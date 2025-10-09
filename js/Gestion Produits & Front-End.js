
/**
 * SCRIPT CENTRAL: Gestionnaire de Catégories
 * Description: Gère la liste des catégories et les informations pour contacter leurs scripts respectifs.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const ADMIN_SPREADSHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg";
const CENTRAL_SHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg"; // IMPORTANT: ID de la feuille centrale

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ABMCY Market [ADMIN]')
      .addItem('📦 Gérer le Catalogue', 'showAdminInterface')
      .addSeparator()
      .addItem('⚙️ Initialiser la feuille centrale', 'setupCentralSheet')
      .addToUi();
}

function showAdminInterface() {
  const html = HtmlService.createHtmlOutputFromFile('AdminInterface').setTitle('Panneau Admin Produits');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Fournit la liste des catégories au front-end (AdminInterface.html).
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'getPublicData';

    if (action === 'invalidateCache') {
      updateCacheVersion();
      return createJsonResponse({ success: true, message: "Cache version updated." });
    }

    if (action === 'getPublicData') {
      const categories = getCategoriesWithProductCounts();
      const cacheVersion = PropertiesService.getScriptProperties().getProperty('CACHE_VERSION') || '1.0';
      return createJsonResponse({ success: true, data: categories, cacheVersion: cacheVersion });
    }

    return createJsonResponse({ success: false, error: "Action non reconnue." });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * NOUVEAU: Se déclenche à chaque modification de la feuille de calcul centrale.
 * Invalide le cache si la feuille "Catégories" est modifiée.
 */
function onEdit(e) {
  const editedSheet = e.range.getSheet();
  if (editedSheet.getName() === "Catégories") {
    Logger.log("Modification détectée sur la feuille 'Catégories'. Invalidation du cache global.");
    updateCacheVersion();
  }
}
/**
 * Récupère la liste simple des catégories.
 */
function getCategories() {
  const ss = SpreadsheetApp.openById(CENTRAL_SHEET_ID);
  const sheet = ss.getSheetByName("Catégories");
  if (!sheet) throw new Error("La feuille 'Catégories' est introuvable.");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * Récupère la liste des catégories depuis la feuille de calcul centrale.
 */
function getCategoriesWithProductCounts() {
  const ss = SpreadsheetApp.openById(CENTRAL_SHEET_ID);
  const sheet = ss.getSheetByName("Catégories");
  if (!sheet) throw new Error("La feuille 'Catégories' est introuvable.");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const categories = data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  // Créer un tableau de requêtes pour UrlFetchApp.fetchAll
  const requests = categories.map(category => ({
    url: `${category.ScriptURL}?action=getProductCount`,
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getIdentityToken()
    }
  }));

  // Exécuter toutes les requêtes en parallèle
  const responses = UrlFetchApp.fetchAll(requests);

  // Récupérer le nombre de produits pour chaque catégorie
  const categoriesWithCounts = categories.map((category, index) => {
    const response = responses[index];
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      category.ProductCount = result.success ? result.count : 'Erreur';
    } else {
      category.ProductCount = 'Erreur API';
    }
    return category;
  });

  return categoriesWithCounts;
}

/**
 * Récupère TOUS les produits de TOUTES les catégories.
 * Appelée par l'UI via google.script.run ou par l'API.
 */
function getAllProducts(categories) {
  // Si les catégories ne sont pas fournies, on les récupère.
  if (!categories) {
    categories = getCategories();
  }

  let allProducts = [];

  // Utilise UrlFetchApp.fetchAll pour appeler tous les scripts de catégorie en parallèle
  const requests = categories.filter(c => c.ScriptURL).map(category => ({
    url: `${category.ScriptURL}?action=getProducts`,
    method: 'get',
    muteHttpExceptions: true
  }));

  const responses = UrlFetchApp.fetchAll(requests);

  responses.forEach((response, index) => {
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      if (result.success && result.data) {
        allProducts = allProducts.concat(result.data);
      }
    } else {
      Logger.log(`Erreur lors de la récupération des produits pour la catégorie via l'admin UI.`);
    }
  });

  return allProducts;
}

/**
 * Met à jour un produit en appelant le script de la bonne catégorie.
 * Appelée par l'UI via google.script.run.
 */
function updateProduct(productData) {
  const categories = getCategoriesWithProductCounts();
  const targetCategory = categories.find(c => c.NomCategorie === productData.Catégorie);

  if (!targetCategory || !targetCategory.ScriptURL) {
    throw new Error(`Catégorie ou URL de script introuvable pour "${productData.Catégorie}"`);
  }

  const payload = {
    action: 'updateProduct',
    data: productData
  };

  const response = UrlFetchApp.fetch(targetCategory.ScriptURL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getIdentityToken()
    }
  });

  return JSON.parse(response.getContentText());
}

/**
 * Déclenche l'archivage des produits épuisés dans toutes les catégories.
 */
function archiveAllOutOfStock() {
  const categories = getCategoriesWithProductCounts();
  const requests = categories.map(category => ({
    url: category.ScriptURL,
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ action: 'archiveOutOfStock' }),
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getIdentityToken()
    }
  }));

  const responses = UrlFetchApp.fetchAll(requests);
  // On pourrait agréger les résultats, mais pour l'instant on lance juste les tâches.
  return { success: true, message: "Tâche d'archivage lancée pour toutes les catégories." };
}

/**
 * NOUVEAU: Met à jour le numéro de version du cache.
 */
function updateCacheVersion() {
  const properties = PropertiesService.getScriptProperties();
  const newVersion = new Date().getTime().toString(); // Timestamp unique comme version
  properties.setProperty('CACHE_VERSION', newVersion);
  Logger.log(`Version du cache mise à jour à : ${newVersion}`);
}

// --- UTILITAIRES ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utilitaire pour convertir une feuille en JSON.
 */
function sheetToJSON(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
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

/**
 * Initialise la feuille de calcul centrale.
 */
function setupCentralSheet() {
  const ss = SpreadsheetApp.openById(CENTRAL_SHEET_ID);
  let sheet = ss.getSheetByName("Catégories");
  if (!sheet) {
    sheet = ss.insertSheet("Catégories");
  }
  sheet.clear();
  const headers = ["IDCategorie", "NomCategorie", "SheetID", "ScriptURL"];
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange("A1:D1").setFontWeight("bold");
  
  // Exemple de remplissage
  sheet.appendRow(["CAT-01", "Smartphones", "ID_SHEET_SMARTPHONES", "URL_SCRIPT_SMARTPHONES"]);
  sheet.appendRow(["CAT-02", "Ordinateurs", "ID_SHEET_ORDINATEURS", "URL_SCRIPT_ORDINATEURS"]);
}