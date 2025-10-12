/**
 * @file Gestion Notifications - API pour abmcymarket.vercel.app
 * @description Service dédié à l'envoi de notifications (email, etc.).
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const ADMIN_EMAIL = "abmcompanysn@gmail.com"; // Email pour recevoir les notifications

const ALLOWED_ORIGINS = [
    "https://abmcymarket.vercel.app"
];

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
    if (ALLOWED_ORIGINS.includes(origin)) {
        response.addHeader('Access-Control-Allow-Origin', origin);
        response.addHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    }
    return response;
}