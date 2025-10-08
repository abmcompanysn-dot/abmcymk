// --- Template - Gestion Produits par Catégorie ---

const PRODUCT_HEADERS = ["IDProduit", "Nom", "Marque", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif", "Catégorie", "NoteMoyenne", "NombreAvis", "Galerie"];

const PERSONAL_DATA = {
  logoUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
  gallery: Array(5).fill('https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png').join(','),
  getProducts: function(categoryName) {
    let products = [];
    for (let i = 1; i <= 10; i++) {
        const price = (Math.floor(Math.random() * 20) + 5) * 10000;
        products.push({
            nom: `${categoryName} Produit ${i}`, marque: `Marque ${String.fromCharCode(65 + i)}`, categorie: categoryName,
            prixActuel: price, reduction: i % 3 === 0 ? 10 : 0, stock: Math.floor(Math.random() * 50) + 10,
            noteMoyenne: (Math.random() * 1.0 + 4.0).toFixed(1), nombreAvis: Math.floor(Math.random() * 100),
            imageURL: this.logoUrl, galerie: this.gallery,
            description: `Description détaillée pour le produit ${i} de la catégorie ${categoryName}.`,
            tags: `${categoryName.toLowerCase()},nouveau,populaire`
        });
    }
    return products;
  }
};

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Gestion Catégorie')
      .addItem('Initialiser la feuille', 'setupSheet')
      .addItem('Vider le cache de cette catégorie', 'invalidateCategoryCache')
      .addItem('Remplir avec des données de test', 'seedDefaultProducts')
      .addSeparator()
      .addItem('Ajouter un produit', 'showProductAddUI')
      .addToUi();
}

/**
 * Point d'entrée pour l'ajout de produit via une requête POST (appelé par l'interface centrale).
 */
function doPost(e) {
  try {
    // La logique de sécurité CORS n'est généralement pas nécessaire pour POST si l'appel vient d'un autre script Google.
    const request = JSON.parse(e.postData.contents);
    if (request.action === 'ajouterProduit') {
      invalidateCategoryCache(); // Vider le cache après un ajout
      return addProduct(request.data);
    }
    // Future actions like 'updateProduct' or 'deleteProduct' would go here
    return createJsonResponse({ success: false, error: "Action POST non reconnue." });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * Point d'entrée pour les requêtes GET (ex: obtenir le nombre/liste de produits).
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getProductCount') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheets()[0];
      const productCount = sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 0; // Soustraire la ligne d'en-tête
      return createJsonResponse({ success: true, count: productCount });
    }
    if (action === 'getProducts') {
      // Lit les produits directement depuis la feuille à chaque appel (pas de cache)
      const products = sheetToJSON(SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]);
      const responseData = { success: true, data: products };
      return createJsonResponse(responseData);
    }
    return createJsonResponse({ success: false, error: "Action GET non reconnue." });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}


/**
 * Logique partagée pour ajouter un produit à la feuille de calcul.
 */
function addProduct(productData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const newProductId = "PROD-" + Utilities.getUuid().substring(0, 6).toUpperCase();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(PRODUCT_HEADERS);
  }

  const prixAncien = (productData.reduction > 0) ? productData.prixActuel / (1 - (productData.reduction / 100)) : productData.prixActuel;
  
  const newRow = [
    newProductId, productData.nom, productData.marque, productData.prixActuel, prixAncien,
    productData.reduction, productData.stock, productData.imageURL, productData.description,
    productData.tags, true, productData.categorie || sheet.getName(), 0, 0, productData.galerie
  ];
  
  sheet.appendRow(newRow);
  return createJsonResponse({ success: true, id: newProductId });
}

/**
 * Fonction appelée par l'interface HTML dédiée à cette catégorie (via google.script.run).
 */
function addProductFromUI(productData) {
  try {
    const response = addProduct(productData);
    // google.script.run attend un objet simple, pas une réponse ContentService
    return JSON.parse(response.getContent());
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Affiche l'interface d'ajout de produit dans une barre latérale.
 */
function showProductAddUI() {
  const html = HtmlService.createHtmlOutputFromFile('ProductAddInterface').setTitle('Ajouter un Produit');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Prépare la feuille de calcul avec les en-têtes corrects.
 */
function setupSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.clear();
  sheet.appendRow(PRODUCT_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length).setFontWeight("bold");
  SpreadsheetApp.getUi().alert("Feuille initialisée avec succès !");
}

/**
 * Renvoie le nom de la feuille active pour l'afficher dans l'UI.
 */
function getCategoryName() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName();
}

/**
 * Vide le cache pour cette catégorie spécifique.
 */
function invalidateCategoryCache() {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = `products_${SpreadsheetApp.getActiveSpreadsheet().getId()}`;
    cache.remove(cacheKey);
    Logger.log(`Cache vidé pour la clé : ${cacheKey}`);
  } catch (e) { Logger.log(`Erreur lors du vidage du cache : ${e.message}`); }
}

/**
 * Remplit la feuille avec 10 produits de test.
 */
function seedDefaultProducts() {
  const categoryName = getCategoryName();
  const products = PERSONAL_DATA.getProducts(categoryName);

  products.forEach(productData => {
    addProduct(productData);
  });

  invalidateCategoryCache(); // Vider le cache après avoir ajouté les produits
  SpreadsheetApp.getUi().alert('10 produits de test ont été ajoutés avec succès !');
}

/**
 * Crée une réponse JSON standard.
 */
function createJsonResponse(data) {
  const jsonResponse = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
    
  return jsonResponse;
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
