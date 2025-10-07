const CONFIG = {
    // URL de l'API publique (Script 2: Gestion Client & Livraison)
    CLIENT_API_URL: "https://script.google.com/macros/s/AKfycbxehBgmtpyBWPlNiDP1IJixHSr40Peuut4_OlfndVldp6jrsoHKsSb-UnlUFXIeU4gs/exec",

    // URL de l'API publique des produits (Script 1: Gestion Produits)
    PRODUCT_API_URL: "https://script.google.com/macros/s/AKfycbz7Pmzu5wgECM734NaURQJi8UdAHGqBvIlA0qD35WXAnTyEH8B9X5m_pr-WwV5TPWyD/exec",
    
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
    menu.classList.toggle('hidden');
}

/**
 * Remplit dynamiquement le menu des catégories à partir du fichier categories.js.
 */
async function populateCategoryMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;

    try {
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const categories = data.categories || [];

        const menuHTML = categories.map(cat => 
        `<a href="categorie.html?cat=${cat.IDCategorie}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">${cat.Nom}</a>`
        ).join('');
        menu.innerHTML = menuHTML;
    } catch (error) {
        console.error("Erreur lors du chargement des catégories:", error);
        menu.innerHTML = '<p class="px-4 py-2 text-sm text-red-500">Erreur de chargement des catégories.</p>';
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
        document.querySelector('h1').textContent = product.Nom;
        document.querySelector('#product-image-main').src = product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE;
        // ... et ainsi de suite pour les autres éléments (prix, description, etc.)
        // Exemple pour le prix:
        document.querySelector('.text-3xl.font-bold.text-gold').textContent = `${product.PrixActuel.toLocaleString('fr-FR')} F CFA`;
        // Afficher le prix barré s'il y a une réduction

        // Mettre à jour le bouton "Ajouter au panier"
        const addToCartButton = document.querySelector('.w-full.bg-black');
        addToCartButton.setAttribute('onclick', `addToCart(event, '${product.IDProduit}', '${product.Nom}', ${product.PrixActuel}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')`);

    } catch (error) {
        console.error("Erreur de chargement du produit:", error);
        document.querySelector('main').innerHTML = `<p class="text-center text-red-500">Impossible de charger les informations du produit.</p>`;
    }
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
        orderData: {
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
        const response = await fetch(CLIENT_API_URL, {
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
    const electronicsSection = document.querySelector('#electronics-products');
    const clothingSection = document.querySelector('#clothing-products');
    const homeSection = document.querySelector('#home-products');

    if (!electronicsSection) return; // Si on n'est pas sur la page d'accueil

    try {
        const response = await fetch(`${CONFIG.PRODUCT_API_URL}?action=getPublicData`);
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.statusText}`);
        }
        const data = await response.json();
        const allProducts = data.products || [];

        const electronics = allProducts.filter(p => p.Catégorie === 'Électronique' || p.categorie === 'Électronique').slice(0, 4);
        const clothing = allProducts.filter(p => p.Catégorie === 'Vêtements').slice(0, 4);
        const home = allProducts.filter(p => p.Catégorie === 'Maison').slice(0, 4);

        electronicsSection.innerHTML = electronics.map(product => renderProductCard(product)).join('');
        clothingSection.innerHTML = clothing.map(product => renderProductCard(product)).join('');
        homeSection.innerHTML = home.map(product => renderProductCard(product)).join('');
    } catch (error) {
        console.error("Erreur lors du chargement des produits de la page d'accueil:", error);
        // Afficher un message d'erreur ou des placeholders si le chargement échoue
        if (electronicsSection) electronicsSection.innerHTML = '<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>';
        if (clothingSection) clothingSection.innerHTML = '<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>';
        if (homeSection) homeSection.innerHTML = '<p class="col-span-full text-center text-red-500">Impossible de charger les produits.</p>';
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

    return `
        <a href="produit.html?id=${product.IDProduit}" class="product-card bg-white rounded-lg shadow-md overflow-hidden block">
            <div class="relative">
                <div class="h-48 bg-gray-200 flex items-center justify-center">
                    <img src="${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${product.Nom}" class="h-full w-full object-cover">
                </div>
                ${discount > 0 ? `<span class="discount-badge absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">-${discount}%</span>` : ''}
            </div>
            <div class="p-4">
                <h4 class="font-semibold text-gray-800 mb-2 truncate">${product.Nom}</h4>
                <div class="flex items-center space-x-2">
                    <span class="text-lg font-bold text-gold">${price.toLocaleString('fr-FR')} F CFA</span>
                    ${oldPrice > price ? `<span class="text-sm text-gray-500 line-through">${oldPrice.toLocaleString('fr-FR')} F CFA</span>` : ''}
                </div>
                <button class="w-full mt-3 bg-black text-white py-2 rounded hover:bg-gray-800 transition" onclick="addToCart(event, '${product.IDProduit}', '${product.Nom}', ${price}, '${product.ImageURL || CONFIG.DEFAULT_PRODUCT_IMAGE}')">
                    Ajouter au panier
                </button>
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
        const response = await fetch(CLIENT_API_URL, {
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
    document.querySelector('.w-16.h-16.rounded-full').textContent = initials;

    // Logique de déconnexion
    const logoutLink = document.getElementById('logout-link');
    const logoutNav = document.querySelector('a[href="#"].text-red-600'); // Cible le lien de déconnexion dans la nav
    
    const logoutAction = (e) => {
        e.preventDefault();
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.removeItem('abmcyUser');
            window.location.href = 'index.html';
        }
    };

    logoutLink.addEventListener('click', logoutAction);
    logoutNav.addEventListener('click', logoutAction);
}