/**
 * @file Gestion Commandes - API pour abmcymarket.vercel.app
 * @description Service dédié à l'enregistrement des nouvelles commandes.
 *
 * @version 1.0.0
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---
const SPREADSHEET_ID = "1pGx-1uFUdS61fL4eh4HhQaHQSX6UzmPXiMQY0i71ZpU";

const SHEET_NAMES = {
    ORDERS: "Commandes",
    LOGS: "Logs"
};

const ALLOWED_ORIGINS = [
    "https://abmcymarket.vercel.app"
];

// --- POINTS D'ENTRÉE DE L'API WEB ---

function doPost(e) {
    const origin = e.headers.Origin || e.headers.origin;
    try {
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("Requête POST invalide ou vide.");
        }

        const request = JSON.parse(e.postData.contents);
        const { action, data } = request;

        if (action === 'enregistrerCommande') {
            return enregistrerCommande(data, origin);
        } else {
            logAction('doPost', { error: 'Action non reconnue', action: action });
            return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }, origin);
        }

    } catch (error) {
        logError(e.postData ? e.postData.contents : 'No postData', error);
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

// --- LOGIQUE MÉTIER ---

function enregistrerCommande(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        const produitsStr = Array.isArray(data.produits) ? data.produits.join(', ') : data.produits;
        const quantitesStr = Array.isArray(data.quantites) ? data.quantites.join(', ') : data.quantites;

        sheet.appendRow([
            idCommande, data.idClient, new Date(), produitsStr, quantitesStr,
            data.total, "En attente", data.adresseLivraison, data.moyenPaiement, data.notes || ''
        ]);

        logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
        return createJsonResponse({ success: true, id: idCommande }, origin);
    } finally {
        lock.releaseLock();
    }
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

function logAction(action, details) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END (CMD)", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

function logError(context, error) {
    try {
        const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.LOGS);
        const errorDetails = { context: context, message: error.message, stack: error.stack };
        logSheet.appendRow([new Date(), "BACK-END (CMD)", "ERROR", JSON.stringify(errorDetails)]);
    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}