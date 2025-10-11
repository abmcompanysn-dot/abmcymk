/**
 * SCRIPT 2: Gestion Client & Livraison (API Publique)
 * Auteur: Gemini Code Assist
 * Description: Gère les comptes clients, commandes, paiements et livraisons.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const CLIENT_SPREADSHEET_ID = "1pGx-1uFUdS61fL4eh4HhQaHQSX6UzmPXiMQY0i71ZpU"; // IMPORTANT: Mettez ici l'ID de votre 2ème Google Sheet
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbwBtesagcmH6DiK1ARbUnIsmpNdQRFlBMUy1qnEj4hDygAkZOML5ZPKKMLGmMtQRfMk/exec"; // URL de l'API Admin
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

// --- DONNÉES PERSONNELLES PAR DÉFAUT (VISIBLES ET MODIFIABLES) ---
const PERSONAL_DATA = {
  clients: [
      { nom: "Moussa Diop", email: "moussa.diop@example.com", motDePasse: "password123", adresse: "123 Rue de Dakar", telephone: "771234567" },
      { nom: "Awa Fall", email: "awa.fall@example.com", motDePasse: "password123", adresse: "456 Avenue de Thies", telephone: "781234567" },
      { nom: "Ibrahima Sow", email: "ibrahima.sow@example.com", motDePasse: "password123", adresse: "789 Boulevard de St-Louis", telephone: "761234567" },
  ]
};

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ABMCY Market [CLIENT]')
      .addItem('📊 Tableau de Bord Commandes', 'showClientInterface')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Configuration')
          .addItem('⚙️ Initialiser les onglets Client', 'initialiserBaseDeDonnees_Client')
          .addItem('🔄 Mettre à jour le système', 'updateSystem_Client'))
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Testing')
          .addItem('🌱 Remplir avec des clients de test', 'seedPersonalData_Client')
          .addItem('🧹 Vider toutes les données client', 'clearAllData_Client'))
      .addToUi();
}

function showClientInterface() {
  const html = HtmlService.createHtmlOutputFromFile('ClientInterface').setTitle('Tableau de Bord Client');
  SpreadsheetApp.getUi().showSidebar(html);
}
// --- POINTS D'ENTREE DE L'API PUBLIQUE ---

function doGet(e) {
  // doGet peut être utilisé pour des tests de connectivité simples.
  const action = e.parameter.action;
  if (action === 'getFavorites') {
    const clientId = e.parameter.clientId;
    return getFavorites(clientId);
  }
  return createJsonResponse({ success: true, message: 'API Client ABMCY Market - Active' });
}

/**
 * NOUVEAU: Gère les requêtes OPTIONS pour le pré-vol CORS. Essentiel pour les requêtes POST.
 */
function doOptions(e) {
  // Répond simplement avec les en-têtes nécessaires pour la pré-vérification CORS.
  // Le navigateur validera que la méthode POST et le header Content-Type sont autorisés.
  return ContentService.createTextOutput(null)
    .setMimeType(ContentService.MimeType.TEXT)
    .addHeader('Access-Control-Allow-Origin', 'https://abmcymarket.vercel.app') // Autorise toutes les origines pour la pré-vérification
    .addHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doPost(e) {
    const origin = e.headers.Origin || e.headers.origin;
    try {
        // On s'attend à ce que la requête POST ait toujours un contenu.
        // La pré-vérification est gérée par doOptions.
        const request = JSON.parse(e.postData.contents);
        const action = request.action;
        const data = request.data;

    if (!action) {
      return createJsonResponse({ success: false, error: 'Action non spécifiée.' }, origin);
    }

    // Créer un contexte pour optimiser les lectures de feuilles
    const ctx = createRequestContext();

    switch (action) {
      case 'enregistrerCommande':
        return enregistrerCommande(data, ctx, origin);
      case 'creerCompteClient':
        return creerCompteClient(data, ctx, origin);
      case 'connecterClient':
        return connecterClient(data, ctx, origin);
      case 'getRecentOrders': // Pour le tableau de bord interne
        return getRecentOrders(data, ctx);
      case 'updateFavorites': // NOUVELLE ACTION
        return updateFavorites(data, ctx);
      case 'getOrdersByClientId': // NOUVELLE ACTION
        return getOrdersByClientId(data, ctx);
      default:
        logAction('doPost', { error: 'Action non reconnue', action: action }, origin);
        return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }, origin);
    }

  } catch (error) {
    logError(e.postData.contents, error);
    return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }, origin);
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

function creerCompteClient(data, ctx, origin) {
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
    // NOUVEAU: Ajout d'une colonne pour les favoris
    sheet.appendRow([idClient, data.nom, data.email, passwordHash, salt, data.adresse, data.telephone, new Date(), "Actif", "Client", ""]);
    logAction('creerCompteClient', { email: data.email, id: idClient });
    return createJsonResponse({ success: true, id: idClient }, origin);

  } catch (error) {
    logError(JSON.stringify({action: 'creerCompteClient', data}), error);
    return createJsonResponse({ success: false, error: error.message }, origin);
  }
}

/**
 * Gère la connexion d'un client.
 */
function connecterClient(data, ctx, origin) {
  // OPTIMISATION: Utiliser les données du contexte
  const usersData = ctx.users || SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS).getDataRange().getValues();
  const headers = usersData.shift();
  const emailIndex = headers.indexOf("Email");
  const hashIndex = headers.indexOf("MotDePasseHash");
  const saltIndex = headers.indexOf("Salt");

  const userRow = usersData.find(row => row[emailIndex] === data.email);

  if (!userRow) {
    return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
  }

  const storedHash = userRow[hashIndex];
  const storedSalt = userRow[saltIndex];
  const providedPasswordHash = hashPassword(data.motDePasse, storedSalt);

  if (providedPasswordHash !== storedHash) {    
    logAction('connecterClient', { email: data.email, success: false });
    return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
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
  }, origin);
}

function enregistrerCommande(data, ctx, origin) {
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
  return createJsonResponse({ success: true, id: idCommande }, origin);
}

/**
 * NOUVEAU: Met à jour la liste des favoris d'un utilisateur.
 */
function updateFavorites(data, ctx) {
  try {
    const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
    const usersData = ctx.users || sheet.getDataRange().getValues();
    const headers = usersData[0];
    const idIndex = headers.indexOf("IDClient");
    const favoritesIndex = headers.indexOf("Favoris");

    if (favoritesIndex === -1) {
      throw new Error("La colonne 'Favoris' est manquante dans la feuille Utilisateurs.");
    }

    const userRowIndex = usersData.findIndex(row => row[idIndex] === data.clientId);

    if (userRowIndex === -1) {
      throw new Error("Utilisateur non trouvé.");
    }

    // Mettre à jour la cellule des favoris pour cet utilisateur
    sheet.getRange(userRowIndex + 1, favoritesIndex + 1).setValue(data.favorites);
    
    return createJsonResponse({ success: true });
  } catch (error) {
    logError(JSON.stringify({action: 'updateFavorites', data}), error);
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * NOUVEAU: Récupère la liste des favoris d'un utilisateur.
 */
function getFavorites(clientId) {
  const usersData = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.USERS).getDataRange().getValues();
  const headers = usersData.shift();
  const idIndex = headers.indexOf("IDClient");
  const favoritesIndex = headers.indexOf("Favoris");

  const userRow = usersData.find(row => row[idIndex] === clientId);

  const favorites = userRow && userRow[favoritesIndex] ? userRow[favoritesIndex] : "";
  return createJsonResponse({ success: true, favorites: favorites });
}

/**
 * Crée une réponse JSON standard pour l'API, gérant CORS.
 * @param {object} data Les données à retourner en JSON.
 * @param {string} [origin] L'origine de la requête, si disponible.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput avec le contenu JSON et les en-têtes CORS.
 */
function createJsonResponse(data, origin) {
    const output = ContentService.createTextOutput(JSON.stringify(data));
    output.setMimeType(ContentService.MimeType.JSON);

    // 🔐 Gestion CORS : Autoriser l'origine si elle est dans la liste, sinon ne rien retourner pour la sécurité.
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        output.addHeader('Access-Control-Allow-Origin', origin);
    }

    return output;
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

    // CORRECTION: Cette fonction est appelée par une interface (google.script.run)
    // qui attend un objet JavaScript simple, et non un objet TextOutput.
    // On retourne donc directement l'objet. La fonction createJsonResponse est
    // réservée aux vraies réponses d'API (doGet/doPost).
    return { success: true, data: orders };

  } catch (error) {
    logError(JSON.stringify({action: 'getRecentOrders', data}), error);
    // CORRECTION: Retourner un objet simple en cas d'erreur.
    return { success: false, error: error.message };
  }
}

/**
 * NOUVEAU: Récupère les commandes pour un client spécifique.
 * Appelée par la page "Mon Compte".
 * @param {object} data L'objet contenant { clientId }.
 * @param {object} ctx Le contexte de la requête avec les données pré-chargées.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse JSON avec les commandes du client.
 */
function getOrdersByClientId(data, ctx) {
  try {
    const clientId = data.clientId;
    if (!clientId) {
      throw new Error("L'ID du client est manquant.");
    }

    const ordersData = ctx.orders || SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ORDERS).getDataRange().getValues();
    const headers = ordersData[0];
    const idClientIndex = headers.indexOf("IDClient");

    const clientOrders = ordersData
      .slice(1) // Ignorer les en-têtes
      .filter(row => row[idClientIndex] === clientId)
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => obj[header] = row[index]);
        return obj;
      }).reverse(); // Afficher les plus récentes en premier

    // CORRECTION: Comme pour getRecentOrders, cette fonction est appelée par une interface
    // et doit retourner un objet JavaScript simple.
    return { success: true, data: clientOrders };
  } catch (error) {
    // CORRECTION: Retourner un objet simple en cas d'erreur.
    return { success: false, error: error.message };
  }
}

// Fonction pour initialiser tous les onglets d'un coup
function initialiserBaseDeDonnees_Client() {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  getOrCreateSheet(ss, SHEET_NAMES.USERS, ["IDClient", "Nom", "Email", "MotDePasseHash", "Salt", "Adresse", "Téléphone", "DateInscription", "Statut", "Rôle", "Favoris"]);
  getOrCreateSheet(ss, SHEET_NAMES.ORDERS, ["IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"]);
  getOrCreateSheet(ss, SHEET_NAMES.PAYMENTS, ["IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", "TransactionID", "PreuvePaiement"]);
  getOrCreateSheet(ss, "Livraisons", ["IDCommande", "Transporteur", "NuméroSuivi", "DateEstimee", "Statut", "DateLivraison", "Commentaire"]);
  getOrCreateSheet(ss, "SAV", ["IDCommande", "Client", "Motif", "Statut", "Date", "Résolution", "Commentaire"]);
  getOrCreateSheet(ss, SHEET_NAMES.LOGS, ["Date", "Script", "Action", "Détails"]);
}

function seedPersonalData_Client() {
    const clients = PERSONAL_DATA.clients;
    clients.forEach(client => {
        creerCompteClient(client, createRequestContext());
    });
    SpreadsheetApp.getUi().alert('Remplissage terminé !', 'Les clients de test ont été ajoutés.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function clearAllData_Client() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Confirmation', 'Êtes-vous sûr de vouloir supprimer TOUTES les données clients (Utilisateurs, Commandes, Paiements) ? Cette action est irréversible.', ui.ButtonSet.YES_NO);

    if (response == ui.Button.YES) {
        const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
        const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
        const ordersSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
        const paymentsSheet = ss.getSheetByName(SHEET_NAMES.PAYMENTS);

        if (usersSheet) usersSheet.getRange("A2:Z").clearContent();
        if (ordersSheet) ordersSheet.getRange("A2:Z").clearContent();
        if (paymentsSheet) paymentsSheet.getRange("A2:Z").clearContent();

        logAction('clearAllData_Client', { status: 'Données effacées' });
        ui.alert('Opération terminée', 'Toutes les données client ont été effacées.', ui.ButtonSet.OK);
    }
}

function updateSystem_Client() {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  try {
    const sheetConfigs = {
      [SHEET_NAMES.USERS]: ["IDClient", "Nom", "Email", "MotDePasseHash", "Salt", "Adresse", "Téléphone", "DateInscription", "Statut", "Rôle", "Favoris"],
      [SHEET_NAMES.ORDERS]: ["IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"],
      [SHEET_NAMES.PAYMENTS]: ["IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", "TransactionID", "PreuvePaiement"],
      [SHEET_NAMES.LOGS]: ["Date", "Script", "Action", "Détails"]
    };

    Object.entries(sheetConfigs).forEach(([name, expectedHeaders]) => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(expectedHeaders);
        Logger.log(`Onglet '${name}' créé avec les en-têtes.`);
      } else {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
        const currentHeaders = headerRange.getValues()[0];
        const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));

        if (missingHeaders.length > 0) {
          sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
          Logger.log(`Colonnes manquantes ajoutées à '${name}': ${missingHeaders.join(', ')}`);
        }
      }
    });
    ui.alert('Mise à jour du système client terminée avec succès !');
  } catch (e) {
    Logger.log(e);
    ui.alert('Erreur lors de la mise à jour', e.message, ui.ButtonSet.OK);
  }
}
