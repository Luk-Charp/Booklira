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


// =========================================================
// accepterAmi — Cloud Function callable
//
// À AJOUTER dans ton fichier functions/index.js existant
// (celui qui contient déjà nettoyerImagesCloudinary), pas à
// remplacer. Copie les imports du haut seulement s'ils n'y
// sont pas déjà.
// =========================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Accepte une demande d'ami (classique OU issue d'un lien
 * d'invitation) et crée l'amitié des DEUX côtés de façon
 * atomique.
 *
 * C'est la SEULE façon de créer un document dans
 * users/{uid}/friends/{friendId} — les règles Firestore
 * interdisent désormais toute écriture cliente sur cette
 * sous-collection (voir firestore.rules). Cette fonction
 * utilise l'Admin SDK, qui ignore les règles de sécurité :
 * c'est donc ici, et seulement ici, que la logique de
 * confiance doit être correcte.
 *
 * @param {{ requestId: string }} data
 *   requestId : id du document friendRequests, au format
 *   "from_to" (ex: "abc123_def456").
 */
exports.accepterAmi = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }

  const { requestId } = request.data || {};

  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "requestId manquant ou invalide.");
  }

  const requestRef = db.collection("friendRequests").doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new HttpsError(
      "not-found",
      "Cette demande n'existe plus (peut-être déjà traitée)."
    );
  }

  const demande = requestSnap.data();
  const { from, to } = demande;

  // ⚠️ Vérification centrale : seul le DESTINATAIRE de la
  // demande peut l'accepter. C'est ce qui empêche un simple
  // clic sur un lien de créer une amitié sans confirmation
  // de l'autre personne.
  if (to !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Seul le destinataire de la demande peut l'accepter."
    );
  }

  if (from === to) {
    throw new HttpsError("failed-precondition", "Demande invalide.");
  }

  // Déjà amis ? On ne recrée rien, on nettoie juste la demande
  // orpheline et on répond succès (idempotence).
  const dejaAmiSnap = await db
    .collection("users")
    .doc(to)
    .collection("friends")
    .doc(from)
    .get();

  if (dejaAmiSnap.exists) {
    await requestRef.delete();
    return { success: true, dejaAmi: true };
  }

  const [fromProfileSnap, toProfileSnap] = await Promise.all([
    db.collection("users").doc(from).get(),
    db.collection("users").doc(to).get(),
  ]);

  const fromProfile = fromProfileSnap.exists ? fromProfileSnap.data() : {};
  const toProfile = toProfileSnap.exists ? toProfileSnap.data() : {};

  const batch = db.batch();

  batch.set(db.collection("users").doc(to).collection("friends").doc(from), {
    pseudo: fromProfile.pseudo || "",
    photoURL: fromProfile.photoURL || "",
    since: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(db.collection("users").doc(from).collection("friends").doc(to), {
    pseudo: toProfile.pseudo || "",
    photoURL: toProfile.photoURL || "",
    since: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.delete(requestRef);

  await batch.commit();

  return {
    success: true,
    ami: { uid: from, pseudo: fromProfile.pseudo || "" },
  };
});