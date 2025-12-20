/**
 * @file Gestion Compte - API pour abmcymarket.vercel.app
 * @description API CENTRALE: Gère les clients, commandes, livraisons et notifications.
 *
 * @version 4.0.0 (Fusion des services)
 * @author Gemini Code Assist
 */

// --- CONFIGURATION GLOBALE ---

// Email pour recevoir les notifications de nouvelles commandes
const ADMIN_EMAIL = "abmcompanysn@gmail.com";

// Noms des feuilles de calcul utilisées
const SHEET_NAMES = {
    USERS: "Utilisateurs",
    ORDERS: "Commandes",
    ENTREPRISES: "Comptes_Entreprises", // NOUVEAU: Feuille pour les comptes des entreprises partenaires
    LOGS: "Logs",
    CONFIG: "Config",
    ADDRESSES: "Adresses", // NOUVEAU: Feuille pour les adresses
    ABMCY_Admin: "ABMCY_Admin", // NOUVEAU: Pour la page de confirmation manuelle
    ABMCY_AGGREGATOR_HISTORY: "ABMCY_Aggregator_History", // NOUVEAU: Pour l'historique des tentatives de paiement
    // NOUVEAU: Ajout des feuilles des autres modules
    LIVRAISONS: "Livraisons",
    NOTIFICATIONS: "Notifications"
};

// Origines autorisées à accéder à cette API.
const ALLOWED_ORIGINS = {
    "https://abmcymarket.vercel.app": true,
    "http://127.0.0.1:5500": true,
    "https://abmcymarket.abmcy.com": true, // NOUVEAU: Ajout du nouveau domaine pour corriger l'erreur CORS.
    "null": true // Autoriser pour les tests locaux ou les redirections depuis des applications
};

// --- POINTS D'ENTRÉE DE L'API WEB (doGet, doPost, doOptions) ---

/**
 * Gère les requêtes HTTP GET.
 * Utilisé principalement pour récupérer des données publiques ou des journaux.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doGet(e) {
    const origin = e.headers ? e.headers.Origin || e.headers.origin : null;
    const action = e.parameter.action;

    if (action === 'getAppLogs') {
        return getAppLogs(e.parameter, origin);
    }

    // NOUVEAU: Action fusionnée depuis Gestion Livraisons
    if (action === 'getDeliveryOptions') {
        const config = getConfig();
        return createJsonResponse({ success: true, data: config.delivery_options || {} }, origin);
    }

    // NOUVEAU: Action pour servir la page du tableau de bord administrateur
    if (action === 'showAdminDashboard') {
      // Note: Idéalement, ajoutez une vérification ici pour s'assurer que seul un admin peut voir cette page.
      return HtmlService.createHtmlOutputFromFile('admin_dashboard')
          .setTitle('Tableau de Bord Admin - ABMCY MARKET')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // NOUVEAU: Action pour servir la page de confirmation manuelle ABMCY
    if (action === 'showAbmcyAdmin') {
      return HtmlService.createHtmlOutputFromFile('abmcy_admin')
          .setTitle('Tableau de Bord Admin - ABMCY MARKET')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // NOUVEAU: Action pour récupérer les données publiques d'une entreprise
    if (action === 'getBusinessPublicData') {
        // Cette action est publique, pas besoin de vérifier l'origine ici.
        return getBusinessPublicData(e.parameter.compteId);
    }
    
    // Réponse par défaut pour un simple test de l'API
    // CORRECTION: N'appelle plus addCorsHeaders
    return createJsonResponse({
      success: true,
      message: 'API Gestion Compte - Active'
    }, origin);
}

/**
 * Gère les requêtes HTTP POST.
 * Point d'entrée principal pour les actions (connexion, inscription, etc.).
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} La réponse JSON.
 */
function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Attendre 30s max
    const origin = e.headers ? (e.headers.Origin || e.headers.origin) : null;

    try {
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("Requête POST invalide ou vide.");
        }

        let request;
        // NOUVEAU: Gestion robuste du corps de la requête.
        // Tente de parser comme text/plain (pour les requêtes simples) puis comme application/json.
        try {
            request = JSON.parse(e.postData.contents);
        } catch (jsonError) {
            throw new Error("Le corps de la requête n'est pas un JSON valide.");
        }
        const { action, data } = request;

        if (!action) {
            return createJsonResponse({ success: false, error: 'Action non spécifiée.' }, origin);
        }

        // NOUVEAU: Protection par mot de passe pour les actions admin de l'agrégateur
        const adminActions = ['getPendingAbmcyPayments', 'manuallyConfirmAbmcyPayment', 'manuallyExpireAbmcyPayment'];
        if (adminActions.includes(action)) {
            // CORRECTION: Recherche dynamique du mot de passe au lieu d'une cellule fixe.
            const abmcyAdminSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ABMCY_Admin);
            const adminData = abmcyAdminSheet.getDataRange().getValues();
            const passwordRow = adminData.find(row => row[0] === 'AdminPassword');
            const storedPassword = passwordRow ? passwordRow[1] : null;

            if (!storedPassword || request.password !== storedPassword) {
                logAction('ABMCY_ADMIN_AUTH_FAIL', { action: action });
                return createJsonResponse({ success: false, unauthorized: true, error: 'Mot de passe incorrect.' }, origin);
            }
        }



        // Routeur pour les actions POST
        switch (action) {
            case 'creerCompteClient':
                return creerCompteClient(data, origin);
            case 'creerCompteEntreprise': // NOUVEAU
                return creerCompteEntreprise(data, origin);
            case 'connecterEntreprise': // NOUVEAU
                return connecterEntreprise(data, origin);
            case 'requestBusinessPasswordReset': // NOUVEAU
                return requestBusinessPasswordReset(data, origin);
            case 'resetBusinessPassword': // NOUVEAU
                return resetBusinessPassword(data, origin);
            case 'connecterClient':
                return connecterClient(data, origin);
            case 'getOrderById': // NOUVEAU
                return getOrderById(data, origin);
            case 'changePassword': // NOUVEAU: Pour un utilisateur connecté
                return changePassword(data, origin);
            case 'requestPasswordReset': // NOUVEAU: Pour un mot de passe oublié
                return requestPasswordReset(data, origin);
            case 'resetPassword': // NOUVEAU: Pour finaliser la réinitialisation
                return resetPassword(data, origin);
            case 'getAllUsers': // NOUVEAU: Pour le panneau admin
                return getAllUsers(data, origin);
            case 'updateUserProfile': // NOUVEAU: Pour modifier le profil
                return updateUserProfile(data, origin);
            // NOUVEAU: Actions pour la gestion des adresses
            case 'getUserAddresses':
                return getUserAddresses(data, origin);
            case 'addUserAddress':
                return addUserAddress(data, origin);
            case 'setDefaultAddress': // NOUVEAU
                return setDefaultAddress(data, origin);
            case 'deleteUserAddress':
                return deleteUserAddress(data, origin);
            // NOUVEAU: Actions pour le panneau d'administration des paiements
            case 'getPaymentSettings':
                return getPaymentSettings(data, origin);
            case 'savePaymentSettings':
                return savePaymentSettings(data, origin);
            case 'getDashboardData': // NOUVEAU: Pour le tableau de bord enrichi
                return getDashboardData(origin);
            case 'getRecentTransactions': // NOUVEAU: Pour le tableau de bord admin
                return getRecentTransactions(data, origin);
            case 'exportOrdersToCSV': // NOUVEAU: Pour exporter les commandes
                return exportOrdersToCSV(origin);
            case 'getSalesDataForChart': // NOUVEAU: Pour le graphique des ventes
                return getSalesDataForChart(origin);
            case 'updateOrderStatus': // NOUVEAU: Pour modifier le statut d'une commande
                return updateOrderStatus(data, origin);
            case 'updateUserAddress': // NOUVEAU: Pour modifier l'adresse
                return updateUserAddress(data, origin);
            case 'getOrdersByClientId':
                return getOrdersByClientId(data, origin);
            case 'createPaydunyaInvoice': // NOUVEAU: Action pour créer une facture Paydunya
                return createPaydunyaInvoice(data, origin);
            // NOUVEAU: Action pour le paiement à la livraison
            case 'createAbmcyAggregatorInvoice': // NOUVEAU: Action pour le nouvel agrégateur ABMCY
                return createAbmcyAggregatorInvoice(data, origin); 
            // L'action 'getAbmcyPaymentStatus' est maintenant fusionnée dans 'getOrderById' pour éviter la redondance.
            case 'getPendingAbmcyPayments': // NOUVEAU: Pour la page admin de confirmation manuelle
                return getPendingAbmcyPayments(origin);
            case 'logAbmcyPaymentAttempt': // NOUVEAU: Pour enregistrer les infos de l'expéditeur
                return logAbmcyPaymentAttempt(data, origin);
            case 'manuallyConfirmAbmcyPayment': // NOUVEAU: Pour la confirmation manuelle
                return manuallyConfirmAbmcyPayment(data, origin);
            case 'manuallyExpireAbmcyPayment': // NOUVEAU: Pour l'expiration manuelle
                return manuallyExpireAbmcyPayment(data, origin);
            case 'initiateAbmcyPayment': // NOUVEAU: Pour enregistrer la tentative de paiement et notifier le client
                return initiateAbmcyPayment(data, origin);
            case 'enregistrerCommandeEtNotifier': // Pour le paiement à la livraison (COD)
                const orderResult = enregistrerCommande(data, origin);
                const orderData = JSON.parse(orderResult.getContent());
                if (orderData.success) { sendOrderConfirmationEmail(orderData, data, "cod"); }
                return orderResult;
            case 'updateBusinessInfo': // NOUVEAU: Mettre à jour les infos de l'entreprise
                return updateBusinessInfo(data, origin);
            case 'logClientEvent':
                return logClientEvent(data, origin);
            // NOUVEAU: Gérer le webhook de Paydunya
            case 'paydunya-webhook':
                // Paydunia envoie des données en `application/x-www-form-urlencoded`
                // donc e.parameter sera utilisé.
                logAction('paydunia-webhook', e.parameter);
                handlePaydunyaWebhook(e); // On passe l'événement complet 'e'
                return createJsonResponse({ success: true }, origin);
            default:
                logAction('doPost', { error: 'Action non reconnue', action: action });
                return createJsonResponse({ success: false, error: `Action non reconnue: ${action}` }, origin);
        }

    } catch (error) {
        logError(e.postData ? e.postData.contents : 'No postData', error, origin);
        return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Met à jour les informations d'une entreprise partenaire.
 * @param {object} data - { compteId, nom, description, telephone, adresse, logoUrl, coverImageUrl }
 * @param {string} origin - L'origine de la requête.
 */
function updateBusinessInfo(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        
        const idIndex = headers.indexOf("NumeroCompte");
        const rowIndex = allData.findIndex(row => row[idIndex] === data.compteId);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Entreprise non trouvée." }, origin);
        }

        const rowToUpdate = rowIndex + 1; // +1 car les indices de feuille commencent à 1

        // Fonction helper pour mettre à jour une colonne si la donnée est présente
        const updateCol = (colName, value) => {
            const colIndex = headers.indexOf(colName);
            if (colIndex > -1 && value !== undefined && value !== null) {
                sheet.getRange(rowToUpdate, colIndex + 1).setValue(value);
            }
        };

        updateCol("NomEntreprise", data.nom);
        updateCol("Description", data.description);
        updateCol("Telephone", data.telephone);
        updateCol("Adresse", data.adresse);
        if (data.logoUrl) updateCol("LogoUrl", data.logoUrl);
        if (data.coverImageUrl) updateCol("CoverImageUrl", data.coverImageUrl);

        return createJsonResponse({ success: true, message: "Informations mises à jour avec succès." }, origin);
    } catch (error) {
        logError('updateBusinessInfo', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * Gère les requêtes HTTP OPTIONS pour la pré-vérification CORS.
 * C'est une étape de sécurité obligatoire demandée par le navigateur pour les requêtes POST.
 * @param {object} e - L'objet événement de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse vide avec les en-têtes CORS.
 */
function doOptions(e) {
  const origin = e.headers ? (e.headers.Origin || e.headers.origin) : null;
  const response = ContentService.createTextOutput(null);
  
  if (ALLOWED_ORIGINS[origin]) {
      response.addHeader('Access-Control-Allow-Origin', origin);
      response.addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  return response;
}

// --- LOGIQUE MÉTIER (ACTIONS DE L'API) ---

/**
 * Crée un nouveau compte client.
 * @param {object} data - Données du client (nom, email, motDePasse).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function creerCompteClient(data, origin) {
    try {
        // NOUVEAU: Validation du mot de passe
        if (!validatePassword(data.motDePasse)) {
            throw new Error("Le mot de passe ne respecte pas les critères de sécurité (8+ caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole).");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getRange(2, 1, sheet.getLastRow(), 3).getValues();
        const emailExists = usersData.some(row => row[1] === data.email);

        if (emailExists) {
            return createJsonResponse({ success: false, error: 'Un compte avec cet email existe déjà.' }, origin);
        }

        const idClient = "CLT-" + new Date().getTime();
        const { passwordHash, salt } = hashPassword(data.motDePasse);

        sheet.appendRow([
            idClient, data.nom, data.email, passwordHash, salt, data.telephone || '',
            data.adresse || '', new Date(), "Actif", "Client"
        ]);

        logAction('creerCompteClient', { email: data.email, id: idClient });
        return createJsonResponse({ success: true, id: idClient }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'creerCompteClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Crée un compte entreprise.
 * @param {object} data - { nomEntreprise, email, typeEntreprise, motDePasse }
 */
function creerCompteEntreprise(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailIndex = headers.indexOf("Email");

        // Vérifier si l'email existe déjà
        if (emailIndex > -1) {
            const emailExists = allData.some(row => row[emailIndex] === data.email);
            if (emailExists) return createJsonResponse({ success: false, error: "Cet email est déjà utilisé par une autre entreprise." }, origin);
        }

        const compteId = `ENT-${new Date().getTime()}`;
        const { passwordHash, salt } = hashPassword(data.motDePasse);
        
        // Colonnes: NumeroCompte, NomEntreprise, Type, Proprietaire, Telephone, Adresse, ApiTypeUrl, LogoUrl, Description, CoverImageUrl, GalerieUrls, Email, PasswordHash, Salt
        // On remplit ce qu'on a, le reste sera vide pour l'instant
        const newRow = [
            compteId, data.nomEntreprise, data.typeEntreprise, "", "", "", "", "", "", "", "", data.email, passwordHash, salt
        ];
        
        // S'assurer que la ligne correspond aux colonnes (gestion dynamique simplifiée ici, on suppose l'ordre de setupProject)
        sheet.appendRow(newRow);

        return createJsonResponse({ status: 'success', numeroCompte: compteId }, origin);
    } catch (error) {
        logError('creerCompteEntreprise', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Connecte une entreprise.
 * @param {object} data - { email, motDePasse }
 */
function connecterEntreprise(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailIndex = headers.indexOf("Email");
        
        const userRow = allData.find(row => row[emailIndex] === data.email);
        if (!userRow) return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);

        const storedHash = userRow[headers.indexOf("PasswordHash")];
        const salt = userRow[headers.indexOf("Salt")];
        
        if (hashPassword(data.motDePasse, salt).passwordHash !== storedHash) {
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        return createJsonResponse({ success: true, numeroCompte: userRow[headers.indexOf("NumeroCompte")] }, origin);
    } catch (error) {
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Demande de réinitialisation de mot de passe pour une entreprise.
 * @param {object} data - { email }
 */
function requestBusinessPasswordReset(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailIndex = headers.indexOf("Email");
        const tokenIndex = headers.indexOf("ResetToken");
        const expiryIndex = headers.indexOf("ResetTokenExpiry");

        if (tokenIndex === -1 || expiryIndex === -1) {
            throw new Error("Colonnes de réinitialisation manquantes dans la feuille Entreprises.");
        }

        const rowIndex = allData.findIndex(row => row[emailIndex] === data.email);

        if (rowIndex !== -1) {
            const resetToken = Utilities.getUuid();
            const expiryDate = new Date(new Date().getTime() + 15 * 60 * 1000); // Valide 15 minutes

            const rowToUpdate = rowIndex + 1;
            sheet.getRange(rowToUpdate, tokenIndex + 1).setValue(resetToken);
            sheet.getRange(rowToUpdate, expiryIndex + 1).setValue(expiryDate);

            // Envoyer l'email
            const resetUrl = `https://abmcymarket.abmcy.com/entreprise/reset-password.html?token=${resetToken}`;
            const subject = "Réinitialisation de votre mot de passe Partenaire ABMCY";
            const body = `
                <p>Bonjour,</p>
                <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte partenaire.</p>
                <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe (valide 15 minutes) :</p>
                <p><a href="${resetUrl}" style="font-weight:bold;">Réinitialiser mon mot de passe</a></p>
                <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            `;
            MailApp.sendEmail(data.email, subject, "", { htmlBody: body });
        }

        return createJsonResponse({ success: true, message: "Si cet email existe, un lien a été envoyé." }, origin);
    } catch (error) {
        logError('requestBusinessPasswordReset', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Réinitialise le mot de passe entreprise avec le jeton.
 * @param {object} data - { token, newPassword }
 */
function resetBusinessPassword(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const tokenIndex = headers.indexOf("ResetToken");
        const expiryIndex = headers.indexOf("ResetTokenExpiry");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const rowIndex = allData.findIndex(row => row[tokenIndex] === data.token);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Jeton invalide ou expiré." }, origin);
        }

        const expiryDate = new Date(allData[rowIndex][expiryIndex]);
        if (expiryDate < new Date()) {
            return createJsonResponse({ success: false, error: "Jeton expiré." }, origin);
        }

        const { passwordHash, salt } = hashPassword(data.newPassword);
        const rowToUpdate = rowIndex + 1;

        sheet.getRange(rowToUpdate, hashIndex + 1).setValue(passwordHash);
        sheet.getRange(rowToUpdate, saltIndex + 1).setValue(salt);
        sheet.getRange(rowToUpdate, tokenIndex + 1).setValue(""); // Effacer le jeton
        sheet.getRange(rowToUpdate, expiryIndex + 1).setValue("");

        return createJsonResponse({ success: true, message: "Mot de passe réinitialisé avec succès." }, origin);
    } catch (error) {
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * Gère la connexion d'un client.
 * @param {object} data - Données de connexion (email, motDePasse).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les infos utilisateur si succès.
 */
function connecterClient(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const usersData = sheet.getDataRange().getValues();
        const headers = usersData.shift();
        const emailIndex = headers.indexOf("Email");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const userRow = usersData.find(row => row[emailIndex] === data.email);

        if (!userRow) {
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        const storedHash = userRow[hashIndex];
        const salt = userRow[saltIndex];
        let providedPasswordHash;

        // NOUVEAU: Gérer le cas où le mot de passe envoyé est déjà un hash (pour le rafraîchissement des données)
        if (data.isHash) {
            providedPasswordHash = data.motDePasse;
        } else {
            // Comportement normal pour une connexion depuis le formulaire de login
            providedPasswordHash = hashPassword(data.motDePasse, salt).passwordHash;
        }

        if (providedPasswordHash !== storedHash) {
            logAction('connecterClient', { email: data.email, success: false });
            return createJsonResponse({ success: false, error: "Email ou mot de passe incorrect." }, origin);
        }

        // Connexion réussie, on retourne les informations de l'utilisateur
        // AMÉLIORATION SÉCURITÉ: Ne retourner que les champs nécessaires et non sensibles.
        // On construit manuellement l'objet au lieu de boucler pour éviter de fuiter des données.
        const userObject = {
            IDClient: userRow[headers.indexOf("IDClient")],
            Nom: userRow[headers.indexOf("Nom")],
            Email: userRow[headers.indexOf("Email")],
            Telephone: userRow[headers.indexOf("Telephone")],
            Adresse: userRow[headers.indexOf("Adresse")]
            // On ne retourne JAMAIS le PasswordHash ou le Salt.
        };

        return createJsonResponse({ success: true, user: userObject }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'connecterClient', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Permet à un utilisateur connecté de changer son mot de passe.
 * @param {object} data - Contient { clientId, currentPassword, newPassword }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function changePassword(data, origin) {
    try {
        if (!data.clientId || !data.currentPassword || !data.newPassword) {
            throw new Error("Données incomplètes pour le changement de mot de passe.");
        }

        // NOUVEAU: Validation du nouveau mot de passe
        if (!validatePassword(data.newPassword)) {
            throw new Error("Le nouveau mot de passe ne respecte pas les critères de sécurité.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift() || [];
        
        const idClientIndex = headers.indexOf("IDClient");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const userRowIndex = allUsers.findIndex(row => row[idClientIndex] === data.clientId);

        if (userRowIndex === -1) {
            return createJsonResponse({ success: false, error: "Utilisateur non trouvé." }, origin);
        }

        const userRow = allUsers[userRowIndex];
        const storedHash = userRow[hashIndex];
        const salt = userRow[saltIndex];

        // Vérifier si le mot de passe actuel est correct
        const currentPasswordHash = hashPassword(data.currentPassword, salt).passwordHash;
        if (currentPasswordHash !== storedHash) {
            return createJsonResponse({ success: false, error: "Le mot de passe actuel est incorrect." }, origin);
        }

        // Hacher et sauvegarder le nouveau mot de passe
        const { passwordHash: newPasswordHash, salt: newSalt } = hashPassword(data.newPassword);
        const rowToUpdate = userRowIndex + 2; // +1 pour l'index 0, +1 pour la ligne d'en-tête

        sheet.getRange(rowToUpdate, hashIndex + 1).setValue(newPasswordHash);
        sheet.getRange(rowToUpdate, saltIndex + 1).setValue(newSalt);

        logAction('changePassword', { clientId: data.clientId });
        return createJsonResponse({ success: true, message: "Mot de passe mis à jour avec succès." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'changePassword', data: { clientId: data.clientId } }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Gère une demande de réinitialisation de mot de passe.
 * @param {object} data - Contient { email }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function requestPasswordReset(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift() || [];
        const emailIndex = headers.indexOf("Email");
        const tokenIndex = headers.indexOf("ResetToken");
        const expiryIndex = headers.indexOf("ResetTokenExpiry");

        // CORRECTION: Vérifier que les colonnes nécessaires existent bien.
        if (tokenIndex === -1 || expiryIndex === -1) {
            logError('requestPasswordReset', new Error("Les colonnes 'ResetToken' ou 'ResetTokenExpiry' sont manquantes dans la feuille Utilisateurs."));
            throw new Error("Configuration du serveur incorrecte. Veuillez contacter le support.");
        }

        const userRowIndex = allUsers.findIndex(row => row[emailIndex] === data.email);

        if (userRowIndex !== -1) {
            const resetToken = Utilities.getUuid();

            const rowToUpdate = userRowIndex + 2;
            sheet.getRange(rowToUpdate, tokenIndex + 1).setValue(resetToken);
            
            // CORRECTION: La variable 'expiryDate' n'était pas définie. On la définit ici pour 5 minutes.
            const expiryDate = new Date(new Date().getTime() + 5 * 60 * 1000);
            sheet.getRange(rowToUpdate, expiryIndex + 1).setValue(expiryDate);

            // Envoyer l'email de réinitialisation
            const resetUrl = `https://abmcymarket.abmcy.com/reset-password.html?token=${resetToken}`;
            const subject = "Réinitialisation de votre mot de passe ABMCY MARKET";
            const body = `
                <p>Bonjour,</p>
                <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour continuer. Ce lien expirera dans 5 minutes.</p>
                <p><a href="${resetUrl}" style="font-weight:bold;">Réinitialiser mon mot de passe</a></p>
                <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>
                <p>L'équipe ABMCY MARKET</p>
            `;
            MailApp.sendEmail(data.email, subject, "", { htmlBody: body });
            logAction('requestPasswordReset', { email: data.email });
        }
        // Note de sécurité : On retourne toujours un message de succès, même si l'email n'existe pas,
        // pour ne pas révéler quels emails sont enregistrés dans le système.
        return createJsonResponse({ success: true, message: "Si un compte est associé à cet email, un lien de réinitialisation a été envoyé." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'requestPasswordReset', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Réinitialise le mot de passe en utilisant un jeton.
 * @param {object} data - Contient { token, newPassword }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function resetPassword(data, origin) {
    try {
        if (!data.token || !data.newPassword) {
            throw new Error("Jeton ou nouveau mot de passe manquant.");
        }

        // NOUVEAU: Validation du nouveau mot de passe
        if (!validatePassword(data.newPassword)) {
            throw new Error("Le nouveau mot de passe ne respecte pas les critères de sécurité.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift() || [];
        const tokenIndex = headers.indexOf("ResetToken");
        const expiryIndex = headers.indexOf("ResetTokenExpiry");
        const hashIndex = headers.indexOf("PasswordHash");
        const saltIndex = headers.indexOf("Salt");

        const userRowIndex = allUsers.findIndex(row => row[tokenIndex] === data.token);

        if (userRowIndex === -1) {
            return createJsonResponse({ success: false, error: "Jeton invalide ou expiré." }, origin);
        }

        const expiryDate = new Date(allUsers[userRowIndex][expiryIndex]);
        if (expiryDate < new Date()) {
            return createJsonResponse({ success: false, error: "Jeton invalide ou expiré." }, origin);
        }

        // Mettre à jour le mot de passe
        const { passwordHash, salt } = hashPassword(data.newPassword);
        const rowToUpdate = userRowIndex + 2;
        sheet.getRange(rowToUpdate, hashIndex + 1).setValue(passwordHash);
        sheet.getRange(rowToUpdate, saltIndex + 1).setValue(salt);

        // Invalider le jeton
        sheet.getRange(rowToUpdate, tokenIndex + 1).setValue('');
        sheet.getRange(rowToUpdate, expiryIndex + 1).setValue('');

        logAction('resetPasswordSuccess', { token: data.token });
        return createJsonResponse({ success: true, message: "Votre mot de passe a été réinitialisé avec succès." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'resetPassword', data: { token: data.token } }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Enregistre une nouvelle commande. Fusionné depuis Gestion Commandes.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'ID de la commande.
 */
function enregistrerCommande(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // Convertir les produits (qui sont des objets) en une chaîne lisible
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');

        // NOUVEAU: Statut initial et étapes de suivi
        // NOUVEAU: Calcul de la date de livraison estimée
        const delais = data.produits.map(p => p.delaiLivraison || 10); // Utilise le délai envoyé, ou 10 jours par défaut
        const maxDelai = Math.max(...delais);
        const dateCommande = new Date();
        const dateLivraisonEstimee = new Date(dateCommande);
        dateLivraisonEstimee.setDate(dateCommande.getDate() + maxDelai);
        
        // Formatter la date pour la feuille de calcul
        const formattedDateLivraison = Utilities.formatDate(dateLivraisonEstimee, Session.getScriptTimeZone(), "yyyy-MM-dd");


        // NOUVEAU: Statut initial et étapes de suivi
        const statutInitial = 'Confirmée'; // Le statut global
        const etapeConfirmee = true; // La première étape est toujours vraie
        const etapePreparation = false;
        const etapeExpediee = false;
        const etapeLivree = false;

        sheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, statutInitial, new Date(), etapeConfirmee, etapePreparation, etapeExpediee, etapeLivree,
            data.adresseLivraison, data.moyenPaiement, // NOUVEAU: Ajout de la date de livraison estimée
            data.notes || ''
        ]);

        logAction('enregistrerCommande', { id: idCommande, client: data.idClient });
        // Retourne plus d'infos pour la notification
        return createJsonResponse({ 
            success: true, 
            id: idCommande, 
            total: data.total, 
            clientId: data.idClient,
            customerEmail: data.customer.email, // NOUVEAU: Retourner l'email du client
            dateLivraisonEstimee: formattedDateLivraison // NOUVEAU: Retourner la date calculée
        }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'enregistrerCommande', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Crée une facture Paydunya et retourne l'URL de paiement.
 * @param {object} data - Les données de la commande.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'URL de paiement.
 */
function createPaydunyaInvoice(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const config = getConfig();
        const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();

        // 1. Enregistrer la commande avec un statut "En attente de paiement"
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');
        // AMÉLIORATION: Enregistrer la commande avec la même structure que les autres, y compris les étapes de suivi.
        // Toutes les étapes sont à 'false' car le paiement n'est pas encore confirmé.
        orderSheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, "En attente de paiement", new Date(), 
            false, false, false, false, // EtapeConfirmee, EtapePreparation, EtapeExpediee, EtapeLivree
            data.adresseLivraison, "Paydunya", data.notes || ''
        ]);

        // 2. Préparer la requête pour l'API Paydunya
        const paydunyaPayload = {
            "store": {
                "name": "ABMCY MARKET",
                "website_url": "https://abmcymarket.vercel.app"
            },
            "invoice": {
                "items": data.produits.map(p => ({
                    "name": p.name,
                    "quantity": p.quantity,
                    "unit_price": p.price,
                    "total_price": p.price * p.quantity
                })),
                "total_amount": data.total,
                "description": `Paiement pour commande #${idCommande} sur ABMCY MARKET`,
                "customer": { // NOUVEAU: Ajout des informations client
                    "name": data.customer.name,
                    "phone": data.customer.phone,
                    "email": data.customer.email
                }
            },
            "actions": {
                "cancel_url": "https://abmcymarket.abmcy.com/checkout.html",
                "return_url": `https://abmcymarket.abmcy.com/confirmation.html?orderId=${idCommande}`,
                "callback_url": ScriptApp.getService().getUrl() + "?action=paydunya-webhook"
            },
            "custom_data": {
                "order_id": idCommande
            }
        };

        const options = {
            'method': 'post',
            'contentType': 'application/json',
            'headers': {
                'PAYDUNYA-MASTER-KEY': config.PAYDUNYA_MASTER_KEY,
                'PAYDUNYA-PRIVATE-KEY': config.PAYDUNYA_PRIVATE_KEY,
                'PAYDUNYA-TOKEN': config.PAYDUNYA_TOKEN
            },
            'payload': JSON.stringify(paydunyaPayload),
            'muteHttpExceptions': true // NOUVEAU: Pour capturer les erreurs 4xx/5xx
        };

        // NOUVEAU: Logique de tentatives multiples pour gérer les erreurs réseau intermittentes
        let response;
        let lastError;
        const maxRetries = 3;

        for (let i = 0; i < maxRetries; i++) {
            try {
                // CORRECTION: Utilisation de l'URL de test (sandbox) pour correspondre aux clés de test.
                response = UrlFetchApp.fetch("https://app.paydunya.com/api/v1/checkout-invoice/create", options);
                // Si la requête réussit, on sort de la boucle
                break;
            } catch (e) {
                lastError = e;
                logAction('Paydunya Fetch Retry', { attempt: i + 1, error: e.message });
                // Attendre 1 seconde avant de réessayer
                if (i < maxRetries - 1) {
                    Utilities.sleep(1000);
                }
            }
        }

        // Si après toutes les tentatives, la réponse est toujours nulle, on lance l'erreur
        if (!response) {
            throw lastError;
        }

        // NOUVEAU: Gérer les réponses qui ne sont pas des succès (ex: 404, 401, 500)
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode !== 200) {
            // Essayer de parser la réponse d'erreur pour un message plus clair
            let errorMessage = `Paydunya a répondu avec le code ${responseCode}.`;
            try {
                const errorJson = JSON.parse(responseText);
                errorMessage = errorJson.response_text || errorJson.message || responseText;
            } catch (e) { /* Ignorer si ce n'est pas du JSON */ }
            throw new Error(errorMessage);
        }

        const responseData = JSON.parse(responseText);
        return createJsonResponse({ success: true, payment_url: responseData.response_text }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'createPaydunyaInvoice', data }), error);
        sendPaymentFailureEmail('Paydunya', error, data); // NOUVEAU: Alerte email
        return createJsonResponse({ success: false, error: `Erreur Paydunya: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Crée une facture pour l'agrégateur ABMCY (Wave, Orange Money, Yaas) et retourne l'URL de paiement.
 * @param {object} data - Les données de la commande, incluant le `paymentProvider` (wave, orange_money, yaas).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec l'URL de paiement.
 */
function createAbmcyAggregatorInvoice(data, origin) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const config = getConfig();
        if (!config.ABMCY_AGGREGATOR_ACTIVE) {
            throw new Error("L'agrégateur de paiement ABMCY n'est pas actif.");
        }

        const paymentMethods = config.ABMCY_PAYMENT_METHODS;
        const selectedProvider = data.paymentProvider;

        if (!paymentMethods || !paymentMethods[selectedProvider]) {
            throw new Error(`Fournisseur de paiement '${selectedProvider}' non configuré.`);
        }

        const providerConfig = paymentMethods[selectedProvider];
        const orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const idCommande = "CMD-" + new Date().getTime();
        const transactionReference = "ABMCY-" + new Date().getTime(); // Référence unique pour le suivi

        // 1. Enregistrer la commande avec un statut "En attente de paiement ABMCY"
        const produitsDetails = data.produits.map(p => `${p.name} (x${p.quantity})`).join(', ');
        const initiationTimestamp = new Date().toISOString(); // Timestamp de début du timer

        // AMÉLIORATION: Ajouter la référence de transaction et le timestamp d'initiation
        orderSheet.appendRow([
            idCommande, data.idClient, produitsDetails,
            data.total, `En attente de paiement ABMCY (${selectedProvider})`, new Date(),
            false, false, false, false, // EtapeConfirmee, EtapePreparation, EtapeExpediee, EtapeLivree
            data.adresseLivraison, selectedProvider, data.notes || '',
            transactionReference, // Nouvelle colonne pour la référence
            initiationTimestamp // Nouvelle colonne pour le timestamp d'initiation
        ]);

        // 2. NOUVEAU: Construire l'URL de redirection vers notre page intermédiaire abmcymarket.html
        // On passe les informations nécessaires en paramètres d'URL.
        const aggregatorPageUrl = "https://abmcymarket.abmcy.com/abmcy_aggregator.html";

        // AMÉLIORATION: Nettoyer l'URL de base pour ne garder que la partie avant les paramètres.
        // Cela évite de passer des placeholders comme {amount} à la page de l'agrégateur.
        const cleanBaseUrl = providerConfig.baseUrl.split('?')[0];
        const paymentUrl = `${aggregatorPageUrl}?orderId=${idCommande}&total=${data.total}&ref=${transactionReference}&provider=${selectedProvider}&baseUrl=${encodeURIComponent(cleanBaseUrl)}`;
        
        // L'ancienne logique de remplacement est maintenant gérée par la page abmcymarket.html elle-même.
        
        // NOUVEAU: Envoyer l'email de "Paiement en attente" au client avec l'URL de la page d'instructions
        const emailData = { customerEmail: data.customer.email, orderId: idCommande, total: data.total, paymentUrl: paymentUrl, paymentProvider: providerConfig.name };
        sendAbmcyStatusEmail(emailData, 'pending');

        // NOUVEAU: Envoyer un email de notification à l'admin avec le lien de confirmation
        const adminNotificationData = { id: idCommande, clientId: data.idClient, total: data.total, customerEmail: data.customer.email };
        const originalOrderData = { produits: data.produits };
        // Le type 'abmcy_pending' déclenchera l'ajout du lien de confirmation
        sendOrderConfirmationEmail(adminNotificationData, originalOrderData, 'abmcy_pending');


        logAction('createAbmcyAggregatorInvoice', { id: idCommande, provider: selectedProvider, url: paymentUrl });
        return createJsonResponse({ success: true, payment_url: paymentUrl, orderId: idCommande }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'createAbmcyAggregatorInvoice', data }), error);
        sendPaymentFailureEmail('ABMCY Aggregator', error, data);
        return createJsonResponse({ success: false, error: `Erreur ABMCY Aggregator: ${error.message}` }, origin);
    } finally {
        lock.releaseLock();
    }
}

/**
 * NOUVEAU: Récupère le statut d'un paiement ABMCY Aggregator.
 * Utilisé par le front-end pour le polling.
 * @param {object} data - Contient { orderId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec le statut.
 */
function getAbmcyPaymentStatus(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];
        const idCommandeIndex = headers.indexOf("IDCommande");
        const statutIndex = headers.indexOf("Statut");

        if (!data.orderId) {
            return createJsonResponse({ success: false, error: "L'ID de la commande est manquant." }, origin);
        }

        const orderRow = allOrders.find(row => row[idCommandeIndex] === data.orderId);

        if (!orderRow) {
            return createJsonResponse({ success: false, error: "Commande non trouvée." }, origin);
        }

        const currentStatus = orderRow[statutIndex];
        const orderObject = headers.reduce((obj, header, index) => {
            obj[header] = orderRow[index];
            return obj;
        }, {});

        logAction('getAbmcyPaymentStatus', { orderId: data.orderId, status: currentStatus });
        return createJsonResponse({ success: true, status: currentStatus, order: orderObject }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'getAbmcyPaymentStatus', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Envoie un email au client concernant le statut de son paiement ABMCY.
 * @param {object} data - Contient { customerEmail, orderId, total, paymentUrl, paymentProvider }.
 * @param {string} statusType - 'pending' ou 'confirmed'.
 */
function sendAbmcyStatusEmail(data, statusType) {
    if (!data.customerEmail) {
        logAction('sendAbmcyStatusEmail', { warning: `Tentative d'envoi d'email sans adresse pour la commande ${data.orderId}.` });
        return;
    }

    let subject, body;

    if (statusType === 'pending') {
        subject = `Votre commande #${data.orderId} est en attente de paiement`;
        body = `
            <h2>Bonjour,</h2>
            <p>Votre commande <strong>#${data.orderId}</strong> a bien été enregistrée et est en attente de votre paiement.</p>
            <p>Pour finaliser votre commande, veuillez effectuer le paiement de <strong>${data.total.toLocaleString('fr-FR')} F CFA</strong> via <strong>${data.paymentProvider}</strong>.</p>
            <p>Vous disposez de 25 minutes pour effectuer le paiement avant que la commande n'expire.</p>
            <p style="text-align:center; margin: 20px 0;">
                <a href="${data.paymentUrl}" style="background-color: #D4AF37; color: black; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Payer ma commande maintenant
                </a>
            </p>
            <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur : ${data.paymentUrl}</p>
            <p>Merci de votre confiance,<br>L'équipe ABMCY MARKET.</p>
        `;
    } else if (statusType === 'confirmed') {
        subject = `Paiement confirmé pour votre commande #${data.orderId}`;
        body = `
            <h2>Bonjour,</h2>
            <p>Bonne nouvelle ! Nous avons bien reçu votre paiement pour la commande <strong>#${data.orderId}</strong>.</p>
            <p>Votre commande est maintenant confirmée et nous allons commencer à la préparer pour l'expédition.</p>
            <p>Vous pouvez suivre son statut à tout moment sur notre site.</p>
            <p>Merci de votre confiance,<br>L'équipe ABMCY MARKET.</p>
        `;
    } else {
        return; // Type de statut non reconnu
    }

    try {
        MailApp.sendEmail(data.customerEmail, subject, "", { htmlBody: body });
        logAction('sendAbmcyStatusEmail', { orderId: data.orderId, email: data.customerEmail, status: statusType });
    } catch (error) {
        logError('sendAbmcyStatusEmail', error);
    }
}

/**
 * NOUVEAU: Fonction utilitaire pour trouver l'email d'un client à partir de son ID de commande.
 * C'est une simplification. Idéalement, l'email devrait être stocké avec la commande.
 */
function findCustomerEmailByOrderId(orderId, allOrders, headers) {
    const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    const usersHeaders = usersData.shift();
    const orderRow = allOrders.find(row => row[headers.indexOf("IDCommande")] === orderId);
    if (!orderRow) return null;
    const clientId = orderRow[headers.indexOf("IDClient")];
    const userRow = usersData.find(row => row[usersHeaders.indexOf("IDClient")] === clientId);
    return userRow ? userRow[usersHeaders.indexOf("Email")] : null;
}

/**
 * NOUVEAU: Enregistre une tentative de paiement dans l'historique de l'agrégateur et envoie un email au client.
 * @param {object} data - Données de la tentative de paiement.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function initiateAbmcyPayment(data, origin) {
    try {
        const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ABMCY_AGGREGATOR_HISTORY);
        if (!historySheet) {
            throw new Error(`La feuille '${SHEET_NAMES.ABMCY_AGGREGATOR_HISTORY}' est introuvable.`);
        }

        // Les en-têtes attendus dans la feuille d'historique
        const headers = ["Timestamp", "IDCommande", "Montant", "MoyenPaiement", "TransactionReference", "NomExpediteur", "NumeroExpediteur", "StatutLog", "NotesAdmin"];
        
        // Construire la ligne à partir des données reçues
        const newRow = headers.map(header => {
            if (header === "Timestamp") return new Date();
            return data[header] || ''; // Utiliser la valeur de 'data' ou une chaîne vide si non fournie
        });

        historySheet.appendRow(newRow);

        // Envoyer l'email de rappel au client
        if (data.EmailClient) {
            const subject = `Finalisez le paiement de votre commande #${data.IDCommande}`;
            // Reconstruire l'URL de la page de l'agrégateur pour l'email
            const aggregatorUrl = `https://abmcymarket.abmcy.com/abmcy_aggregator.html?orderId=${data.IDCommande}&amount=${data.Montant}&provider=${data.MoyenPaiement}`;
            const body = `
                <p>Bonjour ${data.NomExpediteur},</p>
                <p>Vous avez initié un paiement pour la commande <strong>#${data.IDCommande}</strong> d'un montant de <strong>${data.Montant.toLocaleString('fr-FR')} F CFA</strong>.</p>
                <p>Si vous n'avez pas encore finalisé la transaction, vous pouvez le faire en cliquant sur le lien ci-dessous :</p>
                <p><a href="${aggregatorUrl}" style="font-weight:bold;">Finaliser mon paiement</a></p>
                <p>Ce lien vous redirigera vers la page de paiement sécurisée.</p>
                <p>L'équipe ABMCY MARKET</p>
            `;
            MailApp.sendEmail(data.EmailClient, subject, "", { htmlBody: body });
        }

        logAction('initiateAbmcyPayment', { 
            orderId: data.IDCommande, 
            provider: data.MoyenPaiement,
            emailSent: !!data.EmailClient 
        });

        // Comme c'est une requête "fire-and-forget", on renvoie juste un succès.
        return createJsonResponse({ success: true, message: "Initiation de paiement enregistrée." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'initiateAbmcyPayment', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Enregistre une tentative de paiement dans l'historique de l'agrégateur et envoie un email au client.
 * @param {object} data - Données de la tentative de paiement.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function initiateAbmcyPayment(data, origin) {
    try {
        const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ABMCY_AGGREGATOR_HISTORY);
        if (!historySheet) {
            throw new Error(`La feuille '${SHEET_NAMES.ABMCY_AGGREGATOR_HISTORY}' est introuvable.`);
        }

        // Les en-têtes attendus dans la feuille d'historique
        const headers = ["Timestamp", "IDCommande", "Montant", "MoyenPaiement", "TransactionReference", "NomExpediteur", "NumeroExpediteur", "StatutLog", "NotesAdmin"];
        
        // Construire la ligne à partir des données reçues
        const newRow = headers.map(header => {
            if (header === "Timestamp") return new Date();
            return data[header] || ''; // Utiliser la valeur de 'data' ou une chaîne vide si non fournie
        });

        historySheet.appendRow(newRow);

        // Envoyer l'email de rappel au client
        if (data.EmailClient) {
            const subject = `Finalisez le paiement de votre commande #${data.IDCommande}`;
            // Reconstruire l'URL de la page de l'agrégateur pour l'email
            const aggregatorUrl = `https://abmcymarket.abmcy.com/abmcy_aggregator.html?orderId=${data.IDCommande}&amount=${data.Montant}&provider=${data.MoyenPaiement}`;
            const body = `
                <p>Bonjour ${data.NomExpediteur},</p>
                <p>Vous avez initié un paiement pour la commande <strong>#${data.IDCommande}</strong> d'un montant de <strong>${data.Montant.toLocaleString('fr-FR')} F CFA</strong>.</p>
                <p>Si vous n'avez pas encore finalisé la transaction, vous pouvez le faire en cliquant sur le lien ci-dessous :</p>
                <p><a href="${aggregatorUrl}" style="font-weight:bold;">Finaliser mon paiement</a></p>
                <p>Ce lien vous redirigera vers la page de paiement sécurisée.</p>
                <p>L'équipe ABMCY MARKET</p>
            `;
            MailApp.sendEmail(data.EmailClient, subject, "", { htmlBody: body });
        }

        logAction('initiateAbmcyPayment', { 
            orderId: data.IDCommande, 
            provider: data.MoyenPaiement,
            emailSent: !!data.EmailClient 
        });

        // Comme c'est une requête "fire-and-forget", on renvoie juste un succès.
        return createJsonResponse({ success: true, message: "Initiation de paiement enregistrée." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'initiateAbmcyPayment', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Envoie un email de confirmation de commande à l'admin. Fusionné depuis Gestion Notifications.
 * @param {object} orderResult - Le résultat de la fonction enregistrerCommande.
 * @param {object} originalData - Les données originales de la commande contenant les détails des produits.
 * @param {string} type - Le type de confirmation ('cod' pour cash on delivery, 'payment' pour paiement en ligne).
 */
function sendOrderConfirmationEmail(orderData, originalData, type) {
    try {
        // 1. Envoyer l'email à l'administrateur
        let adminSubject, adminBodyHTML;
        const adminConfirmationUrl = ScriptApp.getService().getUrl() + "?action=showAbmcyAdmin";

        if (type === 'abmcy_pending') {
            adminSubject = `⏳ Paiement initié pour commande #${orderData.id}`;
            adminBodyHTML = `
                <p>Un paiement a été initié via l'agrégateur ABMCY pour la commande <strong>#${orderData.id}</strong>.</p>
                <p><strong>Montant :</strong> ${orderData.total.toLocaleString('fr-FR')} F CFA</p>
                <p>Veuillez vérifier la réception des fonds avant de confirmer manuellement.</p>
                <a href="${adminConfirmationUrl}" style="display: inline-block; padding: 10px 15px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Confirmer le paiement</a>
            `;
        } else { // 'cod' ou autre
            adminSubject = `Nouvelle commande #${orderData.id} (Paiement à la livraison)`;
            // NOUVEAU: Email admin beaucoup plus détaillé
            const productDetailsHTML = originalData.produits.map(p => `<li>${p.name} (x${p.quantity}) - ${p.price.toLocaleString('fr-FR')} F CFA</li>`).join('');
            adminBodyHTML = `
                <h2>Nouvelle commande #${orderData.id}</h2>
                <p><strong>Client :</strong> ${originalData.customer.name} (${originalData.customer.email}, Tél: ${originalData.customer.phone})</p>
                <p><strong>Montant Total :</strong> <strong style="color: #D4AF37;">${orderData.total.toLocaleString('fr-FR')} F CFA</strong></p>
                <p><strong>Moyen de paiement :</strong> ${originalData.moyenPaiement}</p>
                <p><strong>Adresse de livraison :</strong> ${originalData.adresseLivraison}</p>
                <p><strong>Date de livraison estimée :</strong> ${new Date(orderData.dateLivraisonEstimee).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <hr>
                <h3>Détails des produits :</h3>
                <ul>${productDetailsHTML}</ul>
                <hr>
                <p><strong>Note du client :</strong> ${originalData.notes || 'Aucune'}</p>
            `;
        }
        MailApp.sendEmail(ADMIN_EMAIL, adminSubject, "", { htmlBody: adminBodyHTML });
        logAction('sendAdminConfirmationEmail', { orderId: orderData.id, type: type });

        // 2. Envoyer l'email de confirmation au client
        if (orderData.customerEmail) {
            const customerSubject = `Confirmation de votre commande #${orderData.id}`;
            const productDetailsHTML = originalData.produits.map(p => `<li>${p.name} (x${p.quantity}) - ${p.price.toLocaleString('fr-FR')} F CFA</li>`).join('');
            const customerBodyHTML = `
                <h2>Bonjour,</h2>
                <p>Merci pour votre commande sur ABMCY MARKET !</p>
                <p>Nous avons bien reçu votre commande <strong>#${orderData.id}</strong> et nous la préparons pour l'expédition.</p>
                <p><strong>Date de livraison estimée :</strong> ${new Date(orderData.dateLivraisonEstimee).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p><h3>Récapitulatif de votre commande :</h3>
                <ul>${productDetailsHTML}</ul>
                <p><strong>Total : ${orderData.total.toLocaleString('fr-FR')} F CFA</strong></p>
                <p>Vous pouvez suivre l'avancement de votre commande à tout moment ici : <a href="https://abmcymarket.abmcy.com/suivi-commande.html?orderId=${orderData.id}">Suivre ma commande</a></p>
                <p>L'équipe ABMCY MARKET.</p>
            `;
            MailApp.sendEmail(orderData.customerEmail, customerSubject, "", { htmlBody: customerBodyHTML });
            logAction('sendCustomerConfirmationEmail', { orderId: orderData.id, email: orderData.customerEmail });
        }
    } catch (error) {
        logError('sendOrderConfirmationEmail', error);
    }
}

/**
 * NOUVEAU: Gère le webhook (IPN) de confirmation de paiement de Paydunya.
 * @param {object} e - L'objet événement complet de la requête POST.
 */
function handlePaydunyaWebhook(e) {
    const webhookData = e.parameter;
    const headers = e.headers;

    try {
        // --- Étape 1: Vérification de sécurité ---
        const signature = headers['Paydunya-Signature'];
        const invoiceToken = webhookData.data.invoice.token;
        const config = getConfig();

        const expectedSignature = Utilities.base64Encode(
            Utilities.computeHmacSha256Signature(invoiceToken, config.PAYDUNYA_MASTER_KEY)
        );

        if (signature !== expectedSignature) {
            logAction('IPN_SECURITY_FAIL', { received: signature, expected: expectedSignature, data: webhookData });
            throw new Error("Signature de webhook invalide. Tentative de fraude possible.");
        }

        // --- Étape 2: Traitement de la notification ---
        const status = webhookData.data.status;
        const customData = webhookData.data.custom_data || {};
        const orderId = customData.order_id;

        if (!orderId) {
            throw new Error("ID de commande manquant dans les données du webhook.");
        }

        if (status === 'completed') {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
            const sheetData = sheet.getDataRange().getValues();
            const sheetHeaders = sheetData[0];
            const idCommandeIndex = sheetHeaders.indexOf("IDCommande");
            const statutIndex = sheetHeaders.indexOf("Statut");
            const etapeConfirmeeIndex = sheetHeaders.indexOf("EtapeConfirmee");

            const rowIndex = sheetData.findIndex(row => row[idCommandeIndex] === orderId);

            if (rowIndex > 0) {
                // Mettre à jour le statut et l'étape de confirmation
                sheet.getRange(rowIndex + 1, statutIndex + 1).setValue("Payée et confirmée");
                sheet.getRange(rowIndex + 1, etapeConfirmeeIndex + 1).setValue(true);

                logAction('PAIEMENT_REUSSI', { orderId: orderId, webhookData: webhookData });

                // --- Étape 3: Envoyer l'email de confirmation de paiement au client ---
                const customerEmail = webhookData.data.customer.email;
                const totalAmount = webhookData.data.invoice.total_amount;
                
                if (customerEmail) {
                    const emailSubject = `Confirmation de paiement pour votre commande #${orderId}`;
                    const emailBody = `
                        <h2>Bonjour,</h2>
                        <p>Nous confirmons avoir bien reçu votre paiement de <strong>${Number(totalAmount).toLocaleString('fr-FR')} F CFA</strong> pour la commande <strong>#${orderId}</strong>.</p>
                        <p>Votre commande est maintenant confirmée et va être préparée pour l'expédition.</p>
                        <p>Vous pouvez suivre son avancement ici : <a href="https://abmcymarket.abmcy.com/suivi-commande.html?orderId=${orderId}">Suivre ma commande</a></p>
                        <p>Merci de votre confiance.</p>
                        <p>L'équipe ABMCY MARKET.</p>
                    `;
                    MailApp.sendEmail(customerEmail, emailSubject, "", { htmlBody: emailBody });
                    logAction('EMAIL_CONFIRMATION_PAIEMENT', { orderId: orderId, email: customerEmail });
                }
            }
        } else {
            logAction('PAIEMENT_NON_COMPLETE', { orderId: orderId, status: status, webhookData: webhookData });
            sendPaymentFailureEmail('Paydunya Webhook', new Error(`Statut: ${status}`), { orderId: orderId, webhookData: webhookData }); // NOUVEAU
        }
    } catch (error) { // CORRECTION: Passer 'e.postData.contents' pour le contexte de l'erreur
        logError('handlePaydunyaWebhook', error, e.postData.contents);
    }
}


/**
 * Récupère les commandes d'un client spécifique.
 * @param {object} data - Contient { clientId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec la liste des commandes.
 */
function getOrdersByClientId(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];
        const idClientIndex = headers.indexOf("IDClient");

        const clientOrdersData = allOrders.filter(row => row[idClientIndex] === data.clientId);

        const clientOrders = clientOrdersData.map(row => {
            return headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
        }).reverse(); // Afficher les plus récentes en premier

        return createJsonResponse({ success: true, data: clientOrders }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'getOrdersByClientId', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Récupère les paramètres de paiement depuis la feuille Config.
 * @param {object} data - Données de la requête (inutilisé ici).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les paramètres.
 */
function getPaymentSettings(data, origin) {
    try {
        const config = getConfig(); // Utilise la fonction existante qui lit depuis la feuille Config
        // On retourne directement les clés nécessaires au tableau de bord
        const settings = {
            PAYDUNYA_ACTIVE: String(config.PAYDUNYA_ACTIVE).toLowerCase() === 'true',
            PAYDUNYA_MASTER_KEY: config.PAYDUNYA_MASTER_KEY,
            PAYDUNYA_PRIVATE_KEY: config.PAYDUNYA_PRIVATE_KEY,
            PAYDUNYA_TOKEN: config.PAYDUNYA_TOKEN,
            PAYDUNYA_PUBLIC_KEY: config.PAYDUNYA_PUBLIC_KEY,
            ABMCY_AGGREGATOR_ACTIVE: String(config.ABMCY_AGGREGATOR_ACTIVE).toLowerCase() === 'true', // NOUVEAU
            ABMCY_PAYMENT_METHODS: config.ABMCY_PAYMENT_METHODS || {} // NOUVEAU: Renvoyer l'objet des méthodes de paiement
        };
        return createJsonResponse({ success: true, data: settings }, origin);
    } catch (error) {
        logError('getPaymentSettings', error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Sauvegarde les paramètres des agrégateurs de paiement dans la feuille Config.
 * @param {object} data - Les nouveaux paramètres.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function savePaymentSettings(data, origin) {
    try {
        // On pourrait ajouter une vérification d'administrateur ici.
        const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONFIG);
        const configData = configSheet.getDataRange().getValues();

        const settingsToUpdate = {
            'PAYDUNYA_ACTIVE': data.PAYDUNYA_ACTIVE,
            'PAYDUNYA_MASTER_KEY': data.PAYDUNYA_MASTER_KEY,
            'PAYDUNYA_PRIVATE_KEY': data.PAYDUNYA_PRIVATE_KEY,
            'PAYDUNYA_TOKEN': data.PAYDUNYA_TOKEN,
            'ABMCY_AGGREGATOR_ACTIVE': data.ABMCY_AGGREGATOR_ACTIVE, // NOUVEAU
        };

        Object.entries(settingsToUpdate).forEach(([key, value]) => {
            const rowIndex = configData.findIndex(row => row[0] === key);
            if (rowIndex > -1) {
                // Mettre à jour la valeur dans la colonne 2 (index 1)
                configSheet.getRange(rowIndex + 1, 2).setValue(value);
            } else {
                // Ajouter la nouvelle clé/valeur si elle n'existe pas
                configSheet.appendRow([key, value]);
            }
        });

        // Invalider le cache pour que les prochaines lectures prennent en compte les changements
        CacheService.getScriptCache().remove('script_config');
        logAction('savePaymentSettings', { user: 'admin' });
        return createJsonResponse({ success: true, message: "Paramètres sauvegardés." }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'savePaymentSettings', data }), error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Récupère toutes les données nécessaires pour le tableau de bord en un seul appel.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec toutes les données du tableau de bord.
 */
function getDashboardData(origin) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        
        // 1. Statistiques générales
        const ordersSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
        const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);

        const numOrders = ordersSheet.getLastRow() - 1;
        const numUsers = usersSheet.getLastRow() - 1;
        const totalSales = ordersSheet.getRange("D2:D" + ordersSheet.getLastRow()).getValues()
            .reduce((sum, row) => sum + (Number(row[0]) || 0), 0);

        const stats = {
            totalSales: totalSales,
            orderCount: numOrders,
            userCount: numUsers
        };

        // 2. Données pour le graphique des ventes (7 derniers jours)
        const salesData = getSalesDataForChart(origin, true); // true pour indiquer un appel interne

        // 3. Transactions récentes
        const recentTransactions = getRecentTransactions(null, origin, true); // true pour un appel interne

        // 4. Paramètres de paiement
        const paymentSettings = getPaymentSettings(null, origin, true); // true pour un appel interne

        const dashboardData = {
            stats: stats,
            salesChartData: salesData.data,
            recentTransactions: recentTransactions.data,
            paymentSettings: paymentSettings.data
        };

        return createJsonResponse({ success: true, data: dashboardData }, origin);

    } catch (error) {
        logError('getDashboardData', error, origin);
        return createJsonResponse({ success: false, error: `Erreur lors de la récupération des données du tableau de bord: ${error.message}` }, origin);
    }
}

/**
 * NOUVEAU: Récupère les données de ventes pour le graphique du tableau de bord.
 * @param {string} origin - L'origine de la requête.
 * @param {boolean} [internalCall=false] - Si true, retourne l'objet de données au lieu d'une réponse JSON.
 * @returns {GoogleAppsScript.Content.TextOutput|object} Réponse JSON ou objet de données.
 */
function getSalesDataForChart(origin, internalCall = false) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const data = sheet.getRange("D2:F" + sheet.getLastRow()).getValues(); // Colonnes MontantTotal (D) et Date (F)

        const salesByDay = {};
        const today = new Date();
        const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

        // Initialiser les 7 derniers jours à 0
        for (let i = 0; i < 7; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const key = d.toISOString().split('T')[0]; // Format YYYY-MM-DD
            salesByDay[key] = 0;
        }

        data.forEach(row => {
            const amount = Number(row[0]);
            const date = new Date(row[2]);
            if (!isNaN(amount) && date >= sevenDaysAgo) {
                const key = date.toISOString().split('T')[0];
                if (salesByDay.hasOwnProperty(key)) {
                    salesByDay[key] += amount;
                }
            }
        });

        // Trier les données par date pour le graphique
        const sortedSales = Object.entries(salesByDay).sort((a, b) => new Date(a[0]) - new Date(b[0]));
        const labels = sortedSales.map(entry => new Date(entry[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        const values = sortedSales.map(entry => entry[1]);

        const chartData = { labels, values };

        if (internalCall) {
            return { success: true, data: chartData };
        }
        return createJsonResponse({ success: true, data: chartData }, origin);

    } catch (error) {
        logError('getSalesDataForChart', error, origin);
        return createJsonResponse({ success: false, error: `Erreur lors de la récupération des données du graphique: ${error.message}` }, origin);
    }
}

/**
 * NOUVEAU: Récupère les transactions de paiement récentes pour le tableau de bord.
 * @param {object} data - Données de la requête (inutilisé ici).
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les transactions.
 */
function getRecentTransactions(data, origin, internalCall = false) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];

        const paymentMethodIndex = headers.indexOf("MoyenPaiement");

        // Filtrer pour ne garder que les paiements en ligne, prendre les 50 derniers
        const onlinePayments = allOrders.filter(row => 
            row[paymentMethodIndex] === 'Paydunya'
        ).slice(-50); // Prend les 50 dernières transactions

        const transactions = onlinePayments.map(row => {
            return headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
        }).reverse(); // Afficher les plus récentes en premier

        const responseData = { success: true, data: transactions.slice(0, 10) }; // Limiter à 10 pour l'affichage

        if (internalCall) {
            return responseData;
        }
        return createJsonResponse({ success: true, data: transactions }, origin);

    } catch (error) {
        logError('getRecentTransactions', error, origin);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Envoie un email d'alerte en cas d'échec de paiement.
 * @param {string} provider - Le nom du fournisseur de paiement (ex: "Paydunya", "PawaPay").
 * @param {Error} error - L'objet erreur capturé.
 * @param {object} orderContext - Les données de la commande ou du contexte de l'erreur.
 */
function sendPaymentFailureEmail(provider, error, orderContext) {
    try {
        const subject = `⚠️ Alerte: Échec de paiement ${provider}`;
        
        // Formatter le contexte de la commande pour l'email
        let contextHtml = '<h3>Contexte de la commande :</h3><ul>';
        if (orderContext.data && orderContext.data.customer) {
            contextHtml += `<li>Client: ${orderContext.data.customer.name} (${orderContext.data.customer.email})</li>`;
            contextHtml += `<li>Montant: ${orderContext.data.total} F CFA</li>`;
        } else if (orderContext.orderId) {
            contextHtml += `<li>ID Commande: ${orderContext.orderId}</li>`;
        } else {
            contextHtml += '<li>Contexte de la commande non disponible.</li>';
        }
        contextHtml += '</ul>';

        const body = `
            <h2>Une tentative de paiement via ${provider} a échoué.</h2>
            <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
            <p><strong>Message d'erreur :</strong> ${error.message}</p>
            <hr>
            ${contextHtml}
            <p>Veuillez consulter les logs pour plus de détails.</p>
        `;
        MailApp.sendEmail(ADMIN_EMAIL, subject, "", { htmlBody: body });
        logAction('sendPaymentFailureEmail', { provider: provider, error: error.message });
    } catch (e) {
        logError('sendPaymentFailureEmail', e);
    }
}

/**
 * NOUVEAU: Exporte toutes les commandes en format CSV.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON contenant les données CSV.
 */
function exportOrdersToCSV(origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const data = sheet.getDataRange().getValues();

        // Fonction utilitaire pour s'assurer que les champs CSV sont correctement formatés
        const toCsvField = (field) => {
            let value = field === null || field === undefined ? '' : String(field);
            // Si la valeur contient une virgule, des guillemets ou un retour à la ligne, on l'entoure de guillemets
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                // On double les guillemets existants à l'intérieur du champ
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }
            return value;
        };

        // Convertir chaque ligne en une ligne CSV
        const csvContent = data.map(row => row.map(toCsvField).join(',')).join('\n');

        logAction('exportOrdersToCSV', { user: 'admin' });

        // Renvoyer les données CSV dans une réponse JSON
        // Le téléchargement sera géré côté client
        return createJsonResponse({ success: true, csvData: csvContent }, origin);

    } catch (error) {
        logError('exportOrdersToCSV', error, origin);
        return createJsonResponse({ success: false, error: `Erreur lors de l'export CSV: ${error.message}` }, origin);
    }
}


/**
 * NOUVEAU: Récupère une commande spécifique par son ID.
 * @param {object} data - Contient { orderId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les détails de la commande.
 */
function getOrderById(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
        const allOrders = sheet.getDataRange().getValues();
        const headers = allOrders.shift() || [];
        const idCommandeIndex = headers.indexOf("IDCommande");

        if (!data.orderId) {
            return createJsonResponse({ success: false, error: "L'ID de la commande est manquant." }, origin);
        }

        const orderRow = allOrders.find(row => row[idCommandeIndex] === data.orderId);

        if (!orderRow) {
            return createJsonResponse({ success: false, error: "Commande non trouvée. Veuillez vérifier le numéro de commande." }, origin);
        }

        const orderObject = headers.reduce((obj, header, index) => {
            obj[header] = orderRow[index];
            return obj;
        }, {});

        return createJsonResponse({ success: true, data: orderObject }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'getOrderById', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Met à jour les informations d'un profil utilisateur.
 * @param {object} data - Contient { clientId, updatedData: { Nom, Telephone, Adresse } }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function updateUserProfile(data, origin) {
    try {
        if (!data.clientId || !data.updatedData) {
            throw new Error("Données de mise à jour incomplètes.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers.shift() || [];
        
        const idClientIndex = headers.indexOf("IDClient");
        const rowIndex = allUsers.findIndex(row => row[idClientIndex] === data.clientId);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Utilisateur non trouvé." }, origin);
        }

        // Mettre à jour les colonnes spécifiques
        const rowToUpdate = rowIndex + 2; // +1 pour l'index 0, +1 pour la ligne d'en-tête
        const { Nom, Telephone, Adresse } = data.updatedData;

        const nomIndex = headers.indexOf("Nom");
        const telIndex = headers.indexOf("Telephone");
        const adresseIndex = headers.indexOf("Adresse");

        if (nomIndex > -1 && Nom !== undefined) sheet.getRange(rowToUpdate, nomIndex + 1).setValue(Nom);
        if (telIndex > -1 && Telephone !== undefined) sheet.getRange(rowToUpdate, telIndex + 1).setValue(Telephone);
        if (adresseIndex > -1 && Adresse !== undefined) sheet.getRange(rowToUpdate, adresseIndex + 1).setValue(Adresse);

        logAction('updateUserProfile', { clientId: data.clientId });
        return createJsonResponse({ success: true, message: "Profil mis à jour avec succès." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'updateUserProfile', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}


/**
 * NOUVEAU: Met à jour l'adresse d'un utilisateur.
 * @param {object} data - Contient { clientId, newAddress }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function updateUserAddress(data, origin) {
    try {
        if (!data.clientId || !data.newAddress) {
            throw new Error("ID client ou nouvelle adresse manquant.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
        const allUsers = sheet.getDataRange().getValues();
        const headers = allUsers[0];
        const idClientIndex = headers.indexOf("IDClient");
        const addressIndex = headers.indexOf("Adresse");

        if (idClientIndex === -1 || addressIndex === -1) {
            throw new Error("Colonnes 'IDClient' ou 'Adresse' introuvables.");
        }

        const rowIndex = allUsers.findIndex(row => row[idClientIndex] === data.clientId);

        if (rowIndex === -1) {
            return createJsonResponse({ success: false, error: "Utilisateur non trouvé." }, origin);
        }

        sheet.getRange(rowIndex + 1, addressIndex + 1).setValue(data.newAddress);
        logAction('updateUserAddress', { clientId: data.clientId });
        return createJsonResponse({ success: true, message: "Adresse mise à jour avec succès." }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'updateUserAddress', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}
/**
 * NOUVEAU: Récupère les adresses d'un utilisateur.
 * @param {object} data - Contient { clientId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function getUserAddresses(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ADDRESSES);
        if (!sheet) throw new Error("La feuille 'Adresses' est introuvable.");

        const allAddresses = sheet.getDataRange().getValues();
        const headers = allAddresses.shift() || [];
        const idClientIndex = headers.indexOf("IDClient");

        const userAddressesData = allAddresses.filter(row => row[idClientIndex] === data.clientId);

        const userAddresses = userAddressesData.map(row => {
            return headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});
        });

        return createJsonResponse({ success: true, data: userAddresses }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'getUserAddresses', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Ajoute une nouvelle adresse pour un utilisateur.
 * @param {object} data - Contient { IDClient, Label, Details }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function addUserAddress(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ADDRESSES);
        if (!sheet) throw new Error("La feuille 'Adresses' est introuvable.");

        const idAdresse = "ADR-" + new Date().getTime();
        sheet.appendRow([idAdresse, data.IDClient, data.Label, data.Details]);

        logAction('addUserAddress', { clientId: data.IDClient, addressId: idAdresse });
        return createJsonResponse({ success: true, id: idAdresse }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'addUserAddress', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Met à jour une adresse existante.
 * @param {object} data - Contient { IDAdresse, Label, Details }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function updateUserAddress(data, origin) { // Cette fonction existait mais était pour le profil, on la spécialise pour les adresses multiples
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ADDRESSES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData.shift() || [];
        const idIndex = headers.indexOf("IDAdresse");
        const labelIndex = headers.indexOf("Label");
        const detailsIndex = headers.indexOf("Details");

        const rowIndex = allData.findIndex(row => row[idIndex] === data.IDAdresse);
        if (rowIndex === -1) return createJsonResponse({ success: false, error: "Adresse non trouvée." }, origin);

        sheet.getRange(rowIndex + 2, labelIndex + 1).setValue(data.Label);
        sheet.getRange(rowIndex + 2, detailsIndex + 1).setValue(data.Details);

        logAction('updateUserAddress', { addressId: data.IDAdresse });
        return createJsonResponse({ success: true, id: data.IDAdresse }, origin);
    } catch (error) {
        logError(JSON.stringify({ action: 'updateUserAddress', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

/**
 * NOUVEAU: Supprime une adresse.
 * @param {object} data - Contient { IDAdresse }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function deleteUserAddress(data, origin) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ADDRESSES);
        const allData = sheet.getDataRange().getValues();
        const idIndex = allData[0].indexOf("IDAdresse");
        const rowIndex = allData.findIndex(row => row[idIndex] === data.IDAdresse);
        if (rowIndex === -1) return createJsonResponse({ success: false, error: "Adresse non trouvée." }, origin);
        sheet.deleteRow(rowIndex + 1);
        return createJsonResponse({ success: true, id: data.IDAdresse }, origin);
    } catch (error) {
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}
/**
 * NOUVEAU: Définit une adresse comme étant celle par défaut pour un client.
 * @param {object} data - Contient { clientId, addressId }.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function setDefaultAddress(data, origin) {
    try {
        if (!data.clientId || !data.addressId) {
            throw new Error("ID client ou ID d'adresse manquant.");
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ADDRESSES);
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const idClientIndex = headers.indexOf("IDClient");
        const idAdresseIndex = headers.indexOf("IDAdresse");
        const isDefaultIndex = headers.indexOf("IsDefault");

        if (isDefaultIndex === -1) {
            throw new Error("La colonne 'IsDefault' est introuvable dans la feuille 'Adresses'.");
        }

        // Parcourir toutes les lignes pour mettre à jour les adresses de ce client
        for (let i = 1; i < allData.length; i++) {
            const row = allData[i];
            if (row[idClientIndex] === data.clientId) {
                // Si c'est l'adresse à définir par défaut, mettre TRUE. Sinon, mettre FALSE.
                const isTargetAddress = (row[idAdresseIndex] === data.addressId);
                sheet.getRange(i + 1, isDefaultIndex + 1).setValue(isTargetAddress);
            }
        }

        logAction('setDefaultAddress', { clientId: data.clientId, addressId: data.addressId });
        return createJsonResponse({ success: true, message: "Adresse par défaut mise à jour." }, origin);

    } catch (error) {
        logError(JSON.stringify({ action: 'setDefaultAddress', data }), error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}


/**
 * Enregistre un événement envoyé par le client dans la feuille de logs.
 * @param {object} data - L'objet log envoyé par le client.
 * @param {string} origin - L'origine de la requête.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function logClientEvent(data, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const details = {
            message: data.message,
            url: data.url,
            error: data.error,
            payload: data.payload,
            origin: origin
        };
        logSheet.appendRow([new Date(data.timestamp), 'FRONT-END', data.type, JSON.stringify(details)]);
        return createJsonResponse({ success: true }, origin);
    } catch (e) {
        return createJsonResponse({ success: false, error: e.message }, origin);
    }
}

/**
 * Récupère les 100 derniers journaux pour la page log.html.
 * @param {object} params - Paramètres de la requête GET.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.
 */
function getAppLogs(params, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        const lastRow = logSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 99);
        const numRows = lastRow > 1 ? lastRow - startRow + 1 : 0;
        const logs = (numRows > 0) ? logSheet.getRange(startRow, 1, numRows, 4).getValues() : [];
        return createJsonResponse({ success: true, logs: logs.reverse() }, origin);
    } catch (error) {
        logError('getAppLogs', error);
        return createJsonResponse({ success: false, error: error.message }, origin);
    }
}

// --- FONCTIONS UTILITAIRES ---

/**
 * Crée une réponse JSON standardisée avec le MimeType.
 * CORRECTION: Ajoute systématiquement l'en-tête CORS à chaque réponse.
 * @param {object} data - L'objet à convertir en JSON.
 * @param {string} [origin] - L'origine de la requête pour l'en-tête CORS.
 * @returns {GoogleAppsScript.Content.TextOutput} Un objet TextOutput.
 */
function createJsonResponse(data, origin) {
    const response = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    // CORRECTION: La vérification doit se faire avec une recherche de clé dans l'objet, pas avec .includes()
    if (origin && ALLOWED_ORIGINS[origin] === true) {
        response.addHeader('Access-Control-Allow-Origin', origin);
    }
    return response;
}

/**
 * Hache un mot de passe avec un sel (salt).
 * @param {string} password - Le mot de passe en clair.
 * @param {string} [salt] - Le sel à utiliser. Si non fourni, un nouveau sera généré.
 * @returns {{passwordHash: string, salt: string}} Le mot de passe haché et le sel utilisé.
 */
function hashPassword(password, salt) {
    const saltValue = salt || Utilities.getUuid();
    const hash = Utilities.computeHmacSha256Signature(password, saltValue);
    const passwordHash = Utilities.base64Encode(hash);
    return { passwordHash, salt: saltValue };
}

/**
 * Journalise une action réussie dans la feuille "Logs".
 * @param {string} action - Le nom de l'action.
 * @param {object} details - Les détails de l'action.
 */
function logAction(action, details) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        logSheet.appendRow([new Date(), "BACK-END", action, JSON.stringify(details)]);
    } catch (e) {
        console.error("Échec de la journalisation d'action: " + e.message);
    }
}

/**
 * Journalise une erreur dans la feuille "Logs".
 * @param {string} context - Le contexte où l'erreur s'est produite.
 * @param {Error} error - L'objet erreur.
 * @param {string} [origin] - L'origine de la requête pour plus de contexte.
 */
function logError(context, error, origin) {
    try {
        const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOGS);
        
        // NOUVEAU: Obtenir une suggestion de correction basée sur l'erreur.
        const suggestion = getCorrectionSuggestion(error, context);

        const errorDetails = {
            context: context,
            message: error.message,
            stack: error.stack,
            suggestion: suggestion, // NOUVEAU: Ajout de la suggestion au log.
            origin: origin || 'N/A'
        };
        logSheet.appendRow([new Date(), "BACK-END", "ERROR", JSON.stringify(errorDetails)]);

        // NOUVEAU: Surligner la ligne de l'erreur en rouge pour une meilleure visibilité.
        const lastRow = logSheet.getLastRow();
        logSheet.getRange(lastRow, 1, 1, logSheet.getLastColumn()).setBackground('#fce8e6'); // Rouge clair

    } catch (e) {
        console.error("Échec de la journalisation d'erreur: " + e.message);
    }
}

/**
 * NOUVEAU: Analyse une erreur et retourne une suggestion de correction.
 * @param {Error} error - L'objet erreur.
 * @param {string} context - Le contexte de l'erreur.
 * @returns {string} Une suggestion textuelle pour corriger le problème.
 */
function getCorrectionSuggestion(error, context) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("action non reconnue")) {
        return "Vérifiez que la valeur 'action' envoyée depuis le front-end (main.js) correspond exactement à un 'case' dans la fonction doPost() du script 'Gestion Compte.js'.";
    }
    if (errorMessage.includes("json.parse")) {
        return "La requête reçue n'est pas un JSON valide. Vérifiez que le front-end envoie bien une chaîne JSON correcte via JSON.stringify() dans le corps de la requête fetch().";
    }
    if (errorMessage.includes("cannot read property") || errorMessage.includes("of undefined")) {
        return `L'objet 'data' reçu est incomplet. Le code a tenté d'accéder à une propriété qui n'existe pas. Vérifiez que l'objet envoyé depuis le front-end pour l'action dans le contexte '${context}' contient toutes les propriétés requises.`;
    }
    if (errorMessage.includes("service invoked too many times")) {
        return "L'API Google a été appelée trop fréquemment. Vérifiez s'il y a des boucles ou des appels excessifs dans le code. Envisagez d'utiliser le cache pour réduire le nombre d'appels.";
    } else {
        return "Erreur générique. Vérifiez les détails du contexte et la trace de la pile (stack trace) pour identifier la source du problème. Assurez-vous que les données envoyées par le client sont conformes à ce que le serveur attend.";
    }
}

/**
 * NOUVEAU: Valide la force d'un mot de passe.
 * @param {string} password - Le mot de passe à valider.
 * @returns {boolean} True si le mot de passe est valide.
 */
function validatePassword(password) {
    if (!password || password.length < 8) return false;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasUpperCase && hasLowerCase && hasNumber && hasSymbol;
}

/**
 * Crée un menu personnalisé à l'ouverture de la feuille de calcul.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Configuration Module')
      .addItem('🚀 Initialiser le projet (Feuilles & Config)', 'setupProject')
      .addSeparator()
      .addItem('⏰ Configurer le déclencheur d\'expiration des paiements ABMCY', 'createAbmcyPaymentExpirationTrigger') // NOUVEAU
      .addSeparator() // NOUVEAU
      .addItem('🔑 Ouvrir la Confirmation Manuelle ABMCY', 'openAbmcyAdminInSidebar') // NOUVEAU
      .addItem('🔑 Ouvrir le Tableau de Bord Admin', 'openAdminDashboardInSidebar') // NOUVEAU
      .addToUi();
}

/**
 * Récupère la configuration depuis la feuille "Config" et la met en cache.
 * @returns {object} Un objet contenant la configuration.
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'script_config';
  const cachedConfig = cache.get(CACHE_KEY);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const defaultConfig = {
    allowed_origins: ["https://abmcymarket.vercel.app"],
    allowed_methods: "POST,GET,OPTIONS",
    allowed_headers: "Content-Type, X-Requested-With", // Ajout pour compatibilité
    delivery_options: {}, // NOUVEAU: Ajout depuis Gestion Livraisons
    allow_credentials: "true",
    PAYDUNYA_MASTER_KEY: "VOTRE_MASTER_KEY",
    PAYDUNYA_PRIVATE_KEY: "VOTRE_PRIVATE_KEY",
    PAYDUNYA_PUBLIC_KEY: "VOTRE_PUBLIC_KEY",
    PAYDUNYA_TOKEN: "VOTRE_TOKEN",
    ABMCY_AGGREGATOR_ACTIVE: "false", // NOUVEAU: Par défaut désactivé
    ABMCY_PAYMENT_METHODS: "{}" // NOUVEAU: JSON vide par défaut
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
      delivery_options: config.delivery_options ? JSON.parse(config.delivery_options) : defaultConfig.delivery_options,
      PAYDUNYA_MASTER_KEY: config.PAYDUNYA_MASTER_KEY || defaultConfig.PAYDUNYA_MASTER_KEY,
      PAYDUNYA_PRIVATE_KEY: config.PAYDUNYA_PRIVATE_KEY || defaultConfig.PAYDUNYA_PRIVATE_KEY,
      PAYDUNYA_PUBLIC_KEY: config.PAYDUNYA_PUBLIC_KEY || defaultConfig.PAYDUNYA_PUBLIC_KEY,
      PAYDUNYA_TOKEN: config.PAYDUNYA_TOKEN || defaultConfig.PAYDUNYA_TOKEN,
      ABMCY_AGGREGATOR_ACTIVE: config.ABMCY_AGGREGATOR_ACTIVE === 'true', // NOUVEAU
      ABMCY_PAYMENT_METHODS: config.ABMCY_PAYMENT_METHODS ? JSON.parse(config.ABMCY_PAYMENT_METHODS) : defaultConfig.ABMCY_PAYMENT_METHODS // NOUVEAU
    };

    cache.put(CACHE_KEY, JSON.stringify(finalConfig), 600); // Cache pendant 10 minutes
    return finalConfig;
  } catch (e) {
    return defaultConfig;
  }
}

/**
 * Initialise les feuilles de calcul nécessaires pour ce module.
 */
function setupProject() {
  // CORRECTION: Utilisation de 'ss' et 'ui' pour plus de clarté
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const sheetsToCreate = {
    [SHEET_NAMES.USERS]: ["IDClient", "Nom", "Email", "PasswordHash", "Salt", "Telephone", "Adresse", "DateInscription", "Statut", "Role", "ResetToken", "ResetTokenExpiry"], // CORRECTION: Ajout des colonnes pour la réinitialisation
    [SHEET_NAMES.ORDERS]: ["IDCommande", "IDClient", "DetailsProduits", "MontantTotal", "Statut", "Date", "EtapeConfirmee", "EtapePreparation", "EtapeExpediee", "EtapeLivree", "AdresseLivraison", "MoyenPaiement", "Notes", "TransactionReference", "InitiationTimestamp", "NomExpediteur", "NumeroExpediteur"], // NOUVEAU: Ajout de colonnes
    [SHEET_NAMES.LOGS]: ["Timestamp", "Source", "Action", "Détails"],
    [SHEET_NAMES.CONFIG]: ["Clé", "Valeur"],
    [SHEET_NAMES.ADDRESSES]: ["IDAdresse", "IDClient", "Label", "Details", "IsDefault"], // NOUVEAU
    [SHEET_NAMES.ENTREPRISES]: ["NumeroCompte", "NomEntreprise", "Type", "Proprietaire", "Telephone", "Adresse", "ApiTypeUrl", "LogoUrl", "Description", "CoverImageUrl", "GalerieUrls", "Email", "PasswordHash", "Salt", "ResetToken", "ResetTokenExpiry"],
    [SHEET_NAMES.ABMCY_AGGREGATOR_HISTORY]: ["Timestamp", "IDCommande", "Montant", "MoyenPaiement", "TransactionReference", "NomExpediteur", "NumeroExpediteur", "StatutLog", "NotesAdmin"], // NOUVEAU
    [SHEET_NAMES.ABMCY_Admin]: ["Clé", "Valeur"], // NOUVEAU
    [SHEET_NAMES.LIVRAISONS]: ["IDLivraison", "IDCommande", "IDClient", "Adresse", "Statut", "DateMiseAJour", "Transporteur"],
    [SHEET_NAMES.NOTIFICATIONS]: ["IDNotification", "IDCommande", "Type", "Message", "Statut", "Date"],
  };

  // NOUVEAU: Fonction utilitaire pour ajouter des colonnes si elles n'existent pas
  const addColumnsIfNotExists = (sheet, requiredHeaders) => {
    if (!sheet) return;
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersToAdd = requiredHeaders.filter(h => !currentHeaders.includes(h));
    
    if (headersToAdd.length > 0) {
      const lastColumn = sheet.getLastColumn();
      sheet.getRange(1, lastColumn + 1, 1, headersToAdd.length).setValues([headersToAdd]);
    }
  };

  Object.entries(sheetsToCreate).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange("A1:Z1").setFontWeight("bold");
    } else {
      // NOUVEAU: Si la feuille existe, on vérifie et on ajoute les colonnes manquantes.
      addColumnsIfNotExists(sheet, headers);
    }
  });

  // NOUVEAU: Remplir la feuille Entreprises avec des exemples
  const entreprisesSheet = ss.getSheetByName(SHEET_NAMES.ENTREPRISES);
  if (entreprisesSheet && entreprisesSheet.getLastRow() < 2) { // Ne remplir que si la feuille est vide (sauf en-têtes)
    const defaultLogo = "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png";
    const entreprisesExemples = [
      { type: "Coiffeur", nom: "Salon de Coiffure Chic" },
      { type: "Restaurant", nom: "Le Gourmet Dakarois" },
      { type: "Boutique de Mode", nom: "Tendance & Style" },
      { type: "Service de Livraison", nom: "ViteLivré Express" },
      { type: "Agence Immobilière", nom: "ImmoConfiance SN" }
    ];

    const rows = entreprisesExemples.map((entreprise, index) => {
      const compteId = `ENT-${String(new Date().getTime()).slice(-5) + index}`;
      return [
        compteId, // NumeroCompte
        entreprise.nom, // NomEntreprise
        entreprise.type, // Type
        "Nom du Propriétaire", // Proprietaire
        "77XXXXXXX", // Telephone
        "Adresse de l'entreprise", // Adresse
        "REMPLIR_URL_API_DU_TYPE", // ApiTypeUrl (ex: URL du script pour les coiffeurs)
        defaultLogo, // LogoUrl
        `Description pour ${entreprise.nom}` // Description
      ];
    });
    entreprisesSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  // Remplir la configuration par défaut
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  // CORRECTION: Vérifier que la feuille existe avant de continuer
  if (!configSheet) {
    ui.alert("Erreur critique : La feuille 'Config' n'a pas pu être créée ou trouvée.");
    return;
  }
  const configData = configSheet.getDataRange().getValues();
  const configMap = new Map(configData.map(row => [row[0], row[1]]));

  const defaultConfigValues = {
    'allowed_origins': 'https://abmcymarket.vercel.app,http://127.0.0.1:5500,',
    'allowed_methods': 'POST, GET, OPTIONS',
    'allowed_headers': 'Content-Type, X-Requested-With',
    'allow_credentials': 'true',
    // NOUVEAU: La configuration de livraison est maintenant gérée côté client dans main.js
    'delivery_options': JSON.stringify({}),
    // 'PAYDUNYA_MASTER_KEY': 'VOTRE_MASTER_KEY',
    // 'PAYDUNYA_PRIVATE_KEY': 'VOTRE_PRIVATE_KEY_TEST_OU_LIVE',
    // 'PAYDUNYA_PUBLIC_KEY': 'VOTRE_PUBLIC_KEY_TEST_OU_LIVE',
    // 'PAYDUNYA_TOKEN': 'VOTRE_TOKEN_TEST_OU_LIVE',
    'PAYDUNYA_ACTIVE': 'false',
    // NOUVEAU: L'agrégateur ABMCY est le seul actif par défaut
    'ABMCY_AGGREGATOR_ACTIVE': 'true',
    'ABMCY_PAYMENT_METHODS': JSON.stringify({ // CORRECTION: Uniquement Wave est conservé
        "wave": {
            "name": "Wave",
            "logo": "https://www.wave.com/img/nav-logo.png",
            "baseUrl": "https://pay.wave.com/m/M_sn_J3jR9Wg9ilPF/c/sn/"
        }
    })
  };

  Object.entries(defaultConfigValues).forEach(([key, value]) => {
    if (!configMap.has(key)) {
      configSheet.appendRow([key, value]);
    }
  });

  // NOUVEAU: Remplir la feuille ABMCY_Admin
  const abmcyAdminSheet = ss.getSheetByName(SHEET_NAMES.ABMCY_Admin);
  // CORRECTION: Vérifier que la feuille existe avant de continuer
  if (!abmcyAdminSheet) {
    ui.alert("Erreur critique : La feuille 'ABMCY_Admin' n'a pas pu être créée ou trouvée.");
    return;
  }
  const abmcyAdminData = abmcyAdminSheet.getDataRange().getValues();
  const abmcyAdminMap = new Map(abmcyAdminData.map(row => [row[0], row[1]]));
  if (!abmcyAdminMap.has('AdminPassword')) {
      // CORRECTION: Écrire directement dans A2:B2 pour éviter les problèmes avec appendRow
      abmcyAdminSheet.getRange("A2:B2").setValues([['AdminPassword', 'abmcy2024']]); // Mot de passe par défaut
  }

  CacheService.getScriptCache().remove('script_config'); // Vider le cache pour prendre en compte les changements
  ui.alert("Projet Central initialisé avec succès ! Tous les onglets sont prêts.");
}

/**
 * NOUVEAU: Crée un déclencheur horaire pour vérifier les paiements ABMCY expirés.
 */
function createAbmcyPaymentExpirationTrigger() {
    const ui = SpreadsheetApp.getUi();
    // Supprimer les déclencheurs existants pour éviter les doublons
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'checkExpiredAbmcyPayments') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }

    // Créer un nouveau déclencheur qui s'exécute toutes les 5 minutes
    ScriptApp.newTrigger('checkExpiredAbmcyPayments')
        .timeBased()
        .everyMinutes(5)
        .create();

    ui.alert("Déclencheur d'expiration des paiements ABMCY créé. Il s'exécutera toutes les 5 minutes.");
}

/**
 * NOUVEAU: Fonction exécutée par un déclencheur horaire pour vérifier les paiements ABMCY expirés.
 * Marque les commandes "En attente de paiement ABMCY" comme "Expiré" si le délai de 25 minutes est dépassé.
 */
function checkExpiredAbmcyPayments() {
    const EXPIRATION_TIME_MS = 25 * 60 * 1000; // 25 minutes en millisecondes
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ORDERS);
    const allOrders = sheet.getDataRange().getValues();
    const headers = allOrders.shift() || [];

    const statutIndex = headers.indexOf("Statut");
    const initiationTimestampIndex = headers.indexOf("InitiationTimestamp");

    if (statutIndex === -1 || initiationTimestampIndex === -1) {
        logError('checkExpiredAbmcyPayments', new Error("Colonnes 'Statut' ou 'InitiationTimestamp' manquantes dans la feuille Commandes."));
        return;
    }

    const now = new Date().getTime();
    let updatedCount = 0;

    for (let i = 0; i < allOrders.length; i++) {
        const row = allOrders[i];
        if (row[statutIndex].startsWith("En attente de paiement ABMCY")) {
            const initiationTime = new Date(row[initiationTimestampIndex]).getTime();
            if (now - initiationTime > EXPIRATION_TIME_MS) {
                sheet.getRange(i + 2, statutIndex + 1).setValue("Expiré (Paiement ABMCY)");
                updatedCount++;
            }
        }
    }
    if (updatedCount > 0) {
        logAction('checkExpiredAbmcyPayments', { message: `${updatedCount} paiements ABMCY expirés mis à jour.` });
    }
}

/**
 * NOUVEAU: Ouvre le tableau de bord administrateur dans une barre latérale de la feuille de calcul.
 */
function openAdminDashboardInSidebar() {
  // CORRECTION: Charge le fichier HTML directement depuis le projet Apps Script.
  const html = HtmlService.createHtmlOutputFromFile('admin_dashboard')
    .setWidth(500)
    .setTitle('Tableau de Bord Admin');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * NOUVEAU: Ouvre la page de confirmation manuelle dans une barre latérale.
 */
function openAbmcyAdminInSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('abmcy_admin')
    .setWidth(500)
    .setTitle('Confirmation Manuelle ABMCY');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * NOUVEAU: Récupère toutes les données publiques d'une entreprise partenaire.
 * C'est le point d'entrée pour les pages vitrines comme babershop.html.
 * @param {string} compteId - L'ID du compte de l'entreprise.
 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON avec les infos de l'entreprise, ses services et produits.
 */
function getBusinessPublicData(compteId) {
    if (!compteId) {
        return createJsonResponse({ success: false, error: "ID de compte manquant." });
    }

    try {
        // 1. Récupérer les informations de base de l'entreprise depuis la feuille "Entreprises"
        const entreprisesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTREPRISES);
        if (!entreprisesSheet) throw new Error("La feuille des entreprises est introuvable.");

        const allEntreprises = entreprisesSheet.getDataRange().getValues();
        const headers = allEntreprises.shift() || [];
        const compteIdIndex = headers.indexOf("NumeroCompte");

        const entrepriseRow = allEntreprises.find(row => row[compteIdIndex] === compteId);

        if (!entrepriseRow) {
            return createJsonResponse({ success: false, error: "Entreprise non trouvée." });
        }

        const businessInfo = headers.reduce((obj, header, index) => {
            obj[header] = entrepriseRow[index];
            return obj;
        }, {});

        // 2. Récupérer l'URL de l'API de données spécifique à ce type d'entreprise
        const apiTypeUrl = businessInfo.ApiTypeUrl;
        if (!apiTypeUrl || !apiTypeUrl.startsWith('https')) {
            // Si pas d'API de données, on retourne juste les infos de base
            return createJsonResponse({ success: true, data: { businessInfo: businessInfo, services: [], products: [] } });
        }

        // 3. Appeler l'API du type d'entreprise (ex: API Coiffeurs) pour obtenir les services et produits
        const apiResponse = UrlFetchApp.fetch(`${apiTypeUrl}?compteId=${compteId}`, {
            method: 'get',
            muteHttpExceptions: true
        });

        let services = [];
        let products = [];

        if (apiResponse.getResponseCode() === 200) {
            const apiResult = JSON.parse(apiResponse.getContentText());
            if (apiResult.status === 'success' && apiResult.data) {
                services = apiResult.data.services || [];
                products = apiResult.data.products || [];
            }
        }

        // 4. Agréger toutes les données et les renvoyer
        const finalData = {
            businessInfo: businessInfo,
            services: services,
            products: products
        };

        return createJsonResponse({ success: true, data: finalData });

    } catch (error) {
        logError(`getBusinessPublicData pour ${compteId}`, error);
        return createJsonResponse({ success: false, error: `Erreur serveur: ${error.message}` });
    }
}
