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
        return createJsonResponse({ status: "error", message: "Action non reconnue." });
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: `Erreur serveur: ${error.message}` });
  }
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

  return createJsonResponse({ status: "success", message: "Mise à jour réussie." });
}

/**
 * Supprime un item.
 * @param {object} data - { compteId, type, itemId }
 */
function deleteItem(data) {
  const { itemId, type } = data;
  const sheetName = (type === 'service') ? SERVICES_SHEET : PRODUCTS_SHEET;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: `Feuille "${sheetName}" introuvable.` });
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const idColIndex = values[0].indexOf("IDItem");
  const rowIndex = values.findIndex(row => row[idColIndex] === itemId);

  if (rowIndex === -1) return createJsonResponse({ status: "error", message: "Item non trouvé." });
  
  sheet.deleteRow(rowIndex + 1);
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
    [PRODUCTS_SHEET]: ["CompteID", "IDItem", "Nom", "Prix", "Description", "ImageURL", "Categorie", "Caracteristiques", "Date"]
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

  const demoServices = [
    {
      compteId: compteId,
      type: 'service',
      nom: 'Coupe Dégradé Américain',
      prix: 2500,
      description: 'Dégradé à blanc progressif, contours nets.',
      imageUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
      category: 'Coupe',
      characteristics: 'Tendance,Moderne'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Taille de Barbe Complète',
      prix: 1500,
      description: 'Rituel complet : taille, contours, huile de soin.',
      imageUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
      category: 'Barbe',
      characteristics: 'Relaxant,Soin'
    },
    {
      compteId: compteId,
      type: 'service',
      nom: 'Soins Visage Black Mask',
      prix: 3000,
      description: 'Nettoyage en profondeur et masque purifiant.',
      imageUrl: 'https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png',
      category: 'Soin',
      characteristics: 'Purifiant,Frais'
    }
  ];

  // Ajoute chaque service en utilisant la fonction existante
  demoServices.forEach(service => addItem(service));

  return createJsonResponse({ status: "success", message: `Services de démonstration ajoutés pour le compte ${compteId}.` });
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
