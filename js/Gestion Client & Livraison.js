/**
 * SCRIPT 2: Gestion Client & Livraison (API Publique)
 * Auteur: Gemini Code Assist
 * Description: Gère les comptes clients, commandes, paiements et livraisons.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const CLIENT_SPREADSHEET_ID = "1pGx-1uFUdS61fL4eh4HhQaHQSX6UzmPXiMQY0i71ZpU"; // IMPORTANT: Mettez ici l'ID de votre 2ème Google Sheet
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbw0dWVwcXOivb9u7ULSkIFeOk54QZQxiBFmtC6UaSzK315nJLk6d9HW4TSHJiweVe-P/execc"; // URL de l'API Admin
const SCRIPT_NAME = "API-Client";

const SHEET_NAMES = {
  USERS: "Utilisateurs",
  ORDERS: "Commandes",
  PAYMENTS: "Paiements",
  LOGS: "Logs"
};

// Liste des URLs autorisées à appeler cette API.
const ALLOWED_ORIGINS = [
  "https://abmcymarket.vercel.app", // URL de production
  "http://127.0.0.1:5500"          // URL de développement local
];

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ABMCY Market [CLIENT]')
      .addItem('📊 Tableau de Bord Commandes', 'showClientInterface')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Configuration')
          .addItem('⚙️ Initialiser les onglets Client', 'initialiserBaseDeDonnees_Client'))
      .addToUi();
}

function showClientInterface() {
  const html = HtmlService.createHtmlOutputFromFile('ClientInterface').setTitle('Tableau de Bord Client');
  SpreadsheetApp.getUi().showSidebar(html);
}
// --- POINTS D'ENTREE DE L'API PUBLIQUE ---

function doGet(e) {
  // doGet peut être utilisé pour des tests de connectivité simples.
  return createJsonResponse({ success: true, message: 'API Client ABMCY Market - Active' });
}

function doPost(e) {
  try {
    // Sécurité : Vérifier l'origine de la requête
    const originHeader = e.headers ? e.headers.origin : undefined;
    if (originHeader && !ALLOWED_ORIGINS.includes(originHeader)) {
      throw new Error("Accès non autorisé depuis cette origine.");
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const data = request.data;

    if (!action) {
      return createJsonResponse({ success: false, error: 'Action non spécifiée.' });
    }

    // Créer un contexte pour optimiser les lectures de feuilles
    const ctx = createRequestContext();

    switch (action) {
      case 'enregistrerCommande':
        return enregistrerCommande(data, ctx);
      case 'creerCompteClient':
        return creerCompteClient(data, ctx);
      case 'connecterClient':
        return connecterClient(data, ctx);
      case 'getRecentOrders': // Pour le tableau de bord interne
        return getRecentOrders(data, ctx);
      default:
        logAction('doPost', { error: 'Action non reconnue', action: action });
        return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` });
    }

  } catch (error) {
    logError(e.postData.contents, error);
    return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` });
  }
}

/**
 * Crée un contexte contenant les données des feuilles fréquemment utilisées.
 * @returns {object} Un objet contenant les données des feuilles.
 */
function createRequestContext() {
  try {
    const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
    return {
      users: ss.getSheetByName(SHEET_NAMES.USERS).getDataRange().getValues(),
      orders: ss.getSheetByName(SHEET_NAMES.ORDERS).getDataRange().getValues(),
    };
  } catch (e) {
    return {}; // En cas d'erreur, renvoie un objet vide.
  }
}

function creerCompteClient(data, ctx) {
  try {
    const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.USERS);

    // OPTIMISATION: Utiliser les données du contexte
    const usersData = ctx.users || sheet.getDataRange().getValues();
    const emailIndex = usersData[0].indexOf("Email");
    const emailList = usersData.slice(1).map(row => row[emailIndex]);

    if (emailList.includes(data.email)) {
      throw new Error("Un compte avec cet email existe déjà.");
    }

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword(data.motDePasse, salt);
    const idClient = "CUST-" + Utilities.getUuid().substring(0, 8).toUpperCase();

    sheet.appendRow([idClient, data.nom, data.email, passwordHash, salt, data.adresse, data.telephone, new Date(), "Actif", "Client"]);
    logAction('creerCompteClient', { email: data.email, id: idClient });
    return createJsonResponse({ success: true, id: idClient });

  } catch (error) {
    logError(JSON.stringify({action: 'creerCompteClient', data}), error);
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * Gère la connexion d'un client.
 */
function connecterClient(data, ctx) {
  // OPTIMISATION: Utiliser les données du contexte
  const usersData = ctx.users || SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS).getDataRange().getValues();
  const headers = usersData.shift();
  const emailIndex = headers.indexOf("Email");
  const hashIndex = headers.indexOf("MotDePasseHash");
  const saltIndex = headers.indexOf("Salt");

  const userRow = usersData.find(row => row[emailIndex] === data.email);

  if (!userRow) {
    return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." });
  }

  const storedHash = userRow[hashIndex];
  const storedSalt = userRow[saltIndex];
  const providedPasswordHash = hashPassword(data.motDePasse, storedSalt);

  if (providedPasswordHash !== storedHash) {    
    logAction('connecterClient', { email: data.email, success: false });
    return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." });
  }

  // Connexion réussie, on retourne les informations de l'utilisateur (sans le mot de passe)
  const userObject = {};
  headers.forEach((header, index) => {
    if (header !== "MotDePasseHash" && header !== "Salt") {
      userObject[header] = userRow[index];
    }
  });

  logAction('connecterClient', { email: data.email, success: true });
  return createJsonResponse({
    success: true,
    user: userObject
  });
}

function enregistrerCommande(data, ctx) {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Sécurité pour la génération d'ID et la mise à jour du stock

  let idCommande;
  try {
    idCommande = "CMD-" + (sheet.getLastRow() + 1) + "-" + new Date().getFullYear();
    sheet.appendRow([idCommande, data.idClient, new Date(), JSON.stringify(data.produits), JSON.stringify(data.quantites), data.total, "En attente de paiement", data.moyenPaiement, data.adresseLivraison, data.notes]);
    
    const stockUpdatePayload = {
      action: 'mettreAJourStock',
      data: data.produits.map((id, index) => ({ idProduit: id, quantite: data.quantites[index] }))
    };

    UrlFetchApp.fetch(ADMIN_API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getIdentityToken(),
      },
      payload: JSON.stringify(stockUpdatePayload)
    });
  } finally {
    lock.releaseLock();
  }
  
  logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
  return createJsonResponse({ success: true, id: idCommande });
}

/**
 * Crée une réponse standard au format JSON pour l'API.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// La fonction enregistrerPaiement et autres fonctions de gestion (livraison, SAV)
// restent conceptuellement les mêmes, mais devraient aussi utiliser le nouveau système de logging.

// La fonction getSiteData n'est plus nécessaire car les données produits sont récupérées directement par le front-end depuis l'API Produits.

/**
 * Fonction de hachage simple pour les mots de passe.
 * @param {string} password Le mot de passe en clair.
 * @param {string} salt Le "grain de sel" unique à l'utilisateur.
 * @returns {string} Le mot de passe haché.
 */
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return Utilities.base64Encode(digest);
}

// --- FONCTIONS UTILITAIRES ---
function logAction(actionName, data) {
  try {
    const logSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
    if (logSheet) {
      logSheet.appendRow([
        new Date(),
        SCRIPT_NAME,
        actionName,
        JSON.stringify(data)
      ]);
    }
  } catch (e) {
    Logger.log(`Échec de l'enregistrement de l'action: ${e.toString()}`);
  }
}

function logError(requestContent, error) {
  try {
    const errorSheet = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
    if (errorSheet) {
      errorSheet.appendRow([new Date(), SCRIPT_NAME, 'ERREUR', `Requête: ${requestContent} | Erreur: ${error.message} | Pile: ${error.stack}`]);
    }
  } catch (e) {
    Logger.log(`Échec de l'enregistrement de l'erreur: ${e.toString()}`);
  }
}

function getOrCreateSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

// --- FONCTIONS DE LECTURE POUR LE DASHBOARD ---

function getRecentOrders(data, ctx) {
  try {
    // OPTIMISATION: Utiliser les données du contexte
    const ordersData = ctx.orders || SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ORDERS).getDataRange().getValues();
    const headers = ordersData[0];
    
    const lastRow = ordersData.length;
    const startRow = Math.max(2, lastRow - 19);
    const numRows = lastRow - startRow + 1;

    if (numRows <= 0) return createJsonResponse({ success: true, data: [] });

    // Extraire les lignes pertinentes des données pré-chargées
    const relevantRows = ordersData.slice(startRow - 1, lastRow);

    const orders = relevantRows.reverse().map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
    return createJsonResponse({ success: true, data: orders });
  } catch (error) {
    logError(JSON.stringify({action: 'getRecentOrders', data}), error);
    return createJsonResponse({ success: false, error: error.message });
  }
}

// Fonction pour initialiser tous les onglets d'un coup
function initialiserBaseDeDonnees_Client() {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  getOrCreateSheet(ss, SHEET_NAMES.USERS, ["IDClient", "Nom", "Email", "MotDePasseHash", "Salt", "Adresse", "Téléphone", "DateInscription", "Statut", "Rôle"]);
  getOrCreateSheet(ss, SHEET_NAMES.ORDERS, ["IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"]);
  getOrCreateSheet(ss, SHEET_NAMES.PAYMENTS, ["IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", "TransactionID", "PreuvePaiement"]);
  getOrCreateSheet(ss, "Livraisons", ["IDCommande", "Transporteur", "NuméroSuivi", "DateEstimee", "Statut", "DateLivraison", "Commentaire"]);
  getOrCreateSheet(ss, "SAV", ["IDCommande", "Client", "Motif", "Statut", "Date", "Résolution", "Commentaire"]);
  getOrCreateSheet(ss, SHEET_NAMES.LOGS, ["Date", "Script", "Action", "Détails"]);
}
