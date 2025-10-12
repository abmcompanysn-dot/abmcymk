/**
 * @file Gestion Client & Livraison - API pour abmcymarket.vercel.app
 * @description Gère l'authentification des clients, l'enregistrement des commandes,
 * la journalisation des événements et la récupération des données spécifiques au client.
 *
 * @version 2.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---

// ⚠️ REMPLACEZ PAR L'ID DE VOTRE FEUILLE GOOGLE SHEETS
const CLIENT_SPREADSHEET_ID = "1pGx-1uFUdS61fL4eh4HhQaHQSX6UzmPXiMQY0i71ZpU";

// Noms des feuilles de calcul utilisées
const SHEET_NAMES = {
    USERS: "Utilisateurs",
    ORDERS: "Commandes",
    LOGS: "Logs",
    PRODUCTS: "Produits" // Ajout pour certaines logiques
};

// 🔐 Origines autorisées à accéder à cette API.
const ALLOWED_ORIGINS = [
    "https://abmcymarket.vercel.app"
    // Ajoutez d'autres origines si nécessaire, ex: "http://localhost:5500" pour les tests locaux
];

// --- POINTS D'ENTRÉE DE L'API WEB (doGet, doPost, doOptions) ---

/**
 * Gère les requêtes HTTP GET.
 * Utilisé principalement pour récupérer des données publiques ou des journaux.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doGet(e) {
    const action = e.parameter.action;

    if (action === 'getAppLogs') {
        return getAppLogs(e.parameter);
    }

    // Réponse par défaut pour un simple test de l'API
    return createJsonResponse({
      success: true,
      message: 'API Gestion Compte - Active'
    });
}

/**
 * Gère les requêtes HTTP OPTIONS pour la pré-vérification CORS.
 * C'est une étape de sécurité obligatoire demandée par le navigateur.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse vide avec les en-têtes CORS.
 */
function doOptions(e) {
    const origin = e && e.headers ? e.headers.Origin || e.headers.origin : null;
    const response = ContentService.createTextOutput(null);
    
    // On autorise si l'origine est dans notre liste blanche
    if (ALLOWED_ORIGINS.includes(origin)) {
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
        const sheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getRange(2, 1, sheet.getLastRow(), 3).getValues();
        const emailExists = usersData.some(row => row[1] === data.email);

        if (emailExists) {
            return createJsonResponse({ success: false, error: 'Un compte avec cet email existe déjà.' }, origin);
        }

        const idClient = "CLT-" + new Date().getTime();
        const { passwordHash, salt } = hashPassword(data.motDePasse);

        sheet.appendRow([
            idClient, data.nom, data.email, passwordHash, salt,
            data.adresse || '', data.telephone || '', new Date(), "Actif", "Client"
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
        const sheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS);
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
        const { passwordHash: providedPasswordHash } = hashPassword(data.motDePasse, salt);

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
 * NOUVEAU: Enregistre une nouvelle commande dans la feuille "Commandes".
 * @param {object} data - Les données de la commande (idClient, produits, total, etc.).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'ID de la commande.
 */
function enregistrerCommande(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Attendre jusqu'à 30 secondes pour éviter les conflits

    try {
        const sheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // Les produits et quantités sont des tableaux, on les convertit en chaînes de caractères.
        const produitsStr = Array.isArray(data.produits) ? data.produits.join(', ') : data.produits;
        const quantitesStr = Array.isArray(data.quantites) ? data.quantites.join(', ') : data.quantites;

        sheet.appendRow([
            idCommande,
            data.idClient,
            new Date(),
            produitsStr,
            quantitesStr,
            data.total,
            "En attente", // Statut initial
            data.adresseLivraison,
            data.moyenPaiement,
            data.notes || ''
        ]);

        logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
        return createJsonResponse({ success: true, id: idCommande }, origin);
    } finally {
        lock.releaseLock();
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
        const sheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift();
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
 * Enregistre un événement envoyé par le client dans la feuille de logs.
 * @param {object} data - L'objet log envoyé par le client.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function logClientEvent(data, origin) {
    try {
        const logSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
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
function getAppLogs(params) {
    try {
        const logSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const lastRow = logSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 99);
        const numRows = lastRow > 1 ? lastRow - startRow + 1 : 0;
        const logs = (numRows > 0) ? logSheet.getRange(startRow, 1, numRows, 4).getValues() : [];
        return createJsonResponse({ success: true, logs: logs.reverse() });
    } catch (error) {
        logError('getAppLogs', error);
        return createJsonResponse({ success: false, error: error.message });
    }
}

// --- FONCTIONS UTILITAIRES ---

/**
 * Crée une réponse JSON standardisée avec les en-têtes CORS.
 * @param {object} data - L'objet à convertir en JSON.
 * @param {string} [origin] - L'origine de la requête pour l'en-tête CORS.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput.
 */
function createJsonResponse(data, origin) {
    const response = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);

    // Pour les requêtes POST, on valide l'origine. Pour les GET, on peut être plus permissif.
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
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
        const logSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

/**
 * Journalise une erreur dans la feuille "Logs".
 * @param {string} context - Le contexte où l'erreur s'est produite.
 * @param {Error} error - L'objet erreur.
 */
function logError(context, error) {
    try {
        const logSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const errorDetails = {
            context: context,
            message: error.message,
            stack: error.stack
        };
        logSheet.appendRow([new Date(), "BACK-END", "ERROR", JSON.stringify(errorDetails)]);
    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}
