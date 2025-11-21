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

    // NOUVEAU: Action pour servir la page du tableau de bord administrateur
    if (action === 'showAdminDashboard') {
      // Note: Idéalement, ajoutez une vérification ici pour s'assurer que seul un admin peut voir cette page.
      return HtmlService.createHtmlOutputFromFile('admin_dashboard')
          .setTitle('Tableau de Bord Admin - ABMCY MARKET')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
            case 'getAllUsers': // NOUVEAU: Pour le panneau admin
                return getAllUsers(data, origin);
            case 'updateUserProfile': // NOUVEAU: Pour modifier le profil
                return updateUserProfile(data, origin);
            // NOUVEAU: Actions pour le panneau d'administration des paiements
            case 'getPaymentSettings':
                return getPaymentSettings(data, origin);
            case 'savePaymentSettings':
                return savePaymentSettings(data, origin);
            case 'getRecentTransactions': // NOUVEAU: Pour le tableau de bord admin
                return getRecentTransactions(data, origin);
            case 'exportOrdersToCSV': // NOUVEAU: Pour exporter les commandes
                return exportOrdersToCSV(origin);
            case 'getSalesDataForChart': // NOUVEAU: Pour le graphique des ventes
                return getSalesDataForChart(origin);
            case 'updateOrderStatus': // NOUVEAU: Pour modifier le statut d'une commande
                return updateOrderStatus(data, origin);
            case 'updateUserAddress': // NOUVEAU: Pour modifier l'adresse
                return updateUserAddress(data, origin);
            case 'getOrdersByClientId':
                return getOrdersByClientId(data, origin);
            case 'createPaydunyaInvoice': // NOUVEAU: Action pour créer une facture Paydunya
                return createPaydunyaInvoice(data, origin);
            // NOUVEAU: Action pour le paiement à la livraison
            case 'enregistrerCommandeEtNotifier':
                const orderResult = enregistrerCommande(data, origin);
                const orderData = JSON.parse(orderResult.getContent());
                if (orderData.success) { sendOrderConfirmationEmail(orderData, data, "cod"); }
                return orderResult;
            // NOUVEAU: Action générique qui décide quel agrégateur utiliser
            case 'createMobileMoneyInvoice':
                return createMobileMoneyInvoice(data, origin);
            case 'logClientEvent':
                return logClientEvent(data, origin);
            // NOUVEAU: Gérer le webhook de Paydunya
            case 'paydunya-webhook':
                // Paydunia envoie des données en `application/x-www-form-urlencoded`
                // donc e.parameter sera utilisé.
                logAction('paydunia-webhook', e.parameter);
                handlePaydunyaWebhook(e); // On passe l'événement complet 'e'
                return createJsonResponse({ success: true }, origin);
            // NOUVEAU: Gérer le webhook de PawaPay
            case 'pawapay-webhook':
                logAction('pawapay-webhook', e.postData.contents);
                handlePawaPayWebhook(e);
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
            // Comportement normal pour une connexion depuis le formulaire de login
            providedPasswordHash = hashPassword(data.motDePasse, salt).passwordHash;
        }

        if (providedPasswordHash !== storedHash) {
            logAction('connecterClient', { email: data.email, success: false });
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        // Connexion réussie, on retourne les informations de l'utilisateur
        // AMÉLIORATION SÉCURITÉ: Ne retourner que les champs nécessaires et non sensibles.
        // On construit manuellement l'objet au lieu de boucler pour éviter de fuiter des données.
        const userObject = {
            IDClient: userRow[headers.indexOf("IDClient")],
            Nom: userRow[headers.indexOf("Nom")],
            Email: userRow[headers.indexOf("Email")],
            Telephone: userRow[headers.indexOf("Telephone")],
            Adresse: userRow[headers.indexOf("Adresse")]
            // On ne retourne JAMAIS le PasswordHash ou le Salt.
        };

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
        // AMÉLIORATION: Enregistrer la commande avec la même structure que les autres, y compris les étapes de suivi.
        // Toutes les étapes sont à 'false' car le paiement n'est pas encore confirmé.
        orderSheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, "En attente de paiement", new Date(), 
            false, false, false, false, // EtapeConfirmee, EtapePreparation, EtapeExpediee, EtapeLivree
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
        sendPaymentFailureEmail('Paydunya', error, data); // NOUVEAU: Alerte email
        return createJsonResponse({ success: false, error: `Erreur Paydunya: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Crée une requête de paiement PawaPay.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'URL de paiement ou une erreur.
 */
function createPawaPayRequest(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const config = getConfig();
        if (config.PAWAPAY_ACTIVE !== 'true') {
            throw new Error("PawaPay n'est pas activé.");
        }

        const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // 1. Enregistrer la commande avec un statut "En attente de paiement"
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');
        orderSheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, "En attente de paiement (PawaPay)", new Date(),
            false, false, false, false, // Etapes de suivi
            data.adresseLivraison, "PawaPay", data.notes || ''
        ]);

        // 2. Préparer la requête pour l'API PawaPay
        // Note: L'URL fournie était pour les "payouts". Pour recevoir un paiement, on utilise généralement "deposits".
        const PAWAPAY_API_URL = "https://api.sandbox.pawapay.io/deposits";
        const depositId = Utilities.getUuid(); // ID unique pour cette transaction

        const pawaPayload = {
            depositId: depositId,
            amount: String(data.total), // PawaPay attend un string pour le montant
            currency: "XOF",
            country: "SEN", // Code ISO du pays (Sénégal)
            reason: `Paiement commande ${idCommande}`,
            depositor: {
                type: "PERSON",
                address: { country: "SEN" },
                firstName: data.customer.name.split(' ')[0],
                lastName: data.customer.name.split(' ').slice(1).join(' ') || data.customer.name.split(' ')[0]
            },
            // L'URL de callback doit être enregistrée dans votre dashboard PawaPay
            // PawaPay enverra une notification à cette URL après la transaction.
            // Nous ajoutons l'ID de commande pour le suivi.
            "notificationUrl": {
                "url": ScriptApp.getService().getUrl() + "?action=pawapay-webhook"
            },
            metadata: {
                orderId: idCommande,
                clientId: data.idClient
            }
        };

        const options = {
            'method': 'post',
            'contentType': 'application/json',
            'headers': {
                'Authorization': 'Bearer ' + config.PAWAPAY_API_KEY // PawaPay utilise un Bearer Token
            },
            'payload': JSON.stringify(pawaPayload),
            'muteHttpExceptions': true
        };

        const response = UrlFetchApp.fetch(PAWAPAY_API_URL, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();
        const responseData = JSON.parse(responseText);

        if (responseCode >= 200 && responseCode < 300 && responseData.redirectUrl) {
            // La requête a réussi, PawaPay a retourné une URL de redirection
            return createJsonResponse({ success: true, payment_url: responseData.redirectUrl }, origin);
        } else {
            // Erreur de l'API PawaPay
            throw new Error(responseData.error || responseData.message || `Erreur PawaPay: ${responseText}`);
        }

    } catch (error) {
        logError(JSON.stringify({ action: 'createPawaPayRequest', data }), error);
        sendPaymentFailureEmail('PawaPay', error, data); // NOUVEAU: Alerte email
        return createJsonResponse({ success: false, error: `Erreur PawaPay: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Action générique qui décide quel agrégateur utiliser.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'URL de paiement ou une erreur.
 */
function createMobileMoneyInvoice(data, origin) {
    const config = getConfig();
    const isPaydunyaActive = String(config.PAYDUNYA_ACTIVE).toLowerCase() === 'true';
    const isPawaPayActive = String(config.PAWAPAY_ACTIVE).toLowerCase() === 'true';

    // Logique de sélection améliorée
    if (config.DEFAULT_AGGREGATOR === 'paydunya' && isPaydunyaActive) {
        return createPaydunyaInvoice(data, origin);
    } else if (config.DEFAULT_AGGREGATOR === 'pawapay' && isPawaPayActive) {
        return createPawaPayRequest(data, origin);
    } else if (isPaydunyaActive) { // Si le défaut n'est pas dispo, on prend le premier actif
        return createPaydunyaInvoice(data, origin);
    } else if (isPawaPayActive) {
        return createPawaPayRequest(data, origin);
    }
    return createJsonResponse({ success: false, error: "Aucun service de paiement mobile n'est actif." }, origin);
}
/**
 * NOUVEAU: Envoie un email de confirmation de commande à l'admin. Fusionné depuis Gestion Notifications.
 * @param {object} orderResult - Le résultat de la fonction enregistrerCommande.
 * @param {object} originalData - Les données originales de la commande contenant les détails des produits.
 * @param {string} type - Le type de confirmation ('cod' pour cash on delivery, 'payment' pour paiement en ligne).
 */
function sendOrderConfirmationEmail(orderData, originalData, type) {
    try {
        // 1. Envoyer l'email à l'administrateur
        const adminSubject = `Nouvelle commande #${orderData.id} (${type === 'cod' ? 'Paiement à la livraison' : 'Payée en ligne'})`;
        const adminBody = `Une nouvelle commande a été passée.\n\nID Commande: ${orderData.id}\nClient: ${orderData.clientId}\nTotal: ${orderData.total} F CFA\nEmail Client: ${orderData.customerEmail}\n\nDétails: ${JSON.stringify(originalData.produits, null, 2)}`;
        MailApp.sendEmail(ADMIN_EMAIL, adminSubject, adminBody);
        logAction('sendAdminConfirmationEmail', { orderId: orderData.id, type: type });

        // 2. Envoyer l'email de confirmation au client
        if (orderData.customerEmail) {
            const customerSubject = `Confirmation de votre commande #${orderData.id}`;
            const productDetailsHTML = originalData.produits.map(p => `<li>${p.name} (x${p.quantity}) - ${p.price.toLocaleString('fr-FR')} F CFA</li>`).join('');
            const customerBodyHTML = `
                <h2>Bonjour,</h2>
                <p>Merci pour votre commande sur ABMCY MARKET !</p>
                <p>Nous avons bien reçu votre commande <strong>#${orderData.id}</strong> et nous la préparons pour l'expédition.</p>
                <h3>Récapitulatif de votre commande :</h3>
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
 * NOUVEAU: Gère le webhook (IPN) de confirmation de paiement de PawaPay.
 * @param {object} e - L'objet événement complet de la requête POST.
 */
function handlePawaPayWebhook(e) {
    const webhookPayload = e.postData.contents;
    const headers = e.headers;

    try {
        // --- Étape 1: Vérification de sécurité ---
        const signature = headers['x-pawa-signature'];
        const config = getConfig();

        // PawaPay signe le corps de la requête (payload) avec votre clé secrète.
        const expectedSignature = Utilities.base64Encode(
            Utilities.computeHmacSha256Signature(webhookPayload, config.PAWAPAY_WEBHOOK_SECRET)
        );

        if (signature !== expectedSignature) {
            logAction('PAWAPAY_IPN_SECURITY_FAIL', { received: signature, expected: expectedSignature, payload: webhookPayload });
            throw new Error("Signature de webhook PawaPay invalide. Tentative de fraude possible.");
        }

        // --- Étape 2: Traitement de la notification ---
        const webhookData = JSON.parse(webhookPayload);
        const status = webhookData.status;
        const metadata = webhookData.metadata || {};
        const orderId = metadata.orderId;

        if (!orderId) {
            throw new Error("ID de commande manquant dans les métadonnées du webhook PawaPay.");
        }

        if (status === 'COMPLETED') {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
            const sheetData = sheet.getDataRange().getValues();
            const sheetHeaders = sheetData[0];
            const idCommandeIndex = sheetHeaders.indexOf("IDCommande");
            const statutIndex = sheetHeaders.indexOf("Statut");
            const etapeConfirmeeIndex = sheetHeaders.indexOf("EtapeConfirmee");

            const rowIndex = sheetData.findIndex(row => row[idCommandeIndex] === orderId);

            if (rowIndex > 0) {
                // Mettre à jour le statut et l'étape de confirmation
                sheet.getRange(rowIndex + 1, statutIndex + 1).setValue("Payée et confirmée");
                sheet.getRange(rowIndex + 1, etapeConfirmeeIndex + 1).setValue(true);

                logAction('PAWAPAY_PAIEMENT_REUSSI', { orderId: orderId, webhookData: webhookData });

                // --- Étape 3: Envoyer l'email de confirmation de paiement au client ---
                const customerEmail = webhookData.depositor.emailAddress;
                const totalAmount = webhookData.amount;
                
                if (customerEmail) {
                    const emailSubject = `Confirmation de paiement pour votre commande #${orderId}`;
                    const emailBody = `
                        <h2>Bonjour,</h2>
                        <p>Nous confirmons avoir bien reçu votre paiement de <strong>${Number(totalAmount).toLocaleString('fr-FR')} F CFA</strong> pour la commande <strong>#${orderId}</strong>.</p>
                        <p>Votre commande est maintenant confirmée et va être préparée pour l'expédition.</p>
                        <p>Vous pouvez suivre son avancement ici : <a href="https://abmcymarket.abmcy.com/suivi-commande.html?orderId=${orderId}">Suivre ma commande</a></p>
                        <p>Merci de votre confiance.</p>
                        <p>L'équipe ABMCY MARKET.</p>
                    `;
                    MailApp.sendEmail(customerEmail, emailSubject, "", { htmlBody: emailBody });
                    logAction('PAWAPAY_EMAIL_CONFIRMATION', { orderId: orderId, email: customerEmail });
                }
            }
        } else {
            logAction('PAWAPAY_PAIEMENT_NON_COMPLETE', { orderId: orderId, status: status, webhookData: webhookData });
            sendPaymentFailureEmail('PawaPay Webhook', new Error(`Statut: ${status}`), { orderId: orderId, webhookData: webhookData }); // NOUVEAU
        }
    } catch (error) {
        logError('handlePawaPayWebhook', error, webhookPayload);
    }
}

/**
 * NOUVEAU: Gère le webhook (IPN) de confirmation de paiement de Paydunya.
 * @param {object} e - L'objet événement complet de la requête POST.
 */
function handlePaydunyaWebhook(e) {
    const webhookData = e.parameter;
    const headers = e.headers;

    try {
        // --- Étape 1: Vérification de sécurité ---
        const signature = headers['Paydunya-Signature'];
        const invoiceToken = webhookData.data.invoice.token;
        const config = getConfig();

        const expectedSignature = Utilities.base64Encode(
            Utilities.computeHmacSha256Signature(invoiceToken, config.PAYDUNYA_MASTER_KEY)
        );

        if (signature !== expectedSignature) {
            logAction('IPN_SECURITY_FAIL', { received: signature, expected: expectedSignature, data: webhookData });
            throw new Error("Signature de webhook invalide. Tentative de fraude possible.");
        }

        // --- Étape 2: Traitement de la notification ---
        const status = webhookData.data.status;
        const customData = webhookData.data.custom_data || {};
        const orderId = customData.order_id;

        if (!orderId) {
            throw new Error("ID de commande manquant dans les données du webhook.");
        }

        if (status === 'completed') {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
            const sheetData = sheet.getDataRange().getValues();
            const sheetHeaders = sheetData[0];
            const idCommandeIndex = sheetHeaders.indexOf("IDCommande");
            const statutIndex = sheetHeaders.indexOf("Statut");
            const etapeConfirmeeIndex = sheetHeaders.indexOf("EtapeConfirmee");

            const rowIndex = sheetData.findIndex(row => row[idCommandeIndex] === orderId);

            if (rowIndex > 0) {
                // Mettre à jour le statut et l'étape de confirmation
                sheet.getRange(rowIndex + 1, statutIndex + 1).setValue("Payée et confirmée");
                sheet.getRange(rowIndex + 1, etapeConfirmeeIndex + 1).setValue(true);

                logAction('PAIEMENT_REUSSI', { orderId: orderId, webhookData: webhookData });

                // --- Étape 3: Envoyer l'email de confirmation de paiement au client ---
                const customerEmail = webhookData.data.customer.email;
                const totalAmount = webhookData.data.invoice.total_amount;
                
                if (customerEmail) {
                    const emailSubject = `Confirmation de paiement pour votre commande #${orderId}`;
                    const emailBody = `
                        <h2>Bonjour,</h2>
                        <p>Nous confirmons avoir bien reçu votre paiement de <strong>${Number(totalAmount).toLocaleString('fr-FR')} F CFA</strong> pour la commande <strong>#${orderId}</strong>.</p>
                        <p>Votre commande est maintenant confirmée et va être préparée pour l'expédition.</p>
                        <p>Vous pouvez suivre son avancement ici : <a href="https://abmcymarket.abmcy.com/suivi-commande.html?orderId=${orderId}">Suivre ma commande</a></p>
                        <p>Merci de votre confiance.</p>
                        <p>L'équipe ABMCY MARKET.</p>
                    `;
                    MailApp.sendEmail(customerEmail, emailSubject, "", { htmlBody: emailBody });
                    logAction('EMAIL_CONFIRMATION_PAIEMENT', { orderId: orderId, email: customerEmail });
                }
            }
        } else {
            logAction('PAIEMENT_NON_COMPLETE', { orderId: orderId, status: status, webhookData: webhookData });
            sendPaymentFailureEmail('Paydunya Webhook', new Error(`Statut: ${status}`), { orderId: orderId, webhookData: webhookData }); // NOUVEAU
        }
    } catch (error) {
        logError('handlePaydunyaWebhook', error, e.postData.contents);
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
 * NOUVEAU: Récupère les paramètres de paiement depuis la feuille Config.
 * @param {object} data - Données de la requête (inutilisé ici).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les paramètres.
 */
function getPaymentSettings(data, origin) {
    try {
        const config = getConfig(); // Utilise la fonction existante qui lit depuis la feuille Config
        // On retourne directement les clés nécessaires au tableau de bord
        const settings = {
            DEFAULT_AGGREGATOR: config.DEFAULT_AGGREGATOR || 'paydunya',
            PAYDUNYA_ACTIVE: String(config.PAYDUNYA_ACTIVE).toLowerCase() === 'true',
            PAWAPAY_ACTIVE: String(config.PAWAPAY_ACTIVE).toLowerCase() === 'true',
            PAYDUNYA_MASTER_KEY: config.PAYDUNYA_MASTER_KEY,
            PAYDUNYA_PRIVATE_KEY: config.PAYDUNYA_PRIVATE_KEY,
            PAYDUNYA_TOKEN: config.PAYDUNYA_TOKEN,
            PAYDUNYA_PUBLIC_KEY: config.PAYDUNYA_PUBLIC_KEY,
            PAWAPAY_API_KEY: config.PAWAPAY_API_KEY,
            PAWAPAY_WEBHOOK_SECRET: config.PAWAPAY_WEBHOOK_SECRET,
        };
        return createJsonResponse({ success: true, data: settings }, origin);
    } catch (error) {
        logError('getPaymentSettings', error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Sauvegarde les paramètres des agrégateurs de paiement dans la feuille Config.
 * @param {object} data - Les nouveaux paramètres.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function savePaymentSettings(data, origin) {
    try {
        // On pourrait ajouter une vérification d'administrateur ici.
        const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONFIG);
        const configData = configSheet.getDataRange().getValues();

        const settingsToUpdate = {
            'DEFAULT_AGGREGATOR': data.DEFAULT_AGGREGATOR,
            'PAYDUNYA_ACTIVE': data.DEFAULT_AGGREGATOR === 'paydunya', // Met à jour automatiquement
            'PAWAPAY_ACTIVE': data.DEFAULT_AGGREGATOR === 'pawapay',   // Met à jour automatiquement
            'PAYDUNYA_MASTER_KEY': data.PAYDUNYA_MASTER_KEY,
            'PAYDUNYA_PRIVATE_KEY': data.PAYDUNYA_PRIVATE_KEY,
            'PAYDUNYA_TOKEN': data.PAYDUNYA_TOKEN,
            'PAWAPAY_API_KEY': data.PAWAPAY_API_KEY,
            'PAWAPAY_WEBHOOK_SECRET': data.PAWAPAY_WEBHOOK_SECRET
        };

        Object.entries(settingsToUpdate).forEach(([key, value]) => {
            const rowIndex = configData.findIndex(row => row[0] === key);
            if (rowIndex > -1) {
                // Mettre à jour la valeur dans la colonne 2 (index 1)
                configSheet.getRange(rowIndex + 1, 2).setValue(value);
            } else {
                // Ajouter la nouvelle clé/valeur si elle n'existe pas
                configSheet.appendRow([key, value]);
            }
        });

        // Invalider le cache pour que les prochaines lectures prennent en compte les changements
        CacheService.getScriptCache().remove('script_config');
        logAction('savePaymentSettings', { user: 'admin' });
        return createJsonResponse({ success: true, message: "Paramètres sauvegardés." }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'savePaymentSettings', data }), error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Récupère les transactions de paiement récentes pour le tableau de bord.
 * @param {object} data - Données de la requête (inutilisé ici).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les transactions.
 */
function getRecentTransactions(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];

        const paymentMethodIndex = headers.indexOf("MoyenPaiement");

        // Filtrer pour ne garder que les paiements en ligne, prendre les 50 derniers
        const onlinePayments = allOrders.filter(row => 
            row[paymentMethodIndex] === 'Paydunya' || row[paymentMethodIndex] === 'PawaPay'
        ).slice(-50); // Prend les 50 dernières transactions

        const transactions = onlinePayments.map(row => {
            return headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
        }).reverse(); // Afficher les plus récentes en premier

        return createJsonResponse({ success: true, data: transactions }, origin);

    } catch (error) {
        logError('getRecentTransactions', error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Envoie un email d'alerte en cas d'échec de paiement.
 * @param {string} provider - Le nom du fournisseur de paiement (ex: "Paydunya", "PawaPay").
 * @param {Error} error - L'objet erreur capturé.
 * @param {object} orderContext - Les données de la commande ou du contexte de l'erreur.
 */
function sendPaymentFailureEmail(provider, error, orderContext) {
    try {
        const subject = `⚠️ Alerte: Échec de paiement ${provider}`;
        
        // Formatter le contexte de la commande pour l'email
        let contextHtml = '<h3>Contexte de la commande :</h3><ul>';
        if (orderContext.data && orderContext.data.customer) {
            contextHtml += `<li>Client: ${orderContext.data.customer.name} (${orderContext.data.customer.email})</li>`;
            contextHtml += `<li>Montant: ${orderContext.data.total} F CFA</li>`;
        } else if (orderContext.orderId) {
            contextHtml += `<li>ID Commande: ${orderContext.orderId}</li>`;
        } else {
            contextHtml += '<li>Contexte de la commande non disponible.</li>';
        }
        contextHtml += '</ul>';

        const body = `
            <h2>Une tentative de paiement via ${provider} a échoué.</h2>
            <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
            <p><strong>Message d'erreur :</strong> ${error.message}</p>
            <hr>
            ${contextHtml}
            <p>Veuillez consulter les logs pour plus de détails.</p>
        `;
        MailApp.sendEmail(ADMIN_EMAIL, subject, "", { htmlBody: body });
        logAction('sendPaymentFailureEmail', { provider: provider, error: error.message });
    } catch (e) {
        logError('sendPaymentFailureEmail', e);
    }
}

/**
 * NOUVEAU: Exporte toutes les commandes en format CSV.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON contenant les données CSV.
 */
function exportOrdersToCSV(origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const data = sheet.getDataRange().getValues();

        // Fonction utilitaire pour s'assurer que les champs CSV sont correctement formatés
        const toCsvField = (field) => {
            let value = field === null || field === undefined ? '' : String(field);
            // Si la valeur contient une virgule, des guillemets ou un retour à la ligne, on l'entoure de guillemets
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                // On double les guillemets existants à l'intérieur du champ
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }
            return value;
        };

        // Convertir chaque ligne en une ligne CSV
        const csvContent = data.map(row => row.map(toCsvField).join(',')).join('\n');

        logAction('exportOrdersToCSV', { user: 'admin' });

        // Renvoyer les données CSV dans une réponse JSON
        // Le téléchargement sera géré côté client
        return createJsonResponse({ success: true, csvData: csvContent }, origin);

    } catch (error) {
        logError('exportOrdersToCSV', error, origin);
        return createJsonResponse({ success: false, error: `Erreur lors de l'export CSV: ${error.message}` }, origin);
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
 * NOUVEAU: Met à jour les informations d'un profil utilisateur.
 * @param {object} data - Contient { clientId, updatedData: { Nom, Telephone, Adresse } }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function updateUserProfile(data, origin) {
    try {
        if (!data.clientId || !data.updatedData) {
            throw new Error("Données de mise à jour incomplètes.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift() || [];
        
        const idClientIndex = headers.indexOf("IDClient");
        const rowIndex = allUsers.findIndex(row => row[idClientIndex] === data.clientId);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Utilisateur non trouvé." }, origin);
        }

        // Mettre à jour les colonnes spécifiques
        const rowToUpdate = rowIndex + 2; // +1 pour l'index 0, +1 pour la ligne d'en-tête
        const { Nom, Telephone, Adresse } = data.updatedData;

        const nomIndex = headers.indexOf("Nom");
        const telIndex = headers.indexOf("Telephone");
        const adresseIndex = headers.indexOf("Adresse");

        if (nomIndex > -1 && Nom !== undefined) sheet.getRange(rowToUpdate, nomIndex + 1).setValue(Nom);
        if (telIndex > -1 && Telephone !== undefined) sheet.getRange(rowToUpdate, telIndex + 1).setValue(Telephone);
        if (adresseIndex > -1 && Adresse !== undefined) sheet.getRange(rowToUpdate, adresseIndex + 1).setValue(Adresse);

        logAction('updateUserProfile', { clientId: data.clientId });
        return createJsonResponse({ success: true, message: "Profil mis à jour avec succès." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'updateUserProfile', data }), error);
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
      .addItem('🔑 Ouvrir le Tableau de Bord Admin', 'openAdminDashboardInSidebar') // NOUVEAU
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
    [SHEET_NAMES.NOTIFICATIONS]: ["IDNotification", "IDCommande", "Type", "Message", "Statut", "Date"],
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
    'PAYDUNYA_TOKEN': 'QSUiqdHl3U7iaXsnoT69',
    'DEFAULT_AGGREGATOR': 'paydunya', // NOUVEAU
    'PAYDUNYA_ACTIVE': 'true', // NOUVEAU
    'PAWAPAY_ACTIVE': 'false', // NOUVEAU
    'PAWAPAY_API_KEY': 'VOTRE_CLE_API_PAWAPAY', // NOUVEAU
    'PAWAPAY_WEBHOOK_SECRET': 'VOTRE_SECRET_WEBHOOK_PAWAPAY', // NOUVEAU
  };

  Object.entries(defaultConfigValues).forEach(([key, value]) => {
    if (!configMap.has(key)) {
      configSheet.appendRow([key, value]);
    }
  });
  
  CacheService.getScriptCache().remove('script_config'); // Vider le cache pour prendre en compte les changements
  ui.alert("Projet Central initialisé avec succès ! Tous les onglets sont prêts.");
}

/**
 * NOUVEAU: Ouvre le tableau de bord administrateur dans une barre latérale de la feuille de calcul.
 */
function openAdminDashboardInSidebar() {
  // CORRECTION: Charge le fichier HTML directement depuis le projet Apps Script.
  const html = HtmlService.createHtmlOutputFromFile('admin_dashboard')
    .setWidth(500)
    .setTitle('Tableau de Bord Admin');
  SpreadsheetApp.getUi().showSidebar(html);
}
