import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";
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
      </div>
    </div>
  );
}

export default Profile;