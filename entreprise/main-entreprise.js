/**
 * @file main-entreprise.js - Logique pour les pages publiques des entreprises partenaires
 * @description Ce script gère l'affichage dynamique des informations, services et produits
 * pour une entreprise spécifique en fonction de son ID dans l'URL.
 * @version 1.0
 */

// --- CONFIGURATION ---
const ENTREPRISE_CONFIG = {
    // URL de l'API CENTRALE qui fournit les données publiques des entreprises
    CENTRAL_API_URL: CONFIG.ACCOUNT_API_URL
};

/**
 * Point d'entrée principal, exécuté au chargement de la page.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Empêcher l'exécution automatique sur le tableau de bord admin (qui possède l'ID 'dashboard-content')
    if (document.getElementById('dashboard-content')) return;
    initializeApp();
    // Mettre à jour le badge du panier au chargement
    updateCartBadge();
});

// NOUVEAU: Fonctions pour la lightbox, accessibles globalement
window.openLightbox = openLightbox;
window.shareBusiness = shareBusiness; // Rendre accessible globalement

/**
 * Initialise la page en récupérant et affichant les données de l'entreprise.
 */
async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    let compteId = params.get('compteId');
    const alias = params.get('alias');

    // Si on a un alias mais pas d'ID, on doit résoudre l'alias
    if (!compteId && alias) {
        try {
            // On demande à l'API de trouver l'ID correspondant à l'alias
            const resolveResponse = await fetch(`${ENTREPRISE_CONFIG.CENTRAL_API_URL}?action=resolveSlug&alias=${alias}`);
            const resolveResult = await resolveResponse.json();
            if (resolveResult.status === 'success') {
                compteId = resolveResult.compteId;
            }
        } catch (e) {
            console.warn("Impossible de résoudre l'alias:", e);
        }
    }

    if (!compteId) {
        displayError("Contenu indisponible", "Les informations de cette entreprise ne peuvent pas être chargées pour le moment.");
        return;
    }

    // Afficher un état de chargement (squelette)
    showLoadingSkeleton();

    try {
        // 1. Appeler l'API centrale pour obtenir toutes les données publiques de l'entreprise
        const response = await fetch(`${ENTREPRISE_CONFIG.CENTRAL_API_URL}?action=getBusinessPublicData&compteId=${compteId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "L'entreprise n'a pas pu être chargée.");
        }

        const { businessInfo, services, products } = result.data;

        // Exposer les données globalement pour les autres scripts (ex: formulaire d'avis)
        window.PUBLIC_DATA = result.data;
        window.BUSINESS_API_URL = businessInfo.ApiTypeUrl;
        window.BUSINESS_ID = compteId;

        // 2. Remplir la page avec les données récupérées
        displayBusinessInfo(businessInfo);
        
        // NOUVEAU: Gestion intelligente de la galerie
        // Si aucune galerie statique n'est détectée dans le HTML, on essaie d'afficher la galerie dynamique
        if (!document.querySelector('.gallery-item') && businessInfo.GalerieUrls) {
            displayDynamicGallery(businessInfo.GalerieUrls);
        }

        // On passe compteId et businessInfo pour lier la vente et l'adresse à l'entreprise
        displayItems(services, 'services-list', 'service', compteId, businessInfo);
        displayItems(products, 'products-list', 'produit', compteId, businessInfo);

    } catch (error) {
        console.error("Erreur d'initialisation:", error);
        displayError("Erreur de chargement", "Impossible de récupérer les informations de l'entreprise.");
    } finally {
        // Cacher le squelette de chargement une fois terminé
        hideLoadingSkeleton();

        // NOUVEAU: Initialiser la lightbox si elle existe sur la page
        initializeLightbox();
    }
}

/**
 * Affiche les informations de base de l'entreprise (nom, logo, description).
 * @param {object} info - L'objet contenant les informations de l'entreprise.
 */
function displayBusinessInfo(info) {
    document.title = `${info.NomEntreprise} - ABMCY Market`; // Mettre à jour le titre de la page
    
    // NOUVEAU: Mise à jour dynamique des balises Open Graph pour le partage (Facebook, WhatsApp)
    updateMetaTag('og:title', `${info.NomEntreprise} - ABMCY Market`);
    updateMetaTag('og:description', info.Description || `Découvrez les produits et services de ${info.NomEntreprise} sur ABMCY Market.`);
    updateMetaTag('og:image', info.CoverImageUrl || info.LogoUrl || 'https://via.placeholder.com/1200x630');
    updateMetaTag('og:url', window.location.href);
    updateMetaTag('og:type', 'business.business');

    const heroSection = document.getElementById('hero-section');
    if (heroSection && info.CoverImageUrl) {
        heroSection.style.backgroundImage = `url('${info.CoverImageUrl}')`;
    }

    document.getElementById('business-name').textContent = info.NomEntreprise || "Nom de l'entreprise";
    const logoElement = document.getElementById('business-logo');
    if (logoElement && info.LogoUrl) {
        logoElement.src = info.LogoUrl || 'https://via.placeholder.com/150';
        logoElement.alt = `Logo de ${info.NomEntreprise}`;
    }
    document.getElementById('business-description').textContent = info.Description || "Aucune description disponible.";
    document.getElementById('business-address').textContent = info.Adresse || "Adresse non spécifiée";

    // NOUVEAU: Afficher les informations de contact (horaires et réseaux sociaux)
    const contactContainer = document.getElementById('business-contact-info');
    if (contactContainer) {
        let contactHTML = '';

        // Horaires d'ouverture (si présents dans les données de l'API)
        if (info.Horaires) {
            contactHTML += `
                <div class="flex items-center text-sm text-gray-600">
                    <svg class="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>${info.Horaires}</span>
                </div>
            `;
        }

        // Icônes des réseaux sociaux (si présents dans les données de l'API)
        const socialLinks = [
            { url: info.WhatsAppUrl, label: 'WhatsApp', icon: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91s-4.45-9.91-9.91-9.91zM17.5 14.3c-.28-.14-1.65-.82-1.91-.91s-.45-.14-.64.14-.72.91-.88 1.1s-.33.19-.61.07c-1.13-.49-2.24-1.24-3.22-2.48-.77-.95-1.29-2.12-1.43-2.48s-.01-.26.13-.39c.13-.13.28-.33.42-.49.1-.13.17-.22.26-.37.09-.15.05-.28-.02-.42s-.64-1.54-.88-2.1c-.23-.56-.47-.48-.64-.49-.17-.01-.36-.01-.54-.01s-.45.07-.69.33c-.24.26-.92.9-1.12 2.18s-.21 2.41.04 2.74c.03.04 1.6 2.58 3.95 4.55 1.59 1.32 2.41 1.66 3.22 1.9.94.28 1.5.24 2.01.15.57-.1.93-.24 1.65-1 .62-.65.92-.91 1.06-1.21s.14-.45.1-.64c-.05-.19-.19-.3-.28-.42z"></path></svg>' },
            { url: info.FacebookUrl, label: 'Facebook', icon: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clip-rule="evenodd"></path></svg>' },
            { url: info.InstagramUrl, label: 'Instagram', icon: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.024.06 1.378.06 3.808s-.012 2.784-.06 3.808c-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.024.048-1.378.06-3.808.06s-2.784-.013-3.808-.06c-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.024-.06-1.378-.06-3.808s.012-2.784.06-3.808c.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 016.08 4.525c.636-.247 1.363-.416 2.427-.465C9.53 2.013 9.884 2 12.315 2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6zm6.406-11.845a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" clip-rule="evenodd"></path></svg>' }
        ]
        .filter(link => link.url)
        .map(link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-gold transition-colors" title="${link.label}">${link.icon}</a>`)
        .join('');

        if (socialLinks) {
            // Ajouter une marge si les horaires sont aussi présents
            contactHTML += `<div class="flex items-center space-x-3 ${info.Horaires ? 'ml-4' : ''}">${socialLinks}</div>`;
        }

        contactContainer.innerHTML = contactHTML;
    }
}

/**
 * NOUVEAU: Affiche une galerie dynamique si configurée dans la base de données.
 * Utile pour les entreprises qui n'ont pas de page HTML personnalisée avec galerie statique.
 * @param {string} galleryUrls - Chaîne d'URLs séparées par des virgules.
 */
function displayDynamicGallery(galleryUrls) {
    const galleryContainer = document.getElementById('business-gallery');
    if (!galleryContainer) return;

    const urls = galleryUrls.split(',').map(url => url.trim()).filter(url => url);
    if (urls.length === 0) return;

    // Rendre la section visible si elle était cachée
    const section = galleryContainer.closest('section');
    if (section) section.classList.remove('hidden');

    galleryContainer.innerHTML = urls.map(url => `
        <div class="gallery-item group cursor-pointer aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden" onclick="openLightbox('${url}', 'Galerie')">
            <img src="${url}" alt="Photo galerie" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300"></div>
        </div>
    `).join('');
}

/**
 * Affiche une liste d'items (services ou produits) dans leur conteneur.
 * @param {Array} items - La liste des items.
 * @param {string} containerId - L'ID du conteneur où afficher les items.
 * @param {string} itemType - Le type d'item ('service' ou 'produit').
 * @param {string} businessId - L'ID de l'entreprise pour l'attribution de la vente.
 * @param {object} businessInfo - Les infos de l'entreprise (pour l'adresse et le nom).
 */
function displayItems(items, containerId, itemType, businessId, businessInfo) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<p class="text-gray-500 col-span-full text-center">Aucun ${itemType} disponible pour le moment.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        // Gestion de l'image : utilise l'image du produit ou une image par défaut si absente
        const imageUrl = item.ImageURL || 'https://via.placeholder.com/150?text=Pas+d+image';
        const name = item.Nom || item.NomService || item.NomProduit;
        const price = item.Prix || 0;
        const id = item.IDItem || item.IDProduit || item.IDService || Date.now(); // Fallback ID
        const businessName = businessInfo ? businessInfo.NomEntreprise.replace(/'/g, "\\'") : '';
        const businessAddress = businessInfo ? (businessInfo.Adresse || '').replace(/'/g, "\\'") : '';

        return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
            <div class="relative h-48 overflow-hidden cursor-pointer group" onclick="openLightbox('${imageUrl}', '${name.replace(/'/g, "\\'")}')">
                <img src="${imageUrl}" alt="${name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity"></div>
            </div>
            <div class="p-4 flex-grow flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-gray-800 text-lg leading-tight">${name}</h3>
                    </div>
                    ${item.Categorie ? `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-2 inline-block">${item.Categorie}</span>` : ''}
                    <p class="text-sm text-gray-600 line-clamp-2 mb-3">${item.Description || ''}</p>
                </div>
                
                <div class="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span class="text-gold font-bold text-xl">${price.toLocaleString('fr-FR')} F</span>
                    <button 
                        onclick="addToCart('${id}', '${name.replace(/'/g, "\\'")}', ${price}, '${imageUrl}', '${itemType}', '${businessId}', '${businessName}', '${businessAddress}')"
                        class="bg-black text-white p-2 rounded-full hover:bg-gold hover:text-black transition-colors duration-300 shadow-md flex items-center justify-center w-10 h-10"
                        title="Ajouter au panier">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

/**
 * Ajoute un produit au panier global (localStorage).
 * C'est ici que se fait l'intégration avec le système de paiement global.
 */
function addToCart(id, name, price, image, type, businessId, businessName, businessAddress) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    const existingItemIndex = cart.findIndex(item => item.id === id);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            quantity: 1,
            type: type,
            businessId: businessId, // CRUCIAL pour les KPI
            businessName: businessName, // Pour l'affichage au checkout
            businessAddress: businessAddress // Pour le retrait
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    
    // Petit feedback visuel
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    btn.classList.add('bg-green-500', 'text-white');
    btn.classList.remove('bg-black');
    
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-green-500', 'text-white');
        btn.classList.add('bg-black');
    }, 1000);
}

/**
 * Met à jour le badge du panier dans l'en-tête.
 */
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
        badge.textContent = totalItems;
        if (totalItems > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

/**
 * Affiche un message d'erreur sur la page.
 * @param {string} title - Le titre de l'erreur.
 * @param {string} message - Le message d'erreur détaillé.
 */
function displayError(title, message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="text-center p-6 bg-red-50 rounded-lg shadow-md">
                <h1 class="text-2xl font-bold text-red-700">${title}</h1>
                <p class="text-red-600 mt-2">${message}</p>
            </div>
        `;
    }
    // On s'assure que le squelette est bien caché même en cas d'erreur
    document.getElementById('skeleton-loader').classList.add('hidden');
    document.getElementById('hero-section').classList.add('hidden'); // Cacher le hero en cas d'erreur
}
 
/**
 * Affiche une animation de chargement (squelette).
 */
function showLoadingSkeleton() {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('hero-section').classList.add('hidden');
    document.getElementById('skeleton-loader').classList.remove('hidden');
    // NOUVEAU: On cache aussi les conteneurs dynamiques
    document.getElementById('dynamic-content').classList.add('hidden');
    document.getElementById('dynamic-content-2').classList.add('hidden');
}

/**
 * Cache l'animation de chargement et affiche le contenu principal.
 */
function hideLoadingSkeleton() {
    document.getElementById('skeleton-loader').classList.add('hidden');
    // NOUVEAU: On affiche les conteneurs dynamiques et le reste de la page
    document.getElementById('dynamic-content').classList.remove('hidden');
    document.getElementById('dynamic-content-2').classList.remove('hidden');
    document.getElementById('hero-section').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden'); // On s'assure que le main est visible
}

/**
 * Initialise les écouteurs d'événements pour la lightbox.
 */
function initializeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeButton = document.getElementById('lightbox-close');
    if (!lightbox || !closeButton) return;

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        // Ferme la lightbox si on clique sur le fond noir, mais pas sur l'image elle-même.
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
}

/**
 * Ouvre la lightbox avec une image et une description spécifiques.
 * @param {string} imageUrl - L'URL de l'image à afficher.
 * @param {string} captionText - La description de l'image.
 */
function openLightbox(imageUrl, captionText) {
    const lightbox = document.getElementById('lightbox');
    document.getElementById('lightbox-image').src = imageUrl;
    document.getElementById('lightbox-caption').textContent = captionText;
    lightbox.classList.remove('opacity-0', 'pointer-events-none');
}

/**
 * Ferme la lightbox.
 */
function closeLightbox() {
    document.getElementById('lightbox').classList.add('opacity-0', 'pointer-events-none');
}

/**
 * NOUVEAU: Helper pour mettre à jour ou créer une balise meta Open Graph.
 * @param {string} property - La propriété de la balise (ex: 'og:title').
 * @param {string} content - Le contenu à assigner.
 */
function updateMetaTag(property, content) {
    if (!content) return;
    let element = document.querySelector(`meta[property="${property}"]`);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
}

/**
 * NOUVEAU: Partage la boutique via l'API native ou copie le lien.
 */
function shareBusiness() {
    const businessName = document.getElementById('business-name').textContent || 'Boutique ABMCY Market';
    const shareData = {
        title: businessName,
        text: `Découvrez ${businessName} sur ABMCY Market !`,
        url: window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Lien de la boutique copié dans le presse-papier !');
        }).catch(() => alert('Impossible de copier le lien.'));
    }
}
