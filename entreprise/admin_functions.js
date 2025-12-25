/**
 * @file admin_functions.js
 * @description Fonctions utilitaires pour le tableau de bord admin (Upload images, etc.)
 */

// URL de l'API Centrale (Gestion Compte) - Modifiez-la ici pour qu'elle s'applique partout
const GLOBAL_CENTRAL_API_URL = "https://script.google.com/macros/s/AKfycbwGt6JHUQ0QQFYQwCRvgqC-LcBhIbx48lAdqXVd3FtBVQdiGoDZtzVe0Mea7YZ7JoLwbw/exec";

const IMGBB_API_KEY = '96ff1e4e9603661db4d410f53df99454';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * Upload une image vers ImgBB et retourne l'URL.
 * @param {File} imageFile - Le fichier image sélectionné par l'utilisateur.
 * @returns {Promise<string>} L'URL de l'image uploadée ou null si échec.
 */
async function uploadImageToImgBB(imageFile) {
    if (!imageFile) return null;

    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', imageFile);

    try {
        const response = await fetch(IMGBB_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data.url;
        } else {
            throw new Error("Erreur ImgBB: " + (result.error ? result.error.message : "Inconnue"));
        }
    } catch (error) {
        console.error("Erreur lors de l'upload de l'image:", error);
        throw error;
    }
}

/**
 * Vérifie si une URL Wave est valide.
 * @param {string} url 
 * @returns {boolean}
 */
function isValidWaveUrl(url) {
    return typeof url === 'string' && url.includes("wave.com");
}