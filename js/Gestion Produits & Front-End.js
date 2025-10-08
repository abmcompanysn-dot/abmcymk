
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
  PROMOTIONS: "Promotions", // NOUVEAU
  LOGS: "Logs"
};

// --- DONNÉES PERSONNELLES PAR DÉFAUT (VISIBLES ET MODIFIABLES) ---
const PERSONAL_DATA = {
  logoUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
  gallery: Array(5).fill('https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png').join(','),
  categories: [
    // 50 Catégories
    { name: "Smartphones & Tablettes", description: "Les derniers cris de la technologie mobile.", parent: "", order: 1 },
    { name: "Ordinateurs & Portables", description: "Puissance et portabilité pour le travail et le jeu.", parent: "", order: 2 },
    { name: "TV, Vidéo & Home Cinéma", description: "Une expérience visuelle immersive.", parent: "", order: 3 },
    { name: "Audio & Hi-Fi", description: "Un son pur pour les mélomanes.", parent: "", order: 4 },
    { name: "Appareils Photo & Caméscopes", description: "Capturez vos moments précieux.", parent: "", order: 5 },
    { name: "Mode Homme", description: "Élégance et style au masculin.", parent: "", order: 6 },
    { name: "Mode Femme", description: "Les dernières tendances pour elle.", parent: "", order: 7 },
    { name: "Chaussures & Sacs", description: "L'accessoire qui fait la différence.", parent: "", order: 8 },
    { name: "Montres & Bijoux", description: "Luxe et précision à votre poignet.", parent: "", order: 9 },
    { name: "Beauté & Parfum", description: "Révélez votre éclat naturel.", parent: "", order: 10 },
    { name: "Maison & Cuisine", description: "Équipez votre intérieur avec style.", parent: "", order: 11 },
    { name: "Électroménager", description: "Simplifiez votre quotidien.", parent: "", order: 12 },
    { name: "Jardin & Bricolage", description: "Pour les mains vertes et les esprits créatifs.", parent: "", order: 13 },
    { name: "Meubles & Décoration", description: "Créez un intérieur qui vous ressemble.", parent: "", order: 14 },
    { name: "Luminaires", description: "Illuminez votre espace de vie.", parent: "", order: 15 },
    { name: "Sports & Loisirs", description: "Pour une vie active et passionnante.", parent: "", order: 16 },
    { name: "Jeux & Jouets", description: "Le bonheur des petits et des grands.", parent: "", order: 17 },
    { name: "Livres & Papeterie", description: "Évadez-vous et organisez-vous.", parent: "", order: 18 },
    { name: "Auto & Moto", description: "Entretenez votre passion mécanique.", parent: "", order: 19 },
    { name: "Épicerie & Boissons", description: "Saveurs du monde livrées chez vous.", parent: "", order: 20 },
    { name: "Santé & Soins personnels", description: "Prenez soin de vous au quotidien.", parent: "", order: 21 },
    { name: "Bébés & Puériculture", description: "Tout pour le confort de votre bébé.", parent: "", order: 22 },
    { name: "Animaux", description: "Le meilleur pour vos compagnons.", parent: "", order: 23 },
    { name: "Instruments de musique", description: "Exprimez votre talent musical.", parent: "", order: 24 },
    { name: "Fournitures de bureau", description: "Organisez votre espace de travail.", parent: "", order: 25 },
    { name: "Bagages", description: "Voyagez avec style et sérénité.", parent: "", order: 26 },
    { name: "Logiciels", description: "Boostez votre productivité et votre créativité.", parent: "", order: 27 },
    { name: "Jeux Vidéo & Consoles", description: "Plongez dans des mondes virtuels.", parent: "", order: 28 },
    { name: "Art & Artisanat", description: "Libérez votre créativité.", parent: "", order: 29 },
    { name: "Vêtements de sport", description: "Performance et confort pour vos entraînements.", parent: "Sports & Loisirs", order: 30 },
    { name: "Smartwatches", description: "La technologie à votre poignet.", parent: "Électronique", order: 31 },
    { name: "Drônes", description: "Voyez le monde sous un nouvel angle.", parent: "Électronique", order: 32 },
    { name: "Cosmétiques Bio", description: "La beauté au naturel.", parent: "Beauté & Parfum", order: 33 },
    { name: "Vins & Spiritueux", description: "Sélections d'exception pour connaisseurs.", parent: "Épicerie & Boissons", order: 34 },
    { name: "Nutrition Sportive", description: "Optimisez vos performances.", parent: "Sports & Loisirs", order: 35 },
    { name: "Mode Enfant", description: "Style et confort pour les plus jeunes.", parent: "", order: 36 },
    { name: "Liseuses", description: "Emportez votre bibliothèque partout.", parent: "Livres & Papeterie", order: 37 },
    { name: "Objets Connectés", description: "Une maison plus intelligente.", parent: "Maison & Cuisine", order: 38 },
    { name: "Équipement de Camping", description: "L'aventure en plein air.", parent: "Sports & Loisirs", order: 39 },
    { name: "Accessoires de Voyage", description: "Pour des voyages sans tracas.", parent: "Bagages", order: 40 },
    { name: "Produits d'Entretien Écologiques", description: "Nettoyez en respectant la planète.", parent: "Maison & Cuisine", order: 41 },
    { name: "Sacs à main de luxe", description: "L'élégance intemporelle.", parent: "Chaussures & Sacs", order: 42 },
    { name: "Lunettes de Soleil", description: "Protégez vos yeux avec style.", parent: "Mode Homme", order: 43 },
    { name: "Imprimantes 3D", description: "Donnez vie à vos idées.", parent: "Ordinateurs & Portables", order: 44 },
    { name: "Matériel de Fitness", description: "Votre salle de sport à domicile.", parent: "Sports & Loisirs", order: 45 },
    { name: "Figurines de collection", description: "Pour les passionnés de pop culture.", parent: "Jeux & Jouets", order: 46 },
    { name: "Thés & Infusions", description: "Un moment de détente et de saveur.", parent: "Épicerie & Boissons", order: 47 },
    { name: "Soins pour cheveux", description: "Des cheveux sains et éclatants.", parent: "Beauté & Parfum", order: 48 },
    { name: "Accessoires pour smartphone", description: "Protégez et améliorez votre appareil.", parent: "Smartphones & Tablettes", order: 49 },
    { name: "Ustensiles de pâtisserie", description: "Pour les chefs en herbe.", parent: "Maison & Cuisine", order: 50 }
  ],
  products: [
    // Génération des 500 produits
    ...(() => {
      const allProducts = [];
      const categories = [
        "Smartphones & Tablettes", "Ordinateurs & Portables", "TV, Vidéo & Home Cinéma", "Audio & Hi-Fi", "Appareils Photo & Caméscopes",
        "Mode Homme", "Mode Femme", "Chaussures & Sacs", "Montres & Bijoux", "Beauté & Parfum",
        "Maison & Cuisine", "Électroménager", "Jardin & Bricolage", "Meubles & Décoration", "Luminaires",
        "Sports & Loisirs", "Jeux & Jouets", "Livres & Papeterie", "Auto & Moto", "Épicerie & Boissons",
        "Santé & Soins personnels", "Bébés & Puériculture", "Animaux", "Instruments de musique", "Fournitures de bureau",
        "Bagages", "Logiciels", "Jeux Vidéo & Consoles", "Art & Artisanat", "Vêtements de sport",
        "Smartwatches", "Drônes", "Cosmétiques Bio", "Vins & Spiritueux", "Nutrition Sportive",
        "Mode Enfant", "Liseuses", "Objets Connectés", "Équipement de Camping", "Accessoires de Voyage",
        "Produits d'Entretien Écologiques", "Sacs à main de luxe", "Lunettes de Soleil", "Imprimantes 3D", "Matériel de Fitness",
        "Figurines de collection", "Thés & Infusions", "Soins pour cheveux", "Accessoires pour smartphone", "Ustensiles de pâtisserie"
      ];
      categories.forEach((catName, catIndex) => {
        for (let i = 1; i <= 10; i++) {
          const price = (Math.floor(Math.random() * 90) + 10) * 5000; // Prix entre 50,000 et 500,000
          allProducts.push({
            nom: `${catName.replace(/&.*$/, '').trim()} Modèle ${i}`,
            marque: `Marque ${String.fromCharCode(65 + catIndex)}`,
            categorie: catName,
            prixActuel: price,
            reduction: i % 4 === 0 ? 15 : 0,
            stock: Math.floor(Math.random() * 100) + 10,
            noteMoyenne: (Math.random() * 1.5 + 3.5).toFixed(1),
            nombreAvis: Math.floor(Math.random() * 200),
            imageURL: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
            galerie: Array(5).fill('https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png').join(','),
            description: `Description détaillée pour le produit ${catName.replace(/&.*$/, '').trim()} Modèle ${i}.`,
            tags: `${catName.split(' ')[0].toLowerCase()},moderne,qualité`
          });
        }
      });
      return allProducts;
    })()
  ]
};

// --- GESTIONNAIRE DE MENU ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ABMCY Market [ADMIN]')
      .addItem('📦 Gérer le Catalogue', 'showAdminInterface')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('Configuration')
          .addItem('⚙️ Initialiser les onglets Admin', 'initialiserBaseDeDonnees_Admin'))
      .addItem('🔄 Mettre à jour le système', 'updateSystem') // NOUVEAU
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Testing')
          .addItem('🌱 Remplir avec des données personnelles', 'seedPersonalData_Admin')
          .addItem('🧹 Vider le cache du site', 'invalidateCache')
          .addItem('🧹 Vider toutes les données', 'clearAllData_Admin'))
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
    // SUIVRE LE NOUVEL ORDRE DES COLONNES
    sheet.appendRow([idProduit, p.nom, p.marque, p.prixActuel, prixAncien, p.reduction, p.stock, p.imageURL, p.description, p.tags, true, p.categorie, p.noteMoyenne || 0, p.nombreAvis || 0, p.galerie]);
    
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
  const promotions = sheetToJSON(ss.getSheetByName(SHEET_NAMES.PROMOTIONS)).filter(p => p.Actif === true); // NOUVEAU
  const data = { products, categories, promotions };
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

function seedPersonalData_Admin() { // Renommée pour plus de clarté
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  initialiserBaseDeDonnees_Admin(); // Assure que toutes les colonnes sont présentes

  const { categories, products } = PERSONAL_DATA; // Utilise les données définies en haut

  products.forEach(p => {
    ajouterProduit({
      ...p // Utilise toutes les propriétés de l'objet produit
    });
  });

  categories.forEach(c => {
    ajouterCategorie({
      nom: c.name, description: c.description, parentCategorie: c.parent, ordreAffichage: c.order
    });
  });

  SpreadsheetApp.getUi().alert('Remplissage terminé !', 'Les produits et catégories de test ont été ajoutés.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function clearAllData_Admin() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirmation', 'Êtes-vous sûr de vouloir supprimer TOUTES les données (Produits, Catégories, Promotions) ? Cette action est irréversible.', ui.ButtonSet.YES_NO);

  if (response == ui.Button.YES) {
    const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    const productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    const categoriesSheet = ss.getSheetByName(SHEET_NAMES.CATEGORIES);
    const promotionsSheet = ss.getSheetByName(SHEET_NAMES.PROMOTIONS);

    if (productsSheet) productsSheet.getRange("A2:Z").clearContent();
    if (categoriesSheet) categoriesSheet.getRange("A2:Z").clearContent();
    if (promotionsSheet) promotionsSheet.getRange("A2:Z").clearContent();

    logAction('clearAllData_Admin', { status: 'Données effacées' });
    ui.alert('Opération terminée', 'Toutes les données ont été effacées.', ui.ButtonSet.OK);
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
  getOrCreateSheet(ss, SHEET_NAMES.PRODUCTS, ["IDProduit", "Nom", "Marque", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif", "Catégorie", "NoteMoyenne", "NombreAvis", "Galerie"]);
  getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES, ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"]);
  getOrCreateSheet(ss, SHEET_NAMES.ALBUMS, ["IDProduit", "ImageURL", "Légende", "Ordre", "TypeImage"]);
  getOrCreateSheet(ss, SHEET_NAMES.PROMOTIONS, ["IDPromotion", "IDProduit", "TypeReduction", "ValeurReduction", "DateDebut", "DateFin", "Actif"]);
  getOrCreateSheet(ss, "StockAlertes", ["IDProduit", "Seuil", "AlerteEnvoyée", "DateDernièreAlerte", "MéthodeNotification"]);
  getOrCreateSheet(ss, SHEET_NAMES.LOGS, ["Date", "Script", "Action", "Détails"]);
}

/**
 * NOUVEAU: Met à jour la structure du Google Sheet de manière non-destructive.
 */
function updateSystem() {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  try {
    const sheetConfigs = {
      [SHEET_NAMES.PRODUCTS]: ["IDProduit", "Nom", "Marque", "PrixActuel", "PrixAncien", "Réduction%", "Stock", "ImageURL", "Description", "Tags", "Actif", "Catégorie", "NoteMoyenne", "NombreAvis", "Galerie"],
      [SHEET_NAMES.CATEGORIES]: ["IDCategorie", "Nom", "Description", "ParentCategorie", "OrdreAffichage"],
      [SHEET_NAMES.ALBUMS]: ["IDProduit", "ImageURL", "Légende", "Ordre", "TypeImage"],
      [SHEET_NAMES.PROMOTIONS]: ["IDPromotion", "IDProduit", "TypeReduction", "ValeurReduction", "DateDebut", "DateFin", "Actif"],
      [SHEET_NAMES.LOGS]: ["Date", "Script", "Action", "Détails"]
    };

    Object.entries(sheetConfigs).forEach(([name, expectedHeaders]) => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(expectedHeaders);
        Logger.log(`Onglet '${name}' créé avec les en-têtes.`);
      } else {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
        const currentHeaders = headerRange.getValues()[0];
        const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));

        if (missingHeaders.length > 0) {
          sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
          Logger.log(`Colonnes manquantes ajoutées à '${name}': ${missingHeaders.join(', ')}`);
        }
      }
    });
    ui.alert('Mise à jour du système terminée avec succès !');
  } catch (e) {
    Logger.log(e);
    ui.alert('Erreur lors de la mise à jour', e.message, ui.ButtonSet.OK);
  }
}