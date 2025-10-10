
/**
 * SCRIPT CENTRAL: Gestionnaire de Catégories
 * Description: Gère la liste des catégories et les informations pour contacter leurs scripts respectifs.
 * A déployer en tant qu'application web avec accès "Tous les utilisateurs".
 */

// --- CONFIGURATION ---
const ADMIN_SPREADSHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg";
const CENTRAL_SHEET_ID = "1kTQsUgcvcWxJNgHuITi4nlMhAqwyVAMhQbzIMIODcBg"; // IMPORTANT: ID de la feuille centrale
const DEFAULT_LOGO_URL = "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png"; // NOUVEAU: URL du logo par défaut

// NOUVEAU: Configuration centrale des attributs par catégorie, copiée depuis le template.
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
    const action = e.parameter.action;

    // CORRECTION: Gérer l'invalidation du cache appelée par les feuilles de catégorie
    if (action === 'invalidateCache') {
      const cache = PropertiesService.getScriptProperties();
      const newVersion = new Date().getTime().toString();
      cache.setProperty('cacheVersion', newVersion);
      return createJsonResponse({ success: true, message: `Cache invalidé. Nouvelle version: ${newVersion}` });
    }

    // Pour l'action 'getPublicData' ou par défaut, on renvoie la liste des catégories et la version du cache.
    // Le panneau d'administration utilise getCategoriesWithProductCounts() directement via google.script.run.
    const categories = getCategories(); // Utiliser la version simple sans décompte pour l'API publique
    return createJsonResponse({ success: true, data: categories, cacheVersion: PropertiesService.getScriptProperties().getProperty('cacheVersion') });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
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
  // NOUVEAU: Ajout de ImageURL pour le front-end
  const headers = ["IDCategorie", "NomCategorie", "SheetID", "ScriptURL", "ImageURL"];
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  
  // NOUVEAU: Remplissage automatique à partir de CATEGORY_CONFIG
  const categoriesToInsert = Object.keys(CATEGORY_CONFIG).sort();
  const rows = categoriesToInsert.map((catName, index) => {
    const catId = `CAT-${String(index + 1).padStart(3, '0')}`;
    const placeholderSheetId = `REMPLIR_ID_FEUILLE_${catName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    const placeholderScriptUrl = `REMPLIR_URL_SCRIPT_${catName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    return [catId, catName, placeholderSheetId, placeholderScriptUrl, DEFAULT_LOGO_URL]; // CORRECTION: Utiliser le logo par défaut
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  SpreadsheetApp.getUi().alert(`Initialisation terminée. ${rows.length} catégories ont été ajoutées à la feuille "Catégories".`);
}