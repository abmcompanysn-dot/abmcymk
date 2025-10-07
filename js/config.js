/**
 * Fichier de configuration central pour l'application ABMCY MARKET.
 */
const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    // À REMPLIR APRÈS LE DÉPLOIEMENT
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbxehBgmtpyBWPlNiDP1IJixHSr40Peuut4_OlfndVldp6jrsoHKsSb-UnlUFXIeU4gs/exec",

    // URL de l'API publique des produits (Script 1: Gestion Produits)
    PRODUCT_API_URL: "https://script.google.com/macros/s/AKfycbz7Pmzu5wgECM734NaURQJi8UdAHGqBvIlA0qD35WXAnTyEH8B9X5m_pr-WwV5TPWyD/exec",
    
    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png",
    
    // Clé pour le cache dans le navigateur du client
    CACHE_KEY_DATA: "abmcy_site_data_cache",

    // Durée de vie du cache en millisecondes (ici, 2 heures)
    CACHE_TTL_FRONTEND: 2 * 60 * 60 * 1000, 
};