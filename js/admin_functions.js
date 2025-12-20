/**
 * Upload une image vers ImgBB et retourne l'URL directe.
 * @param {File} file - Le fichier image provenant d'un input file.
 * @returns {Promise<string>} - L'URL de l'image hébergée.
 */
async function uploadImageToImgBB(file) {
    // ⚠️ IMPORTANT : Remplacez 'VOTRE_CLE_API_ICI' par votre vraie clé API ImgBB
    // Vous pouvez l'obtenir gratuitement sur https://api.imgbb.com/
    const apiKey = '96ff1e4e9603661db4d410f53df99454'; 

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data.url;
        } else {
            throw new Error(result.error ? result.error.message : "Erreur inconnue lors de l'upload vers ImgBB.");
        }
    } catch (error) {
        console.error("Erreur uploadImageToImgBB :", error);
        throw error; // Relance l'erreur pour qu'elle soit attrapée par le formulaire
    }
}