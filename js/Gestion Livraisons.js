/**
 * @file Gestion Livraisons - API pour abmcymarket.vercel.app
 * @description Service dédié à la gestion des options et coûts de livraison.
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const ALLOWED_ORIGINS = [
    "https://abmcymarket.vercel.app"
];

const DELIVERY_OPTIONS = {
    "Dakar": {
        "Dakar - Plateau": { "Standard": 1500, "ABMCY Express": 2500, "Livraison par Yango": 0, "Livraison au point de relais": 0, "Livraison en agence": 0 },
        "Dakar - Yoff": { "Standard": 2000, "ABMCY Express": 3000, "Livraison par Yango": 0, "Livraison au point de relais": 0, "Livraison en agence": 0 },
        "Dakar - Pikine": { "Standard": 2500, "ABMCY Express": 3500, "Livraison par Yango": 0, "Livraison au point de relais": 0, "Livraison en agence": 0 },
        "Rufisque": { "Standard": 3000, "ABMCY Express": 4000, "Livraison par Yango": 0, "Livraison au point de relais": 0, "Livraison en agence": 0 }
    },
    "Thiès": {
        "Thiès Ville": { "Standard": 3500, "ABMCY Express": 5000, "Livraison au point de relais": 0, "Livraison en agence": 0 },
        "Mbour": { "Standard": 4000, "ABMCY Express": 6000, "Livraison au point de relais": 0, "Livraison en agence": 0 },
        "Saly": { "Standard": 4500, "ABMCY Express": 6500, "Livraison au point de relais": 0, "Livraison en agence": 0 }
    },
    "Saint-Louis": { "Saint-Louis Ville": { "Standard": 5000, "Livraison au point de relais": 0, "Livraison en agence": 0 } },
    "Ziguinchor": { "Ziguinchor Ville": { "Standard": 6000, "Livraison au point de relais": 0, "Livraison en agence": 0 } },
    "Kaolack": { "Kaolack Ville": { "Standard": 4500, "Livraison au point de relais": 0, "Livraison en agence": 0 } }
};

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doGet(e) {
    const action = e.parameter.action;

    if (action === 'getDeliveryOptions') {
        return createJsonResponse({ success: true, data: DELIVERY_OPTIONS });
    }

    return createJsonResponse({
        success: true,
        message: 'API Gestion Livraisons - Active'
    });
}

function doOptions(e) {
    const origin = e.headers.Origin || e.headers.origin;
    const response = ContentService.createTextOutput(null);
    if (ALLOWED_ORIGINS.includes(origin)) {
        response.addHeader('Access-Control-Allow-Origin', origin);
        response.addHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    return response;
}

// --- FONCTIONS UTILITAIRES ---

function createJsonResponse(data, origin) {
    const response = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        response.addHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Pour les requêtes GET publiques, on autorise largement.
        response.addHeader('Access-Control-Allow-Origin', '*');
    }
    return response;
}