/**
  * @file Gestion Livraisons - API pour abmcymarket.vercel.app
 * @description Service dédié à la gestion des options et coûts de livraison.
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const SHEET_NAMES = {
    LIVRAISONS: "Livraisons",
    CONFIG: "Config"
};

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    const origin = e && e.headers ? e.headers.Origin || e.headers.origin : null;
    const action = e && e.parameter ? e.parameter.action : null;

    if (action === 'getDeliveryOptions') {
        const config = getConfig();
        return addCorsHeaders(createJsonResponse({ success: true, data: config.delivery_options }), origin);
    }

    return addCorsHeaders(createJsonResponse({
        success: true,
        message: 'API Gestion Livraisons - Active'
    }), origin);
}

function doOptions(e) {
    const origin = e && e.headers ? e.headers.Origin || e.headers.origin : null;
    const output = ContentService.createTextOutput(null);
    const corsHeaders = getCorsHeaders(origin);
    for (const header in corsHeaders) {
        output.setHeader(header, corsHeaders[header]);
    }
    return output;
}

// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data, origin) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * NOUVEAU: Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Configuration Module')
      .addItem('🚀 Initialiser le projet', 'setupProject')
      .addToUi();
}

/**
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config_delivery';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://abmcymarket.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS,PUT",
    allowed_headers: "Content-Type",
    allow_credentials: "true",
    delivery_options: {} // Par défaut, aucune option de livraison
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!configSheet) return defaultConfig;

    const data = configSheet.getDataRange().getValues();
    const config = {};
    data.forEach(row => {
      if (row[0] && row[1]) { config[row[0]] = row[1]; }
    });

    const finalConfig = {
      allowed_origins: config.allowed_origins ? config.allowed_origins.split(',').map(s => s.trim()) : defaultConfig.allowed_origins,
      allowed_methods: config.allowed_methods || defaultConfig.allowed_methods,
      allowed_headers: config.allowed_headers || defaultConfig.allowed_headers,
      allow_credentials: config.allow_credentials === 'true',
      delivery_options: config.delivery_options ? JSON.parse(config.delivery_options) : defaultConfig.delivery_options
    };

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 300); // Cache pendant 5 minutes
    return finalConfig;
  } catch (e) {
    return defaultConfig;
  }
}

/**
 * NOUVEAU: Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.LIVRAISONS]: ["ID Livraison", "ID Commande", "Client", "Adresse", "Statut", "Date de mise à jour", "Transporteur"],
    [SHEET_NAMES.CONFIG]: ["Clé", "Valeur"]
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange("A1:Z1").setFontWeight("bold");
    }
  });

  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  configSheet.appendRow(['allowed_origins', 'https://abmcymarket.vercel.app,http://127.0.0.1:5500']);
  configSheet.appendRow(['allowed_methods', 'POST,GET,OPTIONS,PUT']);
  configSheet.appendRow(['allowed_headers', 'Content-Type']);
  configSheet.appendRow(['allow_credentials', 'true']);
  const defaultDeliveryOptions = {"Dakar":{"Dakar - Plateau":{"Standard":1500,"ABMCY Express":2500},"Rufisque":{"Standard":3000}},"Thiès":{"Thiès Ville":{"Standard":3500}}};
  configSheet.appendRow(['delivery_options', JSON.stringify(defaultDeliveryOptions)]);

  ui.alert("Projet 'Gestion Livraisons' initialisé avec succès !");
}

/**
 * NOUVEAU: Ajoute les en-têtes CORS à une réponse existante.
 * @param {GoogleAppsScript.Content.TextOutput} response - L'objet réponse.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse avec les en-têtes.
 */
function addCorsHeaders(response, origin) {
    const config = getConfig();
    if (origin && config.allowed_origins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        if (config.allow_credentials) {
            response.setHeader('Access-Control-Allow-Credentials', 'true');
        }
    } else {
        response.setHeader('Access-Control-Allow-Origin', '*');
    }
    return response;
}