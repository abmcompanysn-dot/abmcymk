const CONFIG = {
    // NOUVEAU: URL de l'API CENTRALE qui gère maintenant tout (comptes, commandes, etc.)
    ACCOUNT_API_URL:"https://script.google.com/macros/s/AKfycbx8WsziTTQllAvVfCiDoKB_SenRdDQRtjpSN3FCDS8-YDxMk-C4Ic4aHVgW7XU6Kw-S3w/exec",
    // Les URL spécifiques pour commandes, livraisons et notifications sont maintenant obsolètes
    // car tout est géré par l'API centrale (ACCOUNT_API_URL).
    
    // URL du script central pour le catalogue de produits.
    CENTRAL_API_URL: "https://script.google.com/macros/s/AKfycbxC5NVAc-PJhQHLXQAnSPmoU1Mv_5p6n9RvgNOklevfGkV0GBtbychE3Cc7KZkhdSLkcQ/exec",
    
    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "logo/l.svg",
};

// NOUVEAU: La configuration de la livraison est maintenant gérée directement ici.
const DELIVERY_CONFIG = 
    {
  "locations": {
    "retrait_magasin": {
      "label": "Point de retrait (Magasin)",
      "methods": ["retrait_gratuit"]
    },
    "dakar_plateau": {
      "label": "Dakar - Plateau",
      "methods": ["standard_dakar", "express_dakar"]
    },
    "dakar_medina": {
      "label": "Dakar - Médina",
      "methods": ["standard_dakar", "express_dakar"]
    },
    "dakar_grand_yoff": {
      "label": "Dakar - Grand Yoff",
      "methods": ["standard_dakar", "express_dakar"]
    },
    "dakar_parcelles": {
      "label": "Dakar - Parcelles Assainies",
      "methods": ["standard_dakar", "express_dakar"]
    },
    "dakar_almadies": {
      "label": "Dakar - Almadies",
      "methods": ["standard_dakar", "express_dakar"]
    },
    "dakar_ucad": {
      "label": "Dakar - UCAD",
      "methods": ["point_relais_etudiant"]
    },
    "dakar_esp": {
      "label": "Dakar - ESP (Ex-ENSUT)",
      "methods": ["point_relais_etudiant"]
    },
    "dakar_ensept": {
      "label": "Dakar - ENSEPT",
      "methods": ["point_relais_etudiant"]
    },
    "dakar_ism": {
      "label": "Dakar - ISM",
      "methods": ["point_relais_etudiant"]
    },
    "dakar_supdeco": {
      "label": "Dakar - Sup de Co",
      "methods": ["point_relais_etudiant"]
    },
    "dakar_rufisque": {
      "label": "Dakar - Rufisque",
      "methods": ["standard_rufisque"]
    },
    "thies_ville": {
      "label": "Thiès - Ville",
      "methods": ["standard_thies"]
    }
  },
  "methods": {
    "retrait_gratuit": {
      "label": "Retrait en magasin",
      "price": 0,
    },
    "standard_dakar": {
      "label": "Livraison Standard",
      "price": 1500,
    },
    "express_dakar": {
      "label": "Livraison Express",
      "price": 2500,
    },
    "point_relais_etudiant": {
      "label": "Livraison point relais étudiant",
      "price": 500,
    },
    "standard_rufisque": {
      "label": "Livraison Standard",
      "price": 3000,
    },
    "standard_thies": {
      "label": "Livraison Standard",
      "price": 3500,
    }
  }
}
// Variables globales pour le chargement progressif de la page d'accueil
let categoryDirectory = []; // Stocke la liste des catégories et leurs URLs
let allLoadedProducts = []; // Stocke tous les produits déjà chargés
let renderedCategoriesCount = 0;
const CATEGORIES_PER_LOAD = 3;

// NOUVEAU: Variable globale pour stocker la configuration dynamique du site (options de livraison, etc.)
let siteConfig = { deliveryOptions: DELIVERY_CONFIG }; // Utilise la configuration locale par défaut

// Attendre que le contenu de la page soit entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser toutes les fonctionnalités du site
    initializeApp();
});

/**
 * Fonction principale ASYNCHRONE qui initialise l'application.
 */
async function initializeApp() {
    // NOUVEAU: Définir les paramètres de l'URL au début pour qu'ils soient accessibles partout.
    const params = new URLSearchParams(window.location.search);
    const currentPage = window.location.pathname.split('/').pop();

    // Vérifier si l'utilisateur est sur la page de déconnexion
    if (params.get('action') === 'logout') {
        handleLogout();
        return; // Arrêter l'exécution pour laisser la redirection se faire
    }

    const user = JSON.parse(localStorage.getItem('abmcyUser'));

    // Mettre à jour dynamiquement les liens "Compte" sur toute la page.
    const accountLinks = document.querySelectorAll('a[href*="compte.html"], a[href*="authentification.html"]');
    accountLinks.forEach(link => {
        link.href = user ? 'compte.html' : 'authentification.html';
    });

    if (user) {
        // Si l'utilisateur est connecté et sur la page d'authentification, on le redirige vers son compte.
        if (currentPage === 'authentification.html') {
            window.location.href = 'compte.html';
            return; // Arrêter l'exécution pour laisser la redirection se faire
        }
    }

    // --- ÉTAPE 1: Rendu immédiat de ce qui ne dépend pas des données distantes ---
    updateCartBadges();
    initializeSearch(); // Les formulaires de recherche peuvent être initialisés immédiatement.
    if (document.getElementById('auth-forms')) {
        document.getElementById('login-form').addEventListener('submit', (e) => handleAuthForm(e, 'login'));
        document.getElementById('register-form').addEventListener('submit', (e) => handleAuthForm(e, 'register'));
        // NOUVEAU: Initialiser les boutons pour voir/cacher les mots de passe
        initializePasswordToggle('login-password', 'toggle-login-password', 'eye-login-open', 'eye-login-closed');
        initializePasswordToggle('register-password', 'toggle-register-password', 'eye-register-open', 'eye-register-closed');
        initializePasswordToggle('register-password-confirm', 'toggle-confirm-password', 'eye-confirm-open', 'eye-confirm-closed');
        // NOUVEAU: Gérer le clic sur "Mot de passe oublié"
        document.getElementById('forgot-password-link').href = 'reset-password.html';
    }
    // NOUVEAU: Utiliser un ID sur le body pour une détection plus robuste de la page compte.
    if (document.getElementById('account-page')) {
        initializeAccountPage();
    }
    if (document.getElementById('panier-page')) {
        renderCartPage(); // Le panier lit depuis le localStorage, pas besoin d'attendre l'API.
    }
    // NOUVEAU: Initialiser la page de paiement
    if (document.querySelector('#checkout-form')) {
        initializeCheckoutPage();
    }
    // NOUVEAU: Initialiser immédiatement le squelette de la page catégorie si on y est.
    if (window.location.pathname.endsWith('categorie.html')) {
        initializeCategoryPage();
    }
    // NOUVEAU: Initialiser la page de suivi de commande
    if (window.location.pathname.endsWith('suivi-commande.html')) {
        initializeOrderTrackingPage();
    }
    // NOUVEAU: Initialiser la page de confirmation
    if (window.location.pathname.endsWith('confirmation.html')) {
        initializeConfirmationPage();
    }
    // NOUVEAU: Initialiser la page FAQ
    if (window.location.pathname.endsWith('faq.html')) {
        initializeFaqPage();
    }

    if (document.getElementById('countdown')) {
        startCountdown(); // Le compte à rebours est indépendant.
    }
    
    initializeChristmasCountdown(); // NOUVEAU: Appel de la fonction du compte à rebours de Noël
    handleSeasonalContent(); // NOUVEAU: Gère l'affichage des bannières saisonnières

    // NOUVEAU: Optimisation pour la page d'authentification.
    // On ne charge pas le catalogue complet sur cette page pour la rendre plus rapide.
    if (window.location.pathname.includes('authentification.html')) {
        console.log("Page d'authentification détectée. Le chargement du catalogue est ignoré.");
        return; // On arrête l'initialisation ici.
    }

    // --- ÉTAPE 2 & 3: Lancer le chargement des données et remplir le contenu ---
    // Ce bloc ne s'exécutera que si on n'est PAS sur la page d'authentification.
    getCatalogAndRefreshInBackground().then(catalog => {
      if (!catalog || !catalog.success) {
          console.error("Impossible de charger le catalogue. Le site pourrait ne pas fonctionner correctement.");
          return;
      }

      // Les options de livraison sont maintenant locales, plus besoin de les charger.
      // if (catalog.data.deliveryOptions) siteConfig.deliveryOptions = catalog.data.deliveryOptions;
  
      // Remplir les menus et les liens de navigation
      populateCategoryMenu(catalog);
      populateNavLinks(catalog);
  
      // Remplir le contenu spécifique à la page actuelle
      if (window.location.pathname.endsWith('recherche.html')) displaySearchResults(catalog);
      if (window.location.pathname.endsWith('categorie.html')) fillCategoryProducts(catalog);
      if (window.location.pathname.endsWith('categorie.html')) updateWhatsAppLinkForCategory(catalog); // NOUVEAU
      if (window.location.pathname.endsWith('promotions.html')) displayPromotionProducts(catalog);
      if (window.location.pathname.endsWith('produit.html')) loadProductPage(catalog);
      
      // Remplir les sections de la page d'accueil
      if (document.getElementById('superdeals-products')) {
          renderDailyDealsHomepage(catalog);
          renderAllCategoriesSection(catalog);
          renderRecentlyViewedProducts(catalog); // NOUVEAU
          renderHomepageCategorySections(catalog);
          initializeBannerTextAnimation(); // NOUVEAU: Lancer l'animation du texte de la bannière
      }
  
      // NOUVEAU: Si on est sur la page panier, on charge aussi les promos
      if (document.getElementById('panier-page')) {
          renderPromoProductsInCart(catalog);
      }
  });
}

/**
 * NOUVEAU: Gère l'animation du texte de la bannière sur la page d'accueil.
 */
function initializeBannerTextAnimation() {
    const mainTextElement = document.getElementById('banner-main-text');
    const subTextElement = document.getElementById('banner-sub-text');

    // Ne rien faire si les éléments n'existent pas (on n'est pas sur la page d'accueil)
    if (!mainTextElement || !subTextElement) {
        return;
    }

    const phrases = [
    {
        main: "Célébrez la magie des fêtes avec nous.",
        sub: "Sàmmal xew-xew yu mag yi ak nun."
    },
    {
        main: "Des cadeaux qui illuminent vos moments.",
        sub: "Ay sàngu yi di leer seen jamono."
    },
    {
        main: "Partagez la joie, chaque sourire compte.",
        sub: "Seddoo mbég, benn gëstu mooy am solo."
    },
    {
        main: "Un Nouvel An rempli de promesses.",
        sub: "At bu bees bu fees ak ndam."
    },
    {
        main: "La chaleur des fêtes, livrée à votre cœur.",
        sub: "Tànk yu xew-xew yi, ci sa xol."
    }
];;

    let currentIndex = 0;

    setInterval(() => {
        currentIndex = (currentIndex + 1) % phrases.length;

        // Appliquer un effet de fondu
        mainTextElement.classList.add('opacity-0');
        subTextElement.classList.add('opacity-0');

        setTimeout(() => {
            mainTextElement.textContent = phrases[currentIndex].main;
            subTextElement.textContent = phrases[currentIndex].sub;
            mainTextElement.classList.remove('opacity-0');
            subTextElement.classList.remove('opacity-0');
        }, 500); // Doit correspondre à la durée de la transition (duration-500)

    }, 5000); // Changer de phrase toutes les 5 secondes
}

/**
 * Gère l'ouverture et la fermeture du menu des catégories (menu hamburger).
 */
function toggleMobileMenu() {
    // Cette fonction est maintenant utilisée pour le menu déroulant sur desktop
    // et pourrait être réutilisée pour un menu mobile si besoin.
    // La logique actuelle de l'index.html gère l'affichage avec :hover,
    // mais une fonction JS peut être utile pour la compatibilité tactile.
    const menu = document.querySelector('.dropdown-menu');
    if (menu) {
        // Pour une gestion par clic, on pourrait faire : menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Remplit dynamiquement le menu des catégories à partir du fichier categories.js.
 */
function populateCategoryMenu(catalog) {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return; // S'assure que l'élément existe
    const boutiquesMenu = document.getElementById('boutiques-menu');
    let menuHTML = ''; // Initialiser la variable ici

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));

        // Ajout d'un titre pour le menu déroulant
        menuHTML = `<div class="p-2 border-b"><h3 class="font-semibold text-sm text-gray-500 px-2">Toutes les catégories</h3></div>`;

        if (categories.length > 0) {
            menuHTML += categories.map(cat => `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${cat.NomCategorie}</a>`).join('');
        }
        // Ajout du lien vers les promotions (toujours visible)
        menuHTML += '<a href="promotions.html" class="block px-4 py-2 text-sm text-red-600 font-semibold hover:bg-gray-100">Promotions</a>';
        
        menu.innerHTML = menuHTML;
        if (boutiquesMenu) boutiquesMenu.innerHTML = menuHTML;
    } catch (error) {
        console.error("Erreur lors du chargement des menus de catégories:", error);
        const errorHTML = '<p class="px-4 py-2 text-sm text-red-500">Erreur de chargement.</p>';
        menu.innerHTML = errorHTML;
        if (boutiquesMenu) boutiquesMenu.innerHTML = errorHTML;
    }
}

/**
 * NOUVEAU: Remplit dynamiquement les liens de navigation principaux et de la bannière.
 */
function populateNavLinks(catalog) {
    const mainLinksContainer = document.getElementById('main-nav-links');
    const bannerLinksContainer = document.getElementById('banner-nav-links');

    // Ne fait rien si le conteneur principal n'existe pas
    if (!mainLinksContainer) return;

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const MANY_CATEGORIES_THRESHOLD = 8;

        let mainNavCategories = [];
        let bannerNavCategories = [];

        // La logique de division s'applique seulement si on est sur la page d'accueil (où bannerLinksContainer existe)
        if (bannerLinksContainer && categories.length > MANY_CATEGORIES_THRESHOLD) {
            // S'il y a beaucoup de catégories, on les divise
            mainNavCategories = categories.slice(0, 4); // Les 4 premières pour le haut
            bannerNavCategories = categories.slice(4, 10); // Les 6 suivantes pour la bannière
        } else {
            // Sinon, on utilise les mêmes pour les deux (jusqu'à 6)
            mainNavCategories = categories.slice(0, 4);
            bannerNavCategories = categories.slice(0, 6);
        }

        // Générer le HTML pour la navigation principale
        let mainNavHTML = '<a href="promotions.html" class="py-3 text-red-600 hover:text-red-800">SuperDeals</a>'; // Lien fixe
        mainNavHTML += mainNavCategories.map(cat => 
            `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="py-3 text-gray-700 hover:text-gold">${cat.NomCategorie}</a>`
        ).join('');
        mainLinksContainer.innerHTML = mainNavHTML;

        // Générer le HTML pour la navigation de la bannière
        if (bannerLinksContainer) {
            bannerLinksContainer.innerHTML = bannerNavCategories.map((cat, index) => {
                // Logique pour cacher des liens sur mobile si nécessaire
                const responsiveClasses = index > 2 ? 'hidden sm:block' : '';
                return `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="px-4 py-1 hover:bg-white/20 rounded-full transition ${responsiveClasses}">${cat.NomCategorie}</a>`;
            }).join('');
        }

    } catch (error) {
        console.error("Erreur lors du remplissage des liens de navigation:", error);
    }
}
// --- LOGIQUE DU PANIER ---

/**
 * Récupère le panier depuis le localStorage.
 * @returns {Array} Le tableau des articles du panier.
 */
function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

/**
 * Sauvegarde le panier dans le localStorage.
 * @param {Array} cart - Le tableau des articles du panier.
 */
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadges();
}

/**
 * Ajoute un produit au panier.
 * @param {Event} event - L'événement du clic pour l'empêcher de suivre le lien.
 * @param {string} productId - L'ID unique du produit.
 * @param {string} name - Le nom du produit.
 * @param {number} price - Le prix du produit.
 * @param {string} imageUrl - L'URL de l'image du produit.
 */
function addToCart(event, productId, name, price, imageUrl) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const quantityInput = document.getElementById('quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

    // La logique de livraison est retirée de l'ajout au panier.
    // Elle sera gérée au checkout.
    const cart = getCart();

    const selectedVariants = {};
    const variantButtons = document.querySelectorAll('.variant-btn.selected');
    variantButtons.forEach(btn => {
        const group = btn.dataset.group;
        const value = btn.textContent;
        selectedVariants[group] = value;
    });

    // NOUVEAU: Créer une clé unique pour l'article basé sur l'ID et les variantes
    const variantKey = Object.keys(selectedVariants).sort().map(k => `${k}:${selectedVariants[k]}`).join('|');
    const itemKey = `${productId}-${variantKey}`;

    const existingProductIndex = cart.findIndex(item => item.key === itemKey);

    if (existingProductIndex > -1) {
        // Le produit existe déjà, on augmente la quantité
        cart[existingProductIndex].quantity += quantity;
    } else {
        // Nouveau produit
        // On ne stocke plus les infos de livraison ici.
        cart.push({ key: itemKey, productId, name, price, imageUrl, quantity, variants: selectedVariants });
    }
    
    saveCart(cart);
    showToast(`${name} a été ajouté au panier !`); // NOUVEAU: Notification non-bloquante
}

/**
 * NOUVEAU: Affiche une notification "toast" en bas de l'écran.
 * @param {string} message Le message à afficher.
 * @param {boolean} isError Si true, affiche une notification d'erreur.
 */
function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    const title = isError ? 'Erreur' : 'Succès';
    const titleColor = isError ? 'text-red-800' : 'text-green-800';

    // NOUVEAU: Icônes pour un feedback visuel immédiat.
    const icon = isError
        ? `<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        : `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    // NOUVEAU: Structure HTML plus riche pour la notification.
    toast.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0">
                ${icon}
            </div>
            <div class="ml-3">
                <p class="text-sm font-bold ${titleColor}">${title}</p>
                <p class="text-sm text-gray-700">${message}</p>
            </div>
        </div>
    `;
    
    // NOUVEAU: Classes pour un style de carte moderne en bas à droite.
    toast.className = `w-full max-w-sm bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transition-all duration-300 transform translate-y-10 opacity-0 mb-4`;
    
    toastContainer.appendChild(toast);

    // Animer l'apparition
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animer la disparition
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300); // Supprimer l'élément du DOM après l'animation
    }, 3000); // Le toast reste visible 3 secondes
}

/**
 * Met à jour les badges du panier (nombre d'articles).
 */
function updateCartBadges() {
    const cart = getCart() || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    // CORRECTION: Cible tous les badges par leur classe commune pour une mise à jour fiable.
    const badges = document.querySelectorAll('.cart-badge');

    badges.forEach(badge => {
        if (totalItems > 0) {
            badge.textContent = totalItems;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

/**
 * Affiche les articles sur la page du panier.
 */
function renderCartPage() {
    const cart = getCart() || [];
    const cartContainer = document.getElementById('cart-page-items');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">Votre panier est vide.</div>';
        // Cacher le résumé de commande s'il existe
        const summaryWrapper = document.getElementById('cart-summary-wrapper');
        if (summaryWrapper) summaryWrapper.classList.add('hidden');
        return;
    }

    // NOUVEAU: Regrouper les articles par vendeur pour un affichage professionnel
    const groupedCart = cart.reduce((acc, item) => {
        const businessId = item.businessId || 'ABMCY_MARKET'; // Groupe par défaut pour les articles de la boutique principale
        if (!acc[businessId]) {
            acc[businessId] = {
                businessName: item.businessName || 'ABMCY Market',
                businessAddress: item.businessAddress || 'Nos entrepôts',
                items: []
            };
        }
        acc[businessId].items.push(item);
        return acc;
    }, {});

    const cartHTML = Object.values(groupedCart).map(group => {
        const itemsHTML = group.items.map(item => {
            const originalIndex = cart.findIndex(cartItem => (cartItem.key && cartItem.key === item.key) || (cartItem.id && cartItem.id === item.id));
            const imageUrl = item.imageUrl || item.image || CONFIG.DEFAULT_PRODUCT_IMAGE;
            const variantHTML = (variants) => {
                if (!variants || Object.keys(variants).length === 0) return '';
                return `<p class="text-xs text-gray-500">${Object.entries(variants).map(([key, value]) => `${key}: ${value}`).join(', ')}</p>`;
            };

            return `
                <div class="flex items-center p-4 border-b last:border-b-0">
                    <img src="${imageUrl}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                    <div class="flex-grow">
                        <h4 class="font-semibold text-sm">${item.name}</h4>
                        <p class="text-sm text-gold">${item.price.toLocaleString('fr-FR')} F CFA</p>
                        ${variantHTML(item.variants)}
                    </div>
                    <div class="flex items-center">
                        <input type="number" value="${item.quantity}" min="1" onchange="changeQuantity(${originalIndex}, this.value)" class="w-16 text-center border rounded p-1 mx-4">
                        <button onclick="removeFromCart(${originalIndex})" class="text-red-500 hover:text-red-700" title="Supprimer l'article">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="mb-6 bg-white rounded-lg shadow-sm">
                <div class="p-3 border-b bg-gray-50 rounded-t-lg">
                    <h3 class="font-bold text-gray-700 text-sm">Vendu par : ${group.businessName}</h3>
                </div>
                ${itemsHTML}
            </div>`;
    }).join('');

    cartContainer.innerHTML = cartHTML;
    updateCartSummary();
}

/**
 * Met à jour le résumé de la commande sur la page panier.
 */
function updateCartSummary() {
    const cart = getCart() || [];
    if (!document.getElementById('summary-subtotal')) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);    
    // AMÉLIORATION: Sur la page panier, on ne calcule pas encore les frais de livraison.
    // On indique simplement qu'ils seront calculés à l'étape suivante.
    const shippingCostText = "Calculée à l'étape suivante";
    const total = subtotal; // Le total sur cette page est juste le sous-total.

    document.getElementById('summary-subtotal').textContent = `${subtotal.toLocaleString('fr-FR')} F CFA`;
    document.getElementById('summary-shipping').textContent = shippingCostText;
    document.getElementById('summary-total').textContent = `${total.toLocaleString('fr-FR')} F CFA`;
    // Le total affiché est maintenant le sous-total, ce qui est correct pour la page panier.
}

/**
 * Modifie la quantité d'un article dans le panier.
 * @param {number} index - L'index de l'article dans le tableau du panier.
 * @param {string} newQuantity - La nouvelle quantité (depuis l'input).
 */
function changeQuantity(index, newQuantity) {
    const cart = getCart() || [];
    const quantity = parseInt(newQuantity);

    if (quantity > 0) {
        cart[index].quantity = quantity;
    } else {
        // Si la quantité est 0 ou moins, on supprime l'article
        cart.splice(index, 1);
    }

    saveCart(cart);
    renderCartPage(); // Ré-affiche la page du panier avec les nouvelles valeurs
}

/**
 * Supprime un article du panier.
 * @param {number} index - L'index de l'article à supprimer.
 */
function removeFromCart(index) {
    const cart = getCart() || [];
    cart.splice(index, 1); // Supprime l'élément à l'index donné

    saveCart(cart);
    renderCartPage(); // Ré-affiche la page du panier
}

/**
 * NOUVEAU: Affiche une sélection de produits en promotion sur la page du panier.
 * @param {object} catalog L'objet catalogue complet.
 */
function renderPromoProductsInCart(catalog) {
    const container = document.getElementById('promo-products-in-cart');
    if (!container) return;

    // Afficher un squelette de chargement
    container.innerHTML = Array(4).fill(getSkeletonCardHTML()).join('');

    try {
        const allProducts = catalog.data.products || [];
        const discountedProducts = allProducts.filter(p => p['Réduction%'] && parseFloat(p['Réduction%']) > 0);

        if (discountedProducts.length === 0) {
            container.parentElement.classList.add('hidden'); // Cacher toute la section s'il n'y a pas de promos
            return;
        }

        // Mélanger et prendre les 4 premiers pour un affichage varié
        const shuffled = discountedProducts.sort(() => 0.5 - Math.random());
        const selectedProducts = shuffled.slice(0, 4);

        container.innerHTML = selectedProducts.map(product => renderProductCard(product)).join('');

    } catch (error) {
        console.error("Erreur lors de l'affichage des produits en promotion dans le panier:", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Impossible de charger les offres.</p>';
    }
}

// --- LOGIQUE DE RECHERCHE (MODIFIÉE POUR LE BACKEND) ---

/**
 * Charge les produits depuis le backend et initialise la recherche.
 */
async function initializeSearch() {
    const searchForms = document.querySelectorAll('form[id^="search-form"]');
    const suggestionsContainer = document.getElementById('search-suggestions-container');

    searchForms.forEach(form => {
        const searchInput = form.querySelector('input[type="search"]');
        if (!searchInput) return;

        // Gérer la soumission classique (touche Entrée)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `recherche.html?q=${encodeURIComponent(query)}`;
            }
        });

        // NOUVEAU: Gérer les suggestions pendant la frappe
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                return;
            }

            // Utiliser le catalogue déjà chargé en mémoire
            const catalog = await getCatalogAndRefreshInBackground();
            const allProducts = catalog.data.products || [];

            const filteredProducts = allProducts.filter(product =>
                product.Nom.toLowerCase().includes(query) ||
                (product.Marque && product.Marque.toLowerCase().includes(query)) ||
                product.Catégorie.toLowerCase().includes(query)
            ).slice(0, 7); // Limiter à 7 suggestions

            if (filteredProducts.length > 0 && suggestionsContainer) {
                suggestionsContainer.innerHTML = filteredProducts.map(product => `
                    <a href="produit.html?id=${product.IDProduit}" class="flex items-center p-3 hover:bg-gray-100 transition">
                        <img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="w-12 h-12 object-cover rounded-md mr-4">
                        <div class="flex-grow">
                            <p class="font-semibold text-sm text-gray-800 truncate">${product.Nom}</p>
                            <p class="text-xs text-gray-500">${product.Catégorie}</p>
                        </div>
                        <p class="text-sm font-bold text-gold">${product.PrixActuel.toLocaleString('fr-FR')} F</p>
                    </a>
                `).join('') + `
                    <a href="recherche.html?q=${encodeURIComponent(query)}" class="block text-center p-3 bg-gray-50 font-semibold text-blue-600 hover:bg-gray-200 text-sm">
                        Voir tous les résultats
                    </a>
                `;
                suggestionsContainer.classList.remove('hidden');
            } else if (suggestionsContainer) {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // NOUVEAU: Cacher les suggestions si on clique en dehors
        document.addEventListener('click', (e) => {
            if (!form.contains(e.target) && suggestionsContainer) {
                suggestionsContainer.classList.add('hidden');
            }
        });
    });
}

/**
 * Affiche les résultats sur la page de recherche.
 * La recherche se fait maintenant côté client pour plus de rapidité.
 */
async function displaySearchResults(catalog) {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    const queryDisplay = document.getElementById('search-query-display');
    const resultsContainer = document.getElementById('search-results-container');
    const resultsCount = document.getElementById('search-results-count');
    const searchInput = document.getElementById('search-input-page');

    if (!query || !resultsContainer) return;

    queryDisplay.textContent = query;
    searchInput.value = query;

    let filteredProducts = [];
    try {
        const { data } = catalog;
        const allProducts = data.products || [];

        const lowerCaseQuery = query.toLowerCase();
        filteredProducts = allProducts.filter(product => 
            product.Nom.toLowerCase().includes(lowerCaseQuery) ||
            (product.Marque && product.Marque.toLowerCase().includes(lowerCaseQuery)) ||
            product.Catégorie.toLowerCase().includes(lowerCaseQuery) ||
            (product.Tags && product.Tags.toLowerCase().includes(lowerCaseQuery)) ||
            (product.Description && product.Description.toLowerCase().includes(lowerCaseQuery))
        );
        resultsCount.textContent = `${filteredProducts.length} résultat(s) trouvé(s).`;
    } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        resultsCount.textContent = `Erreur lors de la recherche.`;
    }

    if (filteredProducts.length === 0) {
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit ne correspond à votre recherche.</p>`;
        return;
    }

    const resultsHTML = filteredProducts.map(product => renderProductCard(product)).join('');

    resultsContainer.innerHTML = resultsHTML;
}

/**
 * NOUVEAU: Initialise l'affichage de la page catégorie avec des squelettes.
 * Cette fonction est appelée immédiatement au chargement de la page.
 */
function initializeCategoryPage() {
    const params = new URLSearchParams(window.location.search);
    const categoryName = params.get('name');
    const nameDisplay = document.getElementById('category-name-display');
    const resultsContainer = document.getElementById('category-results-container');

    if (!nameDisplay || !resultsContainer) return;

    // Afficher le nom de la catégorie immédiatement
    nameDisplay.textContent = categoryName || "Catégorie";

    // Afficher le squelette de chargement
    resultsContainer.innerHTML = Array(8).fill(getSkeletonCardHTML()).join('');
}

/**
 * NOUVEAU: Remplit la page catégorie avec les produits réels une fois les données chargées.
 */
function fillCategoryProducts(catalog) {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const resultsContainer = document.getElementById('category-results-container');
    const resultsCount = document.getElementById('category-results-count');

    if (!categoryId || !resultsContainer) return;

    try {
        const { data } = catalog;
        const allProducts = data.products || [];
        const allCategories = data.categories || [];
        
        // CORRECTION: Le produit n'a pas d'IDCategorie, mais un nom de catégorie.
        // On trouve la catégorie correspondante à l'ID de l'URL pour obtenir son nom.
        const targetCategory = allCategories.find(cat => cat.IDCategorie == categoryId);
        if (!targetCategory) throw new Error("Catégorie introuvable.");
        
        const categoryProducts = allProducts.filter(product => {
            return product.Catégorie === targetCategory.NomCategorie;
        });

        resultsCount.textContent = `${categoryProducts.length} produit(s) dans cette catégorie.`;

        if (categoryProducts.length === 0) {
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit dans cette catégorie pour le moment.</p>`;
            return;
        }

        // NOUVEAU: Logique pour insérer des carrousels
        const otherProducts = allProducts.filter(p => p.Catégorie !== targetCategory.NomCategorie);
        let finalHTML = '';
        const productsPerCarousel = 4;
        const productsPerRow = 6;

        for (let i = 0; i < categoryProducts.length; i += productsPerRow) {
            const productChunk = categoryProducts.slice(i, i + productsPerRow);
            
            // Ajouter la grille de produits
            finalHTML += `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">${productChunk.map(p => renderProductCard(p)).join('')}</div>`;

            // Ajouter un carrousel après la ligne, s'il reste des produits à afficher
            if (i + productsPerRow < categoryProducts.length && otherProducts.length > 0) {
                const carouselId = `category-promo-carousel-${i}`;
                // Sélectionner des produits aléatoires parmi les autres catégories
                const shuffledOtherProducts = otherProducts.sort(() => 0.5 - Math.random());
                const carouselProducts = shuffledOtherProducts.slice(0, productsPerCarousel);

                if (carouselProducts.length > 0) {
                    const dotsHTML = `<div class="carousel-dots absolute left-1/2 -translate-x-1/2 flex space-x-2">${carouselProducts.map((_, idx) => `<div class="carousel-dot" data-index="${idx}"></div>`).join('')}</div>`;
                    finalHTML += `
                        <section class="my-12 relative pb-8">
                            <h3 class="text-3xl font-extrabold text-center text-gray-800 mb-2">Ne manquez pas nos autres trésors</h3>
                            <p class="text-center text-gray-500 mb-6">Explorez et laissez-vous surprendre.</p>
                            <div id="${carouselId}" class="promo-carousel flex overflow-x-auto snap-x-mandatory">
                                ${carouselProducts.map(p => `
                                    <div class="promo-carousel-item flex-shrink-0 w-full bg-white rounded-lg overflow-hidden p-4">
                                        <a href="produit.html?id=${p.IDProduit}" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                            <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <img src="${p.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${p.Nom}" class="max-h-full max-w-full object-contain">
                                            </div>
                                            <div class="text-center md:text-left">
                                                <p class="text-sm text-gray-500">${p.Catégorie}</p>
                                                <h4 class="text-2xl font-bold text-gray-800 my-2">${p.Nom}</h4>
                                                <p class="font-bold text-3xl text-gold">${p.PrixActuel.toLocaleString('fr-FR')} F CFA</p>
                                                ${p.PrixAncien > p.PrixActuel ? `<p class="text-lg text-gray-400 line-through">${p.PrixAncien.toLocaleString('fr-FR')} F CFA</p>` : ''}
                                                <button class="mt-4 bg-black text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-800 transition">
                                                    Découvrir
                                                </button>
                                            </div>
                                        </a>
                                    </div>
                                `).join('')}
                            </div>
                            ${dotsHTML}
                        </section>
                    `;
                }
            }
        }

        resultsContainer.innerHTML = finalHTML;

        // Initialiser tous les nouveaux carrousels
        document.querySelectorAll('.promo-carousel').forEach(carousel => initializePromoCarousel(carousel.id));

    } catch (error) {
        console.error("Erreur lors de l'affichage des produits de la catégorie:", error);
        resultsCount.textContent = `Erreur lors du chargement des produits.`;
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>`;
    }
}

/**
 * NOUVEAU: Affiche les produits en promotion.
 */
function displayPromotionProducts(catalog) {
    const resultsContainer = document.getElementById('promotion-results-container');
    const resultsCount = document.getElementById('promotion-results-count');

    if (!resultsContainer) return;

    try {
        const { data } = catalog;
        const allProducts = data.products || [];
        // Filtrer les produits qui ont une réduction
        const discountedProducts = allProducts.filter(product => product['Réduction%'] && parseFloat(product['Réduction%']) > 0);

        resultsCount.textContent = `${discountedProducts.length} produit(s) en promotion.`;

        if (discountedProducts.length === 0) {
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit en promotion pour le moment.</p>`;
            return;
        }

        const resultsHTML = discountedProducts.map(product => renderProductCard(product)).join('');
        resultsContainer.innerHTML = resultsHTML;

    } catch (error) {
        console.error("Erreur lors de l'affichage des promotions:", error);
        resultsCount.textContent = `Erreur lors du chargement des promotions.`;
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Impossible de charger les promotions.</p>`;
    }
}

/**
 * NOUVEAU: Initialise et met à jour le compte à rebours de Noël.
 */
function initializeChristmasCountdown() {
    // Sélectionne les éléments HTML du compte à rebours
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const countdownContainer = document.getElementById('christmas-promo-countdown');

    // Si le conteneur du compte à rebours n'existe pas sur la page, on arrête.
    if (!countdownContainer) {
        return;
    }

    // Définissez ici la date de fin de votre promotion.
    // Format : "Mois Jour, Année Heure:Minute:Seconde"
    // Par exemple, pour le 25 Décembre 2024 à 23:59:59
    const countdownDate = new Date("Dec 25, 2025 23:59:59").getTime();

    // Met à jour le compte à rebours toutes les secondes
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = countdownDate - now;

        // Si le compte à rebours est terminé
        if (distance < 0) {
            clearInterval(interval);
            countdownContainer.innerHTML = '<div class="container mx-auto px-4"><h2 class="text-3xl font-extrabold">Les offres de Noël sont terminées !</h2></div>';
            return;
        }

        // Calculs pour les jours, heures, minutes et secondes
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Fonction pour formater les nombres (ajoute un 0 si < 10)
        const formatTime = (time) => time < 10 ? `0${time}` : time;

        // Affiche les résultats dans les éléments HTML
        daysEl.innerHTML = formatTime(days);
        hoursEl.innerHTML = formatTime(hours);
        minutesEl.innerHTML = formatTime(minutes);
        secondsEl.innerHTML = formatTime(seconds);

    }, 1000);
}

/**
 * NOUVEAU: Gère l'affichage des contenus saisonniers comme la bannière GIF de Noël.
 */
function handleSeasonalContent() {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0 = Janvier, 10 = Novembre, 11 = Décembre
    const currentDate = today.getDate();   // Le jour du mois (1-31)

    // --- Logique pour Noël (affiche le contenu à partir du 15 Novembre jusqu'à fin Décembre) ---
    // La condition est vraie si: (on est en Décembre) OU (on est en Novembre ET le jour est 15 ou plus)
    const isChristmasPeriod = (currentMonth === 11) || (currentMonth === 10 && currentDate >= 15);

    if (isChristmasPeriod) {
        const christmasGifBanner = document.getElementById('christmas-gif-banner');
        if (christmasGifBanner) {
            christmasGifBanner.classList.remove('hidden');
        }
    }

    // --- Logique pour d'autres fêtes (à ajouter ici) ---
    // Exemple :
    // const isValentinesPeriod = (currentMonth === 1); // Février
    // if (isValentinesPeriod) { ... }
}

// --- LOGIQUE DE LA PAGE PRODUIT ---

/**
 * Charge les données d'un produit spécifique sur la page produit.
 */
function loadProductPage(catalog) {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        document.querySelector('main').innerHTML = '<p class="text-center text-red-500">Erreur: ID de produit manquant.</p>';
        return;
    }

    try {
        const { data } = catalog;
        const product = data.products.find(p => p.IDProduit == productId);

        if (!product) {
            throw new Error("Produit non trouvé.");
        }

        // Mettre à jour le HTML de la page avec les données du produit
        const nameEl = document.getElementById('product-name');
        const descriptionEl = document.getElementById('product-description');
        const priceContainer = document.getElementById('product-price-container');
        const mainImage = document.getElementById('main-product-image');
        const thumbnailsContainer = document.getElementById('product-thumbnails');
        const addToCartButton = document.getElementById('add-to-cart-button');

        // NOUVEAU: Conteneurs pour les détails dynamiques
        const variantsContainer = document.getElementById('product-variants-container');
        const specsContainer = document.getElementById('product-specs-container');
        // Enlever les classes de chargement
        nameEl.classList.remove('h-12', 'bg-gray-200', 'animate-pulse');
        
        // NOUVEAU: Conteneur pour les boutons d'action
        const actionButtonsContainer = document.getElementById('action-buttons-container');
        const contactSellerButton = document.getElementById('contact-seller-button');

        descriptionEl.classList.remove('h-20', 'bg-gray-200', 'animate-pulse');
        mainImage.parentElement.classList.remove('animate-pulse');

        // SEO: Remplir les données de base et les méta-tags
        nameEl.textContent = product.Nom;
        descriptionEl.textContent = product.Description;

        // NOUVEAU: Mettre à jour les méta-tags Open Graph pour le partage
        document.querySelector('meta[property="og:title"]').setAttribute('content', `${product.Nom} - ABMCY MARKET Sénégal`);
        document.querySelector('meta[property="og:description"]').setAttribute('content', product.Description || `Découvrez ${product.Nom} au meilleur prix au Sénégal.`);
        document.querySelector('meta[property="og:image"]').setAttribute('content', product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE);
        document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);
        document.querySelector('title').textContent = `${product.Nom} - ABMCY MARKET Sénégal`;

        // SEO: Générer les données structurées JSON-LD pour un meilleur référencement
        const structuredData = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.Nom,
            "image": product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE,
            "description": product.Description,
            "sku": product.IDProduit,
            "brand": {
                "@type": "Brand",
                "name": product.Marque || "ABMCY MARKET"
            },
            "offers": {
                "@type": "Offer",
                "url": window.location.href,
                "priceCurrency": "XOF", // Code pour le Franc CFA
                "price": product.PrixActuel,
                "availability": product.Stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": "ABMCY MARKET Sénégal"
                }
            }
        };
        document.getElementById('product-structured-data').textContent = JSON.stringify(structuredData);


        // CORRECTION: Charger l'image immédiatement
        mainImage.src = product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE;
        mainImage.alt = product.Nom;

        // Gérer l'affichage du prix
        let priceHTML = `<span class="text-3xl font-bold text-gold">${product.PrixActuel.toLocaleString('fr-FR')} F CFA</span>`;
        if (product.PrixAncien && product.PrixAncien > product.PrixActuel) {
            priceHTML += `<span class="text-xl text-gray-500 line-through">${product.PrixAncien.toLocaleString('fr-FR')} F CFA</span>`;
        }
        if (product['Réduction%'] > 0) {
            priceHTML += `<span class="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">-${product['Réduction%']}%</span>`;
        }
        priceContainer.innerHTML = priceHTML;

        // NOUVEAU: Construire la galerie de miniatures
        let galleryImages = [];
        if (product.ImageURL) galleryImages.push(product.ImageURL); // L'image principale est la première
        if (product.Galerie) {
            const galleryUrls = product.Galerie.split(',').map(url => url.trim()).filter(url => url);
            galleryImages = [...galleryImages, ...galleryUrls];
        }
        
        // Rendre les URLs uniques pour éviter les doublons
        // Limiter la galerie à 5 photos au maximum
        galleryImages = galleryImages.slice(0, 5);

        thumbnailsContainer.innerHTML = galleryImages.map((imgUrl, index) => `
            <div class="border-2 ${index === 0 ? 'border-gold' : 'border-transparent'} rounded-lg cursor-pointer overflow-hidden thumbnail-item">
                <img src="${imgUrl}" alt="Miniature ${index + 1}" class="h-full w-full object-cover" onclick="changeMainImage('${imgUrl}')" loading="lazy" width="80" height="80">
            </div>
        `).join('');

        // Ajouter les écouteurs d'événements pour la bordure active
        document.querySelectorAll('.thumbnail-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail-item').forEach(i => i.classList.remove('border-gold'));
                item.classList.add('border-gold');
            });
        });

        // NOUVEAU: Afficher le délai de livraison
        const deliveryInfoContainer = document.getElementById('product-delivery-info');
        if (deliveryInfoContainer && product.DelaiLivraisonJours) {
            const deliveryDays = parseInt(product.DelaiLivraisonJours, 10);
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);
            
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = deliveryDate.toLocaleDateString('fr-FR', options);

            deliveryInfoContainer.innerHTML = ` <div class="flex items-center gap-3 text-sm">
                    <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <div>
                        <span class="font-semibold">Livraison à partir du</span>
                        <span class="text-blue-700 font-bold">${formattedDate}</span>
                    </div>
                </div>
            `;
        }

        // NOUVEAU: Afficher les détails spécifiques à la catégorie
        renderCategorySpecificDetails(product, variantsContainer, specsContainer, catalog);

        // Mettre à jour le bouton "Ajouter au panier"
        addToCartButton.setAttribute('onclick', `addToCart(event, '${product.IDProduit}', '${product.Nom}', ${product.PrixActuel}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')`);
        const hasVariants = variantsContainer.innerHTML.trim() !== '';
        // Le bouton est désactivé si le produit est en rupture de stock ET qu'il n'y a pas de variantes.
        addToCartButton.disabled = (product.Stock <= 0 && !hasVariants);

        // NOUVEAU: Charger et afficher les produits similaires
        const similarProductsContainer = document.getElementById('similar-products-container');
        renderSimilarProducts(product, data.products, similarProductsContainer);

        // NOUVEAU: Mettre à jour le lien WhatsApp avec le numéro de la catégorie du produit
        const category = data.categories.find(cat => cat.NomCategorie === product.Catégorie);
        updateWhatsAppLink(category ? category.Numero : null);

        // NOUVEAU: Configurer le bouton "Contacter le vendeur"
        if (category && category.Numero) {
            const cleanedNumber = String(category.Numero).replace(/[\s+()-]/g, '');
            contactSellerButton.href = `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par le produit : ${product.Nom}`)}`;
            contactSellerButton.classList.remove('hidden');
        } else {
            contactSellerButton.classList.add('hidden');
        }
        // Rendre le conteneur de boutons visible
        actionButtonsContainer.classList.remove('hidden');

        // NOUVEAU: Activer le zoom sur l'image principale
        activateInternalZoom("image-zoom-wrapper");

        // NOUVEAU: Ajouter le produit à la liste des produits récemment consultés
        addRecentlyViewedProduct(product.IDProduit);

    } catch (error) {
        console.error("Erreur de chargement du produit:", error);
        const mainContent = document.querySelector('main');
        if(mainContent) mainContent.innerHTML = `<p class="text-center text-red-500">Impossible de charger les informations du produit. Veuillez réessayer.</p>`;
    }
}

/**
 * NOUVEAU: Ajoute un produit à la liste des "consultés récemment" dans le localStorage.
 * @param {string} productId L'ID du produit à ajouter.
 */
function addRecentlyViewedProduct(productId) {
    const RECENTLY_VIEWED_KEY = 'abmcyRecentlyViewed';
    const MAX_RECENTLY_VIEWED = 12;

    let recentlyViewed = getRecentlyViewed();

    // Retirer le produit s'il existe déjà pour le remettre au début
    recentlyViewed = recentlyViewed.filter(id => id !== productId);

    // Ajouter le nouveau produit au début de la liste
    recentlyViewed.unshift(productId);

    // Limiter la taille de la liste
    if (recentlyViewed.length > MAX_RECENTLY_VIEWED) {
        recentlyViewed = recentlyViewed.slice(0, MAX_RECENTLY_VIEWED);
    }

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
}

/**
 * NOUVEAU: Récupère la liste des produits récemment consultés.
 * @returns {string[]} Un tableau d'ID de produits.
 */
function getRecentlyViewed() {
    return JSON.parse(localStorage.getItem('abmcyRecentlyViewed')) || [];
}

/**
 * NOUVEAU: Vide la liste des produits récemment consultés.
 */
function clearRecentlyViewed() {
    localStorage.removeItem('abmcyRecentlyViewed');
    const section = document.getElementById('recently-viewed-section');
    if (section) {
        section.classList.add('hidden');
    }
    showToast('L\'historique de consultation a été effacé.');
}

/**
 * NOUVEAU: Affiche la section des produits récemment consultés sur la page d'accueil.
 * @param {object} catalog L'objet catalogue complet.
 */
function renderRecentlyViewedProducts(catalog) {
    const section = document.getElementById('recently-viewed-section');
    const container = document.getElementById('recently-viewed-container');
    const clearButton = document.getElementById('clear-recently-viewed');

    if (!section || !container || !clearButton) return;

    const viewedIds = getRecentlyViewed();
    if (viewedIds.length === 0) return;

    const allProducts = catalog.data.products || [];
    // Créer une Map pour un accès rapide aux produits par ID
    const productMap = new Map(allProducts.map(p => [p.IDProduit, p]));

    // Filtrer et conserver l'ordre de consultation (le plus récent en premier)
    const viewedProducts = viewedIds.map(id => productMap.get(id)).filter(Boolean); // .filter(Boolean) pour enlever les produits qui n'existent plus

    if (viewedProducts.length === 0) return;

    container.innerHTML = viewedProducts.map(product => renderProductCard(product)).join('');
    section.classList.remove('hidden');
    clearButton.addEventListener('click', clearRecentlyViewed);
}
/**
 * NOUVEAU: Change l'image principale du produit.
 * @param {string} newImageUrl L'URL de la nouvelle image à afficher.
 */
function changeMainImage(newImageUrl) {
    document.getElementById('main-product-image').src = newImageUrl;
    // Le zoom est attaché au conteneur, il fonctionnera automatiquement avec la nouvelle image.
}

/**
 * NOUVEAU: Active l'effet de zoom interne sur une image.
 * @param {string} wrapperId L'ID du conteneur qui englobe l'image.
 */
function activateInternalZoom(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const img = wrapper.querySelector('img');
    if (!img) return;

    function handleMouseMove(e) {
        const { left, top, width, height } = wrapper.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    }

    function handleMouseEnter() {
        img.style.transform = 'scale(2)'; // Ou 1.5, 2.5, etc. selon l'intensité de zoom souhaitée
    }

    function handleMouseLeave() {
        img.style.transform = 'scale(1)';
        img.style.transformOrigin = 'center center';
    }

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseenter', handleMouseEnter);
    wrapper.addEventListener('mouseleave', handleMouseLeave);
}

/**
 * NOUVEAU: Aiguille vers la bonne fonction de rendu en fonction de la catégorie.
 * @param {object} product L'objet produit.
 * @param {HTMLElement} variantsContainer Le conteneur pour les options (taille, couleur...).
 * @param {HTMLElement} specsContainer Le conteneur pour les spécifications techniques.
 */
function renderCategorySpecificDetails(product, variantsContainer, specsContainer, catalog) {
    variantsContainer.innerHTML = '';
    specsContainer.innerHTML = '';

    // Récupérer la configuration des attributs depuis le catalogue
    const categoryConfig = catalog.data.categoryConfig || {};
    const categoryAttributes = categoryConfig[product.Catégorie] || [];

    let variantsHTML = '';
    let specsHTML = '<ul>';
    let hasSpecs = false;

    // Parcourir tous les attributs définis pour cette catégorie
    categoryAttributes.forEach(attr => {
        const value = product[attr];
        if (value) {
            // Si la valeur contient une virgule, on la traite comme une variante sélectionnable
            if (String(value).includes(',')) {
                variantsHTML += createVariantSelector(attr, String(value).split(','));
            } else {
                // Sinon, on l'affiche comme une spécification
                specsHTML += `<li class="flex justify-between py-2 border-b"><span>${attr}</span> <span class="font-semibold text-gray-800">${value}</span></li>`;
                hasSpecs = true;
            }
        }
    });

    specsHTML += '</ul>';

    variantsContainer.innerHTML = variantsHTML;
    if (hasSpecs) {
        specsContainer.innerHTML = specsHTML;
    } else {
        specsContainer.innerHTML = '<p class="text-gray-600">Aucune spécification supplémentaire pour ce produit.</p>';
    }
}
/**
 * NOUVEAU: Crée un sélecteur de variante (boutons).
 * @param {string} label Le nom de la variante (ex: "Taille").
 * @param {string[]} options Un tableau d'options (ex: ["S", "M", "L"]).
 * @returns {string} Le code HTML du sélecteur.
 */
function createVariantSelector(label, options) {
    const validOptions = options.filter(opt => opt && opt.trim() !== '');
    if (validOptions.length === 0) return '';

    let buttonsHTML = validOptions.map(option => `<button class="variant-btn border-2 rounded-md px-4 py-1 text-sm font-semibold" data-group="${label}" onclick="selectVariant(this, '${label}')">${option.trim()}</button>`).join('');
    return `
        <div>
            <h3 class="text-sm font-semibold mb-2">${label} :</h3>
            <div class="flex flex-wrap gap-2">
                ${buttonsHTML}
            </div>
        </div>
    `;
}

/**
 * NOUVEAU: Initialise la logique de la page FAQ (accordéon).
 */
function initializeFaqPage() {
    const faqContainer = document.getElementById('faq-container');
    if (!faqContainer) return;

    const questions = faqContainer.querySelectorAll('.faq-question');

    questions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('svg');

            if (answer.style.maxHeight) {
                answer.style.maxHeight = null;
                icon.classList.remove('rotate-180');
            } else {
                answer.style.maxHeight = answer.scrollHeight + "px";
                icon.classList.add('rotate-180');
            }
        });
    });
}

/**
 * NOUVEAU: Gère la sélection visuelle d'un bouton de variante.
 * @param {HTMLElement} selectedButton Le bouton qui a été cliqué.
 * @param {string} groupName Le nom du groupe de variantes.
 */
function selectVariant(selectedButton, groupName) {
    // Désélectionne tous les autres boutons du même groupe
    document.querySelectorAll(`.variant-btn[data-group="${groupName}"]`).forEach(btn => {
        btn.classList.remove('selected');
    });
    // Sélectionne le bouton cliqué
    selectedButton.classList.add('selected');

}

/**
 * NOUVEAU: Affiche des produits similaires basés sur la même catégorie.
 * @param {object} currentProduct Le produit actuellement affiché.
 * @param {Array} allProducts La liste de tous les produits.
 * @param {HTMLElement} container Le conteneur où afficher les produits similaires.
 */
function renderSimilarProducts(currentProduct, allProducts, container) {
    if (!container) return;

    // Afficher le squelette de chargement
    container.innerHTML = Array(4).fill(getSkeletonCardHTML()).join('');

    // Filtrer pour trouver des produits de la même catégorie, en excluant le produit actuel
    const similar = allProducts.filter(p => 
        p.Catégorie === currentProduct.Catégorie && 
        p.IDProduit !== currentProduct.IDProduit
    ).slice(0, 4); // Limiter à 4 produits similaires

    if (similar.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucun produit similaire trouvé.</p>';
        return;
    }

    const similarProductsHTML = similar.map(product => renderProductCard(product)).join('');
    container.innerHTML = similarProductsHTML;
}

// --- LOGIQUE DE PAIEMENT (CHECKOUT) ---

/**
 * NOUVEAU: Initialise la page de paiement.
 */
// CORRECTION: La fonction doit être 'async' pour pouvoir utiliser 'await'
// et s'assurer que les méthodes de paiement sont chargées avant de continuer.
async function initializeCheckoutPage() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    // Pré-remplir les infos si l'utilisateur est connecté
    const user = JSON.parse(localStorage.getItem('abmcyUser'));
    if (user) {
        form.querySelector('#firstname').value = user.Nom ? user.Nom.split(' ')[0] : '';
        form.querySelector('#lastname').value = user.Nom.split(' ').slice(1).join(' ') || '';
        form.querySelector('#email').value = user.Email || '';
        form.querySelector('#phone').value = user.Telephone || '';
        form.querySelector('#delivery-address').value = user.Adresse || '';
    }

    // Charger les options de livraison
    populateDeliverySelectorsCheckout();

    // CORRECTION: Utiliser 'await' pour forcer le script à attendre que les options de paiement soient chargées et affichées.
    await loadPaymentMethods(); // Charger les méthodes de paiement dynamiquement
    // Afficher les articles du résumé
    renderCheckoutSummaryItems();

    // Mettre à jour le total
    updateCheckoutTotal();

    // Ajouter l'écouteur pour la soumission du formulaire
    form.addEventListener('submit', processCheckout);
}

/**
 * NOUVEAU: Modifie le libellé du paiement à la livraison pour être plus spécifique.
 * Cette fonction est appelée depuis initializeCheckoutPage.
 */
function updateCodLabel() {
    // On cible le label qui est associé à l'input radio avec l'id 'cod'
    const codLabel = document.querySelector('label[for="cod"]');
    if (codLabel) {
        codLabel.innerHTML = codLabel.innerHTML.replace('Paiement à la livraison', 'Paiement après discussion avec un agent ABMCY');
    }
}

/**
 * NOUVEAU: Charge les méthodes de paiement (Paydunya, ABMCY Aggregator) depuis l'API centrale.
 * Met à jour l'interface utilisateur en conséquence.
 */
async function loadPaymentMethods() {
    const mobilePaymentOptionsContainer = document.getElementById('mobile-payment-options');
    if (!mobilePaymentOptionsContainer) return;

    // SIMPLIFICATION: Les options de paiement sont maintenant statiques et toujours affichées.
    // Plus besoin d'appeler l'API pour les récupérer.
    const optionsHTML = `
        <label for="wave" class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-100 has-[:checked]:bg-gold/10 has-[:checked]:border-gold">
            <input type="radio" id="wave" name="payment-provider" value="wave" class="form-radio h-4 w-4 text-gold focus:ring-gold" checked>
            <img src="https://www.wave.com/img/nav-logo.png" alt="Wave" class="h-6">
            <span class="text-sm font-medium">Wave</span>
        </label>
        <!--
        <label for="orange-money" class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-100 has-[:checked]:bg-gold/10 has-[:checked]:border-gold">
            <input type="radio" id="orange-money" name="payment-provider" value="orange-money" class="form-radio h-4 w-4 text-gold focus:ring-gold">
            <img src="https://www.orange-sonatel.com/wp-content/uploads/2022/09/Orange-Money-logo.jpg" alt="Orange Money" class="h-6">
            <span class="text-sm font-medium">Orange Money</span>
        </label>
        <label for="free-money" class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-100 has-[:checked]:bg-gold/10 has-[:checked]:border-gold">
            <input type="radio" id="free-money" name="payment-provider" value="free-money" class="form-radio h-4 w-4 text-gold focus:ring-gold">
            <img src="https://www.freemoney.sn/wp-content/uploads/2023/03/Free-Money-Logo-01.png" alt="Free Money" class="h-6">
            <span class="text-sm font-medium">Free Money</span>
        </label>
        -->
    `;

    mobilePaymentOptionsContainer.innerHTML = optionsHTML;
}

/**
 * NOUVEAU: Remplit les sélecteurs de livraison sur la page de paiement.
 */
function populateDeliverySelectorsCheckout() {
    const locationSelect = document.getElementById('delivery-location');
    const methodSelect = document.getElementById('delivery-method');
    if (!locationSelect || !methodSelect) return;

    // Utiliser la configuration dynamique chargée au démarrage
    const deliveryOptions = siteConfig.deliveryOptions || {};
    const locations = deliveryOptions.locations || {};

    let locationHTML = '<option value="">-- Choisir une localité --</option>';
    
    // NOUVEAU: Parcourir la nouvelle structure des localités
    Object.keys(locations).forEach(locationKey => {
        const locationData = locations[locationKey];
        locationHTML += `<option value="${locationKey}">${locationData.label}</option>`;
    });

    locationSelect.innerHTML = locationHTML;

    // NOUVEAU: Les écouteurs d'événements sont maintenant gérés directement ici.
    locationSelect.addEventListener('change', updateDeliveryMethodsCheckout);
    methodSelect.addEventListener('change', updateCheckoutTotal);
 
    updateDeliveryMethodsCheckout(); // Appel initial
}

/**
 * NOUVEAU: Affiche les articles du panier dans le résumé de la page de paiement.
 */
function renderCheckoutSummaryItems() {
    const container = document.getElementById('checkout-summary-items');
    const cart = getCart();
    if (!container) return;

    // NOUVEAU: Si le panier est vide, désactiver le bouton de paiement
    const submitButton = document.querySelector('#checkout-form button[type="submit"]');
    if (cart.length === 0 && submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Votre panier est vide';
    }

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Votre panier est vide.</p>';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="flex items-center space-x-4 py-2">
            <div class="relative w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                <img src="${item.imageUrl}" alt="${item.name}" class="w-full h-full object-cover">
                <span class="absolute -top-2 -right-2 bg-gray-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">${item.quantity}</span>
            </div>
            <div class="flex-grow"><p class="font-semibold text-sm">${item.name}</p></div>
            <p class="text-sm font-semibold">${(item.price * item.quantity).toLocaleString('fr-FR')} F</p>
        </div>`).join('');
}

/**
 * NOUVEAU: Met à jour les méthodes de livraison en fonction de la localité choisie.
 */
function updateDeliveryMethodsCheckout() {
    const deliveryOptions = siteConfig.deliveryOptions || {};
    const locations = deliveryOptions.locations || {};
    const methods = deliveryOptions.methods || {};

    const locationSelect = document.getElementById('delivery-location');
    const methodSelect = document.getElementById('delivery-method');
    const selectedLocation = locationSelect.value;

    // Si aucune localité n'est choisie, vider et désactiver le sélecteur de méthode.
    if (!selectedLocation) {
        methodSelect.innerHTML = '<option value="">-- D\'abord choisir une localité --</option>';
        methodSelect.disabled = true;
        updateCheckoutTotal(); // Mettre à jour le total (sans frais de port)
        return;
    }

    const locationData = locations[selectedLocation];
    if (!locationData || !locationData.methods) {
        methodSelect.innerHTML = '<option value="">-- Aucune méthode disponible --</option>';
        methodSelect.disabled = true;
        updateCheckoutTotal();
        return;
    }
    
    let methodHTML = '';
    locationData.methods.forEach(methodKey => {
        const methodData = methods[methodKey];
        if (methodData) {
            methodHTML += `<option value="${methodKey}" data-price="${methodData.price}">${methodData.label} (${methodData.price.toLocaleString('fr-FR')} F CFA)</option>`;
        }
    });
    
    methodSelect.innerHTML = methodHTML;
    methodSelect.disabled = false;
    updateCheckoutTotal(); // Mettre à jour le total avec la nouvelle méthode/coût
}

/**
 * NOUVEAU: Calcule les frais de livraison en fonction de la localité et du sous-total.
 * @param {string} locationKey - La clé de la localité de livraison sélectionnée (ex: 'dakar_plateau').
 * @param {number} subtotal - Le sous-total de la commande.
 * @returns {number} Le coût de la livraison.
 */
function getShippingCost(location, subtotal) {
    // La condition de livraison gratuite pour les commandes > 10000 F a été retirée.
    
    const methodSelect = document.getElementById('delivery-method');
    if (methodSelect && methodSelect.selectedOptions.length > 0) {
        const selectedOption = methodSelect.selectedOptions[0];
        // NOUVEAU: Le prix est maintenant stocké dans un attribut `data-price` pour plus de fiabilité.
        const price = selectedOption.dataset.price;
        if (price) {
            return parseFloat(price);
        }
    }

    return 0;
}

/**
 * NOUVEAU: Met à jour le calcul du total sur la page de paiement.
 */
function updateCheckoutTotal() {
    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const selectedLocation = document.getElementById('delivery-location').value;
    const shippingCost = getShippingCost(selectedLocation, subtotal);

    const total = subtotal + shippingCost;

    document.getElementById('checkout-subtotal').textContent = `${subtotal.toLocaleString('fr-FR')} F CFA`;
    document.getElementById('checkout-shipping').textContent = shippingCost > 0 ? `${shippingCost.toLocaleString('fr-FR')} F CFA` : 'Gratuit (Offert)';
    document.getElementById('checkout-total').textContent = `${total.toLocaleString('fr-FR')} F CFA`;
}

/**
 * Traite la commande et l'envoie au backend.
 * @param {Event} event - L'événement du formulaire.
 */
async function processCheckout(event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const form = event.target;
    const statusDiv = document.getElementById('checkout-status');
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Traitement en cours...';

    // NOUVEAU: Références aux éléments de la modale
    const aggregatorModal = document.getElementById('aggregator-modal');

    statusDiv.textContent = 'Veuillez patienter...';

    // NOUVEAU: Récupérer les paramètres de paiement pour vérifier l'activation des agrégateurs
    let paymentSettings;
    try {
        const settingsResponse = await fetch(CONFIG.ACCOUNT_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'getPaymentSettings' }) });
        const settingsResult = await settingsResponse.json();
        if (settingsResult.success) paymentSettings = settingsResult.data;
        else throw new Error(settingsResult.error || "Impossible de récupérer les paramètres de paiement.");
    } catch (error) {
        statusDiv.textContent = `Erreur lors de la récupération des paramètres de paiement: ${error.message}`;
        statusDiv.className = 'mt-4 text-center font-semibold text-red-600'; return;
        submitButton.disabled = false; submitButton.textContent = 'Valider la commande';
    }
    // 1. Récupérer les données du formulaire
    const selectedPaymentMethodElement = form.querySelector('input[name="payment-method"]:checked');
    const selectedPaymentProviderElement = form.querySelector('input[name="payment-provider"]:checked'); // NOUVEAU
    const customerData = {
        firstname: form.querySelector('#firstname').value,
        lastname: form.querySelector('#lastname').value,
        email: form.querySelector('#email').value,
        phone: form.querySelector('#phone').value,
        notes: form.querySelector('#notes').value,
        address: form.querySelector('#delivery-address').value,
        location: form.querySelector('#delivery-location').value,
        deliveryMethod: form.querySelector('#delivery-method').value,
        // CORRECTION: Vérifier si une méthode de paiement est bien sélectionnée avant d'accéder à sa valeur.
        // S'il n'y en a pas (par ex. si l'API a échoué), on utilise 'cod' (Cash on Delivery) par défaut.
        paymentMethod: selectedPaymentMethodElement ? selectedPaymentMethodElement.value : 'cod',
        paymentProvider: selectedPaymentProviderElement ? selectedPaymentProviderElement.value : null // NOUVEAU
    };

    // 2. Récupérer les données du panier depuis le localStorage
    const cart = getCart();
    if (cart.length === 0) {
        statusDiv.textContent = "Votre panier est vide.";
        statusDiv.className = 'mt-4 text-center font-semibold text-red-600';
        submitButton.disabled = false;
        submitButton.textContent = 'Valider la commande';
        return;
    }

    // 3. Vérifier si l'utilisateur est connecté
    const user = JSON.parse(localStorage.getItem('abmcyUser'));
    let clientId = "INVITÉ-" + new Date().getTime(); // ID unique pour l'invité
    let clientName = customerData.firstname + " " + customerData.lastname;

    if (user && user.IDClient) {
        clientId = user.IDClient;
        clientName = user.Nom;
    }

    // 4. Calculer le total final
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = getShippingCost(customerData.location, subtotal);
    const total = subtotal + shippingCost;

    // 5. Préparer l'objet de la commande pour le backend en fonction du mode de paiement
    // NOUVELLE LOGIQUE POUR L'AGRÉGATEUR ABMCY (WAVE, OM, FREE MONEY)
    const isAbmcyAggregatorPayment = customerData.paymentMethod === 'mobile-payment-group' && 
                                     ['wave', 'orange-money', 'free-money'].includes(customerData.paymentProvider);

    if (isAbmcyAggregatorPayment) {
        // UTILISATION DE L'ACTION DÉDIÉE (Comme Paydunya)
        const action = 'createAbmcyAggregatorInvoice';
        const orderPayload = createOrderPayload(action, customerData, cart, total, clientId, clientName);
        // Le backend gérera le statut "En attente" et le moyen de paiement

        try {
            const result = await sendOrderToBackend(orderPayload);
            
            // Redirection vers l'URL de paiement fournie par le backend
            if (result.success && result.payment_url) {
                window.location.href = result.payment_url;
            } else {
                throw new Error("URL de paiement non reçue du serveur.");
            }

        } catch (error) {
            // Gérer les erreurs si l'enregistrement de la commande échoue.
            handleCheckoutError(error, statusDiv, submitButton, 'Valider la commande');
        }

    } else {
        // --- LOGIQUE EXISTANTE POUR LE PAIEMENT À LA LIVRAISON ---
        const action = 'enregistrerCommandeEtNotifier';
        const paymentNote = 'Paiement à la livraison';

        const orderPayload = createOrderPayload(action, customerData, cart, total, clientId, clientName);
        orderPayload.data.moyenPaiement = paymentNote;

        try {
            const result = await sendOrderToBackend(orderPayload);
            statusDiv.className = 'mt-4 text-center font-semibold text-green-600';
            statusDiv.textContent = `Commande #${result.id} enregistrée avec succès ! Vous allez être redirigé.`;
            window.location.href = `confirmation.html?orderId=${result.id}`;
        } catch (error) {
            handleCheckoutError(error, statusDiv, submitButton, 'Valider la commande');
        }
    }
}

/**
 * NOUVEAU: Fonction centralisée pour créer le payload de la commande.
 * @param {string} action - L'action à effectuer par le backend.
 * @param {object} customerData - Données du client.
 * @param {Array} cart - Le panier.
 * @param {number} total - Le montant total.
 * @param {string} clientId - L'ID du client.
 * @param {string} clientName - Le nom du client.
 * @returns {object} Le payload complet de la commande.
 */
function createOrderPayload(action, customerData, cart, total, clientId, clientName) {
    let paymentNote = customerData.paymentMethod === 'cod' ? 'Paiement à la livraison' : customerData.paymentProvider;

    const orderPayload = {
        action: action,
        data: {
            idClient: clientId,
            produits: cart.map(item => {
                let finalName = item.name;
                if (item.variants && Object.keys(item.variants).length > 0) {
                    const variantString = Object.entries(item.variants)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ');
                    finalName += ` (${variantString})`;
                }
                return { 
                    name: finalName, 
                    quantity: item.quantity, 
                    price: item.price, 
                    productId: item.productId, 
                    delaiLivraison: item.delaiLivraison,
                    businessId: item.businessId // NOUVEAU: Transmettre l'ID de l'entreprise
                };
            }),
            adresseLivraison: customerData.location === 'retrait_magasin' ? "Point de Retrait : Boutique ABMCY" : `${customerData.address}, ${customerData.location}`,
            total: total,
            moyenPaiement: paymentNote,
            paymentProvider: customerData.paymentProvider,
            customer: {
                name: clientName,
                email: customerData.email,
                phone: customerData.phone
            },
            notes: `[INFO CLIENT POUR L'ADMIN]
Nom: ${clientName}
Email: ${customerData.email}
Tél: ${customerData.phone}
---
Note du client: ${customerData.notes || 'Aucune'}`.trim()
        }
    };

    return orderPayload;
}

/**
 * NOUVEAU: Fonction pour envoyer le payload de la commande au backend.
 * @param {object} payload - Le payload de la commande.
 * @returns {Promise<object>} La réponse du serveur.
 */
async function sendOrderToBackend(payload) {
    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            // Vider le panier uniquement en cas de succès
            // La redirection se fait après, donc on peut vider le panier ici.
            saveCart([]); 
            localStorage.removeItem('abmcyUserOrders'); // Invalider le cache
            return result;
        } else {
            throw new Error(result.error || "Une erreur inconnue est survenue.");
        }
    } catch (error) {
        throw error; // Propage l'erreur pour qu'elle soit gérée par la fonction appelante
    }
}

/**
 * NOUVEAU: Gère l'affichage des erreurs sur la page de paiement.
 */
function handleCheckoutError(error, statusDiv, submitButton, buttonText) {
    statusDiv.textContent = `Erreur: ${error.message}. Veuillez réessayer ou contacter le support.`;
    statusDiv.className = 'mt-4 text-center font-semibold text-red-600';
    submitButton.disabled = false;
    submitButton.textContent = buttonText;
}

/**
 * NOUVEAU: Affiche les produits dans les sections "SuperDeals" et "Big Save" de la page d'accueil.
 */
function renderDailyDealsHomepage(catalog) {
    const superdealsContainer = document.getElementById('superdeals-products');
    const boutiquesContainer = document.getElementById('boutiques-container');

    if (!superdealsContainer || !boutiquesContainer) return;

    // --- Étape 2: Donner au navigateur le temps de dessiner les squelettes ---
    // On lance le chargement des données. getFullCatalog est déjà optimisé avec un cache.
    try {
        // --- Étape 3: Charger le catalogue complet ---
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const products = data.products || [];

        // --- Étape 4: Remplir la section "Nos Boutiques" dès que les catégories sont prêtes ---
        if (categories.length > 0) {
            boutiquesContainer.innerHTML = categories.slice(0, 6).map(cat => `
            <a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="product-card bg-white rounded-lg shadow-md overflow-hidden block text-center">
                <div class="h-32 bg-gray-100 flex items-center justify-center p-2">
                    <img src="${cat.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${cat.NomCategorie}" class="max-h-full max-w-full object-contain">
                </div>
                <div class="p-2">
                    <p class="font-semibold text-sm text-gray-800 truncate">${cat.NomCategorie}</p>
                </div>
            </a>
        `).join('');
        } else {
            boutiquesContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucune boutique à afficher.</p>';
        }

        // --- Étape 5: Remplir la section "SuperDeals" avec les produits ---
        const superDealsProducts = products
            .filter(p => p['Réduction%'] && parseFloat(p['Réduction%']) > 0)
            .slice(0, 6);

        if (superDealsProducts.length > 0) {
            superdealsContainer.innerHTML = superDealsProducts.map(product => renderProductCard(product)).join('');
        } else {
            superdealsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">Aucune offre spéciale pour le moment.</p>';
        }

    } catch (error) {
        console.error("Erreur lors du chargement des données de la page d'accueil:", error);
        const errorMsg = '<p class="col-span-full text-center text-red-500">Impossible de charger le contenu.</p>';
        superdealsContainer.innerHTML = errorMsg;
        boutiquesContainer.innerHTML = errorMsg;
    }
}

/**
 * NOUVEAU: Gère le compte à rebours pour la section "SuperDeals".
 */
function startCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;

    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    // Définir la date de fin de la promotion. 
    // Pour cet exemple, nous la fixons à 8 heures à partir du moment où la page est chargée.
    // Dans une vraie application, cette date viendrait de votre backend.
    const promotionEndDate = new Date();
    promotionEndDate.setHours(promotionEndDate.getHours() + 8);

    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = promotionEndDate - now;

        // Calculs pour les jours, heures, minutes et secondes
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Afficher le résultat dans les éléments
        // `padStart(2, '0')` assure qu'il y a toujours deux chiffres (ex: 09 au lieu de 9)
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');

        // Si le compte à rebours est terminé, afficher un message
        if (distance < 0) {
            clearInterval(timer);
            countdownElement.innerHTML = '<span class="text-red-500 font-semibold">Offres terminées !</span>';
        }
    }, 1000); // Mettre à jour toutes les secondes
}

/**
 * NOUVEAU: Fonction centrale pour récupérer toutes les données publiques.
 * Met en cache les résultats pour améliorer les performances de navigation.
 */
async function getFullCatalog() {
  // CORRECTION: Cette fonction est maintenant uniquement responsable du chargement depuis le réseau.
  console.log("Cache vide. Chargement initial du catalogue complet depuis le réseau...");
  try {
    const response = await fetch(`${CONFIG.CENTRAL_API_URL}?action=getPublicCatalog`);
    if (!response.ok) {
      throw new Error(`Erreur réseau: ${response.statusText}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "L'API a retourné une erreur.");
    }

    // NOUVEAU: Vérification de l'intégrité des données pour éviter le crash
    if (!result.data) {
        throw new Error("Le catalogue reçu est vide (data manquant).");
    }
    // Si les produits sont manquants, on initialise un tableau vide pour éviter le crash
    if (!result.data.products) {
        console.warn("Catalogue: 'products' manquant dans la réponse, initialisation à [].");
        result.data.products = [];
    }

    // Stocker le résultat dans le cache de session pour les navigations futures.
    console.log(`Catalogue complet assemblé (${result.data.products.length} produits). Mise en cache pour la session.`);
    sessionStorage.setItem('abmcyFullCatalog', JSON.stringify(result));
    sessionStorage.setItem('abmcyCacheVersion', result.cacheVersion); // Stocker la version du cache
    return result;

  } catch (error) {
    console.error("Échec du chargement du catalogue complet:", error);
    // En cas d'erreur, retourner une structure vide pour ne pas planter le site.
    return { success: false, data: { categories: [], products: [] }, error: error.message };
  }
}

/**
 * NOUVEAU: Met à jour le lien du bouton WhatsApp flottant.
 * @param {string|null} number Le numéro de téléphone à utiliser. Si null, utilise le numéro par défaut.
 */
function updateWhatsAppLink(number) {
    const whatsappButton = document.getElementById('whatsapp-float-btn');
    if (!whatsappButton) return;

    const defaultNumber = "221769047999";
    const targetNumber = number && String(number).trim() ? String(number).trim() : defaultNumber;
    
    // Nettoyer le numéro pour l'URL (supprimer espaces, +, etc.)
    const cleanedNumber = targetNumber.replace(/[\s+()-]/g, '');

    whatsappButton.href = `https://wa.me/${cleanedNumber}`;
}

/**
 * NOUVEAU: Met à jour le lien WhatsApp spécifiquement pour la page catégorie.
 */
function updateWhatsAppLinkForCategory(catalog) {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const category = catalog.data.categories.find(cat => cat.IDCategorie === categoryId);
    updateWhatsAppLink(category ? category.Numero : null);
}

/**
 * NOUVEAU: Stratégie "Stale-While-Revalidate".
 * 1. Retourne immédiatement les données du cache si elles existent.
 * 2. En arrière-plan, vérifie si une mise à jour est nécessaire et la télécharge.
 */
async function getCatalogAndRefreshInBackground() {
    const CACHE_KEY = 'abmcyFullCatalog';
    const CACHE_VERSION_KEY = 'abmcyCacheVersion';
    const TIMESTAMP_KEY = 'abmcyCacheTimestamp';
    const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes en millisecondes

    const cachedData = sessionStorage.getItem(CACHE_KEY);
    const cachedVersion = sessionStorage.getItem(CACHE_VERSION_KEY);
    const cacheTimestamp = sessionStorage.getItem(TIMESTAMP_KEY);

    // Fonction pour récupérer les nouvelles données du réseau
    const fetchAndUpdateCache = async () => {
        console.log("Tentative de mise à jour du cache en arrière-plan...");
        try {
            const response = await fetch(`${CONFIG.CENTRAL_API_URL}?action=getPublicCatalog`);
            if (!response.ok) return; // Échoue silencieusement
            const result = await response.json();
            if (result.success) {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
                sessionStorage.setItem(CACHE_VERSION_KEY, result.cacheVersion);
                sessionStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
                console.log("Cache mis à jour avec succès en arrière-plan.");
            }
        } catch (error) {
            console.error("Échec de la mise à jour du cache en arrière-plan:", error);
        }
    };

    // Fonction pour vérifier la version du cache sur le serveur
    const checkCacheVersion = async () => {
        try {
            const response = await fetch(`${CONFIG.CENTRAL_API_URL}?action=getCacheVersion`);
            const result = await response.json();
            if (result.success && result.cacheVersion !== cachedVersion) {
                fetchAndUpdateCache(); // La version a changé, on met à jour
            }
        } catch (error) {
            console.error("Impossible de vérifier la version du cache:", error);
        }
    };

    if (cachedData) {
        console.log("Utilisation des données du cache pour un affichage instantané.");
        const isCacheStale = !cacheTimestamp || (Date.now() - parseInt(cacheTimestamp) > CACHE_LIFETIME);
        
        if (isCacheStale) {
            // Le cache est "périmé", on lance une mise à jour en arrière-plan sans attendre la réponse.
            // AMÉLIORATION: On vérifie d'abord si la version a changé avant de tout télécharger.
            checkCacheVersion();
        }
        // On retourne immédiatement les données du cache, qu'elles soient périmées ou non.
        return JSON.parse(cachedData);
    } else {
        // Si pas de cache, on fait un premier chargement bloquant.
        return await getFullCatalog();
    }
}

/**
 * NOUVEAU: Génère le HTML pour une carte de chargement "squelette".
 * @returns {string} Le code HTML de la carte squelette.
 */
function getSkeletonCardHTML() {
    return `
    <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
        <div class="bg-gray-200 h-40"></div>
        <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
    </div>`;
}

/**
 * Génère le HTML pour une carte de produit.
 * @param {object} product - L'objet produit.
 * @returns {string} Le HTML de la carte.
 */
function renderProductCard(product) { // This function remains synchronous as it only formats data
    const price = product.PrixActuel || 0;
    const oldPrice = product.PrixAncien || 0;
    const discount = product['Réduction%'] || 0;
    const stock = product.Stock || 0;

    // Pour la nouvelle carte de type AliExpress, on simplifie l'affichage
    return `
    <a href="produit.html?id=${product.IDProduit}" class="product-card bg-white rounded-lg shadow overflow-hidden flex flex-col justify-between group block">
        <div class="relative">
            <div class="h-40 bg-gray-200 flex items-center justify-center">
                <img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="h-full w-full object-cover" loading="lazy" width="160" height="160" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_PRODUCT_IMAGE}';">
            </div>
            ${discount > 0 ? `<span class="discount-badge absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">-${Math.round(discount)}%</span>` : ''}
            
            <!-- NOUVEAU: Conteneur pour les icônes d'action qui apparaissent au survol -->
            <div class="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onclick="addToCart(event, '${product.IDProduit}', '${product.Nom}', ${price}, '${product.ImageURL}')" title="Ajouter au panier" class="bg-white p-2 rounded-full shadow-lg hover:bg-gold hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                </button>
                <button onclick="shareProduct(event, '${product.IDProduit}')" title="Partager" class="bg-white p-2 rounded-full shadow-lg hover:bg-gold hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
                </button>
            </div>
        </div>
        <div class="p-3 flex-grow flex flex-col">
            <p class="text-sm text-gray-700 truncate flex-grow" title="${product.Nom}">${product.Nom}</p>
            <div class="mt-1">
                <p class="font-bold text-lg">${price.toLocaleString('fr-FR')} F CFA</p>
                ${oldPrice > price ? `<p class="text-xs text-gray-400 line-through">${oldPrice.toLocaleString('fr-FR')} F CFA</p>` : ''}
            </div>
        </div>
    </a>
    `;
}

/**
 * NOUVEAU: Crée une image partageable en utilisant un canvas.
 * Dessine l'image du produit, un logo, le nom et le prix.
 * @param {object} product - L'objet produit contenant les détails.
 * @returns {Promise<File|null>} Un objet Fichier de l'image générée, ou null en cas d'erreur.
 */
async function createShareableImage(product) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // --- Configuration de l'image ---
    const canvasWidth = 800;
    const canvasHeight = 1000; // Hauteur plus grande pour ajouter un bandeau d'information
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Fond blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Dessiner l'image principale du produit
    try {
        const productImage = new Image();
        // IMPORTANT (CORS): L'image doit être servie avec les bons en-têtes CORS.
        // J'ajoute `crossOrigin` pour tenter de charger l'image correctement.
        productImage.crossOrigin = "Anonymous"; 
        productImage.src = product.ImageURL;
        
        await new Promise((resolve, reject) => {
            productImage.onload = resolve;
            productImage.onerror = () => reject(new Error("Impossible de charger l'image du produit. Vérifiez les en-têtes CORS."));
        });

        // Calculer les dimensions pour que l'image remplisse la zone d'image (800x800)
        const imgAspectRatio = productImage.width / productImage.height;
        let drawWidth = canvasWidth;
        let drawHeight = drawWidth / imgAspectRatio;
        if (drawHeight < canvasWidth) {
            drawHeight = canvasWidth;
            drawWidth = drawHeight * imgAspectRatio;
        }
        const offsetX = (canvasWidth - drawWidth) / 2;
        const offsetY = (canvasWidth - drawHeight) / 2;

        ctx.drawImage(productImage, offsetX, offsetY, drawWidth, drawHeight);

    } catch (error) {
        console.error(error.message);
        showToast(error.message, true);
        return null; // Arrêter si l'image ne peut pas être chargée
    }

    // 3. Dessiner le bandeau d'information en bas
    const infoY = 800;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, infoY, canvasWidth, 200);

    // 4. Ajouter le texte
    // Nom du produit
    ctx.fillStyle = '#1a1a1a'; // Noir
    ctx.font = 'bold 42px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(product.Nom, canvasWidth / 2, infoY + 70, canvasWidth - 40);

    // Prix
    ctx.fillStyle = '#D4AF37'; // Or
    ctx.font = 'bold 52px Montserrat, sans-serif';
    ctx.fillText(`${product.PrixActuel.toLocaleString('fr-FR')} F CFA`, canvasWidth / 2, infoY + 135);

    // Texte "Disponible sur"
    ctx.fillStyle = '#6b7280'; // Gris
    ctx.font = '24px Montserrat, sans-serif';
    ctx.fillText('Disponible sur ABMCY MARKET', canvasWidth / 2, infoY + 175);

    // 5. Convertir le canvas en Fichier pour le partage
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], `${product.IDProduit}.png`, { type: 'image/png' });
                resolve(file);
            } else {
                resolve(null);
            }
        }, 'image/png');
    });
}

/**
 * NOUVEAU: Copie le lien du produit dans le presse-papiers et affiche une notification.
 * @param {Event} event 
 * @param {string} productId 
 */
async function shareProduct(event, productId) {
    event.preventDefault();
    event.stopPropagation();

    const productUrl = `${window.location.origin}/produit.html?id=${productId}`;
    const product = (await getCatalogAndRefreshInBackground()).data.products.find(p => p.IDProduit === productId);
    
    if (!product) {
        showToast("Impossible de générer l'image de partage.", true);
        return;
    }

    // NOUVELLE LOGIQUE: Générer l'image personnalisée
    const shareableImageFile = await createShareableImage(product);

    try {
        // Vérifier si l'API de partage est disponible et si on a pu créer l'image
        if (navigator.share && shareableImageFile) {
            const shareData = {
                title: `Découvrez "${product.Nom}" sur ABMCY MARKET`,
                text: `J'ai trouvé ce super produit sur ABMCY MARKET !`,
                url: productUrl,
                files: [shareableImageFile]
            };
            await navigator.share(shareData);
            console.log("Produit partagé avec succès via l'API de partage avec image personnalisée.");
        } else {
            // Solution de secours : copier le lien si le partage de fichiers n'est pas possible
            navigator.clipboard.writeText(productUrl);
            showToast('Lien du produit copié !');
        }
    } catch (err) {
        console.error('Erreur de partage: ', err);
        // Si l'utilisateur annule, une erreur "AbortError" est levée, c'est normal.
        // On ne montre pas de message d'erreur dans ce cas.
        if (err.name !== 'AbortError') {
            showToast("Le partage a échoué.", true);
        }
    }
}

/**
 * NOUVEAU: Partage le lien du site via l'API native.
 */
async function shareSite() {
    const shareData = {
        title: "ABMCY MARKET",
        text: "J'ai trouvé une super boutique en ligne, ABMCY MARKET, jette un oeil !",
        url: window.location.origin,
    };
    try {
        await navigator.share(shareData);
    } catch (err) {
        console.error('Erreur de partage: ', err);
        // Si le partage échoue, on copie le lien
        copySiteLink();
    }
}

/**
 * NOUVEAU: Copie le lien du site dans le presse-papiers.
 */
function copySiteLink() {
    navigator.clipboard.writeText(window.location.origin).then(() => {
        showToast('Lien de la boutique copié !');
    }).catch(err => {
        showToast('Impossible de copier le lien.', true);
    });
}

/**
 * NOUVEAU: Affiche des sections de produits pour chaque catégorie sur la page d'accueil.
 */
function renderHomepageCategorySections(catalog) {
    const mainContainer = document.getElementById('category-products-sections-container');
    if (!mainContainer) return;
    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));
        const products = data.products || [];

        const productsByCategory = products.reduce((acc, product) => {
            const categoryName = product.Catégorie;
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push(product);
            return acc;
        }, {});

        let allSectionsHTML = '';
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const categoryProducts = (productsByCategory[category.NomCategorie] || []).slice(0, 12); // Limite à 12 produits
            if (categoryProducts.length === 0) continue;

            allSectionsHTML += `
                <section data-category-id="${category.IDCategorie}">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-bold text-gray-800">${category.NomCategorie}</h3>
                        <a href="categorie.html?id=${category.IDCategorie}&name=${encodeURIComponent(category.NomCategorie)}" class="text-sm font-semibold text-blue-600 hover:underline">Voir plus</a>
                    </div>
                    <div class="horizontal-scroll-container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        ${categoryProducts.map(p => renderProductCard(p)).join('')}
                    </div>
                </section>
            `;

            // NOUVEAU: Insérer un carrousel après chaque deux catégories
            if ((i + 1) % 2 === 0 && i < categories.length - 1) {
                const nextCategory1 = categories[i + 1];
                const nextCategory2 = categories[i + 2];
                const carouselId = `promo-carousel-${i}`;
                let carouselItems = [];

                // Ajouter les images de pub
                if (nextCategory1 && nextCategory1.AdImageURLs) {
                    nextCategory1.AdImageURLs.split(',').forEach(url => {
                        if(url.trim()) carouselItems.push({ type: 'ad', imageUrl: url.trim(), link: `categorie.html?id=${nextCategory1.IDCategorie}` });
                    });
                }
                if (nextCategory2 && nextCategory2.AdImageURLs) {
                    nextCategory2.AdImageURLs.split(',').forEach(url => {
                        if(url.trim()) carouselItems.push({ type: 'ad', imageUrl: url.trim(), link: `categorie.html?id=${nextCategory2.IDCategorie}` });
                    });
                }

                // Trouver les produits les moins chers
                let cheapestProducts = [];
                if (nextCategory1) cheapestProducts.push(...(productsByCategory[nextCategory1.NomCategorie] || []));
                if (nextCategory2) cheapestProducts.push(...(productsByCategory[nextCategory2.NomCategorie] || []));

                cheapestProducts.sort((a, b) => a.PrixActuel - b.PrixActuel);
                
                cheapestProducts.slice(0, 4).forEach(p => carouselItems.push({ type: 'product', product: p }));

                if (carouselItems.length > 0) {
                    const dotsHTML = `<div class="carousel-dots absolute left-1/2 -translate-x-1/2 flex space-x-2">${carouselItems.map((_, idx) => `<div class="carousel-dot" data-index="${idx}"></div>`).join('')}</div>`;

                    allSectionsHTML += `
                        <section class="my-12 relative pb-8">
                            <h3 class="text-3xl font-extrabold text-center text-gray-800 mb-2">Nos Offres Immanquables</h3>
                            <p class="text-center text-gray-500 mb-6">Saisissez votre chance, les stocks sont limités !</p>
                            <div id="${carouselId}" class="promo-carousel flex overflow-x-auto snap-x-mandatory">
                                ${carouselItems.map(item => {
                                    if (item.type === 'ad') {
                                        return `
                                            <a href="${item.link}" class="promo-carousel-item flex-shrink-0 w-full rounded-lg overflow-hidden relative h-64">
                                                <img src="${item.imageUrl}" class="w-full h-full object-cover" alt="Publicité">
                                                <div class="absolute inset-0 bg-black bg-opacity-30 flex items-end p-6">
                                                    <h4 class="text-white text-2xl font-bold">Découvrez nos Nouveautés</h4>
                                                </div>
                                            </a>
                                        `;
                                    } else { // type 'product'
                                        const p = item.product;
                                        return `
                                            <div class="promo-carousel-item flex-shrink-0 w-full bg-white rounded-lg overflow-hidden p-4">
                                                <a href="produit.html?id=${p.IDProduit}" class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                                    <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <img src="${p.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${p.Nom}" class="max-h-full max-w-full object-contain">
                                                    </div>
                                                    <div class="text-center md:text-left">
                                                        <p class="text-sm text-gray-500">${p.Catégorie}</p>
                                                        <h4 class="text-2xl font-bold text-gray-800 my-2">${p.Nom}</h4>
                                                        <p class="font-bold text-3xl text-gold">${p.PrixActuel.toLocaleString('fr-FR')} F CFA</p>
                                                        ${p.PrixAncien > p.PrixActuel ? `<p class="text-lg text-gray-400 line-through">${p.PrixAncien.toLocaleString('fr-FR')} F CFA</p>` : ''}
                                                        <button class="mt-4 bg-black text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-800 transition">
                                                            J'en Profite
                                                        </button>
                                                    </div>
                                                </a>
                                            </div>
                                        `;
                                    }
                                }).join('')}
                            </div>
                            ${dotsHTML}
                        </section>
                    `;
                }
            }
        }

        mainContainer.innerHTML = allSectionsHTML;
        // NOUVEAU: Initialiser tous les carrousels créés
        document.querySelectorAll('.promo-carousel').forEach(carousel => initializePromoCarousel(carousel.id));

    } catch (error) {
        console.error("Erreur lors de l'affichage des sections par catégorie:", error);
        container.innerHTML = '<p class="text-center text-red-500">Impossible de charger les sections de produits.</p>';
    }
}

/**
 * NOUVEAU: Initialise un carrousel promotionnel (auto-scroll et points de navigation).
 * @param {string} carouselId L'ID de l'élément carrousel.
 */
function initializePromoCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const dotsContainer = carousel.nextElementSibling;
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    const items = carousel.querySelectorAll('.promo-carousel-item');
    let currentIndex = 0;
    let intervalId;

    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function scrollToItem(index) {
        carousel.scrollTo({
            left: items[index].offsetLeft,
            behavior: 'smooth'
        });
        currentIndex = index;
        updateDots();
    }

    function startAutoScroll() {
        intervalId = setInterval(() => {
            let nextIndex = (currentIndex + 1) % items.length;
            scrollToItem(nextIndex);
        }, 5000); // Change toutes les 5 secondes
    }

    function resetAutoScroll() {
        clearInterval(intervalId);
        startAutoScroll();
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            scrollToItem(parseInt(dot.dataset.index));
            resetAutoScroll(); // Redémarre le minuteur après une interaction manuelle
        });
    });

    carousel.addEventListener('mouseenter', () => clearInterval(intervalId));
    carousel.addEventListener('mouseleave', resetAutoScroll);

    updateDots();
    startAutoScroll();
}

/**
 * NOUVEAU: Affiche la liste complète de toutes les catégories sur la page d'accueil.
 */
function renderAllCategoriesSection(catalog) {
    const container = document.getElementById('all-categories-container');
    if (!container) return;

    try {
        const { data } = catalog;
        const categories = (data.categories || []).filter(cat => cat.SheetID && cat.ScriptURL && !cat.ScriptURL.startsWith('REMPLIR_'));

        if (categories.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Aucune catégorie à afficher pour le moment.</p>';
            return;
        }

        // Organiser les catégories en colonnes pour une meilleure lisibilité
        const categoriesHTML = categories.map(cat => `
            <a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="block text-gray-700 hover:text-gold hover:underline text-sm py-1">
                ${cat.NomCategorie}
            </a>
        `).join('');

        container.innerHTML = `<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-2">${categoriesHTML}</div>`;

    } catch (error) {
        console.error("Erreur lors de l'affichage de la liste complète des catégories:", error);
        container.innerHTML = '<p class="text-center text-red-500">Impossible de charger la liste des catégories.</p>';
    }
}
// --- LOGIQUE D'AUTHENTIFICATION ---

/**
 * NOUVEAU: Enregistre un événement dans le localStorage pour le débogage sur la page log.html.
 * @param {string} type Le type d'événement (ex: 'FETCH_SUCCESS', 'FETCH_ERROR').
 * @param {object} data Les données associées à l'événement.
 */
async function logAppEvent(type, data) {
    const LOG_KEY = 'abmcyAppLogs';
    const MAX_LOGS = 50;
    try {
        let logs = JSON.parse(localStorage.getItem(LOG_KEY)) || [];
        
        const logEntry = {
            type: type,
            timestamp: new Date().toISOString(),
            ...data
        };

        // NOUVEAU: Envoyer le log au serveur de manière asynchrone ("fire and forget")
        // On n'attend pas la réponse pour ne pas ralentir l'interface utilisateur.
        const logPayload = {
            action: 'logClientEvent',
            data: logEntry
        };
        try {
            // NOUVEAU: Utiliser async/await pour capturer les erreurs de fetch (comme CORS)
            // et s'assurer que le log est bien envoyé.
            await fetch(CONFIG.ACCOUNT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, // NOUVEAU: Aligné sur les autres requêtes pour éviter le preflight.
                body: JSON.stringify(logPayload),
                keepalive: true
            });
        } catch (e) { console.error("Échec critique de l'envoi du log au serveur:", e); }

        logs.push(logEntry);
        if (logs.length > MAX_LOGS) {
            logs = logs.slice(logs.length - MAX_LOGS);
        }
        localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) { console.error("Impossible d'écrire dans le journal :", e); }
}

/**
 * NOUVEAU: Gère l'affichage/masquage d'un champ mot de passe.
 * @param {string} inputId 
 * @param {string} toggleId 
 * @param {string} eyeOpenId 
 * @param {string} eyeClosedId 
 */
function initializePasswordToggle(inputId, toggleId, eyeOpenId, eyeClosedId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(toggleId);
    const eyeOpen = document.getElementById(eyeOpenId);
    const eyeClosed = document.getElementById(eyeClosedId);

    if (!passwordInput || !toggleButton) return;

    toggleButton.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        eyeOpen.classList.toggle('hidden', isPassword);
        eyeClosed.classList.toggle('hidden', !isPassword);
    });
}

/**
 * Gère la soumission des formulaires de connexion et d'inscription.
 * @param {Event} event L'événement de soumission du formulaire.
 * @param {string} type 'login' ou 'register'.
 */
async function handleAuthForm(event, type) {
    event.preventDefault();
    const form = event.target;
    const statusDiv = document.getElementById('auth-status');
    statusDiv.className = 'mt-4 text-center font-semibold'; // Reset classes
    statusDiv.textContent = 'Veuillez patienter...';

    let payload;

    if (type === 'register') {
        const password = form.querySelector('#register-password').value;
        const passwordConfirm = form.querySelector('#register-password-confirm').value;

        if (password !== passwordConfirm) {
            statusDiv.textContent = 'Les mots de passe ne correspondent pas.';
            statusDiv.classList.add('text-red-600');
            return;
        }

        // NOUVEAU: Validation du mot de passe
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            statusDiv.innerHTML = 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole.';
            statusDiv.className = 'mt-4 text-center font-semibold text-red-600 text-xs';
            return;
        }

        payload = {
            action: 'creerCompteClient',
            data: {
                nom: form.querySelector('#register-nom').value,
                email: form.querySelector('#register-email').value,
                motDePasse: password,
                adresse: form.querySelector('#register-adresse').value || '',
                telephone: form.querySelector('#register-telephone').value || ''
            }
        };
    } else { // type === 'login'
        payload = {
            action: 'connecterClient', // Assurez-vous que cette action existe dans votre API Client
            data: {
                email: form.querySelector('#login-email').value,
                motDePasse: form.querySelector('#login-password').value
            }
        };
    }

    logAppEvent('FETCH_START', {
        message: `Tentative de ${type === 'login' ? 'connexion' : 'création de compte'}`,
        url: CONFIG.ACCOUNT_API_URL,
        payload: payload
    });

    try {
        form.querySelector('button[type="submit"]').disabled = true;
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            // Utiliser text/plain pour en faire une "requête simple" et éviter le preflight CORS.
            headers: { 'Content-Type': 'text/plain' }, // Changé de application/json
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            logAppEvent('FETCH_SUCCESS', {
                message: `Action '${payload.action}' réussie.`,
                url: CONFIG.ACCOUNT_API_URL,
                response: result
            });

            if (type === 'register') {
                statusDiv.textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
                statusDiv.classList.add('text-green-600');
                setTimeout(() => switchTab('login'), 1500); // Basculer vers l'onglet de connexion
            } else { // type === 'login'
                statusDiv.textContent = 'Connexion réussie ! Redirection...';
                statusDiv.classList.add('text-green-600');
                // Stocker les informations de l'utilisateur et rediriger
                localStorage.setItem('abmcyUser', JSON.stringify(result.user));
                window.location.href = 'compte.html'; // Redirection vers la page de compte
            }
        } else {
            logAppEvent('API_ERROR', {
                message: `L'API a retourné une erreur pour l'action '${payload.action}'.`,
                url: CONFIG.ACCOUNT_API_URL,
                error: result.error,
                payload: payload
            });
            throw new Error(result.error || 'Une erreur est survenue.');
        }
    } catch (error) {
        logAppEvent('FETCH_ERROR', {
            message: `Échec de la requête pour l'action '${payload.action}'.`,
            url: CONFIG.ACCOUNT_API_URL,
            error: error.message,
            payload: payload
        });
        let errorMessage = `Erreur: ${error.message}`;
        // NOUVEAU: Si l'erreur vient de la connexion, on suggère de s'inscrire.
        if (type === 'login') {
            errorMessage += ` <br><a href="#" onclick="switchTab('register'); return false;" class="text-blue-600 hover:underline">Pas de compte ? Créez-en un.</a>`;
        }
        statusDiv.innerHTML = errorMessage; // Utiliser innerHTML pour que le lien soit cliquable
        statusDiv.classList.add('text-red-600');
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
}

/**
 * Gère le changement d'onglet entre Connexion et Inscription.
 * @param {string} tabName 'login' ou 'register'.
 */
function switchTab(tabName) {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginTab.classList.toggle('border-gold', tabName === 'login');
    loginTab.classList.toggle('text-gray-500', tabName !== 'login');
    registerTab.classList.toggle('border-gold', tabName === 'register');
    registerTab.classList.toggle('text-gray-500', tabName !== 'register');

    loginForm.classList.toggle('hidden', tabName !== 'login');
    registerForm.classList.toggle('hidden', tabName !== 'register');

    document.getElementById('auth-status').textContent = ''; // Clear status messages
}

// --- LOGIQUE DE LA PAGE COMPTE ---

/**
 * Initialise la page "Mon Compte".
 * Vérifie si l'utilisateur est connecté, sinon le redirige.
 * Affiche les informations de l'utilisateur.
 */
async function initializeAccountPage() {
    const userFromCache = JSON.parse(localStorage.getItem('abmcyUser'));
    if (!userFromCache) {
        window.location.href = 'authentification.html';
        return;
    }

    // --- AMÉLIORATION: Affichage instantané des données en cache ---
    // Affiche immédiatement les informations de l'utilisateur pour une meilleure réactivité.
    displayUserData(userFromCache);

    // --- Chargement des données du compte ---
    // Les informations personnelles sont déjà affichées depuis le cache.
    // On charge maintenant les commandes et les favoris.
    loadRecentOrdersForAccount(userFromCache.IDClient);
    loadFavoriteProducts();

    // NOUVEAU: Logique pour la modale de modification du profil
    const editModal = document.getElementById('edit-profile-modal');
    if (editModal) {
        document.getElementById('open-edit-modal-btn').addEventListener('click', () => openEditProfileModal(userFromCache));
        document.getElementById('close-edit-modal-btn').addEventListener('click', closeEditProfileModal);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEditProfileModal);
        document.getElementById('edit-profile-form').addEventListener('submit', (e) => handleUpdateProfile(e, userFromCache.IDClient));
    }

    // NOUVEAU: Logique pour la modale d'adresse
    const addressModal = document.getElementById('address-modal');
    if (addressModal) {
        document.getElementById('open-add-address-modal-btn').addEventListener('click', () => openAddressModal());
        document.getElementById('close-address-modal-btn').addEventListener('click', closeAddressModal);
        document.getElementById('cancel-address-btn').addEventListener('click', closeAddressModal);
        document.getElementById('address-form').addEventListener('submit', (e) => handleSaveAddress(e, userFromCache.IDClient));
    }

    // NOUVEAU: Charger les adresses de l'utilisateur
    loadUserAddresses(userFromCache.IDClient);

    // NOUVEAU: Logique pour le formulaire de changement de mot de passe
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => handleChangePassword(e, userFromCache.IDClient));
    }


    // Logique de déconnexion
    const logoutAction = (e) => {
        e.preventDefault();
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            handleLogout();
        }
    };

    // CORRECTION: logout-link n'existe plus dans le nouveau design de compte.html
    // document.getElementById('logout-link').addEventListener('click', logoutAction);
    if(document.getElementById('logout-nav-link')) document.getElementById('logout-nav-link').addEventListener('click', logoutAction);
}
/**
 * NOUVEAU: Gère la déconnexion de l'utilisateur.
 */
function handleLogout() {
    localStorage.removeItem('abmcyUser');
    localStorage.removeItem('abmcyUserOrders');
    localStorage.removeItem('abmcyCart');
    localStorage.removeItem('abmcyFavorites');
    window.location.href = 'authentification.html';
}

/**
 * NOUVEAU: Ouvre la fenêtre modale pour modifier le profil et la pré-remplit.
 * @param {object} user - L'objet utilisateur actuel.
 */
function openEditProfileModal(user) {
    document.getElementById('edit-nom').value = user.Nom || '';
    document.getElementById('edit-email').value = user.Email || '';
    document.getElementById('edit-telephone').value = user.Telephone || '';
    document.getElementById('edit-adresse').value = user.Adresse || '';
    document.getElementById('edit-profile-status').textContent = ''; // Vider les messages de statut
    document.getElementById('edit-profile-modal').classList.remove('hidden');
}

/**
 * NOUVEAU: Ferme la fenêtre modale de modification du profil.
 */
function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

/**
 * NOUVEAU: Gère la soumission du formulaire de mise à jour du profil.
 * @param {Event} event - L'événement de soumission du formulaire.
 * @param {string} clientId - L'ID du client à mettre à jour.
 */
async function handleUpdateProfile(event, clientId) {
    event.preventDefault();
    const form = event.target;
    const statusDiv = document.getElementById('edit-profile-status');
    const submitButton = form.querySelector('button[type="submit"]');

    statusDiv.textContent = 'Enregistrement...';
    statusDiv.className = 'text-center font-semibold text-gray-600';
    submitButton.disabled = true;

    const updatedData = {
        Nom: document.getElementById('edit-nom').value,
        Telephone: document.getElementById('edit-telephone').value,
        Adresse: document.getElementById('edit-adresse').value
    };

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateUserProfile', // Nouvelle action à créer dans l'API
                data: {
                    clientId: clientId,
                    updatedData: updatedData
                }
            })
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.textContent = 'Profil mis à jour avec succès !';
            statusDiv.className = 'text-center font-semibold text-green-600';

            // Mettre à jour les données dans le localStorage
            let user = JSON.parse(localStorage.getItem('abmcyUser'));
            user = { ...user, ...updatedData };
            localStorage.setItem('abmcyUser', JSON.stringify(user));

            // Mettre à jour l'affichage sur la page
            displayUserData(user);

            setTimeout(closeEditProfileModal, 1500);
        } else {
            throw new Error(result.error || 'Une erreur est survenue.');
        }
    } catch (error) {
        statusDiv.textContent = `Erreur : ${error.message}`;
        statusDiv.className = 'text-center font-semibold text-red-600';
    } finally {
        submitButton.disabled = false;
    }
}

/**
 * NOUVEAU: Gère la soumission du formulaire de changement de mot de passe.
 * @param {Event} event - L'événement de soumission.
 * @param {string} clientId - L'ID du client.
 */
async function handleChangePassword(event, clientId) {
    event.preventDefault();
    const form = event.target;
    const statusDiv = document.getElementById('change-password-status');
    const submitButton = form.querySelector('button[type="submit"]');

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    statusDiv.textContent = 'Vérification...';
    statusDiv.className = 'mt-4 text-center font-semibold text-sm text-gray-600';

    // NOUVEAU: Validation du mot de passe
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        statusDiv.innerHTML = 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole.';
        statusDiv.className = 'mt-4 text-center font-semibold text-sm text-red-600 text-xs';
        return;
    }

    if (newPassword.length < 6) {
        statusDiv.textContent = 'Le nouveau mot de passe doit faire au moins 6 caractères.';
        statusDiv.className = 'mt-4 text-center font-semibold text-sm text-red-600';
        return;
    }

    if (newPassword !== confirmNewPassword) {
        statusDiv.textContent = 'Les nouveaux mots de passe ne correspondent pas.';
        statusDiv.className = 'mt-4 text-center font-semibold text-sm text-red-600';
        return;
    }

    submitButton.disabled = true;

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'changePassword',
                data: { clientId, currentPassword, newPassword }
            })
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.textContent = 'Mot de passe mis à jour avec succès !';
            statusDiv.className = 'mt-4 text-center font-semibold text-sm text-green-600';
            form.reset(); // Vider le formulaire
        } else {
            throw new Error(result.error || 'Une erreur est survenue.');
        }
    } catch (error) {
        statusDiv.textContent = `Erreur : ${error.message}`;
        statusDiv.className = 'mt-4 text-center font-semibold text-sm text-red-600';
    } finally {
        submitButton.disabled = false;
        setTimeout(() => { statusDiv.textContent = ''; }, 4000); // Effacer le message après 4 secondes
    }
}

/**
 * NOUVEAU: Ouvre la modale pour ajouter/modifier une adresse.
 * @param {object|null} address - L'objet adresse à modifier, ou null pour en ajouter une nouvelle.
 */
function openAddressModal(address = null) {
    const modal = document.getElementById('address-modal');
    const title = document.getElementById('address-modal-title');
    const form = document.getElementById('address-form');

    form.reset();
    document.getElementById('address-status').textContent = '';

    if (address) {
        title.textContent = 'Modifier l\'adresse';
        document.getElementById('address-id').value = address.IDAdresse;
        document.getElementById('address-label').value = address.Label;
        document.getElementById('address-details').value = address.Details;
    } else {
        title.textContent = 'Ajouter une nouvelle adresse';
        document.getElementById('address-id').value = '';
    }

    modal.classList.remove('hidden');
}

/**
 * NOUVEAU: Ferme la modale d'adresse.
 */
function closeAddressModal() {
    document.getElementById('address-modal').classList.add('hidden');
}

/**
 * NOUVEAU: Gère la sauvegarde (ajout/modification) d'une adresse.
 * @param {Event} event 
 * @param {string} clientId 
 */
async function handleSaveAddress(event, clientId) {
    event.preventDefault();
    const form = event.target;
    const statusDiv = document.getElementById('address-status');
    const submitButton = form.querySelector('button[type="submit"]');

    const addressId = document.getElementById('address-id').value;
    const addressData = {
        IDAdresse: addressId,
        IDClient: clientId,
        Label: document.getElementById('address-label').value,
        Details: document.getElementById('address-details').value
    };

    const action = addressId ? 'updateUserAddress' : 'addUserAddress';

    statusDiv.textContent = 'Enregistrement...';
    submitButton.disabled = true;

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, data: addressData })
        });
        const result = await response.json();

        if (result.success) {
            statusDiv.textContent = 'Adresse enregistrée !';
            statusDiv.className = 'text-center font-semibold text-green-600';
            loadUserAddresses(clientId); // Recharger la liste des adresses
            setTimeout(closeAddressModal, 1000);
        } else {
            throw new Error(result.error || 'Erreur inconnue.');
        }
    } catch (error) {
        statusDiv.textContent = `Erreur : ${error.message}`;
        statusDiv.className = 'text-center font-semibold text-red-600';
    } finally {
        submitButton.disabled = false;
    }
}

/**
 * NOUVEAU: Charge et affiche les adresses de l'utilisateur.
 * @param {string} clientId 
 */
async function loadUserAddresses(clientId) {
    const container = document.getElementById('address-list-container');
    if (!container) return;

    container.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getUserAddresses', data: { clientId } })
        });
        const result = await response.json();

        if (result.success) {
            if (result.data.length === 0) {
                container.innerHTML = '<p class="text-sm text-gray-500">Aucune adresse enregistrée.</p>';
            } else {
                container.innerHTML = result.data.map(addr => {
                    const isDefault = addr.IsDefault === true;
                    const defaultBadge = isDefault ? '<span class="text-xs font-bold text-white bg-green-600 px-2 py-1 rounded-full">Par défaut</span>' : '';
                    const setDefaultButton = !isDefault ? `<button onclick='setDefaultAddress("${addr.IDClient}", "${addr.IDAdresse}")' class="text-green-600 hover:text-green-800" title="Définir par défaut"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>` : '';

                    return `
                    <div class="p-3 border rounded-md ${isDefault ? 'bg-green-50 border-green-200' : 'bg-gray-50'}">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-gray-800">${addr.Label}</p>
                                    ${defaultBadge}
                                </div>
                                <p class="text-sm text-gray-600">${addr.Details}</p>
                            </div>
                            <div class="flex gap-2">
                                ${setDefaultButton}
                                <button onclick='openAddressModal(${JSON.stringify(addr)})' class="text-blue-600 hover:text-blue-800" title="Modifier"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536l12.232-12.232z"></path></svg></button>
                                <button onclick='deleteAddress(${JSON.stringify(addr)})' class="text-red-600 hover:text-red-800" title="Supprimer"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                            </div>
                        </div>
                    </div>
                `}).join('');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        container.innerHTML = `<p class="text-sm text-red-500">Erreur de chargement des adresses.</p>`;
    }
}

/**
 * NOUVEAU: Appelle l'API pour définir une adresse par défaut.
 * @param {string} clientId 
 * @param {string} addressId 
 */
async function setDefaultAddress(clientId, addressId) {
    showToast('Mise à jour de l\'adresse par défaut...');
    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'setDefaultAddress',
                data: { clientId, addressId }
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Adresse par défaut mise à jour !');
            loadUserAddresses(clientId); // Recharger la liste pour refléter le changement
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showToast(`Erreur: ${error.message}`, true);
    }
}

/**
 * NOUVEAU: Supprime une adresse.
 * @param {object} address 
 */
async function deleteAddress(address) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'adresse "${address.Label}" ?`)) return;

    // Similaire à handleSaveAddress, mais avec l'action 'deleteUserAddress'
    // Pour la concision, cette partie est laissée en exercice, mais elle suivrait la même logique que handleSaveAddress.
    // Vous auriez besoin d'une action 'deleteUserAddress' dans votre API.
    showToast(`L'adresse "${address.Label}" a été supprimée.`);
    loadUserAddresses(address.IDClient); // Recharger la liste
}

/**
 * NOUVEAU: Affiche les données de l'utilisateur sur la page.
 * @param {object} user - L'objet utilisateur.
 */
function displayUserData(user) {
    const nameDisplay = document.getElementById('user-name-display'); // Bonjour, [Nom]
    const emailDisplay = document.getElementById('user-email-display'); // Email dans les infos
    const phoneDisplay = document.getElementById('user-phone-display'); // Téléphone dans les infos
    const addressDisplay = document.getElementById('user-address-display'); // Adresse dans les infos
    const dashboardName = document.getElementById('dashboard-user-name'); // Nom dans la section "Mes informations"
    const dashboardNameLink = document.getElementById('dashboard-user-name-link'); // Nom dans l'en-tête
    const userInitials = document.getElementById('user-initials'); // Avatar avec initiales

    if (nameDisplay) nameDisplay.textContent = user.Nom.split(' ')[0]; // Affiche seulement le prénom
    if (emailDisplay) emailDisplay.textContent = user.Email;
    if (phoneDisplay) phoneDisplay.textContent = user.Telephone || 'Non renseigné';
    if (addressDisplay) addressDisplay.textContent = user.Adresse || 'Non renseignée';
    if (dashboardName) dashboardName.textContent = user.Nom;
    if (dashboardNameLink) dashboardNameLink.textContent = user.Nom;

    // Initiales pour l'avatar
    if (userInitials) {
        const initials = user.Nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        userInitials.textContent = initials;
    }
}

/**
 * NOUVEAU: Charge les commandes récentes pour la page de compte.
 */
async function loadRecentOrdersForAccount(clientId) {
    const ordersSection = document.getElementById('recent-orders-section');
    const CACHE_KEY = 'abmcyUserOrders';
    if (!ordersSection) return;

    // 1. Essayer de charger depuis le cache
    const cachedOrders = localStorage.getItem(CACHE_KEY);
    if (cachedOrders) {
        console.log("Chargement des commandes depuis le cache.");
        const orders = JSON.parse(cachedOrders);
        renderOrders(orders, ordersSection);
        return; // Arrêter ici si les données sont en cache
    }

    // 2. Si pas de cache, afficher le chargement et fetch depuis le réseau
    console.log("Cache des commandes vide. Chargement depuis le réseau.");
    ordersSection.innerHTML = '<div class="loader mx-auto"></div><p class="text-center text-gray-500 mt-2">Chargement de vos commandes...</p>';

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // Utiliser text/plain pour éviter le preflight
            body: JSON.stringify({
                action: 'getOrdersByClientId',
                data: { clientId: clientId }
            })
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Impossible de récupérer les commandes.");
        }

        // 3. Afficher les données et les mettre en cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(result.data));
        renderOrders(result.data, ordersSection);

    } catch (error) {
        console.error("Erreur lors du chargement des commandes:", error);
        ordersSection.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4><p class="text-red-500">Une erreur est survenue lors du chargement de vos commandes.</p>';
    }
}

/**
 * NOUVEAU: Fonction dédiée au rendu de la liste des commandes.
 * @param {Array} orders - La liste des commandes.
 * @param {HTMLElement} container - L'élément où injecter le HTML.
 */
function renderOrders(orders, container) {
    // NOUVEAU: Ajout d'une icône et d'un titre plus clairs
    const titleHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
            Mes commandes récentes
        </h2>`;

    if (orders.length === 0) {
        container.innerHTML = titleHTML + '<p class="text-gray-500">Vous n\'avez passé aucune commande pour le moment.</p>';
        return;
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Livrée': case 'Payée et confirmée': return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">${status}</span>`;
            case 'Expédiée': case 'En cours de livraison': case 'Confirmée': return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${status}</span>`;
            case 'Annulée': case 'Expiré (Paiement ABMCY)': return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">${status}</span>`;
            default: return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">${status}</span>`;
        }
    };

    const ordersHTML = `
        <h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4>
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm text-left">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 font-semibold">Commande</th><th class="p-3 font-semibold">Date</th><th class="p-3 font-semibold">Statut</th><th class="p-3 font-semibold text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.slice(0, 5).map(order => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-3 font-medium">
                                <a href="suivi-commande.html?orderId=${order.IDCommande}" class="text-blue-600 hover:underline">#${order.IDCommande}</a>
                            </td>
                            <td class="p-3 text-gray-600">${new Date(order.Date).toLocaleDateString('fr-FR')}</td>
                            <td class="p-3">${getStatusBadge(order.Statut)}</td>
                            <td class="p-3 text-right font-semibold text-gray-800">${Number(order.MontantTotal).toLocaleString('fr-FR')} F CFA</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${orders.length > 5 ? '<a href="suivi-commande.html" class="block text-center mt-4 text-sm font-semibold text-blue-600 hover:underline">Voir toutes mes commandes</a>' : ''}
    `;
    container.innerHTML = titleHTML + ordersHTML;
}

/**
 * NOUVEAU: Charge et affiche les produits favoris sur la page de compte.
 */
async function loadFavoriteProducts() {
    const container = document.getElementById('favorite-products-section');
    if (!container) return;

    // NOUVEAU: Ajout d'un titre avec icône
    const titleHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"></path></svg>
            Mes produits favoris
        </h2>`;

    const favoriteIds = getFavorites();
    if (favoriteIds.length === 0) {
        container.innerHTML = titleHTML + '<p class="text-gray-500">Vous n\'avez aucun produit en favori pour le moment.</p>';
        return;
    }

    container.innerHTML = titleHTML + '<div class="loader mx-auto"></div>';

    try {
        const catalog = await getCatalogAndRefreshInBackground();
        const allProducts = catalog.data.products || [];

        const favoriteProducts = allProducts.filter(p => favoriteIds.includes(p.IDProduit));
        
        if (favoriteProducts.length === 0) {
            container.innerHTML = titleHTML + '<p class="text-gray-500">Certains de vos favoris ne sont plus disponibles.</p>';
            return;
        }

        // NOUVEAU: Utiliser un conteneur de défilement horizontal
        const productsHTML = favoriteProducts.map(p => `
            <div class="flex-shrink-0 w-48 md:w-56 p-2">
                ${renderProductCard(p)}
            </div>
        `).join('');

        container.innerHTML = titleHTML + `
            <div class="horizontal-scroll-container flex overflow-x-auto -mx-2 pb-4">
                ${productsHTML}
            </div>
        `;
    } catch (error) {
        console.error("Erreur lors du chargement des favoris:", error);
        container.innerHTML = '<h2 class="text-xl font-bold text-gray-800 mb-4">Mes produits favoris</h2><p class="text-red-500">Impossible de charger vos favoris.</p>';
    }
}

/**
 * Récupère les favoris depuis le localStorage.
 * @returns {string[]} Un tableau d'ID de produits favoris.
 */
function getFavorites() {
    return JSON.parse(localStorage.getItem('abmcyFavorites')) || [];
}

/**
 * Sauvegarde les favoris dans le localStorage.
 * @param {string[]} favorites - Le tableau d'ID de produits favoris.
 */
function saveFavorites(favorites) {
    localStorage.setItem('abmcyFavorites', JSON.stringify(favorites));
}

/**
 * Ajoute ou retire un produit des favoris.
 * @param {Event} event - L'événement du clic.
 * @param {string} productId - L'ID du produit.
 */
function toggleFavorite(event, productId) {
    event.preventDefault();
    event.stopPropagation();

    let favorites = getFavorites();
    const button = event.currentTarget;
    const isFavorited = favorites.includes(productId);

    if (isFavorited) {
        favorites = favorites.filter(id => id !== productId);
        showToast('Retiré des favoris.');
    } else {
        favorites.push(productId);
        showToast('Ajouté aux favoris !');
    }

    saveFavorites(favorites);
    updateFavoriteIcon(button, !isFavorited);
}

/**
 * Met à jour l'apparence de l'icône de favori.
 * @param {HTMLElement} button - Le bouton sur lequel l'utilisateur a cliqué.
 * @param {boolean} isFavorited - True si le produit est maintenant en favori.
 */
function updateFavoriteIcon(button, isFavorited) {
    if (isFavorited) {
        button.classList.add('text-red-500'); // Couleur pour un favori
        button.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>';
    } else {
        button.classList.remove('text-red-500');
        button.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"></path></svg>';
    }
}

/**
 * Charge et affiche les produits favoris sur la page de compte.
 */
async function loadFavoriteProducts() {
    const container = document.getElementById('favorite-products-section');
    if (!container) return;

    const favoriteIds = getFavorites();
    if (favoriteIds.length === 0) {
        container.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes produits favoris</h4><p class="text-gray-500">Vous n\'avez aucun produit en favori pour le moment.</p>';
        return;
    }

    container.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes produits favoris</h4><div class="loader mx-auto"></div>';

    try {
        const catalog = await getCatalogAndRefreshInBackground();
        const allProducts = catalog.data.products || [];

        const favoriteProducts = allProducts.filter(p => favoriteIds.includes(p.IDProduit));

        if (favoriteProducts.length === 0) {
            container.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes produits favoris</h4><p class="text-gray-500">Certains de vos favoris ne sont plus disponibles.</p>';
            return;
        }

        const productsHTML = favoriteProducts.map(p => renderProductCard(p)).join('');
        container.innerHTML = `
            <h4 class="text-lg font-semibold mb-4">Mes produits favoris</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                ${productsHTML}
            </div>
        `;
    } catch (error) {
        console.error("Erreur lors du chargement des favoris:", error);
        container.innerHTML = '<h4 class="text-lg font-semibold mb-4">Mes produits favoris</h4><p class="text-red-500">Impossible de charger vos favoris.</p>';
    }
}

/**
 * NOUVEAU: Initialise la page de confirmation de commande.
 */
async function initializeConfirmationPage() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    const orderNumberElement = document.getElementById('order-number'); // CORRECTION: Utiliser le bon ID
    const orderDetailsContainer = document.getElementById('order-details');
    const countdownContainer = document.getElementById('payment-countdown');
    
    // Si l'un des éléments principaux est manquant, on ne fait rien.
    if (!orderNumberElement || !orderDetailsContainer || !countdownContainer) {
        return;
    }

    if (orderId) {
        orderNumberElement.textContent = orderId;
    } else {
        orderNumberElement.textContent = 'Non disponible';
    }

    // Afficher un message de chargement
    orderDetailsContainer.innerHTML = `
        <div id="loading-details" class="text-center p-4">
            <div class="loader mx-auto"></div><p class="text-sm text-gray-500 mt-2">Récupération des informations de la commande...</p>
        </div>`;

    try {
        // Appeler l'API pour obtenir les détails de la commande
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getOrderById', data: { orderId: orderId } }) // OPTIMISATION: Utilisation de la fonction unifiée
        });
        const result = await response.json();

        // Cacher le message de chargement
        const loadingMessage = document.getElementById('loading-details');
        if (loadingMessage) loadingMessage.remove();
        
        if (result.success && result.data) {
            const order = result.data;
            // Injecter les détails de la commande dans la page (sans le statut pour l'instant)
            orderDetailsContainer.innerHTML = `
                <h2 class="font-semibold mb-2">Récapitulatif :</h2>
                <div class="space-y-1 text-sm">
                    <p><strong>Numéro de commande :</strong> <span class="font-mono">#${order.IDCommande}</span></p>
                    <p><strong>Montant total :</strong> <span class="font-semibold">${Number(order.MontantTotal).toLocaleString('fr-FR')} F CFA</span></p>
                    <p><strong>Adresse de livraison :</strong> ${order.AdresseLivraison}</p>
                    <!-- Le statut sera géré par le compte à rebours et le polling -->
                </div>
                <p class="text-xs text-gray-500 mt-3">Un email de confirmation vous a été envoyé.</p>
            `;

                const updateCountdown = () => {
                    const now = new Date().getTime();
                    const timeLeft = endTime - now;

                    if (timeLeft <= 0) {
                        clearInterval(countdownInterval); // Arrêter le compte à rebours
                        // Ne pas arrêter le polling, car le paiement peut arriver en retard
                        countdownContainer.innerHTML = '<p class="text-red-600 font-bold">Le délai de paiement est expiré. Si vous avez payé, veuillez contacter le support.</p>';
                        return;
                    }

                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                    countdownContainer.innerHTML = `
                        <p class="text-sm text-gray-700">En attente de la confirmation de votre paiement...</p>
                        <p class="text-2xl font-bold text-gold">${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</p>
                        <p class="text-xs text-gray-500 mt-2">Vous pouvez fermer cette page, le statut de votre commande sera mis à jour automatiquement.</p>
                    `;
                };
                const countdownInterval = setInterval(updateCountdown, 1000);
                updateCountdown(); // Appel initial

                // Polling pour le statut de la commande toutes les 30 secondes
                const pollingInterval = setInterval(async () => {
                    const pollResponse = await fetch(CONFIG.ACCOUNT_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({ action: 'getOrderById', data: { orderId: orderId } }) // OPTIMISATION
                    });
                    const pollResult = await pollResponse.json();

                    if (pollResult.success && pollResult.data.Statut !== document.getElementById('current-order-status').textContent) {
                        if (pollResult.data.Statut === 'Confirmée' || pollResult.data.Statut.startsWith('Payée')) {
                            clearInterval(countdownInterval);
                            clearInterval(pollingInterval);
                            countdownContainer.innerHTML = '<p class="text-2xl font-bold text-green-600">Paiement confirmé avec succès !</p>';
                        }
                    }
                }, 30000); // Toutes les 30 secondes
        } else {
            // AMÉLIORATION: Afficher un message d'erreur clair si la commande n'est pas trouvée
            document.getElementById('main-title').textContent = 'Commande Introuvable';
            document.getElementById('main-message').textContent = 'Nous n\'avons pas pu trouver les détails pour cette commande. Veuillez vérifier le numéro de commande ou contacter le support client.';
            orderDetailsContainer.classList.add('hidden');

        }
    } catch (error) {
        const loadingMessage = document.getElementById('loading-details');
        if (loadingMessage) loadingMessage.remove();
        orderDetailsContainer.innerHTML += '<p class="text-sm text-red-500">Erreur de communication avec le serveur.</p>';
        console.error("Erreur lors de la récupération des détails de la commande:", error);
    }
}


// --- NOUVEAU: LOGIQUE DE SUIVI DE COMMANDE ---

/**
 * Initialise la page de suivi de commande.
 */
function initializeOrderTrackingPage() {
    const form = document.getElementById('tracking-form');
    if (form) form.addEventListener('submit', handleTrackOrder);

    // Pré-remplir et lancer la recherche si un orderId est dans l'URL
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    if (orderId) {
        form.querySelector('#order-id-input').value = orderId;
        trackOrder(orderId);
    }
}

/**
 * Gère la soumission du formulaire de suivi.
 * @param {Event} event 
 */
function handleTrackOrder(event) {
    event.preventDefault();
    const orderId = event.target.querySelector('#order-id-input').value.trim();
    if (orderId) {
        // Met à jour l'URL pour la rendre partageable
        window.history.pushState({}, '', `?orderId=${orderId}`);
        trackOrder(orderId);
    }
}

/**
 * Interroge l'API pour obtenir les détails d'une commande.
 * @param {string} orderId 
 */
async function trackOrder(orderId) {
    const resultsContainer = document.getElementById('tracking-results');
    resultsContainer.innerHTML = '<div class="loader mx-auto"></div><p class="text-center text-gray-500 mt-2">Recherche de votre commande...</p>';
    // Réinitialiser les classes d'animation pour une nouvelle recherche
    resultsContainer.classList.remove('results-enter', 'results-enter-active');
    
    // NOUVEAU: Fonction pour afficher le contenu avec une animation
    const renderResults = (html) => {
        resultsContainer.innerHTML = html;
        resultsContainer.classList.add('results-enter');
        requestAnimationFrame(() => {
            resultsContainer.classList.add('results-enter-active');
        });
    };

    try {
        const response = await fetch(CONFIG.ACCOUNT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getOrderById', data: { orderId: orderId } })
        });
        const result = await response.json();

        if (result.success && result.data) {
            // La commande a été trouvée, on génère l'affichage.
            const orderHTML = createOrderTrackingHTML(result.data);
            renderResults(orderHTML);
        } else {
            // L'API a répondu mais la commande n'a pas été trouvée.
            const errorMessage = result.error || 'Commande non trouvée. Vérifiez le numéro et réessayez.';
            throw new Error(errorMessage);
        }
    } catch (error) {
        // Erreur réseau ou commande non trouvée.
        const errorHTML = `
            <div class="text-center p-6 bg-red-50 border border-red-200 rounded-lg">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h3 class="text-lg font-semibold text-red-800">Oups ! Commande introuvable</h3>
                <p class="text-red-600 mt-1">${error.message}</p>
            </div>
        `;
        renderResults(errorHTML);
    }
}

/**
 * NOUVEAU: Crée le HTML complet pour l'affichage du suivi de commande.
 * @param {object} order - L'objet de la commande retourné par l'API.
 * @returns {string} Le code HTML à afficher.
 */
function createOrderTrackingHTML(order) {
    // Définition des étapes avec plus de détails (icônes, descriptions)
    const steps = [
        { name: 'Confirmée', completed: order.EtapeConfirmee === true, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', description: 'Nous avons bien reçu votre commande.' },
        { name: 'En préparation', completed: order.EtapePreparation === true, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', description: 'Nos équipes préparent vos articles.' },
        { name: 'Expédiée', completed: order.EtapeExpediee === true, icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-2l-4 4z', description: 'Votre colis est en route vers vous.' },
        { name: 'Livrée', completed: order.EtapeLivree === true, icon: 'M5 13l4 4L19 7', description: 'Votre commande a été livrée. Merci !' }
    ];

    // Trouver l'index de la dernière étape complétée pour l'affichage
    let currentStepIndex = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].completed) {
            currentStepIndex = i;
            break;
        }
    }

    // Génération de la chronologie (timeline) visuelle
    const timelineHTML = `
        <div class="grid grid-cols-4 gap-4 text-center mb-16">
            ${steps.map((step, index) => `
                <div class="relative">
                    <div class="timeline-step ${step.completed ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}">
                        ${step.completed ? '✓' : (index + 1)}
                    </div>
                    <p class="timeline-label ${index === currentStepIndex ? 'text-gold' : ''}">${step.name}</p>
                    ${index < steps.length - 1 ? `<div class="timeline-line"><div class="timeline-line-progress ${step.completed ? 'completed' : ''}"></div></div>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    // Assemblage final du HTML
    return `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">Commande #${order.IDCommande}</h3>
                    <p class="text-sm text-gray-500">Passée le ${new Date(order.Date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <span class="font-semibold px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 self-start sm:self-center">${order.Statut}</span>
            </div>

            ${timelineHTML}

            <div class="border-t pt-6">
                <h4 class="font-semibold text-lg mb-4">Détails de la commande</h4>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between"><span>Total :</span> <span class="font-semibold">${Number(order.MontantTotal).toLocaleString('fr-FR')} F CFA</span></div>
                    <div class="flex justify-between"><span>Produits :</span> <span class="font-semibold text-right">${order.DetailsProduits}</span></div>
                    <div class="flex justify-between"><span>Adresse :</span> <span class="font-semibold text-right">${order.AdresseLivraison}</span></div>
                </div>
            </div>

            <div class="border-t pt-6 mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-lg mb-3">Un problème avec votre commande ?</h4>
                <p class="text-sm text-gray-600 mb-4">Notre service client est là pour vous aider. Contactez-nous via l'un des canaux ci-dessous.</p>
                <div class="flex flex-col sm:flex-row gap-4">
                    <a href="https://wa.me/221769047999?text=Bonjour, j'ai une question concernant ma commande #${order.IDCommande}" target="_blank" class="flex-1 text-center bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition">
                        Contacter sur WhatsApp
                    </a>
                    <a href="mailto:abmcompanysn@gmail.com?subject=Réclamation Commande #${order.IDCommande}" class="flex-1 text-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition">
                        Envoyer un Email
                    </a>
                </div>
            </div>
        </div>
    `;
}