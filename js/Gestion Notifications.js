/**
 * @file Gestion Notifications - API pour abmcymarket.vercel.app
 * @description Service dédié à l'envoi de notifications (email, etc.).
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const ADMIN_EMAIL = "abmcompanysn@gmail.com"; // Email pour recevoir les notifications
const SHEET_NAMES = {
    NOTIFICATIONS: "Notifications",
    CONFIG: "Config"
};
// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    const origin = e && e.headers ? e.headers.Origin || e.headers.origin : null;
    // Réponse par défaut pour un simple test de connectivité
    return addCorsHeaders(createJsonResponse({
      success: true,
      message: 'API Gestion Notifications - Active'
    }), origin);
}

function doPost(e) {
    const origin = e && e.headers ? e.headers.Origin || e.headers.origin : null;
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        if (action === 'sendOrderConfirmation') {
            // Logique pour envoyer un email de confirmation de commande
            const subject = `Nouvelle commande #${data.orderId}`;
            const body = `Une nouvelle commande a été passée.\n\nID Commande: ${data.orderId}\nClient: ${data.clientId}\nTotal: ${data.total}\n\nDétails: ${JSON.stringify(data.products, null, 2)}`;
            MailApp.sendEmail(ADMIN_EMAIL, subject, body);
            return addCorsHeaders(createJsonResponse({ success: true, message: "Notification envoyée." }), origin);
        }

        return addCorsHeaders(createJsonResponse({ success: false, error: "Action de notification non reconnue." }), origin);

    } catch (error) {
        return addCorsHeaders(createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }), origin);
    }
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
 * NOUVEAU: Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config_notifications';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://abmcymarket.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS",
    allowed_headers: "Content-Type",
    allow_credentials: "true"
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
      allow_credentials: config.allow_credentials === 'true'
    };

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600);
    return finalConfig;
  } catch (e) {
    return defaultConfig;
  }
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
 * NOUVEAU: Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.NOTIFICATIONS]: ["ID Notification", "Email Client", "Type", "Message", "Statut", "Date"],
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
  configSheet.appendRow(['allowed_methods', 'POST,GET,OPTIONS']);
  configSheet.appendRow(['allowed_headers', 'Content-Type']);
  configSheet.appendRow(['allow_credentials', 'true']);

  ui.alert("Projet 'Gestion Notifications' initialisé avec succès !");
}

/**
 * NOUVEAU: Ajoute les en-têtes CORS à une réponse existante.
 * @param {GoogleAppsScript.Content.TextOutput} response - L'objet réponse.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse avec les en-têtes.
 */
function addCorsHeaders(response, origin) {
    const output = response;
    const corsHeaders = getCorsHeaders(origin);

    if (corsHeaders['Access-Control-Allow-Origin']) {
        output.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    }
    if (corsHeaders['Access-Control-Allow-Credentials']) {
        output.setHeader('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);
    }

    return output;
}

/**
 * NOUVEAU: Construit un objet d'en-têtes CORS basé sur la configuration.
 * @param {string} origin - L'origine de la requête.
 * @returns {object} Un objet contenant les en-têtes CORS.
 */
function getCorsHeaders(origin) {
    const config = getConfig();
    const headers = {};

    if (origin && config.allowed_origins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = config.allowed_methods;
        headers['Access-Control-Allow-Headers'] = config.allowed_headers;
        if (config.allow_credentials) {
            headers['Access-Control-Allow-Credentials'] = 'true';
        }
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return headers;
}