/**
 * @file main-entreprise.js - Logique pour les pages publiques des entreprises partenaires
 * @description Ce script gère l'affichage dynamique des informations, services et produits
 * pour une entreprise spécifique en fonction de son ID dans l'URL.
 * @version 1.0
 */

// --- CONFIGURATION ---
const ENTREPRISE_CONFIG = {
    // URL de l'API CENTRALE qui fournit les données publiques des entreprises
    CENTRAL_API_URL: "https://script.google.com/macros/s/AKfycbwu6h2krfmoluUOTnkVG2dNWp8KieA93O4IrxW9i6vyV6u4pWrg0RlYMoRk5Cw1GUv8Zw/exec"
};

/**
 * Point d'entrée principal, exécuté au chargement de la page.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Empêcher l'exécution automatique sur le tableau de bord admin (qui possède l'ID 'dashboard-content')
    if (document.getElementById('dashboard-content')) return;
    initializeApp();
});

// NOUVEAU: Fonctions pour la lightbox, accessibles globalement
window.openLightbox = openLightbox;

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

        // 2. Remplir la page avec les données récupérées
        displayBusinessInfo(businessInfo);
        
        // NOUVEAU: Gestion intelligente de la galerie
        // Si aucune galerie statique n'est détectée dans le HTML, on essaie d'afficher la galerie dynamique
        if (!document.querySelector('.gallery-item') && businessInfo.GalerieUrls) {
            displayDynamicGallery(businessInfo.GalerieUrls);
        }

        displayItems(services, 'services-list', 'service');
        displayItems(products, 'products-list', 'produit');

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
 */
function displayItems(items, containerId, itemType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<p class="text-gray-500">Aucun ${itemType} disponible pour le moment.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        // Gestion de l'image : utilise l'image du produit ou une image par défaut si absente
        const imageUrl = item.ImageURL || 'https://via.placeholder.com/150?text=Pas+d+image';
        const hasImage = item.ImageURL && item.ImageURL.length > 0;

        return `
        <div class="border-b py-4 flex gap-4 items-start">
            ${hasImage ? `<div class="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden cursor-pointer" onclick="openLightbox('${imageUrl}', '${item.Nom}')"><img src="${imageUrl}" class="w-full h-full object-cover" alt="${item.Nom}"></div>` : ''}
            <div class="flex-grow">
                <div class="flex justify-between items-start">
                    <h3 class="font-semibold text-gray-800 text-lg">${item.Nom || item.NomService || item.NomProduit}</h3>
                    <p class="font-bold text-gold whitespace-nowrap ml-2">${(item.Prix || 0).toLocaleString('fr-FR')} F CFA</p>
                </div>
                ${item.Categorie ? `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mt-1 inline-block">${item.Categorie}</span>` : ''}
                ${item.Description ? `<p class="text-sm text-gray-600 mt-2 leading-relaxed">${item.Description}</p>` : ''}
                ${item.Caracteristiques ? `<p class="text-xs text-gray-500 mt-1 italic">Caractéristiques: ${item.Caracteristiques}</p>` : ''}
            </div>
        </div>
    `}).join('');
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
