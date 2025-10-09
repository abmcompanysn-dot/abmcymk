const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbwi3zpOqK7EKSKDCQ1VTIYvrfesOTTpNBs4vQvh_3BCcSE65KGjlWnLsilUtyvOdsgT/exec",

    // URL du script central. On ajoute l'action dans la requête fetch.
    CENTRAL_API_URL: "https://script.google.com/macros/s/AKfycbw6Y2VBKFXli2aMvbfCaWeMx0Ws29axaG3BIm2oMiFh1-qpc-hkSRIcrQbQ0JmXRQFB/exec",
    
    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png",
};

// Variables globales pour le chargement progressif de la page d'accueil
let categoryDirectory = []; // Stocke la liste des catégories et leurs URLs
let allLoadedProducts = []; // Stocke tous les produits déjà chargés
let renderedCategoriesCount = 0;
const CATEGORIES_PER_LOAD = 3;

// Attendre que le contenu de la page soit entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser toutes les fonctionnalités du site
    initializeApp();
});

/**
 * Fonction principale ASYNCHRONE qui initialise l'application.
 */
async function initializeApp() {
    // Ces fonctions s'exécutent immédiatement, sans attendre les données des produits
    updateCartBadges();
    
    // Initialisation des éléments qui nécessitent des données du backend
    await populateCategoryMenu(); // Doit être appelé avant initializeSearch si la recherche utilise les catégories
    await populateNavLinks(); // NOUVEAU: Remplit les barres de navigation
    await initializeSearch(); // Peut nécessiter les produits

    // Une fois les données prêtes, on initialise le reste
    // Si nous sommes sur la page panier, on l'affiche
    if (document.getElementById('panier-page')) {
        renderCartPage();
    }

    // Si nous sommes sur la page de recherche, afficher les résultats
    if (window.location.pathname.endsWith('recherche.html')) {
        displaySearchResults();
    }

    // Si nous sommes sur une page catégorie, afficher les produits
    if (window.location.pathname.endsWith('categorie.html')) {
        displayCategoryProducts();
    }

    // Si nous sommes sur la page des promotions, afficher les produits
    if (window.location.pathname.endsWith('promotion.html')) {
        displayPromotionProducts();
    }

    // Si nous sommes sur la page produit, charger les données du produit
    if (window.location.pathname.endsWith('produit.html')) {
        loadProductPage();
    }

    // Si nous sommes sur la page d'accueil (avec les nouvelles sections), on les remplit.
    if (document.getElementById('superdeals-products')) {
        renderDailyDealsHomepage();
        startCountdown(); // Lancer le compte à rebours
    }

    // Si nous sommes sur la page compte, on l'initialise
    if (document.querySelector('main h1.text-3xl')?.textContent.includes("Mon Compte")) {
        initializeAccountPage();
    }

    // Si nous sommes sur la page d'authentification, on attache les événements aux deux formulaires
    if (document.getElementById('auth-forms')) {
        document.getElementById('login-form').addEventListener('submit', (e) => handleAuthForm(e, 'login'));
        document.getElementById('register-form').addEventListener('submit', (e) => handleAuthForm(e, 'register'));
    }
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
async function populateCategoryMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return; // S'assure que l'élément existe
    const boutiquesMenu = document.getElementById('boutiques-menu');
    let menuHTML = ''; // Initialiser la variable ici

    try {
        // On récupère les données depuis la nouvelle fonction centrale
        const catalog = await getFullCatalog();
        const categories = catalog.data.categories;
        
        // Ajout d'un titre pour le menu déroulant
        menuHTML = `<div class="p-2 border-b"><h3 class="font-semibold text-sm text-gray-500 px-2">Toutes les catégories</h3></div>`;

        menuHTML += categories.map(cat => 
        // Lien vers la page de catégorie
        `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${cat.NomCategorie}</a>`
        ).join('');
        // Ajout du lien vers les promotions
        menuHTML += '<a href="promotion.html" class="block px-4 py-2 text-sm text-red-600 font-semibold hover:bg-gray-100">Promotions</a>';
    } catch (error) {
        const errorHTML = '<p class="px-4 py-2 text-sm text-red-500">Erreur de chargement.</p>';
        console.error("Erreur lors du chargement des menus de catégories:", error);
        menu.innerHTML = errorHTML;
        if (boutiquesMenu) boutiquesMenu.innerHTML = errorHTML;
        return; // Sortir en cas d'erreur
    }

    menu.innerHTML = menuHTML;
    if (boutiquesMenu) {
        boutiquesMenu.innerHTML = menuHTML; // On utilise le même contenu pour les deux menus
    }
}

/**
 * NOUVEAU: Remplit dynamiquement les liens de navigation principaux et de la bannière.
 */
async function populateNavLinks() {
    const mainLinksContainer = document.getElementById('main-nav-links');
    const bannerLinksContainer = document.getElementById('banner-nav-links');

    // Ne fait rien si le conteneur principal n'existe pas
    if (!mainLinksContainer) return;

    try {
        const categories = await getCategories();
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
    return JSON.parse(localStorage.getItem('abmcyCart')) || [];
}

/**
 * Sauvegarde le panier dans le localStorage.
 * @param {Array} cart - Le tableau des articles du panier.
 */
function saveCart(cart) {
    localStorage.setItem('abmcyCart', JSON.stringify(cart));
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
    event.preventDefault(); // Empêche la navigation si on clique sur le bouton dans un lien
    event.stopPropagation();

    const cart = getCart();
    const quantityInput = document.getElementById('quantity'); // Pour la page produit
    const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
    const existingProductIndex = cart.findIndex(item => item.id === productId);

    if (existingProductIndex > -1) {
        // Le produit existe déjà, on augmente la quantité
        cart[existingProductIndex].quantity += quantity;
    } else {
        // Nouveau produit
        cart.push({ id: productId, name, price, imageUrl, quantity });
    }

    saveCart(cart);
    alert(`${name} a été ajouté au panier !`); // Message de confirmation simple
}

/**
 * Met à jour les badges du panier (nombre d'articles).
 */
function updateCartBadges() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    const badges = document.querySelectorAll('#bottomNavCartBadge'); // Cible tous les badges

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
    const cart = getCart();
    const cartContainer = document.getElementById('cart-page-items');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="p-6 text-center text-gray-500">Votre panier est vide.</p>';
        document.getElementById('cart-summary').style.display = 'none'; // Cache le résumé si le panier est vide
        return;
    }

    const cartHTML = cart.map((item, index) => `
        <div class="flex items-center p-4 border-b">
            <div class="w-16 h-16 bg-gray-200 rounded mr-4 overflow-hidden">
                <img src="${item.imageUrl || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${item.name}" class="w-full h-full object-cover">
            </div>
            <div class="flex-grow">
                <h4 class="font-semibold">${item.name}</h4>
                <p class="text-sm text-gold">${item.price.toLocaleString('fr-FR')} F CFA</p>
            </div>
            <div class="flex items-center">
                <input type="number" value="${item.quantity}" min="1" onchange="changeQuantity(${index}, this.value)" class="w-16 text-center border rounded p-1 mx-4">
                <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');

    cartContainer.innerHTML = cartHTML;
    updateCartSummary();
}

/**
 * Met à jour le résumé de la commande sur la page panier.
 */
function updateCartSummary() {
    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const shippingCost = subtotal > 30000 ? 0 : 5000; // Livraison gratuite si > 30000 F CFA
    const total = subtotal + shippingCost;

    document.getElementById('summary-subtotal').textContent = `${subtotal.toLocaleString('fr-FR')} F CFA`;
    document.getElementById('summary-shipping').textContent = shippingCost > 0 ? `${shippingCost.toLocaleString('fr-FR')} F CFA` : 'Gratuite';
    document.getElementById('summary-total').textContent = `${total.toLocaleString('fr-FR')} F CFA`;
}

/**
 * Modifie la quantité d'un article dans le panier.
 * @param {number} index - L'index de l'article dans le tableau du panier.
 * @param {string} newQuantity - La nouvelle quantité (depuis l'input).
 */
function changeQuantity(index, newQuantity) {
    const cart = getCart();
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
    if (!confirm('Voulez-vous vraiment supprimer cet article du panier ?')) {
        return;
    }

    const cart = getCart();
    cart.splice(index, 1); // Supprime l'élément à l'index donné

    saveCart(cart);
    renderCartPage(); // Ré-affiche la page du panier
}

// --- LOGIQUE DE RECHERCHE (MODIFIÉE POUR LE BACKEND) ---

/**
 * Charge les produits depuis le backend et initialise la recherche.
 */
function initializeSearch() {
    const searchForms = document.querySelectorAll('form[id^="search-form"]');
    searchForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = form.querySelector('input[type="search"]');
            const query = searchInput.value.trim();
            if (query) {
                // On passe la recherche en paramètre à la page de recherche
                window.location.href = `recherche.html?q=${encodeURIComponent(query)}`;
            }
        });
    });
}

/**
 * Affiche les résultats sur la page de recherche.
 * La recherche se fait maintenant côté client pour plus de rapidité.
 */
async function displaySearchResults() {
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
        const catalog = await getFullCatalog();
        const allProducts = catalog.data.products;

        const lowerCaseQuery = query.toLowerCase();
        filteredProducts = allProducts.filter(product => 
            product.Nom.toLowerCase().includes(lowerCaseQuery) ||
            product.Catégorie.toLowerCase().includes(lowerCaseQuery) ||
            (product.Tags && product.Tags.toLowerCase().includes(lowerCaseQuery))
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

    const resultsHTML = filteredProducts.map(product => `
        <a href="produit.html?id=${product.IDProduit}" class="bg-white rounded-lg shadow-md overflow-hidden block">
            <div class="h-48 bg-gray-200"><img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="h-full w-full object-cover"></div>
            <div class="p-4">
                <h4 class="font-semibold text-gray-800 mb-2">${product.Nom}</h4>
                <span class="text-lg font-bold text-gold">${product.PrixActuel.toLocaleString('fr-FR')} F CFA</span>
                <button class="w-full mt-3 bg-black text-white py-2 rounded hover:bg-gray-800 transition" onclick="addToCart(event, '${product.IDProduit}', '${product.Nom}', ${product.PrixActuel}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')">Ajouter au panier</button>
            </div>
        </a>
    `).join('');

    resultsContainer.innerHTML = resultsHTML;
}

/**
 * NOUVEAU: Affiche les produits pour une catégorie donnée.
 */
async function displayCategoryProducts() {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const categoryName = params.get('name');

    const nameDisplay = document.getElementById('category-name-display');
    const resultsContainer = document.getElementById('category-results-container');
    const resultsCount = document.getElementById('category-results-count');

    if (!categoryId || !resultsContainer) return;

    nameDisplay.textContent = categoryName || "Catégorie";

    // NOUVEAU: Afficher le squelette de chargement
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    resultsContainer.innerHTML = Array(8).fill(skeletonCard).join('');

    try {
        const catalog = await getFullCatalog();
        const allProducts = catalog.data.products;
        const allCategories = catalog.data.categories;

        // CORRECTION: Le produit n'a pas d'IDCategorie, mais un nom de catégorie.
        // On trouve la catégorie correspondante à l'ID de l'URL pour obtenir son nom.
        const targetCategory = allCategories.find(cat => cat.IDCategorie == categoryId);
        if (!targetCategory) throw new Error("Catégorie introuvable.");

        const filteredProducts = allProducts.filter(product => {
            return product.Catégorie === targetCategory.NomCategorie;
        });

        resultsCount.textContent = `${filteredProducts.length} produit(s) dans cette catégorie.`;

        if (filteredProducts.length === 0) {
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Aucun produit dans cette catégorie pour le moment.</p>`;
            return;
        }

        const resultsHTML = filteredProducts.map(product => renderProductCard(product)).join('');
        resultsContainer.innerHTML = resultsHTML;

    } catch (error) {
        console.error("Erreur lors de l'affichage des produits de la catégorie:", error);
        resultsCount.textContent = `Erreur lors du chargement des produits.`;
        resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>`;
    }
}

/**
 * NOUVEAU: Affiche les produits en promotion.
 */
async function displayPromotionProducts() {
    const resultsContainer = document.getElementById('promotion-results-container');
    const resultsCount = document.getElementById('promotion-results-count');

    if (!resultsContainer) return;

    // NOUVEAU: Afficher le squelette de chargement
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    resultsContainer.innerHTML = Array(8).fill(skeletonCard).join('');

    try {
        const catalog = await getFullCatalog();
        const allProducts = catalog.data.products;
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

// --- LOGIQUE DE LA PAGE PRODUIT ---

/**
 * Charge les données d'un produit spécifique sur la page produit.
 */
async function loadProductPage() { // Make it async
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        document.querySelector('main').innerHTML = '<p class="text-center text-red-500">Erreur: ID de produit manquant.</p>';
        return;
    }

    try {
        const catalog = await getFullCatalog();
        const product = catalog.data.products.find(p => p.IDProduit == productId);

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
        descriptionEl.classList.remove('h-20', 'bg-gray-200', 'animate-pulse');
        mainImage.parentElement.classList.remove('animate-pulse');

        // Remplir les données
        nameEl.textContent = product.Nom;
        descriptionEl.textContent = product.Description;
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
                <img src="${imgUrl}" alt="Miniature ${index + 1}" class="h-full w-full object-cover" onclick="changeMainImage('${imgUrl}')">
            </div>
        `).join('');

        // Ajouter les écouteurs d'événements pour la bordure active
        document.querySelectorAll('.thumbnail-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail-item').forEach(i => i.classList.remove('border-gold'));
                item.classList.add('border-gold');
            });
        });

        // NOUVEAU: Afficher les détails spécifiques à la catégorie
        renderCategorySpecificDetails(product, variantsContainer, specsContainer);

        // Mettre à jour le bouton "Ajouter au panier"
        addToCartButton.setAttribute('onclick', `addToCart(event, '${product.IDProduit}', '${product.Nom}', ${product.PrixActuel}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')`);
        const hasVariants = variantsContainer.innerHTML.trim() !== '';
        // Le bouton est désactivé si le produit est en rupture de stock ET qu'il n'y a pas de variantes.
        addToCartButton.disabled = (product.Stock <= 0 && !hasVariants);

        // NOUVEAU: Activer le zoom sur l'image principale
        activateInternalZoom("image-zoom-wrapper");

    } catch (error) {
        console.error("Erreur de chargement du produit:", error);
        const mainContent = document.querySelector('main');
        if(mainContent) mainContent.innerHTML = `<p class="text-center text-red-500">Impossible de charger les informations du produit. Veuillez réessayer.</p>`;
    }
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
function renderCategorySpecificDetails(product, variantsContainer, specsContainer) {
    // Vide les conteneurs précédents
    variantsContainer.innerHTML = '';
    specsContainer.innerHTML = '';

    // Logique de rendu basée sur la catégorie
    switch (product.Catégorie.toLowerCase()) {
        case 'vêtements':
            renderClothingDetails(product, variantsContainer, specsContainer);
            break;
        case 'chaussures':
            renderShoesDetails(product, variantsContainer, specsContainer);
            break;
        case 'électronique':
            renderElectronicsDetails(product, variantsContainer, specsContainer);
            break;
        case 'sacs':
            renderBagsDetails(product, variantsContainer, specsContainer);
            break;
        case 'livres':
            renderBooksDetails(product, variantsContainer, specsContainer);
            break;
        case 'alimentation':
            renderFoodDetails(product, variantsContainer, specsContainer);
            break;
        case 'beauté & soins':
            renderBeautyDetails(product, variantsContainer, specsContainer);
            break;
        // NOUVEAU: Ajout des nouvelles catégories
        case 'literie':
            renderBeddingDetails(product, variantsContainer, specsContainer);
            break;
        case 'luminaires':
            renderLightingDetails(product, variantsContainer, specsContainer);
            break;
        case 'vêtements bébé':
            renderBabyClothesDetails(product, variantsContainer, specsContainer);
            break;
        case 'bagages':
            renderLuggageDetails(product, variantsContainer, specsContainer);
            break;
        case 'photographie':
            renderPhotographyDetails(product, variantsContainer, specsContainer);
            break;
        case 'fournitures scolaires':
            renderSchoolSuppliesDetails(product, variantsContainer, specsContainer);
            break;
        // Ajoutez d'autres 'case' pour chaque catégorie que vous voulez personnaliser
        // case 'livres':
        //     renderBooksDetails(product, specsContainer);
        //     break;
        default:
            // Comportement par défaut si aucune catégorie ne correspond
            specsContainer.innerHTML = '<p class="text-gray-600">Aucune spécification supplémentaire pour ce produit.</p>';
            break;
    }
}

/**
 * NOUVEAU: Fonctions de rendu spécifiques par catégorie.
 * Ces fonctions génèrent le HTML pour les variantes et les spécifications.
 */

function renderClothingDetails(product, variantsContainer, specsContainer) {
    // Options de variantes (ex: Tailles)
    if (product.Taille) variantsContainer.innerHTML += createVariantSelector('Taille', product.Taille.split(','));
    if (product.Couleur) variantsContainer.innerHTML += createVariantSelector('Couleur', product.Couleur.split(','));

    // Spécifications
    let specsHTML = '<ul>';
    if (product.Coupe) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Coupe</span> <span class="font-semibold text-gray-800">${product.Coupe}</span></li>`;
    if (product.Matière) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Matière</span> <span class="font-semibold text-gray-800">${product.Matière}</span></li>`;
    if (product.Saison) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Saison</span> <span class="font-semibold text-gray-800">${product.Saison}</span></li>`;
    if (product.Style) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Style</span> <span class="font-semibold text-gray-800">${product.Style}</span></li>`;
    if (product.Genre) specsHTML += `<li class="flex justify-between py-2"><span>Genre</span> <span class="font-semibold text-gray-800">${product.Genre}</span></li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderShoesDetails(product, variantsContainer, specsContainer) {
    // Options de variantes (ex: Pointures)
    if (product.Pointure) {
        variantsContainer.innerHTML += createVariantSelector('Pointure', product.Pointure.split(','));
    }
    if (product.Couleur) {
        variantsContainer.innerHTML += createVariantSelector('Couleur', product.Couleur.split(','));
    }
    // Spécifications
    let specsHTML = '<ul>';
    if (product.Matière) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Matière</span> <span class="font-semibold text-gray-800">${product.Matière}</span></li>`;
    if (product.Type) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Type</span> <span class="font-semibold text-gray-800">${product.Type}</span></li>`;
    if (product.Genre) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Genre</span> <span class="font-semibold text-gray-800">${product.Genre}</span></li>`;
    if (product.Semelle) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Semelle</span> <span class="font-semibold text-gray-800">${product.Semelle}</span></li>`;
    if (product.Usage) specsHTML += `<li class="flex justify-between py-2"><span>Usage</span> <span class="font-semibold text-gray-800">${product.Usage}</span></li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderElectronicsDetails(product, variantsContainer, specsContainer) {
    // Options de variantes (ex: Capacités)
    if (product.Capacité) {
        variantsContainer.innerHTML += createVariantSelector('Capacité', product.Capacité.split(','));
    }
    // Spécifications
    let specsHTML = '<ul>';
    if (product.Marque) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Marque</span> <span class="font-semibold text-gray-800">${product.Marque}</span></li>`;
    if (product.Modèle) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Modèle</span> <span class="font-semibold text-gray-800">${product.Modèle}</span></li>`;
    if (product.Connectivité) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Connectivité</span> <span class="font-semibold text-gray-800">${product.Connectivité}</span></li>`;
    if (product.Compatibilité) specsHTML += `<li class="flex justify-between py-2 border-b"><span>Compatibilité</span> <span class="font-semibold text-gray-800">${product.Compatibilité}</span></li>`;
    if (product.Garantie) specsHTML += `<li class="flex justify-between py-2"><span>Garantie</span> <span class="font-semibold text-gray-800">${product.Garantie}</span></li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderBagsDetails(product, variantsContainer, specsContainer) {
    if (product.Couleur) {
        variantsContainer.innerHTML += createVariantSelector('Couleur', product.Couleur.split(','));
    }
    let specsHTML = '<ul>';
    if (product.Volume) specsHTML += `<li class="py-2 border-b"><strong>Volume :</strong> ${product.Volume}</li>`;
    if (product.Type) specsHTML += `<li class="py-2 border-b"><strong>Type :</strong> ${product.Type}</li>`;
    if (product.Matière) specsHTML += `<li class="py-2"><strong>Matière :</strong> ${product.Matière}</li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderBooksDetails(product, variantsContainer, specsContainer) {
    // Pas de variantes sélectionnables pour les livres en général
    let specsHTML = '<ul>';
    if (product.Auteur) specsHTML += `<li class="py-2 border-b"><strong>Auteur :</strong> ${product.Auteur}</li>`;
    if (product.Genre) specsHTML += `<li class="py-2 border-b"><strong>Genre :</strong> ${product.Genre}</li>`;
    if (product.Format) specsHTML += `<li class="py-2 border-b"><strong>Format :</strong> ${product.Format}</li>`;
    if (product.Langue) specsHTML += `<li class="py-2 border-b"><strong>Langue :</strong> ${product.Langue}</li>`;
    if (product.ISBN) specsHTML += `<li class="py-2"><strong>ISBN :</strong> ${product.ISBN}</li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderFoodDetails(product, variantsContainer, specsContainer) {
    if (product.Poids) {
        variantsContainer.innerHTML += createVariantSelector('Poids', product.Poids.split(','));
    }
    let specsHTML = '<ul>';
    if (product.Ingrédients) specsHTML += `<li class="py-2 border-b"><strong>Ingrédients :</strong> ${product.Ingrédients}</li>`;
    if (product.Origine) specsHTML += `<li class="py-2 border-b"><strong>Origine :</strong> ${product.Origine}</li>`;
    if (product.Labels) specsHTML += `<li class="py-2"><strong>Labels :</strong> ${product.Labels}</li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
}

function renderBeautyDetails(product, variantsContainer, specsContainer) {
    if (product.Format) {
        variantsContainer.innerHTML += createVariantSelector('Format', product.Format.split(','));
    }
    let specsHTML = '<ul>';
    if (product['Type de peau']) specsHTML += `<li class="py-2 border-b"><strong>Type de peau :</strong> ${product['Type de peau']}</li>`;
    if (product.Ingrédients) specsHTML += `<li class="py-2"><strong>Ingrédients principaux :</strong> ${product.Ingrédients}</li>`;
    specsHTML += '</ul>';
    specsContainer.innerHTML = specsHTML;
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

    // Activer le bouton "Ajouter au panier" si toutes les variantes sont sélectionnées
    const variantGroups = document.querySelectorAll('#product-variants-container > div');
    const allSelected = Array.from(variantGroups).every(group => group.querySelector('.variant-btn.selected'));

    const addToCartButton = document.getElementById('add-to-cart-button');
    addToCartButton.disabled = !allSelected;
}

// --- LOGIQUE DE PAIEMENT (CHECKOUT) ---

/**
 * Traite la commande et l'envoie au backend.
 * @param {Event} event - L'événement du formulaire.
 */
async function processCheckout(event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Traitement en cours...';

    // 1. Récupérer les données du formulaire
    const deliveryData = {
        firstname: form.querySelector('#firstname').value,
        lastname: form.querySelector('#lastname').value,
        address: form.querySelector('#address').value,
        city: form.querySelector('#city').value,
        zip: form.querySelector('#zip').value,
    };

    // 2. Récupérer les données du panier depuis le localStorage
    const cart = getCart();
    if (cart.length === 0) {
        alert("Votre panier est vide.");
        return;
    }

    // 3. Vérifier si l'utilisateur est connecté
    const user = JSON.parse(localStorage.getItem('abmcyUser'));
    let clientId = "INVITÉ-" + new Date().getTime(); // ID unique pour l'invité
    let clientName = deliveryData.firstname + " " + deliveryData.lastname;

    if (user && user.IDClient) {
        clientId = user.IDClient;
        clientName = user.Nom;
    }

    // 3. Préparer l'objet de la commande pour le backend
    const orderPayload = {
        action: 'enregistrerCommande', // Correspond à la fonction du Script 2
        data: {
            idClient: clientId,
            produits: cart.map(item => item.id), // On utilise l'ID du produit
            quantites: cart.map(item => item.quantity),
            adresseLivraison: `${deliveryData.address}, ${deliveryData.zip} ${deliveryData.city}`,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) > 30000 ? 0 : 5000),
            moyenPaiement: "Carte de crédit", // Exemple
            notes: "Client: " + clientName
        }
    };

    // 4. Envoyer la commande à l'API Client (Script 2)
    try {
        const response = await fetch(CONFIG.CLIENT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        const result = await response.json();

        if (result.success) {
            alert(`Commande ${result.id} enregistrée avec succès !`);
            saveCart([]); // Vider le panier après la commande
            window.location.href = 'index.html'; // Rediriger vers la page d'accueil
        } else {
            throw new Error(result.error || "Une erreur inconnue est survenue.");
        }
    } catch (error) {
        alert(`Erreur lors de la commande: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = 'Payer';
    }
}

/**
 * NOUVEAU: Affiche les produits dans les sections "SuperDeals" et "Big Save" de la page d'accueil.
 */
async function renderDailyDealsHomepage() {
    const superdealsContainer = document.getElementById('superdeals-products');
    const boutiquesContainer = document.getElementById('boutiques-container');

    if (!superdealsContainer || !boutiquesContainer) return;

    // --- Étape 1: Afficher IMMÉDIATEMENT les squelettes de chargement ---
    const skeletonCard = `
        <div class="bg-white rounded-lg shadow overflow-hidden animate-pulse">
            <div class="bg-gray-200 h-40"></div>
            <div class="p-3 space-y-2"><div class="bg-gray-200 h-4 rounded"></div><div class="bg-gray-200 h-6 w-1/2 rounded"></div></div>
        </div>`;
    superdealsContainer.innerHTML = Array(6).fill(skeletonCard).join('');
    boutiquesContainer.innerHTML = Array(6).fill(skeletonCard).join('');

    // --- Étape 2: Donner au navigateur le temps de dessiner les squelettes ---
    // setTimeout avec 0ms est une astuce pour laisser le thread principal se libérer un instant.
    setTimeout(async () => {
        try {
            // --- Étape 3: Charger les données en parallèle ---
            const [categories, products] = await Promise.all([
                getCategories(),
                getAllProducts()
            ]);

            // --- Étape 4: Remplir la section "Nos Boutiques" dès que les catégories sont prêtes ---
            if (categories.length > 0) {
                boutiquesContainer.innerHTML = categories.map(cat => `
                <a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.NomCategorie)}" class="product-card bg-white rounded-lg shadow overflow-hidden block text-center">
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
    }, 0);
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
 * NEW: Central function to retrieve all public data (products and categories).
 * Met en cache les résultats pour améliorer les performances de navigation.
 */
async function getFullCatalog() {
    const cachedItem = sessionStorage.getItem('fullCatalog');
    if (cachedItem) {
        const { data, timestamp } = JSON.parse(cachedItem);
        const now = new Date().getTime();
        const fiveMinutes = 10 * 60 * 1000; // 10 minutes en millisecondes

        if (now - timestamp < fiveMinutes) {
            console.log("Utilisation du catalogue complet depuis le cache (valide).");
            return data;
        } else {
            console.log("Cache du catalogue complet expiré. Rechargement...");
            sessionStorage.removeItem('fullCatalog'); // On nettoie l'ancien cache
        }
    }

    // Si non, charger les deux en parallèle
    console.log("Assemblage du catalogue complet pour la première fois...");
    const [categories, products] = await Promise.all([
        getCategories(),
        getAllProducts()
    ]);

    const catalogData = { success: true, data: { categories, products } };
    const itemToCache = { data: catalogData, timestamp: new Date().getTime() };
    
    console.log(`Catalogue complet assemblé (${products.length} produits). Mise en cache pour 5 minutes.`);
    sessionStorage.setItem('fullCatalog', JSON.stringify(itemToCache));
    return catalogData;
}

/**
 * NOUVEAU: Récupère uniquement la liste des catégories.
 */
async function getCategories() {
    const cachedItem = sessionStorage.getItem('categories');
    if (cachedItem) {
        const { data, timestamp } = JSON.parse(cachedItem);
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (now - timestamp < fiveMinutes) {
            console.log("Utilisation des catégories depuis le cache (valide).");
            return data;
        }
    }

    console.log("Appel API pour les catégories...");
    const response = await fetch(CONFIG.CENTRAL_API_URL);
    if (!response.ok) throw new Error(`Erreur réseau lors de la récupération des catégories.`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Impossible de charger la liste des catégories.");
    
    const categories = result.data.sort((a, b) => a.Ordre - b.Ordre);
    const itemToCache = { data: categories, timestamp: new Date().getTime() };
    sessionStorage.setItem('categories', JSON.stringify(itemToCache));
    return categories;
}

/**
 * NOUVEAU: Récupère tous les produits de toutes les catégories.
 */
async function getAllProducts() {
    const cachedItem = sessionStorage.getItem('allProducts');
    if (cachedItem) {
        const { data, timestamp } = JSON.parse(cachedItem);
        const now = new Date().getTime();
        const fiveMinutes = 2 * 60 * 1000;

        if (now - timestamp < fiveMinutes) {
            console.log("Utilisation des produits depuis le cache (valide).");
            return data;
        }
    }

    const categories = await getCategories(); // S'assure d'avoir les URLs
    console.log("Appels API parallèles pour tous les produits...");
    const productFetchPromises = categories.map(cat => 
        fetch(`${cat.ScriptURL}?action=getProducts`).then(res => res.json())
    );
    const productResults = await Promise.all(productFetchPromises);
    const allProducts = productResults.flatMap(res => (res.success && res.data) ? res.data : []);
    const itemToCache = { data: allProducts, timestamp: new Date().getTime() };
    sessionStorage.setItem('allProducts', JSON.stringify(itemToCache));
    return allProducts;
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
    <a href="produit.html?id=${product.IDProduit}" class="product-card bg-white rounded-lg shadow overflow-hidden block">
        <div class="relative">
            <div class="h-40 bg-gray-200 flex items-center justify-center">
            <img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="h-full w-full object-cover" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_PRODUCT_IMAGE}';">
            </div>
            ${discount > 0 ? `<span class="discount-badge absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">-${Math.round(discount)}%</span>` : ''}
        </div>
        <div class="p-3">
            <p class="text-sm text-gray-700 truncate" title="${product.Nom}">${product.Nom}</p>
            <p class="font-bold text-lg mt-1">${price.toLocaleString('fr-FR')} F CFA</p>
            ${oldPrice > price ? `<p class="text-xs text-gray-400 line-through">${oldPrice.toLocaleString('fr-FR')} F CFA</p>` : ''}
        </div>
    </a>
    `;
}

// --- LOGIQUE D'AUTHENTIFICATION ---

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

        payload = {
            action: 'creerCompteClient',
            data: {
                nom: form.querySelector('#register-nom').value,
                email: form.querySelector('#register-email').value,
                motDePasse: password,
                adresse: '',
                telephone: ''
            }
        };
    } else { // type === 'login'
        payload = {
            action: 'connecterClient',
            data: {
                email: form.querySelector('#login-email').value,
                motDePasse: form.querySelector('#login-password').value
            }
        };
    }

    try {
        form.querySelector('button[type="submit"]').disabled = true;
        const response = await fetch(CONFIG.CLIENT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            if (type === 'register') {
                statusDiv.textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
                statusDiv.classList.add('text-green-600');
                form.reset();
            } else { // type === 'login'
                statusDiv.textContent = 'Connexion réussie ! Redirection...';
                statusDiv.classList.add('text-green-600');
                // Stocker les informations de l'utilisateur et rediriger
                localStorage.setItem('abmcyUser', JSON.stringify(result.user));
                window.location.href = 'compte.html'; // Redirection vers la page de compte
            }
        } else {
            throw new Error(result.error || 'Une erreur est survenue.');
        }
    } catch (error) {
        statusDiv.textContent = `Erreur: ${error.message}`;
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
function initializeAccountPage() {
    const user = JSON.parse(localStorage.getItem('abmcyUser'));

    // Si l'utilisateur n'est pas connecté, on le renvoie à la page d'authentification
    if (!user) {
        window.location.href = 'authentification.html';
        return;
    }

    // Afficher les informations de l'utilisateur
    document.getElementById('user-name-display').textContent = user.Nom;
    document.getElementById('user-email-display').textContent = user.Email;
    document.getElementById('dashboard-user-name').textContent = user.Nom;
    document.getElementById('dashboard-user-name-link').textContent = user.Nom;

    // Initiales pour l'avatar
    const initials = user.Nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-initials').textContent = initials;

    // Logique de déconnexion
    const logoutLink = document.getElementById('logout-link');
    const logoutNav = document.getElementById('logout-nav-link');
    
    const logoutAction = (e) => {
        e.preventDefault();
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.removeItem('abmcyUser');
            window.location.href = 'authentification.html';
        }
    };

    logoutLink.addEventListener('click', logoutAction);
    logoutNav.addEventListener('click', logoutAction);

    // Charger et afficher les commandes récentes
    loadRecentOrdersForAccount(user.IDClient);
}

/**
 * NOUVEAU: Charge les commandes récentes pour la page de compte.
 */
async function loadRecentOrdersForAccount(clientId) {
    const ordersSection = document.getElementById('recent-orders-section');
    if (!ordersSection) return;

    ordersSection.innerHTML = '<p>Chargement des commandes récentes...</p>';

    // Note: Cette action n'existe pas encore côté backend, il faudra l'ajouter.
    // Pour l'instant, on simule ou on laisse un message.
    // Dans un futur développement, on appellerait une action comme 'getOrdersByClientId'.
    ordersSection.innerHTML = `
        <h4 class="text-lg font-semibold mb-4">Mes commandes récentes</h4>
        <p class="text-gray-500">Cette fonctionnalité est en cours de développement.</p>
    `;
}