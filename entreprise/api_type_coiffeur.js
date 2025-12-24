// Fichier : api_type_coiffeur.js

/**
 * @file API de Type - Coiffeur
 * @description Ce script sert de modèle pour gérer les données spécifiques à un type d'entreprise (ici, "Coiffeur").
 * Il est appelé par l'API centrale (Gestion Compte.js) pour les données publiques,
 * et par le tableau de bord de l'entreprise pour la gestion (CRUD).
 * @version 2.1 (Avec support CORS)
 */

const SERVICES_SHEET = "Services"; // Feuille contenant les services de TOUS les coiffeurs
const PRODUCTS_SHEET = "Produits"; // Feuille contenant les produits de TOUS les coiffeurs
const LOGS_SHEET = "Logs";         // Feuille pour le journal d'activité
const SLUGS_SHEET = "Slugs";       // Feuille pour les alias (URL courtes)
const STATS_SHEET = "Stats_Visites"; // Feuille pour l'historique des visites

/**
 * Gère les requêtes OPTIONS pour le support CORS.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.JSON)
    .append(JSON.stringify({ status: "success" }));
}

/**
 * Gère les requêtes GET.
 * - Point d'entrée pour l'API centrale qui récupère les données publiques d'une entreprise.
 * - Peut aussi être utilisé par le tableau de bord de l'entreprise pour récupérer ses propres données.
 * 
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 * 
 * Sera appelé avec une requête GET.
 * Exemple d'appel: .../exec?compteId=ENT-12345
 */
function doGet(e) {
  // Vérifier si on demande une résolution d'alias (slug)
  if (e.parameter.action === 'resolveSlug' && e.parameter.alias) {
    return resolveSlug(e.parameter.alias);
  }

  const compteId = e.parameter.compteId;
  if (!compteId) {
    return createJsonResponse({ status: "error", message: "ID de compte manquant." });
  }
  // Note: Pour une sécurité accrue, on pourrait vérifier ici si l'appelant est autorisé.

  const services = getDataForId(SERVICES_SHEET, compteId);
  const products = getDataForId(PRODUCTS_SHEET, compteId);

  return createJsonResponse({
    status: "success",
    data: {
      services: services,
      products: products
    }
  });
}

/**
 * Gère les requêtes POST.
 * Point d'entrée pour toutes les actions de création, modification et suppression (CRUD).
 * 
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const { action, data } = request;

    // Note: Ici, il faudrait ajouter une vérification d'authentification
    // pour s'assurer que seul le propriétaire du compte peut modifier ses données.

    switch (action) {
      case 'getBusinessItems': // Pour charger les produits/services dans le dashboard
        return getBusinessItems(data);
      case 'addService': // Pour ajouter un service depuis le dashboard
        return addItemFromDashboard(data, 'service');
      case 'addProduct': // Pour ajouter un produit depuis le dashboard
        return addItemFromDashboard(data, 'produit');
      case 'getLogs': // Pour récupérer le journal d'activité
        return getLogs(data);
      case 'setSlug': // Pour définir un alias personnalisé
        return setSlug(data);
      case 'getSlug': // Pour récupérer l'alias actuel
        return getSlug(data);
      case 'getVisitStats': // Pour récupérer les stats graphiques
        return getVisitStats(data);
      case 'addItem':
        return addItem(data);
      case 'updateItem':
        return updateItem(data);
      case 'deleteItem':
        return deleteItem(data);
      case 'submitPublicHaircut':
        return submitPublicHaircut(data);
      case 'setup':
        return createJsonResponse(setupSheets());
      case 'addDemoData':
        return addDemoData(data);
      case 'creerCompteEntreprise':
        return createJsonResponse({ status: "error", message: "Veuillez utiliser l'API Centrale (Gestion Compte) pour créer un compte entreprise." });
      default:
        return createJsonResponse({ status: "error", message: `Action non reconnue: '${action}'. Assurez-vous d'avoir déployé la dernière version du script.` });
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: `Erreur serveur: ${error.message}` });
  }
}

/**
 * Récupère les items pour le tableau de bord (Action: getBusinessItems).
 * @param {object} data - { compteId }
 */
function getBusinessItems(data) {
  const compteId = data.compteId;
  if (!compteId) {
    return createJsonResponse({ status: "error", message: "ID de compte manquant." });
  }

  const services = getDataForId(SERVICES_SHEET, compteId);
  const products = getDataForId(PRODUCTS_SHEET, compteId);

  return createJsonResponse({
    status: "success",
    data: {
      services: services,
      products: products
    }
  });
}

/**
 * Adapte les données du dashboard pour la fonction addItem (Actions: addService, addProduct).
 * Le dashboard envoie une structure imbriquée { item: {...} } que nous devons aplatir.
 */
function addItemFromDashboard(data, type) {
  const itemData = data.item || {};
  
  // On construit l'objet plat attendu par addItem
  const flatData = {
    compteId: data.compteId,
    type: type,
    nom: itemData.nom,
    prix: itemData.prix,
    imageUrl: itemData.imageUrl,
    description: itemData.description || '',
    category: itemData.category || '',
    characteristics: itemData.characteristics || ''
  };
  
  return addItem(flatData);
}

/**
 * Ajoute un nouvel item (service ou produit).
 * @param {object} data - { compteId, type, nom, prix, description, imageUrl, category, characteristics }
 */
function addItem(data) {
  const { compteId, type, nom, prix, description, imageUrl, category, characteristics } = data;
  if (!compteId || !type || !nom || !prix) {
    return createJsonResponse({ status: "error", message: "Données requises manquantes (compteId, type, nom, prix)." });
  }

  const sheetName = (type === 'service') ? SERVICES_SHEET : PRODUCTS_SHEET;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: `Feuille "${sheetName}" introuvable.` });
  const itemId = `${type.toUpperCase().slice(0,3)}-${new Date().getTime()}`; // Génère un ID unique, ex: SER-167...
  
  // Ordre des colonnes : CompteID, IDItem, Nom, Prix, Description, ImageURL, Categorie, Caracteristiques, Date
  sheet.appendRow([
    compteId, 
    itemId, 
    nom, 
    prix, 
    description || '', 
    imageUrl || '', 
    category || '', 
    characteristics || '', 
    new Date()
  ]);

  logAction(compteId, `Ajout ${type}`, `Nom: ${nom}, Prix: ${prix}`);
  return createJsonResponse({ status: "success", message: `"${nom}" ajouté avec succès.` });
}

/**
 * Met à jour un item existant.
 * @param {object} data - { compteId, type, itemId, nom, prix, description, imageUrl, category, characteristics }
 */
function updateItem(data) {
  const { compteId, type, itemId, nom, prix, description, imageUrl, category, characteristics } = data;
  if (!itemId || !type) {
    return createJsonResponse({ status: "error", message: "ID de l'item ou type manquant." });
  }

  const sheetName = (type === 'service') ? SERVICES_SHEET : PRODUCTS_SHEET;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: `Feuille "${sheetName}" introuvable.` });
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf("IDItem"); // Assurez-vous d'avoir une colonne "IDItem"

  const rowIndex = values.findIndex(row => row[idColIndex] === itemId);

  if (rowIndex === -1) {
    return createJsonResponse({ status: "error", message: "Item non trouvé." });
  }

  // Mettre à jour les valeurs
  sheet.getRange(rowIndex + 1, headers.indexOf("Nom") + 1).setValue(nom);
  sheet.getRange(rowIndex + 1, headers.indexOf("Prix") + 1).setValue(prix);
  sheet.getRange(rowIndex + 1, headers.indexOf("Description") + 1).setValue(description);
  
  if (imageUrl) {
    sheet.getRange(rowIndex + 1, headers.indexOf("ImageURL") + 1).setValue(imageUrl);
  }
  if (category) {
    sheet.getRange(rowIndex + 1, headers.indexOf("Categorie") + 1).setValue(category);
  }
  if (characteristics) {
    sheet.getRange(rowIndex + 1, headers.indexOf("Caracteristiques") + 1).setValue(characteristics);
  }

  logAction(compteId, `Modification ${type}`, `ID: ${itemId}, Nom: ${nom}`);
  return createJsonResponse({ status: "success", message: "Mise à jour réussie." });
}

/**
 * Supprime un item.
 * @param {object} data - { compteId, type, itemId }
 */
function deleteItem(data) {
  const { itemId, type, compteId } = data;
  const sheetName = (type === 'service') ? SERVICES_SHEET : PRODUCTS_SHEET;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: `Feuille "${sheetName}" introuvable.` });
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const idColIndex = values[0].indexOf("IDItem");
  const rowIndex = values.findIndex(row => row[idColIndex] === itemId);

  if (rowIndex === -1) return createJsonResponse({ status: "error", message: "Item non trouvé." });
  
  sheet.deleteRow(rowIndex + 1);
  if (compteId) logAction(compteId, `Suppression ${type}`, `ID: ${itemId}`);
  return createJsonResponse({ status: "success", message: "Item supprimé." });
}

/**
 * Fonction pour permettre à n'importe qui d'ajouter une coupe (service)
 * avec support de plusieurs photos pour enrichir le catalogue.
 * @param {object} data - { compteId, nom, prix, description, photos: [], ... }
 */
function submitPublicHaircut(data) {
  // Force le type à 'service' car c'est une coupe
  data.type = 'service';
  
  // Définit la catégorie par défaut à 'Coupe' si elle n'est pas spécifiée
  if (!data.category) {
    data.category = 'Coupe';
  }

  // Gestion de plusieurs photos : si un tableau 'photos' est fourni, on joint les URLs par des virgules
  if (data.photos && Array.isArray(data.photos)) {
    data.imageUrl = data.photos.join(',');
  }

  // Réutilise la logique d'ajout existante
  return addItem(data);
}

/**
 * Initialise les feuilles et les en-têtes nécessaires pour l'application.
 * À appeler une fois pour configurer le Google Sheet automatiquement.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Configuration des feuilles et des colonnes attendues
  const sheetsToCreate = {
    [SERVICES_SHEET]: ["CompteID", "IDItem", "Nom", "Prix", "Description", "ImageURL", "Categorie", "Caracteristiques", "Date"],
    [PRODUCTS_SHEET]: ["CompteID", "IDItem", "Nom", "Prix", "Description", "ImageURL", "Categorie", "Caracteristiques", "Date"],
    [LOGS_SHEET]: ["CompteID", "Date", "Action", "Details"],
    [SLUGS_SHEET]: ["Slug", "CompteID", "Date", "Visits"],
    [STATS_SHEET]: ["CompteID", "Date"]
  };

  let log = [];

  Object.entries(sheetsToCreate).forEach(([sheetName, desiredHeaders]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(desiredHeaders);
      sheet.setFrozenRows(1); // Fige la ligne d'en-tête pour plus de lisibilité
      log.push(`Feuille "${sheetName}" créée.`);
    } else {
      // Synchronisation des colonnes
      const lastCol = sheet.getLastColumn();
      let currentHeaders = [];
      if (lastCol > 0) {
        currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      }

      // 1. Ajouter les colonnes manquantes
      const headersToAdd = desiredHeaders.filter(h => !currentHeaders.includes(h));
      if (headersToAdd.length > 0) {
        sheet.getRange(1, lastCol + 1, 1, headersToAdd.length).setValues([headersToAdd]);
        log.push(`Colonnes ajoutées à "${sheetName}": ${headersToAdd.join(', ')}.`);
      }

      // 2. Supprimer les colonnes en trop (non utilisées)
      for (let i = currentHeaders.length - 1; i >= 0; i--) {
        const header = currentHeaders[i];
        if (!desiredHeaders.includes(header)) {
           sheet.deleteColumn(i + 1);
           log.push(`Colonne "${header}" supprimée de "${sheetName}".`);
        }
      }
    }
  });

  return { status: "success", message: log.length > 0 ? log.join("\n") : "Configuration vérifiée : Tout est à jour." };
}

/**
 * Ajoute des données de démonstration (services) pour un compte spécifique.
 * Permet de peupler rapidement le catalogue pour tester ou présenter.
 * @param {object} data - { compteId }
 */
function addDemoData(data) {
  const { compteId } = data;
  if (!compteId) {
    return createJsonResponse({ status: "error", message: "ID de compte manquant pour la démo." });
  }

  // Vérifie si le compte possède déjà des services pour éviter les doublons ou de mélanger avec des données réelles
  const existingServices = getDataForId(SERVICES_SHEET, compteId);
  if (existingServices.length > 0) {
    return createJsonResponse({ status: "error", message: "Le compte possède déjà des services. Ajout des données de démo annulé." });
  }

  const defaultImage = 'https://i.postimg.cc/5tQq2dm7/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png';

  const demoItems = [
    // --- 5 SERVICES ---
    {
      compteId: compteId,
      type: 'service',
      nom: 'Coupe Dégradé Américain',
      prix: 2500,
      description: 'Dégradé à blanc progressif, contours nets.',
      imageUrl: defaultImage,
      category: 'Coupe',
      characteristics: 'Tendance,Moderne'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Taille de Barbe Complète',
      prix: 1500,
      description: 'Rituel complet : taille, contours, huile de soin.',
      imageUrl: defaultImage,
      category: 'Barbe',
      characteristics: 'Relaxant,Soin'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Soins Visage Black Mask',
      prix: 3000,
      description: 'Nettoyage en profondeur et masque purifiant.',
      imageUrl: defaultImage,
      category: 'Soin',
      characteristics: 'Purifiant,Frais'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Coupe Classique Ciseaux',
      prix: 2000,
      description: 'Coupe traditionnelle aux ciseaux pour un rendu naturel.',
      imageUrl: defaultImage,
      category: 'Coupe',
      characteristics: 'Classique,Naturel'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Coloration / Teinture',
      prix: 5000,
      description: 'Coloration cheveux ou barbe pour cacher les cheveux blancs ou changer de style.',
      imageUrl: defaultImage,
      category: 'Coloration',
      characteristics: 'Style,Jeunesse'
    },
    // --- 5 PRODUITS ---
    {
      compteId: compteId, type: 'produit', nom: 'Cire Coiffante Mate', prix: 4000,
      description: 'Fixation forte avec un effet mat naturel.', imageUrl: defaultImage,
      category: 'Coiffant', characteristics: 'Mat,Fort'
    },
    {
      compteId: compteId, type: 'produit', nom: 'Huile à Barbe Bio', prix: 3500,
      description: 'Nourrit et adoucit la barbe, parfum boisé.', imageUrl: defaultImage,
      category: 'Barbe', characteristics: 'Bio,Hydratant'
    },
    {
      compteId: compteId, type: 'produit', nom: 'Gel de Rasage Précision', prix: 2500,
      description: 'Transparent pour des contours parfaits.', imageUrl: defaultImage,
      category: 'Rasage', characteristics: 'Précision'
    },
    {
      compteId: compteId, type: 'produit', nom: 'Shampoing Purifiant', prix: 3000,
      description: 'Nettoie en profondeur et élimine les résidus.', imageUrl: defaultImage,
      category: 'Soins', characteristics: 'Purifiant'
    },
    {
      compteId: compteId, type: 'produit', nom: 'Peigne en Bois', prix: 1500,
      description: 'Antistatique, idéal pour la barbe.', imageUrl: defaultImage,
      category: 'Accessoire', characteristics: 'Durable'
    }
  ];

  // Ajoute chaque service en utilisant la fonction existante
  demoItems.forEach(item => addItem(item));

  return createJsonResponse({ status: "success", message: `5 services et 5 produits de démonstration ajoutés pour le compte ${compteId}.` });
}

/**
 * Crée un menu "Admin" à l'ouverture du fichier pour faciliter la configuration.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Admin Coiffeur')
    .addItem('Initialiser les feuilles', 'manualSetup')
    .addToUi();
}

/**
 * Version manuelle de l'initialisation (pour le menu).
 */
function manualSetup() {
  const result = setupSheets();
  SpreadsheetApp.getUi().alert(result.message);
}

/**
 * Enregistre une action dans le journal.
 */
function logAction(compteId, action, details) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET);
  if (sheet) {
    sheet.appendRow([compteId, new Date(), action, details]);
  }
}

/**
 * Récupère les logs pour un compte spécifique.
 */
function getLogs(data) {
  const compteId = data.compteId;
  if (!compteId) return createJsonResponse({ status: "error", message: "ID de compte manquant." });

  // On utilise getDataForId car la structure est compatible (CompteID en colonne 0)
  const logs = getDataForId(LOGS_SHEET, compteId);
  
  // Tri décroissant par date (le plus récent en premier)
  logs.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  return createJsonResponse({ status: "success", data: logs });
}

/**
 * Définit un alias (slug) pour un compte.
 * @param {object} data - { compteId, slug }
 */
function setSlug(data) {
  const { compteId, slug } = data;
  if (!compteId || !slug) return createJsonResponse({ status: "error", message: "Données manquantes." });

  // Nettoyage du slug (minuscules, pas d'espaces, pas de caractères spéciaux sauf -)
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SLUGS_SHEET);
  const values = sheet.getDataRange().getValues();
  
  // Vérifier si le slug est déjà pris par un AUTRE compte
  const existing = values.find(row => row[0] === cleanSlug && row[1] !== compteId);
  if (existing) {
    return createJsonResponse({ status: "error", message: `L'identifiant "${cleanSlug}" est déjà pris.` });
  }

  // Vérifier si ce compte a déjà un slug et le mettre à jour, sinon créer
  const rowIndex = values.findIndex(row => row[1] === compteId);
  
  if (rowIndex > 0) { // Mise à jour (on saute l'en-tête)
    sheet.getRange(rowIndex + 1, 1).setValue(cleanSlug);
    sheet.getRange(rowIndex + 1, 3).setValue(new Date());
  } else { // Création
    sheet.appendRow([cleanSlug, compteId, new Date()]);
  }

  return createJsonResponse({ status: "success", message: "Identifiant personnalisé enregistré.", slug: cleanSlug });
}

/**
 * Récupère le slug d'un compte.
 */
function getSlug(data) {
  const { compteId } = data;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SLUGS_SHEET);
  if (!sheet) return createJsonResponse({ status: "success", slug: "" });
  
  const row = sheet.getDataRange().getValues().find(r => r[1] === compteId);
  return createJsonResponse({ 
    status: "success", 
    slug: row ? row[0] : "",
    visits: (row && row[3]) ? row[3] : 0 
  });
}

/**
 * Résout un slug en ID de compte (Public).
 */
function resolveSlug(alias) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SLUGS_SHEET);
  if (!sheet) return createJsonResponse({ status: "error", message: "Système d'alias non configuré." });
  
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(r => r[0] === alias);
  
  if (rowIndex !== -1) {
    const row = data[rowIndex];
    // Incrémenter le compteur de visites (Colonne 4 : Visits)
    const currentVisits = row[3] ? parseInt(row[3]) : 0;
    sheet.getRange(rowIndex + 1, 4).setValue(currentVisits + 1);

    // Enregistrer la visite dans l'historique pour le graphique
    const statsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STATS_SHEET);
    if (statsSheet) {
      statsSheet.appendRow([row[1], new Date()]);
    }

    return createJsonResponse({ status: "success", compteId: row[1] });
  }
  return createJsonResponse({ status: "error", message: "Boutique introuvable." });
}

/**
 * Récupère les statistiques de visites des 7 derniers jours.
 */
function getVisitStats(data) {
  const { compteId } = data;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STATS_SHEET);
  // Si la feuille n'existe pas encore, renvoyer des données vides
  if (!sheet) return createJsonResponse({ status: "success", labels: [], data: [] });

  const values = sheet.getDataRange().getValues();
  // Filtrer les logs pour ce compte (on saute l'en-tête)
  const logs = values.slice(1).filter(r => r[0] === compteId);

  // Préparer les 7 derniers jours
  const stats = {};
  const labels = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = d.toISOString().split('T')[0]; // Format YYYY-MM-DD
    stats[dateKey] = 0;
    labels.push(dateKey);
  }

  // Compter les visites
  logs.forEach(row => {
    try {
      const d = new Date(row[1]);
      const dateKey = d.toISOString().split('T')[0];
      if (stats.hasOwnProperty(dateKey)) {
        stats[dateKey]++;
      }
    } catch (e) { /* ignorer dates invalides */ }
  });

  // Formater pour Chart.js
  const chartData = labels.map(key => stats[key]);
  const chartLabels = labels.map(key => {
    const parts = key.split('-');
    return `${parts[2]}/${parts[1]}`; // Format DD/MM
  });

  return createJsonResponse({ status: "success", labels: chartLabels, data: chartData });
}

// --- Fonctions Utilitaires ---

function getDataForId(sheetName, id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift(); // Sépare l'en-tête
  
  const filteredData = allData.filter(row => row[0] === id); // Filtre par ID de compte (colonne 0 "CompteID")
  
  // Transforme les lignes en objets
  return filteredData.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
