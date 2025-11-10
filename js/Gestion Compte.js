/**
 * @file Gestion Compte - API pour abmcymarket.vercel.app
 * @description API CENTRALE: Gère les clients, commandes, livraisons et notifications.
 *
 * @version 4.0.0 (Fusion des services)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---

// Email pour recevoir les notifications de nouvelles commandes
const ADMIN_EMAIL = "abmcompanysn@gmail.com";

// Noms des feuilles de calcul utilisées
const SHEET_NAMES = {
    USERS: "Utilisateurs",
    ORDERS: "Commandes",
    LOGS: "Logs",
    CONFIG: "Config",
    // NOUVEAU: Ajout des feuilles des autres modules
    LIVRAISONS: "Livraisons",
    NOTIFICATIONS: "Notifications"
};

// Origines autorisées à accéder à cette API.
const ALLOWED_ORIGINS = {
    "https://abmcymarket.vercel.app": true,
    "http://127.0.0.1:5500": true,
    "https://abmcymarket.abmcy.com": true // NOUVEAU: Ajout du nouveau domaine pour corriger l'erreur CORS.
};

// --- POINTS D'ENTRÉE DE L'API WEB (doGet, doPost, doOptions) ---

/**
 * Gère les requêtes HTTP GET.
 * Utilisé principalement pour récupérer des données publiques ou des journaux.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doGet(e) {
    const origin = e.headers ? e.headers.Origin || e.headers.origin : null;
    const action = e.parameter.action;

    if (action === 'getAppLogs') {
        return getAppLogs(e.parameter, origin);
    }

    // NOUVEAU: Action fusionnée depuis Gestion Livraisons
    if (action === 'getDeliveryOptions') {
        const config = getConfig();
        return createJsonResponse({ success: true, data: config.delivery_options || {} }, origin);
    }

    // Réponse par défaut pour un simple test de l'API
    // CORRECTION: N'appelle plus addCorsHeaders
    return createJsonResponse({
      success: true,
      message: 'API Gestion Compte - Active'
    }, origin);
}

/**
 * Gère les requêtes HTTP POST.
 * Point d'entrée principal pour les actions (connexion, inscription, etc.).
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Attendre 30s max
    const origin = e.headers ? (e.headers.Origin || e.headers.origin) : null;

    try {
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("Requête POST invalide ou vide.");
        }

        let request;
        // NOUVEAU: Gestion robuste du corps de la requête.
        // Tente de parser comme text/plain (pour les requêtes simples) puis comme application/json.
        try {
            request = JSON.parse(e.postData.contents);
        } catch (jsonError) {
            throw new Error("Le corps de la requête n'est pas un JSON valide.");
        }
        const { action, data } = request;

        if (!action) {
            return createJsonResponse({ success: false, error: 'Action non spécifiée.' }, origin);
        }

        // Routeur pour les actions POST
        switch (action) {
            case 'creerCompteClient':
                return creerCompteClient(data, origin);
            case 'connecterClient':
                return connecterClient(data, origin);
            case 'getOrderById': // NOUVEAU
                return getOrderById(data, origin);
            case 'updateUserAddress': // NOUVEAU: Pour modifier l'adresse
                return updateUserAddress(data, origin);
            case 'getOrdersByClientId':
                return getOrdersByClientId(data, origin);
            case 'createPaydunyaInvoice': // NOUVEAU: Action pour créer une facture Paydunya
                return createPaydunyaInvoice(data, origin);
            // NOUVEAU: Action fusionnée depuis Gestion Commandes & Notifications
            case 'enregistrerCommandeEtNotifier':
                const orderResult = enregistrerCommande(data, origin);
                const orderData = JSON.parse(orderResult.getContent());
                if (orderData.success) { sendOrderConfirmationEmail(orderData, data); }
                return orderResult;
            case 'logClientEvent':
                return logClientEvent(data, origin);
            // NOUVEAU: Gérer le webhook de Paydunya
            case 'paydunya-webhook':
                // Paydunia envoie des données en `application/x-www-form-urlencoded`
                // donc e.parameter sera utilisé.
                logAction('paydunia-webhook', e.parameter);
                handlePayduniaWebhook(e.parameter);
                return createJsonResponse({ success: true }, origin);
            default:
                logAction('doPost', { error: 'Action non reconnue', action: action });
                return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }, origin);
        }

    } catch (error) {
        logError(e.postData ? e.postData.contents : 'No postData', error, origin);
        return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * Gère les requêtes HTTP OPTIONS pour la pré-vérification CORS.
 * C'est une étape de sécurité obligatoire demandée par le navigateur pour les requêtes POST.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse vide avec les en-têtes CORS.
 */
function doOptions(e) {
  const origin = e.headers ? (e.headers.Origin || e.headers.origin) : null;
  const response = ContentService.createTextOutput(null);
  
  if (ALLOWED_ORIGINS[origin]) {
      response.addHeader('Access-Control-Allow-Origin', origin);
      response.addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  return response;
}

// --- LOGIQUE MÉTIER (ACTIONS DE L'API) ---

/**
 * Crée un nouveau compte client.
 * @param {object} data - Données du client (nom, email, motDePasse).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function creerCompteClient(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getRange(2, 1, sheet.getLastRow(), 3).getValues();
        const emailExists = usersData.some(row => row[1] === data.email);

        if (emailExists) {
            return createJsonResponse({ success: false, error: 'Un compte avec cet email existe déjà.' }, origin);
        }

        const idClient = "CLT-" + new Date().getTime();
        const { passwordHash, salt } = hashPassword(data.motDePasse);

        sheet.appendRow([
            idClient, data.nom, data.email, passwordHash, salt, data.telephone || '',
            data.adresse || '', new Date(), "Actif", "Client"
        ]);

        logAction('creerCompteClient', { email: data.email, id: idClient });
        return createJsonResponse({ success: true, id: idClient }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'creerCompteClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * Gère la connexion d'un client.
 * @param {object} data - Données de connexion (email, motDePasse).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les infos utilisateur si succès.
 */
function connecterClient(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getDataRange().getValues();
        const headers = usersData.shift();
        const emailIndex = headers.indexOf("Email");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const userRow = usersData.find(row => row[emailIndex] === data.email);

        if (!userRow) {
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        const storedHash = userRow[hashIndex];
        const salt = userRow[saltIndex];
        let providedPasswordHash;

        // NOUVEAU: Gérer le cas où le mot de passe envoyé est déjà un hash (pour le rafraîchissement des données)
        if (data.isHash) {
            providedPasswordHash = data.motDePasse;
        } else {
            providedPasswordHash = hashPassword(data.motDePasse, salt).passwordHash;
        }

        if (providedPasswordHash !== storedHash) {
            logAction('connecterClient', { email: data.email, success: false });
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        // Connexion réussie, on retourne les informations de l'utilisateur
        const userObject = headers.reduce((obj, header, index) => {
            // Exclure les informations sensibles
            if (header !== 'PasswordHash' && header !== 'Salt') {
                obj[header] = userRow[index];
            }
            return obj;
        }, {});

        return createJsonResponse({ success: true, user: userObject }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'connecterClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Enregistre une nouvelle commande. Fusionné depuis Gestion Commandes.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'ID de la commande.
 */
function enregistrerCommande(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // Convertir les produits (qui sont des objets) en une chaîne lisible
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');

        // NOUVEAU: Statut initial et étapes de suivi
        const statutInitial = 'Confirmée'; // Le statut global
        const etapeConfirmee = true; // La première étape est toujours vraie
        const etapePreparation = false;
        const etapeExpediee = false;
        const etapeLivree = false;

        sheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, statutInitial, new Date(), etapeConfirmee, etapePreparation, etapeExpediee, etapeLivree,
            data.adresseLivraison, data.moyenPaiement,
            data.notes || ''
        ]);

        logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
        // Retourne plus d'infos pour la notification
        return createJsonResponse({ 
            success: true, 
            id: idCommande, 
            total: data.total, 
            clientId: data.idClient,
            customerEmail: data.customer.email // NOUVEAU: Retourner l'email du client
        }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'enregistrerCommande', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Crée une facture Paydunya et retourne l'URL de paiement.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'URL de paiement.
 */
function createPaydunyaInvoice(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const config = getConfig();
        const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // 1. Enregistrer la commande avec un statut "En attente de paiement"
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');
        orderSheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, "En attente de paiement", new Date(),
            data.adresseLivraison, "Paydunya", data.notes || ''
        ]);

        // 2. Préparer la requête pour l'API Paydunya
        const paydunyaPayload = {
            "store": {
                "name": "ABMCY MARKET",
                "website_url": "https://abmcymarket.vercel.app"
            },
            "invoice": {
                "items": data.produits.map(p => ({
                    "name": p.name,
                    "quantity": p.quantity,
                    "unit_price": p.price,
                    "total_price": p.price * p.quantity
                })),
                "total_amount": data.total,
                "description": `Paiement pour commande #${idCommande} sur ABMCY MARKET`,
                "customer": { // NOUVEAU: Ajout des informations client
                    "name": data.customer.name,
                    "phone": data.customer.phone,
                    "email": data.customer.email
                }
            },
            "actions": {
                "cancel_url": "https://abmcymarket.vercel.app/panier.html",
                "return_url": `https://abmcymarket.vercel.app/confirmation.html?orderId=${idCommande}`,
                "callback_url": ScriptApp.getService().getUrl() + "?action=paydunya-webhook"
            },
            "custom_data": {
                "order_id": idCommande
            }
        };

        const options = {
            'method': 'post',
            'contentType': 'application/json',
            'headers': {
                'PAYDUNYA-MASTER-KEY': config.PAYDUNYA_MASTER_KEY,
                'PAYDUNYA-PRIVATE-KEY': config.PAYDUNYA_PRIVATE_KEY,
                'PAYDUNYA-TOKEN': config.PAYDUNYA_TOKEN
            },
            'payload': JSON.stringify(paydunyaPayload),
            'muteHttpExceptions': true // NOUVEAU: Pour capturer les erreurs 4xx/5xx
        };

        // NOUVEAU: Logique de tentatives multiples pour gérer les erreurs réseau intermittentes
        let response;
        let lastError;
        const maxRetries = 3;

        for (let i = 0; i < maxRetries; i++) {
            try {
                // CORRECTION: Utilisation de l'URL de test (sandbox) pour correspondre aux clés de test.
                response = UrlFetchApp.fetch("https://app.paydunya.com/api/v1/checkout-invoice/create", options);
                // Si la requête réussit, on sort de la boucle
                break;
            } catch (e) {
                lastError = e;
                logAction('Paydunya Fetch Retry', { attempt: i + 1, error: e.message });
                // Attendre 1 seconde avant de réessayer
                if (i < maxRetries - 1) {
                    Utilities.sleep(1000);
                }
            }
        }

        // Si après toutes les tentatives, la réponse est toujours nulle, on lance l'erreur
        if (!response) {
            throw lastError;
        }

        // NOUVEAU: Gérer les réponses qui ne sont pas des succès (ex: 404, 401, 500)
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode !== 200) {
            // Essayer de parser la réponse d'erreur pour un message plus clair
            let errorMessage = `Paydunya a répondu avec le code ${responseCode}.`;
            try {
                const errorJson = JSON.parse(responseText);
                errorMessage = errorJson.response_text || errorJson.message || responseText;
            } catch (e) { /* Ignorer si ce n'est pas du JSON */ }
            throw new Error(errorMessage);
        }

        const responseData = JSON.parse(responseText);
        return createJsonResponse({ success: true, payment_url: responseData.response_text }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'createPaydunyaInvoice', data }), error);
        return createJsonResponse({ success: false, error: `Erreur Paydunya: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Envoie un email de confirmation de commande à l'admin. Fusionné depuis Gestion Notifications.
 * @param {object} orderResult - Le résultat de la fonction enregistrerCommande.
 * @param {object} originalData - Les données originales de la commande contenant les détails des produits.
 */
function sendOrderConfirmationEmail(orderData, originalData) {
    try {
        // 1. Envoyer l'email à l'administrateur
        const adminSubject = `Nouvelle commande #${orderData.id}`;
        const adminBody = `Une nouvelle commande a été passée.\n\nID Commande: ${orderData.id}\nClient: ${orderData.clientId}\nTotal: ${orderData.total} F CFA\nEmail Client: ${orderData.customerEmail}\n\nDétails: ${JSON.stringify(originalData.produits, null, 2)}`;
        MailApp.sendEmail(ADMIN_EMAIL, adminSubject, adminBody);
        logAction('sendAdminConfirmationEmail', { orderId: orderData.id });

        // 2. Envoyer l'email de confirmation au client
        if (orderData.customerEmail) {
            const customerSubject = `Confirmation de votre commande #${orderData.id}`;
            const productDetailsHTML = originalData.produits.map(p => `<li>${p.name} (x${p.quantity}) - ${p.price.toLocaleString('fr-FR')} F CFA</li>`).join('');
            const customerBodyHTML = `
                <h2>Bonjour,</h2>
                <p>Merci pour votre commande sur ABMCY MARKET !</p>
                <p>Nous avons bien reçu votre commande <strong>#${orderData.id}</strong> et nous la préparons pour l'expédition.</p>
                <h3>Récapitulatif :</h3>
                <ul>${productDetailsHTML}</ul>
                <p><strong>Total : ${orderData.total.toLocaleString('fr-FR')} F CFA</strong></p>
                <p>Vous pouvez suivre l'avancement de votre commande à tout moment ici : <a href="https://abmcymarket.abmcy.com/suivi-commande.html?orderId=${orderData.id}">Suivre ma commande</a></p>
                <p>L'équipe ABMCY MARKET.</p>
            `;
            MailApp.sendEmail(orderData.customerEmail, customerSubject, "", { htmlBody: customerBodyHTML });
            logAction('sendCustomerConfirmationEmail', { orderId: orderData.id, email: orderData.customerEmail });
        }
    } catch (error) {
        logError('sendOrderConfirmationEmail', error);
    }
}

/**
 * NOUVEAU: Gère le webhook de confirmation de paiement de Paydunya.
 * @param {object} webhookData - Les données envoyées par Paydunya (e.parameter).
 */
function handlePaydunyaWebhook(webhookData) {
    // Paydunya envoie le statut dans `invoice_token` et les données custom dans `custom_data`
    const status = webhookData.status;

    if (status === 'completed') {
        const customData = JSON.parse(webhookData.custom_data || '{}');
        const orderId = customData.order_id;

        if (orderId) {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
            const data = sheet.getDataRange().getValues();
            const idCommandeIndex = data[0].indexOf("IDCommande");
            const statutIndex = data[0].indexOf("Statut");

            const rowIndex = data.findIndex(row => row[idCommandeIndex] === orderId);

            if (rowIndex > 0) {
                sheet.getRange(rowIndex + 1, statutIndex + 1).setValue("Payée et confirmée");
                logAction('Paiement Réussi', { orderId: orderId, webhookData: webhookData });
            }
        }
    }
}

/**
 * Récupère les commandes d'un client spécifique.
 * @param {object} data - Contient { clientId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec la liste des commandes.
 */
function getOrdersByClientId(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];
        const idClientIndex = headers.indexOf("IDClient");

        const clientOrdersData = allOrders.filter(row => row[idClientIndex] === data.clientId);

        const clientOrders = clientOrdersData.map(row => {
            return headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
        }).reverse(); // Afficher les plus récentes en premier

        return createJsonResponse({ success: true, data: clientOrders }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'getOrdersByClientId', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Récupère une commande spécifique par son ID.
 * @param {object} data - Contient { orderId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les détails de la commande.
 */
function getOrderById(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];
        const idCommandeIndex = headers.indexOf("IDCommande");

        if (!data.orderId) {
            return createJsonResponse({ success: false, error: "L'ID de la commande est manquant." }, origin);
        }

        const orderRow = allOrders.find(row => row[idCommandeIndex] === data.orderId);

        if (!orderRow) {
            return createJsonResponse({ success: false, error: "Commande non trouvée." }, origin);
        }

        const orderObject = headers.reduce((obj, header, index) => {
            obj[header] = orderRow[index];
            return obj;
        }, {});

        return createJsonResponse({ success: true, data: orderObject }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'getOrderById', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Met à jour l'adresse d'un utilisateur.
 * @param {object} data - Contient { clientId, newAddress }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function updateUserAddress(data, origin) {
    try {
        if (!data.clientId || !data.newAddress) {
            throw new Error("ID client ou nouvelle adresse manquant.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers[0];
        const idClientIndex = headers.indexOf("IDClient");
        const addressIndex = headers.indexOf("Adresse");

        if (idClientIndex === -1 || addressIndex === -1) {
            throw new Error("Colonnes 'IDClient' ou 'Adresse' introuvables.");
        }

        const rowIndex = allUsers.findIndex(row => row[idClientIndex] === data.clientId);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Utilisateur non trouvé." }, origin);
        }

        sheet.getRange(rowIndex + 1, addressIndex + 1).setValue(data.newAddress);
        logAction('updateUserAddress', { clientId: data.clientId });
        return createJsonResponse({ success: true, message: "Adresse mise à jour avec succès." }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'updateUserAddress', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}
/**
 * Enregistre un événement envoyé par le client dans la feuille de logs.
 * @param {object} data - L'objet log envoyé par le client.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function logClientEvent(data, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const details = {
            message: data.message,
            url: data.url,
            error: data.error,
            payload: data.payload,
            origin: origin
        };
        logSheet.appendRow([new Date(data.timestamp), 'FRONT-END', data.type, JSON.stringify(details)]);
        return createJsonResponse({ success: true }, origin);
    } catch (e) {
        return createJsonResponse({ success: false, error: e.message }, origin);
    }
}

/**
 * Récupère les 100 derniers journaux pour la page log.html.
 * @param {object} params - Paramètres de la requête GET.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function getAppLogs(params, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const lastRow = logSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 99);
        const numRows = lastRow > 1 ? lastRow - startRow + 1 : 0;
        const logs = (numRows > 0) ? logSheet.getRange(startRow, 1, numRows, 4).getValues() : [];
        return createJsonResponse({ success: true, logs: logs.reverse() }, origin);
    } catch (error) {
        logError('getAppLogs', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

// --- FONCTIONS UTILITAIRES ---

/**
 * Crée une réponse JSON standardisée avec le MimeType.
 * CORRECTION: Ajoute systématiquement l'en-tête CORS à chaque réponse.
 * @param {object} data - L'objet à convertir en JSON.
 * @param {string} [origin] - L'origine de la requête pour l'en-tête CORS.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput.
 */
function createJsonResponse(data, origin) {
    const response = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    // CORRECTION: La vérification doit se faire avec une recherche de clé dans l'objet, pas avec .includes()
    if (origin && ALLOWED_ORIGINS[origin] === true) {
        response.addHeader('Access-Control-Allow-Origin', origin);
    }
    return response;
}

/**
 * Hache un mot de passe avec un sel (salt).
 * @param {string} password - Le mot de passe en clair.
 * @param {string} [salt] - Le sel à utiliser. Si non fourni, un nouveau sera généré.
 * @returns {{passwordHash: string, salt: string}} Le mot de passe haché et le sel utilisé.
 */
function hashPassword(password, salt) {
    const saltValue = salt || Utilities.getUuid();
    const hash = Utilities.computeHmacSha256Signature(password, saltValue);
    const passwordHash = Utilities.base64Encode(hash);
    return { passwordHash, salt: saltValue };
}

/**
 * Journalise une action réussie dans la feuille "Logs".
 * @param {string} action - Le nom de l'action.
 * @param {object} details - Les détails de l'action.
 */
function logAction(action, details) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

/**
 * Journalise une erreur dans la feuille "Logs".
 * @param {string} context - Le contexte où l'erreur s'est produite.
 * @param {Error} error - L'objet erreur.
 * @param {string} [origin] - L'origine de la requête pour plus de contexte.
 */
function logError(context, error, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        
        // NOUVEAU: Obtenir une suggestion de correction basée sur l'erreur.
        const suggestion = getCorrectionSuggestion(error, context);

        const errorDetails = {
            context: context,
            message: error.message,
            stack: error.stack,
            suggestion: suggestion, // NOUVEAU: Ajout de la suggestion au log.
            origin: origin || 'N/A'
        };
        logSheet.appendRow([new Date(), "BACK-END", "ERROR", JSON.stringify(errorDetails)]);

        // NOUVEAU: Surligner la ligne de l'erreur en rouge pour une meilleure visibilité.
        const lastRow = logSheet.getLastRow();
        logSheet.getRange(lastRow, 1, 1, logSheet.getLastColumn()).setBackground('#fce8e6'); // Rouge clair

    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}

/**
 * NOUVEAU: Analyse une erreur et retourne une suggestion de correction.
 * @param {Error} error - L'objet erreur.
 * @param {string} context - Le contexte de l'erreur.
 * @returns {string} Une suggestion textuelle pour corriger le problème.
 */
function getCorrectionSuggestion(error, context) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("action non reconnue")) {
        return "Vérifiez que la valeur 'action' envoyée depuis le front-end (main.js) correspond exactement à un 'case' dans la fonction doPost() du script 'Gestion Compte.js'.";
    }
    if (errorMessage.includes("json.parse")) {
        return "La requête reçue n'est pas un JSON valide. Vérifiez que le front-end envoie bien une chaîne JSON correcte via JSON.stringify() dans le corps de la requête fetch().";
    }
    if (errorMessage.includes("cannot read property") || errorMessage.includes("of undefined")) {
        return `L'objet 'data' reçu est incomplet. Le code a tenté d'accéder à une propriété qui n'existe pas. Vérifiez que l'objet envoyé depuis le front-end pour l'action dans le contexte '${context}' contient toutes les propriétés requises.`;
    }
    if (errorMessage.includes("service invoked too many times")) {
        return "L'API Google a été appelée trop fréquemment. Vérifiez s'il y a des boucles ou des appels excessifs dans le code. Envisagez d'utiliser le cache pour réduire le nombre d'appels.";
    } else {
        return "Erreur générique. Vérifiez les détails du contexte et la trace de la pile (stack trace) pour identifier la source du problème. Assurez-vous que les données envoyées par le client sont conformes à ce que le serveur attend.";
    }
}

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Configuration Module')
      .addItem('🚀 Initialiser le projet', 'setupProject')
      .addToUi();
}

/**
 * Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://abmcymarket.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS",
    allowed_headers: "Content-Type, X-Requested-With", // Ajout pour compatibilité
    delivery_options: {}, // NOUVEAU: Ajout depuis Gestion Livraisons
    allow_credentials: "true",
    PAYDUNYA_MASTER_KEY: "VOTRE_MASTER_KEY",
    PAYDUNYA_PRIVATE_KEY: "VOTRE_PRIVATE_KEY",
    PAYDUNYA_PUBLIC_KEY: "VOTRE_PUBLIC_KEY",
    PAYDUNYA_TOKEN: "VOTRE_TOKEN"
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!configSheet) return defaultConfig;

    const data = configSheet.getDataRange().getValues();
    const config = {};
    data.forEach(row => {
      if (row[0] && row[1]) { config[row[0]] = row[1]; }
    });

    const finalConfig = {
      allowed_origins: config.allowed_origins ? config.allowed_origins.split(',').map(s => s.trim()) : defaultConfig.allowed_origins,
      allowed_methods: config.allowed_methods || defaultConfig.allowed_methods,
      allowed_headers: config.allowed_headers || defaultConfig.allowed_headers,
      allow_credentials: config.allow_credentials === 'true',
      delivery_options: config.delivery_options ? JSON.parse(config.delivery_options) : defaultConfig.delivery_options,
      PAYDUNYA_MASTER_KEY: config.PAYDUNYA_MASTER_KEY || defaultConfig.PAYDUNYA_MASTER_KEY,
      PAYDUNYA_PRIVATE_KEY: config.PAYDUNYA_PRIVATE_KEY || defaultConfig.PAYDUNYA_PRIVATE_KEY,
      PAYDUNYA_PUBLIC_KEY: config.PAYDUNYA_PUBLIC_KEY || defaultConfig.PAYDUNYA_PUBLIC_KEY,
      PAYDUNYA_TOKEN: config.PAYDUNYA_TOKEN || defaultConfig.PAYDUNYA_TOKEN
    };

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600); // Cache pendant 10 minutes
    return finalConfig;
  } catch (e) {
    return defaultConfig;
  }
}

/**
 * Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.USERS]: ["IDClient", "Nom", "Email", "PasswordHash", "Salt", "Telephone", "Adresse", "DateInscription", "Statut", "Role"],
    [SHEET_NAMES.ORDERS]: ["IDCommande", "IDClient", "DetailsProduits", "MontantTotal", "Statut", "Date", "EtapeConfirmee", "EtapePreparation", "EtapeExpediee", "EtapeLivree", "AdresseLivraison", "MoyenPaiement", "Notes"],
    [SHEET_NAMES.LOGS]: ["Timestamp", "Source", "Action", "Détails"],
    [SHEET_NAMES.CONFIG]: ["Clé", "Valeur"],
    [SHEET_NAMES.LIVRAISONS]: ["IDLivraison", "IDCommande", "IDClient", "Adresse", "Statut", "DateMiseAJour", "Transporteur"],
    [SHEET_NAMES.NOTIFICATIONS]: ["IDNotification", "IDCommande", "Type", "Message", "Statut", "Date"]
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange("A1:Z1").setFontWeight("bold");
    }
  });

  // Remplir la configuration par défaut
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  const configData = configSheet.getDataRange().getValues();
  const configMap = new Map(configData.map(row => [row[0], row[1]]));

  const defaultConfigValues = {
    'allowed_origins': 'https://abmcymarket.vercel.app,http://127.0.0.1:5500',
    'allowed_methods': 'POST, GET, OPTIONS',
    'allowed_headers': 'Content-Type, X-Requested-With',
    'allow_credentials': 'true',
    'delivery_options': JSON.stringify({
      "Point de retrait": { "Retrait en magasin": { "Gratuit": 0 } },
      "Dakar": {"Dakar - Plateau":{"Standard":1500,"ABMCY Express":2500},"Rufisque":{"Standard":3000}},"Thiès":{"Thiès Ville":{"Standard":3500}}
    }),
    'PAYDUNYA_MASTER_KEY': 'ZosA6n35-Tyd6-KhH9-TaPR-7ZOFqyBxfjvz',
    'PAYDUNYA_PRIVATE_KEY': 'live_private_3CzZajIPeFrcWxNOvDxyTuan3dm',
    'PAYDUNYA_PUBLIC_KEY': 'live_public_TgcjrnTM5MmbDajbWjZQJdFjuro',
    'PAYDUNYA_TOKEN': 'QSUiqdHl3U7iaXsnoT69'
  };

  Object.entries(defaultConfigValues).forEach(([key, value]) => {
    if (!configMap.has(key)) {
      configSheet.appendRow([key, value]);
    }
  });
  
  CacheService.getScriptCache().remove('script_config'); // Vider le cache pour prendre en compte les changements
  ui.alert("Projet Central initialisé avec succès ! Tous les onglets sont prêts.");
}
