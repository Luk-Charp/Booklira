import { useState } from "react";
import { updateProfile, deleteUser } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "./UserContext";
import "./Profile.css";

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo

function Profile() {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const user = auth.currentUser;

  const [nom, setNom] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [sauvegarde, setSauvegarde] = useState(false);
  const [message, setMessage] = useState("");

  const [uploadPhotoEnCours, setUploadPhotoEnCours] = useState(false);
  const [erreurUploadPhoto, setErreurUploadPhoto] = useState("");

  // --- RGPD : export des données ---
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState("");

  // --- RGPD : suppression du compte ---
  const [confirmationSuppression, setConfirmationSuppression] =
    useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState("");

  const handlePhotoFileChange = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setErreurUploadPhoto("Merci de choisir un fichier image.");
      e.target.value = "";
      return;
    }
    if (fichier.size > TAILLE_MAX_IMAGE) {
      setErreurUploadPhoto("Image trop lourde (8 Mo maximum).");
      e.target.value = "";
      return;
    }

    setErreurUploadPhoto("");
    setUploadPhotoEnCours(true);

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      const formData = new FormData();
      formData.append("file", fichier);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error("Échec de l'upload Cloudinary");
      const data = await res.json();
      setPhotoURL(data.secure_url);
      setMessage("");
    } catch (err) {
      console.error("Erreur upload photo de profil :", err);
      setErreurUploadPhoto("L'import a échoué, réessaie.");
    } finally {
      setUploadPhotoEnCours(false);
      e.target.value = "";
    }
  };

  const enregistrer = async (e) => {
    e.preventDefault();

    if (!nom.trim()) {
      setMessage("Merci d'indiquer un nom.");
      return;
    }

    setSauvegarde(true);
    setMessage("");

    try {
      await updateProfile(user, {
        displayName: nom.trim(),
        photoURL: photoURL || null,
      });

      setNom(nom.trim());

      // Met à jour le header (nom + avatar) sur l'écran principal
      // sans que l'utilisateur ait besoin de recharger la page.
      await refreshUser();

      setMessage("✓ Profil enregistré !");
    } catch (err) {
      console.error("Erreur modification profil :", err);
      setMessage("Impossible d'enregistrer le profil.");
    } finally {
      setSauvegarde(false);
    }
  };

  // =========================
  // EXPORT DES DONNÉES (RGPD)
  // =========================

  const exporterDonnees = async () => {
    setErreurExport("");
    setExportEnCours(true);

    try {
      const q = query(
        collection(db, "books"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);

      const livres = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const donnees = {
        profil: {
          nom: user.displayName || "",
          email: user.email || "",
          photoURL: user.photoURL || "",
        },
        livres,
        dateExport: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(donnees, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = "booklira-mes-donnees.json";
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur export des données :", err);
      setErreurExport("Impossible d'exporter les données pour le moment.");
    } finally {
      setExportEnCours(false);
    }
  };

  // =========================
  // SUPPRESSION DU COMPTE (RGPD)
  // =========================

  const supprimerCompte = async () => {
    setErreurSuppression("");
    setSuppressionEnCours(true);

    try {
      // 1. Supprimer tous les livres de l'utilisateur
      const q = query(
        collection(db, "books"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);

      const CHUNK = 400;
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const morceau = docs.slice(i, i + CHUNK);

        morceau.forEach((d) => {
          batch.delete(doc(db, "books", d.id));
        });

        await batch.commit();
      }

      // 2. Supprimer le compte d'authentification
      await deleteUser(user);

      // La redirection vers l'écran de connexion se fait
      // automatiquement via onAuthStateChanged dans App.jsx.
    } catch (err) {
      console.error("Erreur suppression du compte :", err);

      if (err.code === "auth/requires-recent-login") {
        setErreurSuppression(
          "Pour des raisons de sécurité, reconnecte-toi puis réessaie de supprimer ton compte."
        );
      } else {
        setErreurSuppression(
          "Impossible de supprimer le compte pour le moment."
        );
      }
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <button
        className="back-btn"
        onClick={() => navigate("/")}
      >
        ← Retour à la bibliothèque
      </button>

      <div className="profile-card">
        <div className="profile-avatar-picker">
          {photoURL ? (
            <img
              src={photoURL}
              alt="Photo de profil"
              className="profile-avatar-preview"
            />
          ) : (
            <div className="profile-icon">
              👤
            </div>
          )}

          <label className="profile-avatar-btn">
            {uploadPhotoEnCours
              ? "Import en cours..."
              : photoURL
              ? "Changer la photo"
              : "📁 Ajouter une photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploadPhotoEnCours}
              onChange={handlePhotoFileChange}
            />
          </label>

          {erreurUploadPhoto && (
            <p className="profile-avatar-error">{erreurUploadPhoto}</p>
          )}
        </div>

        <h1>Mon profil</h1>

        <p className="profile-subtitle">
          Personnalise ton espace BookTracker.
        </p>

        <form onSubmit={enregistrer}>
          <div className="profile-field">
            <label>Nom affiché</label>

            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ton prénom ou ton nom"
              maxLength={40}
            />
          </div>

          <div className="profile-field">
            <label>Email</label>

            <input
              type="email"
              value={user.email || ""}
              disabled
            />
          </div>

          {message && (
            <p className="profile-message">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="profile-save-btn"
            disabled={sauvegarde}
          >
            {sauvegarde
              ? "Enregistrement..."
              : "💾 Enregistrer"}
          </button>
        </form>

        {/* =========================
            GESTION DES DONNÉES (RGPD)
        ========================= */}

        <div className="profile-data-zone">
          <h2>Mes données</h2>

          <p className="profile-data-text">
            Exporte une copie de tes données ou supprime définitivement ton
            compte, conformément au RGPD.
          </p>

          <button
            type="button"
            className="profile-export-btn"
            onClick={exporterDonnees}
            disabled={exportEnCours}
          >
            {exportEnCours
              ? "Export en cours..."
              : "⬇️ Exporter mes données"}
          </button>

          {erreurExport && (
            <p className="profile-avatar-error">{erreurExport}</p>
          )}

          <div className="profile-danger-zone">
            {!confirmationSuppression ? (
              <button
                type="button"
                className="profile-delete-btn"
                onClick={() => setConfirmationSuppression(true)}
              >
                🗑 Supprimer mon compte
              </button>
            ) : (
              <div className="profile-delete-confirm">
                <p>
                  Cette action est irréversible : ton compte et tous tes
                  livres seront définitivement supprimés. Confirmes-tu ?
                </p>

                <div className="profile-delete-confirm-actions">
                  <button
                    type="button"
                    className="profile-delete-btn"
                    onClick={supprimerCompte}
                    disabled={suppressionEnCours}
                  >
                    {suppressionEnCours
                      ? "Suppression..."
                      : "Oui, supprimer définitivement"}
                  </button>

                  <button
                    type="button"
                    className="profile-cancel-btn"
                    onClick={() => setConfirmationSuppression(false)}
                    disabled={suppressionEnCours}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {erreurSuppression && (
              <p className="profile-avatar-error">{erreurSuppression}</p>
            )}
          </div>
        </div>

        <div className="profile-legal-links">
          <Link to="/legal/mentions">Mentions légales</Link>
          <span aria-hidden="true">·</span>
          <Link to="/legal/cgu">CGU</Link>
          <span aria-hidden="true">·</span>
          <Link to="/legal/confidentialite">Confidentialité</Link>
        </div>
      </div>
    </div>
  );
}

export default Profile;