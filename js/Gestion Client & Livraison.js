/**
 * SCRIPT 2: Gestion Client & Livraison (API Publique)
 * Auteur: Gemini Code Assist
 * Description: Gère les comptes clients, commandes, paiements et livraisons.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const SPREADSHEET_ID = "VOTRE_ID_DE_FEUILLE_DE_CALCUL_ICI"; // Le même ID que le Script 1
const ADMIN_API_URL = "URL_DE_VOTRE_SCRIPT_1_ADMIN_ICI"; // URL de l'API Admin
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
    .withHeaders({'Access-Control-Allow-Origin': '*'}); // Ajout de l'en-tête CORS
}

function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);
  const action = requestData.action;
  let response;

  switch (action) {
    case 'enregistrerCommande':
      response = enregistrerCommande(requestData.data);
      break;
    case 'creerCompteClient':
      response = creerCompteClient(requestData.data);
      break;
    // Ajoutez d'autres actions client ici (créerCompteClient, etc.)
    default:
      response = { success: false, error: "Action non reconnue." };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .withHeaders({'Access-Control-Allow-Origin': '*'}); // Ajout de l'en-tête CORS
}

function creerCompteClient(data) { // Prend un objet en paramètre
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Utilisateurs", [
    "IDClient", "Nom", "Email", "MotDePasse", "Adresse", "Téléphone", 
    "DateInscription", "Statut", "Rôle"
  ]);

  // TODO: Ajouter une vérification pour voir si l'email existe déjà
  // TODO: Hasher le mot de passe avant de le stocker

  const idClient = "CUST-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  sheet.appendRow([idClient, data.nom, data.email, data.motDePasse, data.adresse, data.telephone, new Date(), "Actif", "Client"]);
  
  logAction(ss, `Nouveau compte client créé: ${data.email} (ID: ${idClient})`);
  return { success: true, id: idClient };
}

function enregistrerCommande(data) { // Prend un objet en paramètre
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    // TODO: Décrémenter le stock dans la feuille de calcul Admin.
    // Cela nécessiterait un appel UrlFetchApp vers l'API Admin, ce qui est complexe.
    // Il est plus simple de gérer les stocks manuellement ou via un script de rapprochement nocturne.
  } finally {
    lock.releaseLock();
  }
  
  logAction(ss, `Nouvelle commande enregistrée: ${idCommande} par ${data.idClient}`);
  return { success: true, id: idCommande };
}

function enregistrerPaiement(idCommande, montant, moyenPaiement, statut, transactionID, preuvePaiementURL) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet(ss, "Utilisateurs", ["IDClient", "Nom", "Email", "MotDePasse", "Adresse", "Téléphone", "DateInscription", "Statut", "Rôle"]);
  getOrCreateSheet(ss, "Commandes", ["IDCommande", "IDClient", "Date", "Produits", "Quantités", "Total", "Statut", "MoyenPaiement", "AdresseLivraison", "Notes"]);
  getOrCreateSheet(ss, "Paiements", ["IDCommande", "Montant", "MoyenPaiement", "Statut", "Date", "TransactionID", "PreuvePaiement"]);
  getOrCreateSheet(ss, "Livraisons", ["IDCommande", "Transporteur", "NuméroSuivi", "DateEstimee", "Statut", "DateLivraison", "Commentaire"]);
  getOrCreateSheet(ss, "SAV", ["IDCommande", "Client", "Motif", "Statut", "Date", "Résolution", "Commentaire"]);
  getOrCreateSheet(ss, "Logs", ["Date", "Script", "Action"]);
}
