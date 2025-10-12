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

function doPost(e) {
    const origin = e.headers.Origin || e.headers.origin;
    try {
        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        if (action === 'sendOrderConfirmation') {
            // Logique pour envoyer un email de confirmation de commande
            const subject = `Nouvelle commande #${data.orderId}`;
            const body = `Une nouvelle commande a été passée.\n\nID Commande: ${data.orderId}\nClient: ${data.clientId}\nTotal: ${data.total}\n\nDétails: ${JSON.stringify(data.products, null, 2)}`;
            MailApp.sendEmail(ADMIN_EMAIL, subject, body);
            return createJsonResponse({ success: true, message: "Notification envoyée." }, origin);
        }

        return createJsonResponse({ success: false, error: "Action de notification non reconnue." }, origin);

    } catch (error) {
        return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }, origin);
    }
}

function doOptions(e) {
    const origin = e.headers.Origin || e.headers.origin;
    const response = ContentService.createTextOutput(null);
    const config = getConfig();
    if (config.allowed_origins.includes(origin)) {
        response.addHeader('Access-Control-Allow-Origin', origin);
        response.addHeader('Access-Control-Allow-Methods', config.allowed_methods);
        response.addHeader('Access-Control-Allow-Headers', config.allowed_headers);
        if (config.allow_credentials) {
            response.addHeader('Access-Control-Allow-Credentials', 'true');
        }
    }
    return response;
}

// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data, origin) {
    const response = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    const config = getConfig();
    if (origin && config.allowed_origins.includes(origin)) {
        response.addHeader('Access-Control-Allow-Origin', origin);
        if (config.allow_credentials) {
            response.addHeader('Access-Control-Allow-Credentials', 'true');
        }
    }
    return response;
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