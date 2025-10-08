
/**
 * SCRIPT 1: Gestion Produits & Front-End (Admin API)
 * Description: Gère le catalogue, les stocks, les catégories et les promotions.
 * A utiliser en interne. Déployer avec accès "Moi uniquement".
 */

// --- CONFIGURATION ---
const ADMIN_SPREADSHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg";
const SCRIPT_NAME = "API-Produits";

const SHEET_NAMES = {
  PRODUCTS: "Produits",
  CATEGORIES: "Catégories",
  ALBUMS: "Albums",
  LOGS: "Logs"
};

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

// --- POINTS D'ENTREE DE L'API ---

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const data = request.data;

    if (!action) {
      return createJsonResponse({ success: false, error: 'Action non spécifiée.' });
    }

    // Le routeur principal pour les actions POST
    switch (action) {
      case 'mettreAJourStock':
        // Cette action est appelée par l'autre script, sécurisée par le token d'identité.
        return mettreAJourStockProduits(data);
      // D'autres actions POST pourraient être ajoutées ici.
      default:
        logAction('doPost', { error: 'Action POST non reconnue', action: action });
        return createJsonResponse({ success: false, error: `Action POST non reconnue: ${action}` });
    }
  } catch (error) {
    logError(e.postData.contents, error);
    return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const data = e.parameter;

    if (!action) {
      return createJsonResponse({ success: true, message: 'API Produits ABMCY Market - Active' });
    }

    // Le routeur principal pour les actions GET
    switch (action) {
      case 'getPublicData':
        return getPublicData();
      case 'getAlbumByProductId':
        return getAlbumByProductId(data);
      default:
        logAction('doGet', { error: 'Action GET non reconnue', action: action });
        return createJsonResponse({ success: false, error: `Action GET non reconnue: ${action}` });
    }
  } catch (error) {
    logError(JSON.stringify(e.parameter), error);
    return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` });
  }
}

// --- FONCTIONS DE MODIFICATION ---
// Ces fonctions sont appelées par l'interface admin via google.script.run

function ajouterProduit(p) {
  try {
    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    const idProduit = "PROD-" + Utilities.getUuid().substring(0, 6).toUpperCase();
    let prixAncien = p.prixActuel;
    if (p.reduction > 0 && p.reduction < 100) {
      prixAncien = p.prixActuel / (1 - (p.reduction / 100));
    }
    sheet.appendRow([idProduit, p.nom, p.categorie, p.prixActuel, prixAncien, p.reduction, p.stock, p.imageURL, p.description, p.tags, true]);
    
    invalidateCache();
    logAction('ajouterProduit', { nom: p.nom, id: idProduit });
    return { success: true, id: idProduit }; // Retourne un objet simple pour google.script.run
  } catch (error) {
    logError(JSON.stringify({action: 'ajouterProduit', data: p}), error);
    return { success: false, error: error.message };
  }
}

function ajouterCategorie(c) {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.CATEGORIES);
  const idCategorie = "CAT-" + Utilities.getUuid().substring(0, 4).toUpperCase();
  sheet.appendRow([idCategorie, c.nom, c.description, c.parentCategorie, c.ordreAffichage]);
  invalidateCache();
  logAction('ajouterCategorie', { nom: c.nom });
  return { success: true, id: idCategorie };
}

function ajouterImageAlbum(data) {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.ALBUMS);
  sheet.appendRow([data.idProduit, data.imageURL, data.legende, data.ordre, data.typeImage]);
  invalidateCache();
  logAction('ajouterImageAlbum', { produit: data.idProduit });
  return { success: true };
}

/**
 * Met à jour le stock pour plusieurs produits (utilisé après une commande).
 * @param {Array<Object>} items - Un tableau d'objets { idProduit, quantite }.
 */
function mettreAJourStockProduits(items) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Verrou pour éviter les conflits si plusieurs commandes arrivent en même temps

  try {
    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    if (!sheet) throw new Error("Feuille des produits introuvable.");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf("IDProduit");
    const stockIndex = headers.indexOf("Stock");

    items.forEach(item => {
      const rowIndex = data.findIndex(row => row[idIndex] === item.idProduit);
      if (rowIndex > 0) { // rowIndex > 0 pour ignorer l'en-tête
        const currentStock = parseInt(data[rowIndex][stockIndex]);
        const newStock = currentStock - item.quantite;
        sheet.getRange(rowIndex + 1, stockIndex + 1).setValue(newStock >= 0 ? newStock : 0);
        logAction('mettreAJourStock', { produit: item.idProduit, ancien: currentStock, nouveau: newStock });
      }
    });
    invalidateCache();
    return createJsonResponse({ success: true });
  } catch (error) {
    logError(JSON.stringify({action: 'mettreAJourStockProduits', data: items}), error);
    return createJsonResponse({ success: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

// --- FONCTIONS DE LECTURE ---

function getPublicData() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'public_site_data';
  const cached = cache.get(cacheKey);

  if (cached != null) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const products = sheetToJSON(ss.getSheetByName(SHEET_NAMES.PRODUCTS));
  const categories = sheetToJSON(ss.getSheetByName(SHEET_NAMES.CATEGORIES));
  const data = { products, categories };
  const dataString = JSON.stringify(data);

  cache.put(cacheKey, dataString, 21600); // Cache de 6 heures
  return ContentService.createTextOutput(dataString).setMimeType(ContentService.MimeType.JSON);
}

function getAlbumByProductId(data) {
  const productId = data.id;
  if (!productId) {
    return createJsonResponse({ success: false, error: "Product ID is missing" });
  }
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const albumSheet = ss.getSheetByName(SHEET_NAMES.ALBUMS);
  const allAlbumImages = sheetToJSON(albumSheet);
  const productImages = allAlbumImages.filter(img => img.IDProduit == productId).sort((a, b) => a.Ordre - b.Ordre);
  return createJsonResponse({ success: true, data: productImages });
}

// --- GESTION DU CACHE ---

/**
 * Invalide le cache des données publiques.
 */
function invalidateCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('public_site_data');
    logAction('invalidateCache', { reason: 'Modification des données' });
  } catch (e) {
    logError('invalidateCache', e);
  }
}


// --- GESTION DU CACHE NOCTURNE ---

/**
 * Déclencheur (Trigger) à exécuter tous les soirs à 23h.
 * Invalide le cache pour forcer un rechargement des données fraîches le lendemain.
 */
function nightlyCacheRefresh() {
  const cache = CacheService.getScriptCache();
  cache.remove('public_site_data');
  logAction('nightlyCacheRefresh', { status: 'Cache invalidé' });
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
  getOrCreateSheet(ss, SHEET_NAMES.PRODUCTS, ["IDProduit", "Nom", "Catégorie", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif"]);
  getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES, ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);

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
    const productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    const categoriesSheet = ss.getSheetByName(SHEET_NAMES.CATEGORIES);

    if (productsSheet) productsSheet.getRange("A2:Z").clearContent();
    if (categoriesSheet) categoriesSheet.getRange("A2:Z").clearContent();

    logAction('clearProductsAndCategories', { status: 'Données effacées' });
    ui.alert('Opération terminée', 'Les données des produits et catégories ont été effacées.', ui.ButtonSet.OK);
  }
}

// --- UTILITAIRES ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logAction(actionName, data) {
  try {
    const logSheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
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
    const errorSheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
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
  getOrCreateSheet(ss, SHEET_NAMES.PRODUCTS, ["IDProduit", "Nom", "Catégorie", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif"]);
  getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES, ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);
  getOrCreateSheet(ss, SHEET_NAMES.ALBUMS, ["IDProduit", "ImageURL", "Légende", "Ordre", "TypeImage"]);
  getOrCreateSheet(ss, "StockAlertes", ["IDProduit", "Seuil", "AlerteEnvoyée", "DateDernièreAlerte", "MéthodeNotification"]);
  getOrCreateSheet(ss, SHEET_NAMES.LOGS, ["Date", "Script", "Action", "Détails"]);
}