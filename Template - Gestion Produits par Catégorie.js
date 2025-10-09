// --- Template - Gestion Produits par Catégorie ---
const CENTRAL_ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbw6Y2VBKFXli2aMvbfCaWeMx0Ws29axaG3BIm2oMiFh1-qpc-hkSRIcrQbQ0JmXRQFB/exec"; // URL du script central

// NOUVEAU: Configuration centrale des attributs par catégorie
const CATEGORY_CONFIG = {
  "Chaussures": ["Pointure", "Couleur", "Matière", "Type", "Genre", "Semelle", "Usage"],
  "Vêtements": ["Taille", "Coupe", "Matière", "Couleur", "Genre", "Saison", "Style"],
  "Sacs": ["Volume", "Type", "Matière", "Couleur", "Usage", "Genre"],
  "Montres": ["Type", "Bracelet", "Cadran", "Marque", "Étanchéité", "Genre"],
  "Lunettes": ["Type", "Forme", "Couleur", "Protection UV", "Matière", "Genre"],
  "Bijoux": ["Type", "Métal", "Pierre", "Taille", "Genre", "Finition"],
  "Accessoires": ["Dimensions", "Compatibilité", "Matière", "Usage", "Couleur", "Poids"],
  "Beauté & soins": ["Type de peau", "Ingrédients", "Format", "Parfum", "Volume", "Genre"],
  "Parfums": ["Famille olfactive", "Notes", "Intensité", "Format", "Genre"],
  "Électronique": ["Marque", "Modèle", "Capacité", "Connectivité", "Compatibilité", "Garantie"],
  "Informatique": ["Processeur", "RAM", "Stockage", "Écran", "OS", "Connectivité", "Usage"],
  "Gaming": ["Plateforme", "Genre", "Éditeur", "PEGI", "Multijoueur", "Édition"],
  "Livres": ["Auteur", "Genre", "Langue", "Format", "Pages", "ISBN", "Édition"],
  "Musique": ["Artiste", "Genre", "Format", "Durée", "Label"],
  "Films & séries": ["Titre", "Genre", "Format", "Langue", "Durée", "Réalisateur", "Acteurs"],
  "Jeux & jouets": ["Âge", "Type", "Matière", "Dimensions", "Marque", "Éducatif/créatif"],
  "Sport & fitness": ["Usage", "Taille", "Poids", "Niveau", "Matière", "Pliable", "Intensité"],
  "Meubles": ["Dimensions", "Matière", "Style", "Usage", "Couleur", "Montage"],
  "Décoration": ["Type", "Matière", "Couleur", "Style", "Usage"],
  "Jardin": ["Type", "Usage", "Dimensions", "Matière", "Saison"],
  "Outillage": ["Type", "Puissance", "Usage", "Alimentation", "Marque", "Sécurité"],
  "Automobile": ["Marque", "Modèle", "Année", "Carburant", "Transmission", "Couleur"],
  "Moto & vélo": ["Type", "Taille", "Usage", "Marque", "Vitesse", "Accessoires inclus"],
  "Alimentation": ["Poids", "Ingrédients", "Origine", "Date limite", "Labels", "Type"],
  "Literie": ["Taille", "Matière", "Fermeté", "Épaisseur", "Traitement anti-acariens"],
  "Rideaux & stores": ["Type", "Dimensions", "Matière", "Opacité", "Fixation"],
  "Luminaires": ["Type", "Style", "Puissance", "Source", "Installation"],
  "Vaisselle": ["Type", "Matière", "Nombre de pièces", "Usage", "Compatibilité lave-vaisselle"],
  "Ustensiles de cuisine": ["Type", "Matière", "Usage", "Ergonomie", "Compatibilité"],
  "Rangement": ["Type", "Dimensions", "Matière", "Capacité", "Empilable"],
  "Salle de bain": ["Type", "Matière", "Dimensions", "Installation", "Usage"],
  "Cuisine équipée": ["Type", "Dimensions", "Finition", "Électroménagers inclus"],
  "Climatisation": ["Type", "Puissance", "Surface couverte", "Consommation", "Installation"],
  "Chauffage": ["Type", "Puissance", "Technologie", "Sécurité", "Mobilité"],
  "Instruments de musique": ["Type", "Marque", "Matière", "Niveau", "Accessoires inclus"],
  "Matériel artistique": ["Type", "Format", "Couleur", "Technique", "Usage"],
  "Loisirs créatifs": ["Type", "Niveau", "Matière", "Thème", "Âge"],
  "Couture & tricot": ["Type", "Matière", "Couleur", "Format", "Compatibilité machine"],
  "Modélisme": ["Type", "Échelle", "Matériau", "Niveau", "Motorisation"],
  "Photographie": ["Type", "Résolution", "Format", "Connectivité", "Accessoires"],
  "Scrapbooking": ["Type", "Format", "Thème", "Couleur", "Nombre d’éléments"],
  "Calligraphie": ["Type", "Pointe", "Encre", "Format", "Usage"],
  "Fournitures scolaires": ["Type", "Format", "Niveau", "Matière", "Compatibilité"],
  "Jeux éducatifs": ["Âge", "Matière", "Thème", "Niveau", "Nombre de joueurs"],
  "Livres jeunesse": ["Âge", "Genre", "Format", "Langue", "Illustration"],
  "Mobilier enfant": ["Type", "Dimensions", "Sécurité", "Matière", "Évolutif"],
  "Vêtements bébé": ["Taille", "Matière", "Sécurité", "Saison", "Genre"],
  "Puériculture": ["Type", "Sécurité", "Âge", "Format", "Compatibilité"],
  "Yoga & méditation": ["Type", "Matière", "Niveau", "Usage", "Format"],
  "Compléments alimentaires": ["Type", "Ingrédients", "Posologie", "Certification", "Format"],
  "Huiles essentielles": ["Plante", "Usage", "Format", "Certification", "Origine"],
  "Matériel médical": ["Type", "Usage", "Format", "Précision", "Homologation"],
  "Produits d’hygiène": ["Type", "Format", "Ingrédients", "Usage", "Certification"],
  "Soins capillaires": ["Type", "Format", "Ingrédients", "Usage", "Texture"],
  "Matériaux": ["Type", "Dimensions", "Matière", "Usage", "Certification"],
  "Équipements de chantier": ["Type", "Puissance", "Sécurité", "Mobilité", "Usage"],
  "Électricité": ["Type", "Tension", "Compatibilité", "Installation", "Sécurité"],
  "Plomberie": ["Type", "Diamètre", "Matière", "Installation", "Usage"],
  "Quincaillerie": ["Type", "Dimensions", "Matière", "Usage", "Résistance"],
  "Équipements de protection": ["Type", "Norme", "Taille", "Usage", "Matière"],
  "Bagages": ["Type", "Dimensions", "Matière", "Roues", "Sécurité"],
  "Accessoires de voyage": ["Type", "Usage", "Format", "Compatibilité", "Sécurité"],
  "Guides touristiques": ["Destination", "Langue", "Format", "Édition", "Thématique"],
  "Camping": ["Type", "Dimensions", "Matière", "Usage", "Saison"],
  "Randonnée": ["Type", "Niveau", "Matière", "Poids", "Imperméabilité"],
  "Mobilité urbaine": ["Type", "Autonomie", "Vitesse", "Poids", "Pliable"],
};

const BASE_HEADERS = ["IDProduit", "Nom", "Marque", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif", "Catégorie", "NoteMoyenne", "NombreAvis", "Galerie"];

/**
 * NOUVEAU: Récupère les en-têtes pour une catégorie spécifique.
 */
function getCategorySpecificHeaders(categoryName) {
  const specificAttributes = CATEGORY_CONFIG[categoryName] || [];
  return [...BASE_HEADERS, ...specificAttributes];
}

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
    const action = request.action;

    switch(action) {
      case 'ajouterProduit':
        invalidateCategoryCache();
        return addProduct(request.data);
      case 'updateProduct':
        invalidateCategoryCache();
        return updateProduct(request.data);
      case 'archiveOutOfStock':
        invalidateCategoryCache();
        return archiveOutOfStock();
      default:
        return createJsonResponse({ success: false, error: "Action POST non reconnue." });
    }

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * NOUVEAU: Se déclenche automatiquement à chaque modification de la feuille.
 */
function onEdit(e) {
  // On ne fait rien si c'est juste une sélection de cellule
  if (!e.range || e.range.getHeight() === 0 || e.range.getWidth() === 0) {
    return;
  }
  // On ignore les modifications sur la première ligne (en-têtes)
  if (e.range.getRow() === 1) {
    return;
  }
  
  Logger.log("Modification détectée. Invalidation du cache global demandée.");
  // Appelle le script central pour lui dire de mettre à jour la version du cache.
  // On utilise un appel "fire-and-forget", on n'attend pas la réponse.
  UrlFetchApp.fetch(CENTRAL_ADMIN_API_URL + "?action=invalidateCache", {
    method: 'get', muteHttpExceptions: true
  });
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
  const sheet = ss.getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newProductId = "PROD-" + Utilities.getUuid().substring(0, 6).toUpperCase();

  if (sheet.getLastRow() === 0) {
    // Ne devrait pas arriver si setupSheet est utilisé
    return createJsonResponse({ success: false, error: "Feuille non initialisée." });
  }

  const prixAncien = (productData.reduction > 0) ? productData.prixActuel / (1 - (productData.reduction / 100)) : productData.prixActuel;
  
  const newRow = headers.map(header => {
      if (header === "IDProduit") return newProductId;
      return productData[header] || ''; // Gère les champs non fournis
  });
  
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
function setupSheet(categoryName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const headers = getCategorySpecificHeaders(categoryName);
  sheet.clear();
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  SpreadsheetApp.getUi().alert(`Feuille initialisée comme "${categoryName}" avec succès !`);
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
