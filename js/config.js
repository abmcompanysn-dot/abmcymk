/**
 * Fichier de configuration central pour l'application ABMCY MARKET.
 */

const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    // À REMPLIR APRÈS LE DÉPLOIEMENT
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbw8P9FEvCqw9xXDkvK7BY_RQ-wTZSKoIuxV1tVHj1RGE9rUSMMyaqqQGQcfpi9_Rsax/exec",

    // URL de l'API d'administration (Script 1: Gestion Produits & Front-End)
    // À REMPLIR APRÈS LE DÉPLOIEMENT
    ADMIN_API_URL: "https://script.google.com/macros/s/AKfycbzYGOU2yHC1tfQmRo9Eh3x2_K8dKe_jyhj30aprb_Q3MO3ljilTilS8QqMmBsn95AFp/exec",

    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png",
    CACHE_TTL_FRONTEND: 12 * 60 * 60 * 1000, // 12 heures en millisecondes
};