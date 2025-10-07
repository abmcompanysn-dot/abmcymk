/**
 * Fichier de configuration central pour l'application ABMCY MARKET.
 */

const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    // À REMPLIR APRÈS LE DÉPLOIEMENT
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbykJzbujkpNHKmBOTXLsftzqfEjWYQBsa7Z2iCGQGvJ66XMRcSbH5hzqxiPKcu9HhDT/exec",

    // URL de l'API d'administration (Script 1: Gestion Produits & Front-End)
    // À REMPLIR APRÈS LE DÉPLOIEMENT
    ADMIN_API_URL: "https://script.google.com/macros/s/AKfycbwB5wmfFB-PSfMl7UUFKM2W1IAOf7W9hiurgfrPYMouDeZlWDu10lz2DFV074f-5Ksy/exec",

    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png",
    CACHE_TTL_FRONTEND: 12 * 60 * 60 * 1000, // 12 heures en millisecondes
};