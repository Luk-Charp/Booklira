const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const cloudinary = require("cloudinary").v2;

initializeApp();

const CLOUDINARY_CLOUD_NAME = defineSecret("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

// Extrait le public_id Cloudinary à partir d'une secure_url, ex :
// https://res.cloudinary.com/demo/image/upload/v1699999999/abc123.jpg
// -> "abc123"
function extrairePublicId(url) {
  if (!url || typeof url !== "string") return null;
  const correspondance = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return correspondance ? correspondance[1] : null;
}

/**
 * Supprime de Cloudinary toutes les images (couvertures de livres +
 * photo de profil) appartenant à l'utilisateur qui appelle cette
 * fonction. Prévu pour être appelé juste avant la suppression du
 * compte (Profile.jsx).
 *
 * Important : on ne fait JAMAIS confiance à des URLs envoyées par le
 * client. On relit nous-mêmes Firestore côté serveur avec l'uid de
 * la personne authentifiée, pour être certain qu'elle ne peut faire
 * supprimer que SES PROPRES images, jamais celles d'un autre
 * utilisateur.
 */
exports.nettoyerImagesCloudinary = onCall(
  {
    secrets: [
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Connexion requise.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();
    const urls = [];

    // Couvertures de tous les livres de l'utilisateur
    const livresSnap = await db
      .collection("books")
      .where("userId", "==", uid)
      .get();

    livresSnap.forEach((doc) => {
      const couverture = doc.data().couverture;
      if (couverture) urls.push(couverture);
    });

    // Photo de profil publique
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists) {
      const photoURL = userSnap.data().photoURL;
      if (photoURL) urls.push(photoURL);
    }

    const publicIds = [...new Set(urls.map(extrairePublicId).filter(Boolean))];

    if (publicIds.length === 0) {
      return { supprimees: 0, total: 0 };
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME.value(),
      api_key: CLOUDINARY_API_KEY.value(),
      api_secret: CLOUDINARY_API_SECRET.value(),
    });

    let supprimees = 0;
    for (const publicId of publicIds) {
      try {
        await cloudinary.uploader.destroy(publicId);
        supprimees++;
      } catch (err) {
        console.error("Erreur suppression Cloudinary :", publicId, err);
      }
    }

    return { supprimees, total: publicIds.length };
  }
);