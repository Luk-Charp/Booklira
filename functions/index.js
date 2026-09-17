const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cloudinary = require("cloudinary").v2;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CLOUDINARY_CLOUD_NAME = defineSecret("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

// =========================================================
// UTILITAIRES
// =========================================================

/**
 * Extrait le public_id Cloudinary à partir d'une secure_url.
 *
 * Exemple :
 * https://res.cloudinary.com/demo/image/upload/v1699999999/abc123.jpg
 * -> abc123
 *
 * Les éventuels dossiers Cloudinary sont conservés.
 */
function extrairePublicId(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const correspondance = url.match(
      /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/
    );

    return correspondance ? correspondance[1] : null;
  } catch {
    return null;
  }
}

// =========================================================
// NETTOYAGE CLOUDINARY
// =========================================================

/**
 * Supprime de Cloudinary toutes les images appartenant
 * à l'utilisateur authentifié :
 *
 * - couvertures de ses livres
 * - photo de profil
 *
 * IMPORTANT :
 * Les URLs ne viennent jamais du client.
 * Elles sont relues directement depuis Firestore avec
 * l'UID de l'utilisateur authentifié.
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
      throw new HttpsError(
        "unauthenticated",
        "Connexion requise."
      );
    }

    const uid = request.auth.uid;

    try {
      const urls = [];

      // -------------------------------------------------------
      // Couvertures des livres de l'utilisateur
      // -------------------------------------------------------
      const livresSnap = await db
        .collection("books")
        .where("userId", "==", uid)
        .get();

      livresSnap.forEach((document) => {
        const couverture = document.data()?.couverture;

        if (typeof couverture === "string" && couverture) {
          urls.push(couverture);
        }
      });

      // -------------------------------------------------------
      // Photo de profil
      // -------------------------------------------------------
      const userSnap = await db
        .collection("users")
        .doc(uid)
        .get();

      if (userSnap.exists) {
        const photoURL = userSnap.data()?.photoURL;

        if (typeof photoURL === "string" && photoURL) {
          urls.push(photoURL);
        }
      }

      // -------------------------------------------------------
      // Extraction + suppression des doublons
      // -------------------------------------------------------
      const publicIds = [
        ...new Set(
          urls
            .map(extrairePublicId)
            .filter(Boolean)
        ),
      ];

      if (publicIds.length === 0) {
        return {
          supprimees: 0,
          total: 0,
        };
      }

      // -------------------------------------------------------
      // Configuration Cloudinary avec les secrets serveur
      // -------------------------------------------------------
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME.value(),
        api_key: CLOUDINARY_API_KEY.value(),
        api_secret: CLOUDINARY_API_SECRET.value(),
      });

      // -------------------------------------------------------
      // Suppression parallèle
      // -------------------------------------------------------
      const resultats = await Promise.allSettled(
        publicIds.map((publicId) =>
          cloudinary.uploader.destroy(publicId)
        )
      );

      const supprimees = resultats.filter(
        (resultat) => resultat.status === "fulfilled"
      ).length;

      resultats.forEach((resultat, index) => {
        if (resultat.status === "rejected") {
          console.error(
            "Erreur suppression Cloudinary :",
            publicIds[index],
            resultat.reason
          );
        }
      });

      return {
        supprimees,
        total: publicIds.length,
      };
    } catch (err) {
      console.error(
        "Erreur générale nettoyage Cloudinary :",
        err
      );

      throw new HttpsError(
        "internal",
        "Impossible de nettoyer les images Cloudinary."
      );
    }
  }
);

// =========================================================
// ACCEPTER UNE DEMANDE D'AMI
// =========================================================

/**
 * Accepte une demande d'ami et crée l'amitié
 * des deux côtés.
 *
 * La fonction est volontairement la seule manière de créer
 * les documents users/{uid}/friends/{friendId}.
 *
 * Firestore interdit les créations/modifications clientes
 * sur cette sous-collection.
 *
 * @param {{ requestId: string }} data
 */
exports.accepterAmi = onCall(async (request) => {
  // ---------------------------------------------------------
  // Authentification
  // ---------------------------------------------------------
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "Connexion requise."
    );
  }

  // ---------------------------------------------------------
  // Validation des données reçues
  // ---------------------------------------------------------
  const requestId = request.data?.requestId;

  if (
    typeof requestId !== "string" ||
    requestId.length === 0 ||
    requestId.length > 256
  ) {
    throw new HttpsError(
      "invalid-argument",
      "requestId manquant ou invalide."
    );
  }

  const requestRef = db
    .collection("friendRequests")
    .doc(requestId);

  try {
    // =======================================================
    // TRANSACTION
    //
    // Permet d'éviter qu'une même demande soit acceptée
    // simultanément par plusieurs opérations.
    // =======================================================

    const resultat = await db.runTransaction(async (transaction) => {
      // -----------------------------------------------------
      // Lecture de la demande
      // -----------------------------------------------------
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        throw new HttpsError(
          "not-found",
          "Cette demande n'existe plus ou a déjà été traitée."
        );
      }

      const demande = requestSnap.data() || {};

      const from = demande.from;
      const to = demande.to;

      // -----------------------------------------------------
      // Validation de la structure de la demande
      // -----------------------------------------------------
      if (
        typeof from !== "string" ||
        typeof to !== "string" ||
        !from ||
        !to
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Cette demande d'ami est invalide."
        );
      }

      if (from === to) {
        throw new HttpsError(
          "failed-precondition",
          "Une demande d'ami ne peut pas cibler le même utilisateur."
        );
      }

      // L'ID du document doit correspondre aux utilisateurs
      // réellement présents dans la demande.
      if (requestId !== `${from}_${to}`) {
        throw new HttpsError(
          "failed-precondition",
          "Identifiant de demande invalide."
        );
      }

      // -----------------------------------------------------
      // SEUL LE DESTINATAIRE PEUT ACCEPTER
      // -----------------------------------------------------
      if (to !== uid) {
        throw new HttpsError(
          "permission-denied",
          "Seul le destinataire de la demande peut l'accepter."
        );
      }

      // -----------------------------------------------------
      // Références des deux amitiés
      // -----------------------------------------------------
      const amiDestinataireRef = db
        .collection("users")
        .doc(to)
        .collection("friends")
        .doc(from);

      const amiExpediteurRef = db
        .collection("users")
        .doc(from)
        .collection("friends")
        .doc(to);

      // -----------------------------------------------------
      // Lecture des documents nécessaires
      // -----------------------------------------------------
      const [
        amiDestinataireSnap,
        amiExpediteurSnap,
        fromProfileSnap,
        toProfileSnap,
      ] = await Promise.all([
        transaction.get(amiDestinataireRef),
        transaction.get(amiExpediteurRef),
        transaction.get(
          db.collection("users").doc(from)
        ),
        transaction.get(
          db.collection("users").doc(to)
        ),
      ]);

      // -----------------------------------------------------
      // Cas déjà ami
      //
      // On supprime simplement la demande restante.
      // -----------------------------------------------------
      if (
        amiDestinataireSnap.exists ||
        amiExpediteurSnap.exists
      ) {
        transaction.delete(requestRef);

        return {
          success: true,
          dejaAmi: true,
        };
      }

      // -----------------------------------------------------
      // Profils
      // -----------------------------------------------------
      const fromProfile = fromProfileSnap.exists
        ? fromProfileSnap.data() || {}
        : {};

      const toProfile = toProfileSnap.exists
        ? toProfileSnap.data() || {}
        : {};

      // -----------------------------------------------------
      // Création de l'amitié des deux côtés
      // -----------------------------------------------------
      transaction.set(amiDestinataireRef, {
        pseudo:
          typeof fromProfile.pseudo === "string"
            ? fromProfile.pseudo
            : "",
        photoURL:
          typeof fromProfile.photoURL === "string"
            ? fromProfile.photoURL
            : "",
        since: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(amiExpediteurRef, {
        pseudo:
          typeof toProfile.pseudo === "string"
            ? toProfile.pseudo
            : "",
        photoURL:
          typeof toProfile.photoURL === "string"
            ? toProfile.photoURL
            : "",
        since: admin.firestore.FieldValue.serverTimestamp(),
      });

      // -----------------------------------------------------
      // Suppression atomique de la demande
      // -----------------------------------------------------
      transaction.delete(requestRef);

      return {
        success: true,
        dejaAmi: false,
        ami: {
          uid: from,
          pseudo:
            typeof fromProfile.pseudo === "string"
              ? fromProfile.pseudo
              : "",
        },
      };
    });

    return resultat;
  } catch (err) {
    // Les HttpsError que nous avons volontairement générées
    // doivent être renvoyées telles quelles.
    if (err instanceof HttpsError) {
      throw err;
    }

    console.error(
      "Erreur lors de l'acceptation de la demande d'ami :",
      err
    );

    throw new HttpsError(
      "internal",
      "Impossible d'accepter cette demande d'ami."
    );
  }
});