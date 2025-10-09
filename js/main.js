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
        console.error("Erreur lors du chargement des catégories:", error);
        menu.innerHTML = '<p class="px-4 py-2 text-sm text-red-500">Erreur de chargement des catégories.</p>';
        return; // Sortir en cas d'erreur
    }

    menu.innerHTML = menuHTML;
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

    try {
        const catalog = await getFullCatalog();
        const allProducts = catalog.data.products;
        // Filtrer les produits par l'ID de la catégorie
        const normalizedCategoryName = categoryName.trim().toLowerCase();
        const filteredProducts = allProducts.filter(product => {
            // Rendre la comparaison insensible à la casse et aux espaces
            const productCategory = product.Catégorie || '';
            return productCategory.trim().toLowerCase() === normalizedCategoryName;
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

        // Mettre à jour le bouton "Ajouter au panier"
        addToCartButton.setAttribute('onclick', `addToCart(event, '${product.IDProduit}', '${product.Nom}', ${product.PrixActuel}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')`);
        addToCartButton.disabled = false;

        // NOUVEAU: Construire la galerie de miniatures
        let galleryImages = [];
        if (product.ImageURL) galleryImages.push(product.ImageURL); // L'image principale est la première
        if (product.Galerie) {
            const galleryUrls = product.Galerie.split(',').map(url => url.trim()).filter(url => url);
            galleryImages = [...galleryImages, ...galleryUrls];
        }
        
        // Rendre les URLs uniques pour éviter les doublons
        galleryImages = [...new Set(galleryImages)];

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
    const bigsaveContainer = document.getElementById('bigsave-products');

    if (!superdealsContainer || !bigsaveContainer) return;

    // Affiche un état de chargement simple
    const loadingHTML = Array(5).fill('<div class="bg-white rounded-lg shadow h-64 animate-pulse"></div>').join('');
    superdealsContainer.innerHTML = loadingHTML;
    bigsaveContainer.innerHTML = loadingHTML;

    try {
        const catalog = await getFullCatalog();
        const allProducts = catalog.data.products;

        // 1. Filtrer les produits pour "SuperDeals" (ceux avec une réduction)
        const superDealsProducts = allProducts
            .filter(p => p['Réduction%'] && parseFloat(p['Réduction%']) > 0)
            .slice(0, 5); // On prend les 5 premiers

        // 2. Filtrer les produits pour "Big Save" (ceux qui ne sont PAS en réduction)
        const bigSaveProducts = allProducts
            .filter(p => !p['Réduction%'] || parseFloat(p['Réduction%']) === 0)
            .slice(0, 5); // On prend les 5 premiers

        // 3. Afficher les produits
        superdealsContainer.innerHTML = superDealsProducts.length > 0 
            ? superDealsProducts.map(product => renderProductCard(product)).join('')
            : '<p class="col-span-full text-center text-gray-500">Aucune offre spéciale pour le moment.</p>';

        bigsaveContainer.innerHTML = bigSaveProducts.length > 0
            ? bigSaveProducts.map(product => renderProductCard(product)).join('')
            : '<p class="col-span-full text-center text-gray-500">Aucun produit à afficher.</p>';

    } catch (error) {
        console.error("Erreur lors du chargement des offres du jour:", error);
        const errorMsg = '<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>';
        superdealsContainer.innerHTML = errorMsg;
        bigsaveContainer.innerHTML = errorMsg;
    }
}

/**
 * NEW: Central function to retrieve all public data (products and categories).
 * Met en cache les résultats pour améliorer les performances de navigation.
 */
async function getFullCatalog() {
    // Si le répertoire des catégories est déjà chargé, on ne fait rien de plus ici.
    // Cette fonction est maintenant principalement un point d'entrée pour les pages
    // qui ont besoin de tout le catalogue d'un coup (ex: recherche).
    if (categoryDirectory.length > 0) {
        return { success: true, data: { categories: categoryDirectory, products: allLoadedProducts } };
    }

    // --- NOUVELLE LOGIQUE DE CACHE ---
    const cachedData = sessionStorage.getItem('fullCatalog');
    if (cachedData) {
        console.log("Utilisation du catalogue depuis sessionStorage.");
        const parsedData = JSON.parse(cachedData);
        categoryDirectory = parsedData.data.categories;
        allLoadedProducts = parsedData.data.products;
        return parsedData;
    }

    // --- Étape 1: Charger dynamiquement la liste des catégories (l'annuaire) ---
    console.log("Appel au script central pour l'annuaire des catégories...");
    const categoryResponse = await fetch(CONFIG.CENTRAL_API_URL);
    if (!categoryResponse.ok) throw new Error(`Erreur réseau lors de la récupération des catégories.`);
    const categoryResult = await categoryResponse.json();
    if (!categoryResult.success) throw new Error(categoryResult.error || "Impossible de charger la liste des catégories.");
    
    categoryDirectory = categoryResult.data.sort((a, b) => a.Ordre - b.Ordre);

    // --- Étape 2: Charger TOUS les produits pour le cache initial ---
    console.log("Appels parallèles pour charger tous les produits...");
    const productFetchPromises = categoryDirectory.map(category => {
        if (category.ScriptURL) return fetch(`${category.ScriptURL}?action=getProducts`).then(res => res.json());
        return Promise.resolve({ success: false });
    });

    const productResults = await Promise.all(productFetchPromises);
    allLoadedProducts = productResults.flatMap(result => (result.success && result.data) ? result.data : []);
    
    // --- Étape 3: Assembler le catalogue final et le mettre en cache ---
    const fullCatalog = { success: true, data: { products: allLoadedProducts, categories: categoryDirectory } };
    console.log(`Catalogue complet assemblé (${allLoadedProducts.length} produits). Mise en cache.`);
    sessionStorage.setItem('fullCatalog', JSON.stringify(fullCatalog));
    return fullCatalog;
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