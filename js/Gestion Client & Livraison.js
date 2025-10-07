/**
 * SCRIPT 2: Gestion Client & Livraison (API Publique)
 * Auteur: Gemini Code Assist
 * Description: Gère les comptes clients, commandes, paiements et livraisons.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const CLIENT_SPREADSHEET_ID = "1pGx-1uFUdS61fL4eh4HhQaHQSX6UzmPXiMQY0i71ZpU"; // IMPORTANT: Mettez ici l'ID de votre 2ème Google Sheet
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycby1fT2lUaqCEqMbb7dgKRFRf5_Hh_p0H-WilPtmmO66GQ8RdfybJdCyLkjlAIQ3RMmt/exec"; // URL de l'API Admin
const SCRIPT_NAME = "API-Client";
const CACHE_TTL_SERVER = 21600; // Durée de vie du cache serveur en secondes (6 heures)

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
  const action = e.parameter.action;
  let response;

  // Sécurité : Vérifier l'origine de la requête
  const originHeader = e.headers.origin;
  const allowedOrigin = getAllowedOrigin(originHeader);
  if (!allowedOrigin) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Accès non autorisé depuis cette origine." })).setMimeType(ContentService.MimeType.JSON);
  }

  switch (action) {
    case 'getSiteData':
      response = getSiteData();
      break;
    case 'getRecentOrders': // Ajout pour le tableau de bord
      response = getRecentOrders();
      break;
    default:
      response = { success: false, error: "Action non reconnue." };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', allowedOrigin);
}

function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);
  const action = requestData.action;
  let response;

  // Sécurité : Vérifier l'origine de la requête
  const originHeader = e.headers.origin;
  const allowedOrigin = getAllowedOrigin(originHeader);
  if (!allowedOrigin) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Accès non autorisé depuis cette origine." })).setMimeType(ContentService.MimeType.JSON);
  }

  switch (action) {
    case 'enregistrerCommande':
      response = enregistrerCommande(requestData.data);
      break;
    case 'creerCompteClient':
      response = creerCompteClient(requestData.data);
      break;
    case 'connecterClient':
      response = connecterClient(requestData.data);
      break;
    // Ajoutez d'autres actions client ici (créerCompteClient, etc.)
    default:
      response = { success: false, error: "Action non reconnue." };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', allowedOrigin);
}

function creerCompteClient(data) { // Prend un objet en paramètre
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Utilisateurs", [
    "IDClient", "Nom", "Email", "MotDePasseHash", "Salt", "Adresse", "Téléphone", 
    "DateInscription", "Statut", "Rôle"
  ]);

  // Vérification si l'email existe déjà
  const emailColumn = sheet.getRange("C:C").getValues();
  const emailList = emailColumn.flat(); // Aplatit le tableau 2D en 1D
  if (emailList.includes(data.email)) {
    logAction(ss, `Tentative d'inscription échouée (email déjà utilisé): ${data.email}`);
    return { success: false, error: "Un compte avec cet email existe déjà." };
  }

  // Hachage du mot de passe
  const salt = Utilities.getUuid();
  const passwordHash = hashPassword(data.motDePasse, salt);

  const idClient = "CUST-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  try {
    sheet.appendRow([idClient, data.nom, data.email, passwordHash, salt, data.adresse, data.telephone, new Date(), "Actif", "Client"]);
  } catch (e) {
    logAction(ss, `Erreur lors de l'écriture dans la feuille Utilisateurs: ${e.message}`);
    return { success: false, error: "Erreur interne lors de la création du compte." };
  }
  logAction(ss, `Nouveau compte client créé: ${data.email} (ID: ${idClient})`);
  return { success: true, id: idClient };
}

/**
 * Gère la connexion d'un client.
 */
function connecterClient(data) {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Utilisateurs");
  if (!sheet) return { success: false, error: "Erreur interne: feuille utilisateurs introuvable." };

  const usersData = sheet.getDataRange().getValues();
  const headers = usersData.shift();
  const emailIndex = headers.indexOf("Email");
  const hashIndex = headers.indexOf("MotDePasseHash");
  const saltIndex = headers.indexOf("Salt");

  const userRow = usersData.find(row => row[emailIndex] === data.email);

  if (!userRow) {
    return { success: false, error: "Email ou mot de passe incorrect." };
  }

  const storedHash = userRow[hashIndex];
  const storedSalt = userRow[saltIndex];
  const providedPasswordHash = hashPassword(data.motDePasse, storedSalt);

  if (providedPasswordHash !== storedHash) {
    return { success: false, error: "Email ou mot de passe incorrect." };
  }

  // Connexion réussie, on retourne les informations de l'utilisateur (sans le mot de passe)
  const userObject = {};
  headers.forEach((header, index) => {
    if (header !== "MotDePasseHash" && header !== "Salt") {
      userObject[header] = userRow[index];
    }
  });

  logAction(ss, `Connexion réussie pour: ${data.email}`);
  return {
    success: true,
    user: userObject
  };
}

function enregistrerCommande(data) { // Prend un objet en paramètre
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Commandes", [
    "IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", 
    "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"
  ]);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Sécurité pour la génération d'ID et la mise à jour du stock

  let idCommande;
  try {
    idCommande = "CMD-" + (sheet.getLastRow() + 1) + "-" + new Date().getFullYear();
    sheet.appendRow([idCommande, data.idClient, new Date(), JSON.stringify(data.produits), JSON.stringify(data.quantites), data.total, "En attente de paiement", data.moyenPaiement, data.adresseLivraison, data.notes]);
    
    // Décrémenter le stock en appelant l'API Admin
    const stockUpdatePayload = {
      // La clé secrète est nécessaire si l'API Admin la requiert pour les appels POST
      // Cependant, pour les appels de script à script, l'authentification se fait via le token d'identité.
      // Nous allons donc ajouter une action POST à l'API Admin qui ne nécessite pas de clé secrète mais qui est sécurisée.
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
  
  logAction(ss, `Nouvelle commande enregistrée: ${idCommande} par ${data.idClient}`);
  return { success: true, id: idCommande };
}

function enregistrerPaiement(idCommande, montant, moyenPaiement, statut, transactionID, preuvePaiementURL) {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Paiements", [
    "IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", 
    "TransactionID", "PreuvePaiement"
  ]);

  sheet.appendRow([idCommande, montant, moyenPaiement, statut, new Date(), transactionID, preuvePaiementURL]); // Correction: ajout des paramètres
  
  // Mettre à jour le statut de la commande principale
  // ...
  
  logAction(ss, `Paiement enregistré pour la commande ${idCommande}`);
  return { success: true };
}

// Les fonctions suivantes sont plutôt des actions admin, mais on les laisse ici si un client doit pouvoir y accéder (ex: annuler une livraison)
// Dans l'idéal, elles seraient dans le script admin.
function enregistrerLivraison(idCommande, transporteur, numeroSuivi, dateEstimee) { /* ... */ }
function enregistrerSAV(idCommande, client, motif) { /* ... */ }
function envoyerNotificationClient(idClient, message) { /* ... */ }

// --- FONCTION DE RECUPERATION DES DONNEES (CACHE) ---

function getSiteData() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'site_data_cache';
  const cached = cache.get(cacheKey);

  if (cached != null) {
    Logger.log("Données du site servies depuis le cache serveur.");
    return JSON.parse(cached);
  }

  try {
    Logger.log("Appel de l'API Admin pour obtenir les données publiques...");
    const response = UrlFetchApp.fetch(`${ADMIN_API_URL}?action=getPublicData`, {
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getIdentityToken(),
      },
    });
    const dataString = response.getContentText();
    
    cache.put(cacheKey, dataString, CACHE_TTL_SERVER);
    Logger.log("Données mises en cache sur le serveur.");
    return JSON.parse(dataString);

  } catch (e) {
    Logger.log("Erreur lors de l'appel à l'API Admin: " + e.toString());
    return { error: "Impossible de récupérer les données du site.", details: e.toString() };
  }
}

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
// --- FONCTIONS DE SÉCURITÉ ---

/**
 * Vérifie si l'origine de la requête est dans la liste des origines autorisées.
 * @param {string} originHeader - L'en-tête "Origin" de la requête entrante.
 * @returns {string|null} L'origine autorisée si elle est trouvée, sinon null.
 */
function getAllowedOrigin(originHeader) {
  if (!originHeader) {
    // Si l'en-tête Origin n'est pas présent, on refuse par sécurité.
    return null;
  }

  try {
    const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
    const configSheet = ss.getSheetByName("Configuration");
    const data = configSheet.getDataRange().getValues();
    const headers = data.shift();
    const keyIndex = headers.indexOf("Clé");
    const valueIndex = headers.indexOf("Valeur");

    const originsRow = data.find(row => row[keyIndex] === "ALLOWED_ORIGINS");
    const allowedOrigins = originsRow ? originsRow[valueIndex].split(',').map(s => s.trim()) : [];

    return allowedOrigins.includes(originHeader) ? originHeader : null;
  } catch (e) {
    return null; // En cas d'erreur de lecture, on refuse l'accès.
  }
}

// --- FONCTIONS UTILITAIRES ---

function logAction(spreadsheet, details) {
  const sheet = getOrCreateSheet(spreadsheet, "Logs", ["Date", "Script", "Action"]);
  sheet.appendRow([new Date(), SCRIPT_NAME, details]);
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

/**
 * Convertit les données d'une feuille de calcul en un tableau d'objets JSON.
 */
function sheetToJSON(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) { // Ignore empty header columns
        obj[header] = row[index];
      }
    });
    return obj;
  });
}

// --- FONCTIONS DE LECTURE POUR LE DASHBOARD ---

function getRecentOrders() {
  try {
    const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Commandes");
    if (!sheet) return { success: false, error: "L'onglet Commandes est introuvable." };

    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 19);
    const numRows = lastRow - startRow + 1;

    if (numRows <= 0) return { success: true, data: [] };

    const data = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const orders = data.reverse().map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
    return { success: true, data: orders };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Fonction pour initialiser tous les onglets d'un coup
function initialiserBaseDeDonnees_Client() {
  const ss = SpreadsheetApp.openById(CLIENT_SPREADSHEET_ID);
  getOrCreateSheet(ss, "Utilisateurs", ["IDClient", "Nom", "Email", "MotDePasseHash", "Salt", "Adresse", "Téléphone", "DateInscription", "Statut", "Rôle"]);
  getOrCreateSheet(ss, "Commandes", ["IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"]);
  getOrCreateSheet(ss, "Paiements", ["IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", "TransactionID", "PreuvePaiement"]);
  getOrCreateSheet(ss, "Livraisons", ["IDCommande", "Transporteur", "NuméroSuivi", "DateEstimee", "Statut", "DateLivraison", "Commentaire"]);
  getOrCreateSheet(ss, "SAV", ["IDCommande", "Client", "Motif", "Statut", "Date", "Résolution", "Commentaire"]);
  getOrCreateSheet(ss, "Logs", ["Date", "Script", "Action"]);

  // Création de l'onglet de configuration avec des valeurs par défaut
  const configSheet = getOrCreateSheet(ss, "Configuration", ["Clé", "Valeur", "Description"]);
  const configData = configSheet.getRange("A2:A").getValues().flat();
  if (!configData.includes("ALLOWED_ORIGINS")) {
    // URL de votre site en production et URL pour le développement local.
    configSheet.appendRow(["ALLOWED_ORIGINS", "https://abmcymarket.vercel.app,http://127.0.0.1:5500", "URLs autorisées à appeler l'API (séparées par des virgules)."]);
  }
}
