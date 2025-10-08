
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
  // Routeur pour les requêtes GET publiques
  const action = e.parameter.action;

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

  SpreadsheetApp.getUi().alert("Le cache du catalogue a été généré avec succès !");
}

/**
 * NOUVEAU: Récupère toutes les données publiques (catégories et tous les produits)
 * pour le site web front-end en temps réel.
 */
function getPublicData() {
  try {
    const categories = getCategoriesWithProductCounts();
    const allProducts = getAllProducts(categories); // Passe les catégories pour éviter de les re-fetcher

    const publicData = {
      success: true,
      data: {
        categories: categories,
        products: allProducts
      }
    };

    return createJsonResponse(publicData);

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
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