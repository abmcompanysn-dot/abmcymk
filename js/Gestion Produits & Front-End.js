
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
      .addItem('🔄 Générer le cache du catalogue', 'buildFullCatalogCache')
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
  // Routeur pour les requêtes GET publiques
  const action = e.parameter.action;

  if (action === 'getCatalogVersion') {
    // C'est le nouveau point d'entrée pour la version du catalogue
    return getCatalogVersion();
  }

  if (action === 'getPublicData') {
    // C'est le nouveau point d'entrée pour votre site web
    return getPublicData();
  }

  // L'appel existant pour le panneau d'administration
  try {
    const categories = getCategoriesWithProductCounts(); // Appel à la nouvelle fonction
    return createJsonResponse({ success: true, data: categories });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
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
 * NOUVEAU: Renvoie la version actuelle du catalogue depuis un fichier sur Drive.
 */
function getCatalogVersion() {
  try {
    const fileName = "catalog_version.json";
    const files = DriveApp.getFilesByName(fileName);
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    } else {
      return createJsonResponse({ success: true, version: null }); // Pas encore de version
    }
  } catch (error) {
    return createJsonResponse({ success: false, error: `Erreur lors de la lecture de la version : ${error.message}` });
  }
}

/**
 * NOUVEAU: Récupère toutes les données publiques (catégories et tous les produits)
 * pour le site web front-end.
 * Cette fonction est maintenant très rapide car elle lit un fichier pré-généré.
 */
function getPublicData() {
  try {
    const fileName = "public_catalog.json";
    const files = DriveApp.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      // On renvoie directement le contenu JSON
      return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Si le fichier n'existe pas, on le génère une première fois.
      buildFullCatalogCache();
      // Et on ré-essaie de le servir.
      const newFiles = DriveApp.getFilesByName(fileName);
      if (newFiles.hasNext()) {
        const newFile = newFiles.next();
        const newContent = newFile.getBlob().getDataAsString();
        return ContentService.createTextOutput(newContent).setMimeType(ContentService.MimeType.JSON);
      }
      throw new Error("Le fichier de catalogue n'a pas pu être généré.");
    }
  } catch (error) {
    return createJsonResponse({ success: false, error: `Erreur lors de la lecture du cache : ${error.message}` });
  }
}

/**
 * NOUVEAU: Construit le catalogue complet et le sauvegarde dans un fichier sur Google Drive.
 * C'est la fonction "lente" à exécuter manuellement.
 */
function buildFullCatalogCache() {
  const categories = getCategoriesWithProductCounts();
  const allProducts = getAllProducts(categories); // Passe les catégories pour éviter de les re-fetcher

  const publicData = {
    success: true, // On inclut le statut de succès directement dans le fichier
    data: {
      categories: categories,
      products: allProducts
    }
  };

  saveToDrive("public_catalog.json", JSON.stringify(publicData));
  
  // NOUVEAU: Sauvegarder la version du catalogue
  const versionData = { version: new Date().getTime() };
  saveToDrive("catalog_version.json", JSON.stringify(versionData));

  SpreadsheetApp.getUi().alert("Le cache du catalogue a été généré avec succès !");
}

/**
 * Récupère TOUS les produits de TOUTES les catégories.
 * Appelée par l'UI via google.script.run.
 */
function getAllProducts() {
  const categories = getCategoriesWithProductCounts(); // On a besoin des URLs
  let allProducts = [];

  const requests = categories.map(category => ({
    url: `${category.ScriptURL}?action=getProducts`,
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getIdentityToken()
    }
  }));

  const responses = UrlFetchApp.fetchAll(requests);

  responses.forEach((response, index) => {
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      if (result.success && result.data) {
        allProducts = allProducts.concat(result.data);
      }
    } else {
      Logger.log(`Erreur lors de la récupération des produits pour la catégorie ${categories[index].NomCategorie}`);
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
 * Sauvegarde une chaîne de caractères dans un fichier sur Google Drive, en écrasant l'ancien si besoin.
 */
function saveToDrive(fileName, content) {
  const files = DriveApp.getFilesByName(fileName);
  let file;
  if (files.hasNext()) {
    // Si le fichier existe, on le met à jour
    file = files.next();
    file.setContent(content);
  } else {
    // Sinon, on le crée
    file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);
  }
  return file;
}

// --- UTILITAIRES ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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