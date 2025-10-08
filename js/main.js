const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbwi3zpOqK7EKSKDCQ1VTIYvrfesOTTpNBs4vQvh_3BCcSE65KGjlWnLsilUtyvOdsgT/exec",

    // URL de l'API publique des produits (Script 1: Gestion Produits)
    PRODUCT_API_URL: "https://script.google.com/macros/s/AKfycbw0dWVwcXOivb9u7ULSkIFeOk54QZQxiBFmtC6UaSzK315nJLk6d9HW4TSHJiweVe-P/exec",
    
    // Autres configurations
    DEFAULT_PRODUCT_IMAGE: "https://i.postimg.cc/6QZBH1JJ/Sleek-Wordmark-Logo-for-ABMCY-MARKET.png",
};

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

    // Si nous sommes sur la page d'accueil, afficher les produits
    if (document.querySelector('#homepage-sections')) {
        renderHomepageProducts();
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
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    
    menu.classList.toggle('hidden'); // Continue de gérer la visibilité
    menu.classList.toggle('-translate-x-full'); // Gère l'animation de glissement
    overlay.classList.toggle('hidden'); // Affiche/cache l'arrière-plan
}

/**
 * Remplit dynamiquement le menu des catégories à partir du fichier categories.js.
 */
async function populateCategoryMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return; // S'assure que l'élément existe
    let menuHTML = ''; // Initialiser la variable ici

    try {
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const categories = data.categories || [];
        
        // Ajout d'un titre et d'un bouton de fermeture
        menuHTML = `<div class="p-4 border-b"><h3 class="font-bold text-lg">Catégories</h3></div>`;

        menuHTML += categories.map(cat => 
        // Correction: Utiliser l'ID et le nom pour la page catégorie
        `<a href="categorie.html?id=${cat.IDCategorie}&name=${encodeURIComponent(cat.Nom)}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${cat.Nom}</a>`
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
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const allProducts = data.products || [];

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
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) throw new Error(`Erreur réseau: ${response.statusText}`);
        
        const data = await response.json();
        const allProducts = data.products || [];

        // Filtrer les produits par l'ID de la catégorie
        const filteredProducts = allProducts.filter(product => product.Catégorie === categoryName); // Supposant que la catégorie est stockée par nom

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
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) throw new Error(`Erreur réseau: ${response.statusText}`);
        
        const data = await response.json();
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
        // Fetch all products and find the specific one
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const allProducts = data.products || [];

        const product = allProducts.find(p => p.IDProduit == productId);

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
 * Affiche dynamiquement les produits sur la page d'accueil.
 */
async function renderHomepageProducts() {
    const homepageContainer = document.querySelector('#homepage-sections');
    if (!homepageContainer) return; // Si on n'est pas sur la page d'accueil

    try {
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const allCategories = data.categories || [];
        const allProducts = data.products || [];

        // Sélectionner les 3 premières catégories à afficher
        const categoriesToShow = allCategories.sort((a, b) => a.Ordre - b.Ordre).slice(0, 3);

        let homepageHTML = '';
        categoriesToShow.forEach((category, index) => {
            const categoryProducts = allProducts.filter(p => p.Catégorie === category.Nom).slice(0, 4);
            const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-100';

            homepageHTML += `
                <section class="py-12 ${bgColor}">
                    <div class="container mx-auto px-4">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="text-3xl font-bold text-gray-800">${category.Nom}</h3>
                            <a href="categorie.html?id=${category.IDCategorie}&name=${encodeURIComponent(category.Nom)}" class="text-gold hover:underline">Voir plus</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            ${categoryProducts.map(product => renderProductCard(product)).join('')}
                        </div>
                    </div>
                </section>
            `;
        });

        homepageContainer.innerHTML = homepageHTML;

    } catch (error) {
        console.error("Erreur lors du chargement des produits de la page d'accueil:", error);
        homepageContainer.innerHTML = '<p class="py-12 text-center text-red-500">Impossible de charger les sections de produits.</p>';
    }
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
  const brand = product.Marque || 'Marque Inconnue'; // Placeholder for brand
  const description = product.Description || '';
  const rating = product.NoteMoyenne || 0;
  const reviewsCount = product.NombreAvis || 0;

  let stockInfo;
  if (stock > 10) {
    stockInfo = `<span class="text-xs font-semibold text-green-600">En stock</span>`;
  } else if (stock > 0) {
    stockInfo = `<span class="text-xs font-semibold text-orange-500">Stock faible (${stock} restants)</span>`;
  } else {
    stockInfo = `<span class="text-xs font-semibold text-red-600">Épuisé</span>`;
  }

  return `
    <div class="product-card bg-white rounded-lg shadow-md overflow-hidden flex flex-col justify-between">
      <a href="produit.html?id=${product.IDProduit}" class="block">
        <div class="relative">
          <div class="h-48 bg-gray-200 flex items-center justify-center">
            <img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="h-full w-full object-cover" onerror="this.onerror=null;this.src='${CONFIG.DEFAULT_PRODUCT_IMAGE}';">
          </div>
          ${discount > 0 ? `<span class="discount-badge absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">-${discount}%</span>` : ''}
        </div>
        <div class="p-4">
          <span class="text-xs text-gray-500">${brand}</span>
          <h4 class="font-semibold text-gray-800 mt-1 truncate" title="${product.Nom}">${product.Nom}</h4>
          <p class="text-sm text-gray-600 mt-1 h-10 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]" title="${description}">${description}</p>
          
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center text-yellow-500">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
              <span class="text-xs text-gray-600 ml-1">${rating > 0 ? `${rating.toFixed(1)} (${reviewsCount} avis)` : 'Pas encore d\'avis'}</span>
            </div>
            ${stockInfo}
          </div>

          <div class="flex items-baseline space-x-2 mt-3">
            <span class="text-xl font-bold text-gold">${price.toLocaleString('fr-FR')} F CFA</span>
            ${oldPrice > price ? `<span class="text-sm text-gray-500 line-through">${oldPrice.toLocaleString('fr-FR')} F CFA</span>` : ''}
          </div>
        </div>
      </a>
      <div class="p-4 pt-0 flex items-center space-x-2">
        <button class="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition text-sm font-semibold" ${stock === 0 ? 'disabled' : ''} onclick="addToCart(event, '${product.IDProduit}', '${product.Nom}', ${price}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')">
          ${stock > 0 ? 'Ajouter au panier' : 'Épuisé'}
        </button>
        <button class="p-2 border rounded text-gray-500 hover:bg-gray-100 hover:text-red-500" title="Ajouter aux favoris"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 016.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"></path></svg></button>
        <button class="p-2 border rounded text-gray-500 hover:bg-gray-100" title="Comparer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg></button>
      </div>
    </div>
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