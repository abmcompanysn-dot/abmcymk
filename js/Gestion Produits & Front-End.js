
/**
 * SCRIPT 1: Gestion Produits & Front-End (Admin API)
 * Description: Gère le catalogue, les stocks, les catégories et les promotions.
 * A utiliser en interne. Déployer avec accès "Moi uniquement".
 */

// --- CONFIGURATION ---
const ADMIN_SPREADSHEET_ID = "VOTRE_ID_DE_FEUILLE_DE_CALCUL_ICI";
const SCRIPT_NAME_ADMIN = "Admin-Produits";
const ADMIN_SECRET_KEY = "CHANGER_CETTE_CLE_SECRETE_POUR_QUELQUE_CHOSE_DE_COMPLEXE";

// --- GESTIONNAIRE DE MENU ---

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ABMCY Market [ADMIN]')
      .addItem('📦 Gérer le Catalogue', 'showAdminInterface')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Configuration')
          .addItem('⚙️ Initialiser les onglets Admin', 'initialiserBaseDeDonnees_Admin'))
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Testing')
          .addItem('🌱 Remplir avec des produits de test', 'seedProducts')
          .addItem('🧹 Vider les produits et catégories', 'clearProductsAndCategories'))
      .addToUi();
}

function showAdminInterface() {
  const html = HtmlService.createHtmlOutputFromFile('AdminInterface').setTitle('Panneau Admin Produits');
  SpreadsheetApp.getUi().showSidebar(html);
}

// --- POINT D'ENTREE POST ---
function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);
  
  // Sécurité simple: vérifier une clé secrète
  if (requestData.secretKey !== ADMIN_SECRET_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Accès non autorisé." })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = requestData.action;
  let response;

  switch (action) {
    case 'ajouterProduit':
      response = ajouterProduit(requestData.data);
      break;
    case 'ajouterCategorie':
      response = ajouterCategorie(requestData.data);
      break;
    // Ajoutez d'autres actions admin ici
    default:
      response = { success: false, error: "Action admin non reconnue." };
  }

  // Invalider le cache après chaque modification
  const cache = CacheService.getScriptCache();
  cache.remove('public_site_data');
  Logger.log("Cache serveur invalidé suite à une action admin.");

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// --- POINT D'ENTREE GET (pour la communication inter-services) ---
function doGet(e) {
  // Ce point d'entrée est destiné à être appelé par le Script 2 (Client)
  // Il est sécurisé car le script est déployé avec accès "Moi uniquement",
  // et seul un autre script Google appartenant au même utilisateur peut l'appeler avec un token d'authentification.
  const action = e.parameter.action;
  if (action === 'getPublicData') {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'public_site_data';
    const cached = cache.get(cacheKey);

    if (cached != null) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const products = sheetToJSON(ss.getSheetByName("Produits"));
    const categories = sheetToJSON(ss.getSheetByName("Catégories"));
    const data = { products, categories };
    const dataString = JSON.stringify(data);

    cache.put(cacheKey, dataString, 21600); // Cache de 6 heures
    return ContentService.createTextOutput(dataString).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getAlbumByProductId') {
    const productId = e.parameter.id;
    if (!productId) {
      return ContentService.createTextOutput(JSON.stringify({error: "Product ID is missing"})).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const albumSheet = ss.getSheetByName("Albums");
    const allAlbumImages = sheetToJSON(albumSheet);
    const productImages = allAlbumImages.filter(img => img.IDProduit == productId).sort((a, b) => a.Ordre - b.Ordre);
    return ContentService.createTextOutput(JSON.stringify(productImages)).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: "Action non autorisée"})).setMimeType(ContentService.MimeType.JSON);
}


// --- FONCTIONS DE MODIFICATION ---

function ajouterProduit(p) {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Produits", ["IDProduit", "Nom", "Catégorie", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif"]);
  const idProduit = "PROD-" + Utilities.getUuid().substring(0, 6).toUpperCase();
  let prixAncien = p.prixActuel;
  if (p.reduction > 0) {
    prixAncien = p.prixActuel / (1 - (p.reduction / 100));
  }
  sheet.appendRow([idProduit, p.nom, p.categorie, p.prixActuel, prixAncien, p.reduction, p.stock, p.imageURL, p.description, p.tags, true]);
  logAction(ss, `Produit ajouté: ${p.nom} (ID: ${idProduit})`);
  return { success: true, id: idProduit };
}

function ajouterCategorie(c) {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Catégories", ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);
  const idCategorie = "CAT-" + Utilities.getUuid().substring(0, 4).toUpperCase();
  sheet.appendRow([idCategorie, c.nom, c.description, c.parentCategorie, c.ordreAffichage]);
  logAction(ss, `Catégorie ajoutée: ${c.nom}`);
  return { success: true, id: idCategorie };
}

function ajouterImageAlbum(data) {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, "Albums", ["IDProduit", "ImageURL", "Légende", "Ordre", "TypeImage"]);
  sheet.appendRow([data.idProduit, data.imageURL, data.legende, data.ordre, data.typeImage]);
  logAction(ss, `Image ajoutée à l'album du produit ${data.idProduit}`);
  return { success: true };
}

function mettreAJourStock(idProduit, nouveauStock) {
  // Implémentation...
  logAction(SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID), `Stock mis à jour pour ${idProduit}: ${nouveauStock}`);
  return { success: true };
}

function générerRéductionAutomatique(idProduit, pourcentage) {
  // Implémentation...
  logAction(SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID), `Réduction de ${pourcentage}% appliquée au produit ${idProduit}`);
  return { success: true };
}


// --- GESTION DU CACHE NOCTURNE ---

/**
 * Déclencheur (Trigger) à exécuter tous les soirs à 23h.
 * Invalide le cache pour forcer un rechargement des données fraîches le lendemain.
 */
function nightlyCacheRefresh() {
  const cache = CacheService.getScriptCache();
  cache.remove('public_site_data');
  Logger.log("TRIGGER 23h: Cache serveur nocturne invalidé avec succès.");
}

/**
 * Fonction pour créer le déclencheur horaire programmatiquement.
 * À exécuter une seule fois manuellement depuis l'éditeur Apps Script.
 */
function createNightlyTrigger() {
  // Supprime les anciens triggers pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'nightlyCacheRefresh') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  // Crée un nouveau trigger qui exécute 'nightlyCacheRefresh' tous les jours entre 23h et minuit.
  ScriptApp.newTrigger('nightlyCacheRefresh').timeBased().atHour(23).everyDays(1).create();
  Logger.log("Déclencheur nocturne (23h) créé/mis à jour avec succès.");
}

// --- FONCTIONS DE TEST ---

/**
 * Librairie de données de test pour les produits et catégories, intégrée directement.
 */
function getSampleProducts() {
  return [
    // nom, categorie, prixActuel, reduction, stock, imageURL, description, tags
    ['Smartphone X-Pro', 'Électronique', 450000, 15, 50, 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png', 'Un smartphone ultra-performant avec un écran OLED.', 'téléphone,mobile,tech'],
    ['Laptop UltraBook Z', 'Électronique', 780000, 10, 30, 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png', 'Léger, puissant et une autonomie incroyable.', 'ordinateur,laptop,tech'],
    ['Casque Audio Pro', 'Accessoires', 85000, 20, 100, 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png', 'Réduction de bruit active et son haute-fidélité.', 'audio,casque,musique'],
    ['T-shirt "Code Life"', 'Vêtements', 15000, 0, 200, 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png', 'Le t-shirt parfait pour les développeurs passionnés.', 'vêtement,mode,geek'],
    ['Jean Slim Fit', 'Vêtements', 42000, 5, 150, 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png', 'Un jean confortable et stylé pour toutes les occasions.', 'vêtement,mode,jean']
  ];
}

function getSampleCategories() {
  return [
    // nom, description, parentCategorie, ordreAffichage
    ['Électronique', 'Tous nos produits high-tech.', '', 1],
    ['Vêtements', 'Dernières tendances de la mode.', '', 2],
    ['Accessoires', 'Complétez votre style.', 'Électronique', 3],
    ['Promotions', 'Toutes nos offres spéciales.', '', 99]
  ];
}

function seedProducts() {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const productsSheet = getOrCreateSheet(ss, "Produits", ["IDProduit", "Nom", "Catégorie", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif"]);
  const categoriesSheet = getOrCreateSheet(ss, "Catégories", ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);

  const sampleProducts = getSampleProducts();
  sampleProducts.forEach(p => {
    ajouterProduit({
      nom: p[0], categorie: p[1], prixActuel: p[2], reduction: p[3], stock: p[4], 
      imageURL: p[5], description: p[6], tags: p[7]
    });
  });

  const sampleCategories = getSampleCategories();
  sampleCategories.forEach(c => {
    ajouterCategorie({
      nom: c[0], description: c[1], parentCategorie: c[2], ordreAffichage: c[3]
    });
  });

  SpreadsheetApp.getUi().alert('Remplissage terminé !', 'Les produits et catégories de test ont été ajoutés.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function clearProductsAndCategories() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirmation', 'Êtes-vous sûr de vouloir supprimer TOUS les produits et catégories ? Cette action est irréversible.', ui.ButtonSet.YES_NO);

  if (response == ui.Button.YES) {
    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const productsSheet = ss.getSheetByName("Produits");
    const categoriesSheet = ss.getSheetByName("Catégories");

    if (productsSheet) productsSheet.getRange("A2:Z").clearContent();
    if (categoriesSheet) categoriesSheet.getRange("A2:Z").clearContent();

    logAction(ss, "Produits et catégories vidés.");
    ui.alert('Opération terminée', 'Les données des produits et catégories ont été effacées.', ui.ButtonSet.OK);
  }
}

// --- UTILITAIRES ---

function logAction(spreadsheet, details) {
  const sheet = getOrCreateSheet(spreadsheet, "Logs", ["Date", "Script", "Action"]);
  sheet.appendRow([new Date(), SCRIPT_NAME_ADMIN, details]);
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

function sheetToJSON(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index];
      }
    });
    return obj;
  });
}

function initialiserBaseDeDonnees_Admin() {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  getOrCreateSheet(ss, "Produits", ["IDProduit", "Nom", "Catégorie", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif"]);
  getOrCreateSheet(ss, "Catégories", ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);
  getOrCreateSheet(ss, "Albums", ["IDProduit", "ImageURL", "Légende", "Ordre", "TypeImage"]);
  getOrCreateSheet(ss, "StockAlertes", ["IDProduit", "Seuil", "AlerteEnvoyée", "DateDernièreAlerte", "MéthodeNotification"]);
  getOrCreateSheet(ss, "Logs", ["Date", "Script", "Action"]);
}