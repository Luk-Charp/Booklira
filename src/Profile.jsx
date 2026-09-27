import { useState, useEffect } from "react";
import {
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { db, auth, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "./UserContext";
import "./Profile.css";
import ImportCSV from "./ImportCSV";

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo

const THEMES_AUTORISES = [
  "brown",
  "blue",
  "pink",
  "green",
  "yellow",
  "purple",
];

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

  // --- Amis : pseudo public + réglages de confidentialité ---
  const [pseudo, setPseudo] = useState("");
  const [visibilite, setVisibilite] = useState({
    livres: true,
    notes: true,
    stats: true,
  });
  const [confidentialiteChargee, setConfidentialiteChargee] = useState(false);
  const [confidentialiteEnCours, setConfidentialiteEnCours] = useState(false);
  const [messageConfidentialite, setMessageConfidentialite] = useState("");

  // --- Apparence ---
  const [theme, setTheme] = useState("brown");
  const [themeEnCours, setThemeEnCours] = useState(false);

  useEffect(() => {
    const chargerProfilPublic = async () => {
      if (!user) return;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const donnees = snap.data();

          setPseudo(donnees.pseudo || user.displayName || "");

          const visibiliteNormalisee = {
            livres: donnees.visibilite?.livres ?? true,
            notes: donnees.visibilite?.notes ?? true,
            stats: donnees.visibilite?.stats ?? true,
          };

          setVisibilite(visibiliteNormalisee);

          const themeNormalise = THEMES_AUTORISES.includes(donnees.theme)
            ? donnees.theme
            : "brown";

          setTheme(themeNormalise);
          document.documentElement.dataset.theme = themeNormalise;

          // Les anciens comptes peuvent ne pas avoir encore le champ
          // "visibilite" ou certains de ses réglages dans Firestore.
          const visibiliteExistante = donnees.visibilite || {};

          if (
            visibiliteExistante.livres === undefined ||
            visibiliteExistante.notes === undefined ||
            visibiliteExistante.stats === undefined
          ) {
            await setDoc(
              doc(db, "users", user.uid),
              {
                visibilite: visibiliteNormalisee,
              },
              { merge: true }
            );
          }

          // Les anciens comptes n'ont pas encore de thème.
          // On enregistre le thème marron par défaut.
          if (!THEMES_AUTORISES.includes(donnees.theme)) {
            await setDoc(
              doc(db, "users", user.uid),
              {
                theme: "brown",
              },
              { merge: true }
            );
          }
        } else {
          setPseudo(user.displayName || "");

          setTheme("brown");
          document.documentElement.dataset.theme = "brown";
        }
      } catch (err) {
        console.error("Erreur chargement profil public :", err);

        // En cas d'erreur, on conserve le thème marron par défaut.
        document.documentElement.dataset.theme = "brown";
      } finally {
        setConfidentialiteChargee(true);
      }
    };

    chargerProfilPublic();
  }, [user]);

  // --- Changement de thème ---
  const changerTheme = async (nouveauTheme) => {
    if (!user || !THEMES_AUTORISES.includes(nouveauTheme)) {
      return;
    }

    const ancienTheme = theme;

    setTheme(nouveauTheme);
    document.documentElement.dataset.theme = nouveauTheme;
    setThemeEnCours(true);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          theme: nouveauTheme,
        },
        {
          merge: true,
        }
      );
    } catch (err) {
      console.error("Erreur changement de thème :", err);

      // Retour au thème précédent si Firestore échoue.
      setTheme(ancienTheme);
      document.documentElement.dataset.theme = ancienTheme;
    } finally {
      setThemeEnCours(false);
    }
  };

  // --- Changement de mot de passe ---
  const compteAvecMotDePasse = user?.providerData?.some(
    (provider) => provider.providerId === "password"
  );

  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [changementMotDePasseEnCours, setChangementMotDePasseEnCours] =
    useState(false);
  const [messageMotDePasse, setMessageMotDePasse] = useState("");
  const [motDePasseOuvert, setMotDePasseOuvert] = useState(false);
  const [erreurMotDePasse, setErreurMotDePasse] = useState("");

  const changerMotDePasse = async (e) => {
    e.preventDefault();

    setMessageMotDePasse("");
    setErreurMotDePasse("");

    if (!motDePasseActuel || !nouveauMotDePasse || !confirmationMotDePasse) {
      setErreurMotDePasse("Merci de remplir tous les champs.");
      return;
    }

    if (nouveauMotDePasse.length < 8) {
      setErreurMotDePasse(
        "Le nouveau mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setErreurMotDePasse(
        "Les deux nouveaux mots de passe ne correspondent pas."
      );
      return;
    }

    if (motDePasseActuel === nouveauMotDePasse) {
      setErreurMotDePasse(
        "Le nouveau mot de passe doit être différent de l'ancien."
      );
      return;
    }

    if (!user.email) {
      setErreurMotDePasse(
        "Impossible de modifier le mot de passe de ce compte."
      );
      return;
    }

    setChangementMotDePasseEnCours(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        motDePasseActuel
      );

      // Firebase exige une authentification récente pour cette opération.
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, nouveauMotDePasse);

      setMotDePasseActuel("");
      setNouveauMotDePasse("");
      setConfirmationMotDePasse("");

      setMessageMotDePasse("✓ Mot de passe modifié avec succès !");
    } catch (err) {
      console.error("Erreur changement de mot de passe :", err);

      switch (err?.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
          setErreurMotDePasse("L'ancien mot de passe est incorrect.");
          break;

        case "auth/weak-password":
          setErreurMotDePasse("Le nouveau mot de passe est trop faible.");
          break;

        case "auth/requires-recent-login":
          setErreurMotDePasse(
            "Pour des raisons de sécurité, reconnecte-toi puis réessaie."
          );
          break;

        case "auth/too-many-requests":
          setErreurMotDePasse(
            "Trop de tentatives. Attends quelques instants puis réessaie."
          );
          break;

        default:
          setErreurMotDePasse(
            "Impossible de modifier le mot de passe pour le moment."
          );
      }
    } finally {
      setChangementMotDePasseEnCours(false);
    }
  };

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
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Échec de l'upload Cloudinary");
      }

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

  const normaliserPseudo = (valeur) =>
    valeur.trim().normalize("NFKC").toLowerCase();

  const enregistrer = async (e) => {
    e.preventDefault();

    if (!nom.trim()) {
      setMessage("Merci d'indiquer un nom.");
      return;
    }

    if (!pseudo.trim()) {
      setMessage("Merci d'indiquer un pseudo.");
      return;
    }

    setSauvegarde(true);
    setMessage("");

    const nomFinal = nom.trim();
    const pseudoFinal = pseudo.trim();
    const pseudoLowerFinal = normaliserPseudo(pseudoFinal);
    const photoFinale = photoURL || "";
    const profilRef = doc(db, "users", user.uid);

    let profilAvantModification = null;
    let ancienPseudoLower = "";

    try {
      const profilSnap = await getDoc(profilRef);
      profilAvantModification = profilSnap.exists()
        ? profilSnap.data()
        : {};
      ancienPseudoLower = normaliserPseudo(
        profilAvantModification.pseudo || ""
      );

      await runTransaction(db, async (transaction) => {
        const pseudoRef = doc(db, "usernames", pseudoLowerFinal);
        const pseudoSnap = await transaction.get(pseudoRef);

        let ancienPseudoSnap = null;
        let ancienPseudoRef = null;

        if (ancienPseudoLower && ancienPseudoLower !== pseudoLowerFinal) {
          ancienPseudoRef = doc(db, "usernames", ancienPseudoLower);
          ancienPseudoSnap = await transaction.get(ancienPseudoRef);
        }

        if (
          pseudoSnap.exists() &&
          pseudoSnap.data().uid !== user.uid
        ) {
          const erreur = new Error("Ce pseudo est déjà utilisé.");
          erreur.code = "pseudo-already-taken";
          throw erreur;
        }

        transaction.set(
          pseudoRef,
          {
            uid: user.uid,
            pseudo: pseudoFinal,
          },
          { merge: true }
        );

        if (
          ancienPseudoRef &&
          ancienPseudoSnap?.exists() &&
          ancienPseudoSnap.data().uid === user.uid
        ) {
          transaction.delete(ancienPseudoRef);
        }

        transaction.set(
          profilRef,
          {
            pseudo: pseudoFinal,
            pseudoLower: pseudoLowerFinal,
            photoURL: photoFinale,
            email: user.email || "",
          },
          { merge: true }
        );
      });

      try {
        await updateProfile(user, {
          displayName: nomFinal,
          photoURL: photoFinale || null,
        });
      } catch (authError) {
        await runTransaction(db, async (transaction) => {
          const nouveauPseudoRef = doc(
            db,
            "usernames",
            pseudoLowerFinal
          );
          const nouveauPseudoSnap = await transaction.get(nouveauPseudoRef);

          if (
            nouveauPseudoSnap.exists() &&
            nouveauPseudoSnap.data().uid === user.uid
          ) {
            transaction.delete(nouveauPseudoRef);
          }

          if (ancienPseudoLower) {
            transaction.set(
              doc(db, "usernames", ancienPseudoLower),
              {
                uid: user.uid,
                pseudo: profilAvantModification.pseudo || "",
              },
              { merge: true }
            );
          }

          transaction.set(
            profilRef,
            {
              pseudo: profilAvantModification.pseudo || "",
              pseudoLower: ancienPseudoLower,
              photoURL: profilAvantModification.photoURL || "",
            },
            { merge: true }
          );
        });

        throw authError;
      }

      setNom(nomFinal);
      setPseudo(pseudoFinal);

      try {
        await refreshUser();
      } catch (refreshError) {
        console.warn(
          "Profil sauvegardé mais impossible de rafraîchir Firebase Auth :",
          refreshError
        );
      }

      setMessage("✓ Profil enregistré !");
    } catch (err) {
      console.error("Erreur modification profil :", err);
      console.error("Code Firebase :", err?.code);
      console.error("Message Firebase :", err?.message);

      if (err?.code === "pseudo-already-taken") {
        setMessage("❌ Ce pseudo est déjà utilisé par quelqu'un.");
      } else {
        setMessage(
          err?.code
            ? `Erreur : ${err.code}`
            : "Impossible d'enregistrer le profil."
        );
      }
    } finally {
      setSauvegarde(false);
    }
  };

  // =========================
  // CONFIDENTIALITÉ
  // =========================

  const basculerVisibilite = async (cle) => {
    const nouvelleValeur = !visibilite[cle];
    const nouvelleVisibilite = {
      ...visibilite,
      [cle]: nouvelleValeur,
    };

    setVisibilite(nouvelleVisibilite);
    setConfidentialiteEnCours(true);
    setMessageConfidentialite("");

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          visibilite: {
            [cle]: nouvelleValeur,
          },
        },
        {
          merge: true,
        }
      );
    } catch (err) {
      console.error("Erreur mise à jour confidentialité :", err);

      setVisibilite(visibilite);

      setMessageConfidentialite(
        "Impossible d'enregistrer ce réglage."
      );
    } finally {
      setConfidentialiteEnCours(false);
    }
  };

  // =========================
  // EXPORT DES DONNÉES
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

      const amisSnap = await getDocs(
        collection(db, "users", user.uid, "friends")
      );

      const listeAmis = amisSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const donnees = {
        profil: {
          nom: user.displayName || "",
          pseudo: pseudo || "",
          email: user.email || "",
          photoURL: user.photoURL || "",
          visibilite,
          theme,
        },

        livres,
        amis: listeAmis,
        dateExport: new Date().toISOString(),
      };

      const blob = new Blob(
        [JSON.stringify(donnees, null, 2)],
        {
          type: "application/json",
        }
      );

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

      setErreurExport(
        "Impossible d'exporter les données pour le moment."
      );
    } finally {
      setExportEnCours(false);
    }
  };

  // =========================
  // SUPPRESSION DU COMPTE
  // =========================

  const supprimerCompte = async () => {
    setErreurSuppression("");
    setSuppressionEnCours(true);

    try {
      try {
        const nettoyer = httpsCallable(
          functions,
          "nettoyerImagesCloudinary"
        );

        await nettoyer();
      } catch (err) {
        console.warn(
          "Nettoyage Cloudinary partiel ou échoué :",
          err
        );
      }

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

      const amisSnap = await getDocs(
        collection(db, "users", user.uid, "friends")
      );

      const [
        demandesEnvoyeesSnap,
        demandesRecuesSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, "friendRequests"),
            where("from", "==", user.uid)
          )
        ),

        getDocs(
          query(
            collection(db, "friendRequests"),
            where("to", "==", user.uid)
          )
        ),
      ]);

      const batchNettoyage = writeBatch(db);

      amisSnap.docs.forEach((d) => {
        batchNettoyage.delete(
          doc(
            db,
            "users",
            user.uid,
            "friends",
            d.id
          )
        );

        batchNettoyage.delete(
          doc(
            db,
            "users",
            d.id,
            "friends",
            user.uid
          )
        );
      });

      demandesEnvoyeesSnap.docs.forEach((d) =>
        batchNettoyage.delete(
          doc(db, "friendRequests", d.id)
        )
      );

      demandesRecuesSnap.docs.forEach((d) =>
        batchNettoyage.delete(
          doc(db, "friendRequests", d.id)
        )
      );

      const pseudoActuelLower = normaliserPseudo(pseudo || "");
      if (pseudoActuelLower) {
        const pseudoRef = doc(db, "usernames", pseudoActuelLower);
        const pseudoSnap = await getDoc(pseudoRef);

        if (
          pseudoSnap.exists() &&
          pseudoSnap.data().uid === user.uid
        ) {
          batchNettoyage.delete(pseudoRef);
        }
      }

      batchNettoyage.delete(
        doc(db, "users", user.uid)
      );

      await batchNettoyage.commit();

      await deleteUser(user);
    } catch (err) {
      console.error(
        "Erreur suppression du compte :",
        err
      );

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
            <p className="profile-avatar-error">
              {erreurUploadPhoto}
            </p>
          )}
        </div>

        <h1>Mon profil</h1>

        <p className="profile-subtitle">
          Personnalise ton espace BookTracker.
        </p>

        <Link
          to="/friends"
          className="profile-friends-link"
        >
          👥 Voir mes amis
        </Link>

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
            <label>
              Pseudo (visible par tes amis)
            </label>

            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Le pseudo que tes amis pourront rechercher"
              maxLength={30}
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
            SÉCURITÉ
        ========================= */}

        <div className={`profile-data-zone profile-security-zone ${motDePasseOuvert ? "is-open" : ""}`}>
          {compteAvecMotDePasse ? (
            <>
              <button
                type="button"
                className="profile-section-toggle"
                onClick={() => setMotDePasseOuvert((ouvert) => !ouvert)}
                aria-expanded={motDePasseOuvert}
              >
                <span>
                  <strong>🔒 Changer le mot de passe</strong>
                  <small>Modifier les identifiants de ton compte</small>
                </span>
                <span className="profile-section-chevron">⌄</span>
              </button>

              {motDePasseOuvert && (
                <div className="profile-collapsible-content">
                  <p className="profile-data-text">
                    Ton ancien mot de passe est demandé pour vérifier ton identité.
                  </p>

                  <form onSubmit={changerMotDePasse}>
                    <div className="profile-field">
                      <label>Mot de passe actuel</label>
                      <input
                        type="password"
                        value={motDePasseActuel}
                        onChange={(e) => setMotDePasseActuel(e.target.value)}
                        placeholder="Ton mot de passe actuel"
                        autoComplete="current-password"
                        disabled={changementMotDePasseEnCours}
                      />
                    </div>

                    <div className="profile-field">
                      <label>Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={nouveauMotDePasse}
                        onChange={(e) => setNouveauMotDePasse(e.target.value)}
                        placeholder="8 caractères minimum"
                        minLength={8}
                        autoComplete="new-password"
                        disabled={changementMotDePasseEnCours}
                      />
                    </div>

                    <div className="profile-field">
                      <label>Confirmer le nouveau mot de passe</label>
                      <input
                        type="password"
                        value={confirmationMotDePasse}
                        onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                        placeholder="Retape ton nouveau mot de passe"
                        minLength={8}
                        autoComplete="new-password"
                        disabled={changementMotDePasseEnCours}
                      />
                    </div>

                    {messageMotDePasse && (
                      <p className="profile-message">{messageMotDePasse}</p>
                    )}

                    {erreurMotDePasse && (
                      <p className="profile-avatar-error">{erreurMotDePasse}</p>
                    )}

                    <button
                      type="submit"
                      className="profile-save-btn"
                      disabled={changementMotDePasseEnCours}
                    >
                      {changementMotDePasseEnCours
                        ? "Modification..."
                        : "🔒 Modifier mon mot de passe"}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Sécurité</h2>
              <p className="profile-data-text">
                Ton compte utilise une connexion externe (par exemple Google).
                Le mot de passe est géré par ce fournisseur de connexion.
              </p>
            </>
          )}
        </div>

        {/* =========================
            APPARENCE
        ========================= */}

        <div className="profile-theme-zone">
          <h2>🎨 Apparence</h2>

          <p className="profile-theme-description">
            Choisis la couleur principale de ton espace Booklira.
          </p>

          <div className="profile-theme-list">
            <button
              type="button"
              className={`profile-theme-button ${
                theme === "brown" ? "active" : ""
              }`}
              style={{ "--theme-color": "#a9784e" }}
              onClick={() => changerTheme("brown")}
              disabled={themeEnCours}
              aria-label="Thème marron"
              title="Marron"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Marron</span>

              {theme === "brown" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>

            <button
              type="button"
              className={`profile-theme-button ${
                theme === "blue" ? "active" : ""
              }`}
              style={{ "--theme-color": "#2867b2" }}
              onClick={() => changerTheme("blue")}
              disabled={themeEnCours}
              aria-label="Thème bleu"
              title="Bleu"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Bleu</span>

              {theme === "blue" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>

            <button
              type="button"
              className={`profile-theme-button ${
                theme === "pink" ? "active" : ""
              }`}
              style={{ "--theme-color": "#c93668" }}
              onClick={() => changerTheme("pink")}
              disabled={themeEnCours}
              aria-label="Thème rose"
              title="Rose"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Rose</span>

              {theme === "pink" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>

            <button
              type="button"
              className={`profile-theme-button ${
                theme === "green" ? "active" : ""
              }`}
              style={{ "--theme-color": "#27844b" }}
              onClick={() => changerTheme("green")}
              disabled={themeEnCours}
              aria-label="Thème vert"
              title="Vert"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Vert</span>

              {theme === "green" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>

            <button
              type="button"
              className={`profile-theme-button ${
                theme === "yellow" ? "active" : ""
              }`}
              style={{ "--theme-color": "#c98a08" }}
              onClick={() => changerTheme("yellow")}
              disabled={themeEnCours}
              aria-label="Thème jaune"
              title="Jaune"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Jaune</span>

              {theme === "yellow" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>

            <button
              type="button"
              className={`profile-theme-button ${theme === "purple" ? "active" : ""}`}
              style={{ "--theme-color": "#9b6dcc" }}
              onClick={() => changerTheme("purple")}
              disabled={themeEnCours}
              aria-label="Thème violet"
              title="Violet"
            >
              <span className="profile-theme-color"></span>
              <span className="profile-theme-name">Violet</span>

              {theme === "purple" && (
                <span className="profile-theme-check">✓</span>
              )}
            </button>
          </div>
        </div>

        {/* =========================
            CONFIDENTIALITÉ
        ========================= */}

        <div className="profile-privacy-zone">
          <h2>Ce que voient mes amis</h2>

          <p className="profile-data-text">
            Choisis ce que tes amis peuvent consulter sur ton
            profil Booklira.
          </p>

          {confidentialiteChargee && (
            <div className="privacy-toggle-list">
              <label className="privacy-toggle">
                <span>Mes livres lus</span>

                <input
                  type="checkbox"
                  checked={visibilite.livres}
                  onChange={() =>
                    basculerVisibilite("livres")
                  }
                  disabled={confidentialiteEnCours}
                />
              </label>

              <label className="privacy-toggle">
                <span>Mes notes (étoiles)</span>

                <input
                  type="checkbox"
                  checked={visibilite.notes}
                  onChange={() =>
                    basculerVisibilite("notes")
                  }
                  disabled={confidentialiteEnCours}
                />
              </label>

              <label className="privacy-toggle">
                <span>Mes statistiques</span>

                <input
                  type="checkbox"
                  checked={visibilite.stats}
                  onChange={() =>
                    basculerVisibilite("stats")
                  }
                  disabled={confidentialiteEnCours}
                />
              </label>
            </div>
          )}

          {messageConfidentialite && (
            <p className="profile-avatar-error">
              {messageConfidentialite}
            </p>
          )}
        </div>

        {/* =========================
            RAFRAÎCHIR L'APPLICATION
        ========================= */}

        <div className="profile-data-zone profile-refresh-zone">
          <button
            type="button"
            className="profile-refresh-btn"
            onClick={() => window.location.reload()}
          >
            🔄 Rafraîchir l'application
          </button>
        </div>

        {/* =========================
            IMPORT DES DONNÉES
        ========================= */}

        <div className="profile-data-zone profile-import-zone">
          <h2>Importer mes données</h2>
          <p className="profile-data-text">
            Mets à jour tes livres depuis un fichier CSV Booklira.
          </p>
          <ImportCSV />
        </div>

        {/* =========================
            GESTION DES DONNÉES
        ========================= */}

        <div className="profile-data-zone">
          <h2>Mes données</h2>

          <p className="profile-data-text">
            Exporte une copie de tes données ou supprime
            définitivement ton compte, conformément au RGPD.
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
            <p className="profile-avatar-error">
              {erreurExport}
            </p>
          )}

          <div className="profile-danger-zone">
            {!confirmationSuppression ? (
              <button
                type="button"
                className="profile-delete-btn"
                onClick={() =>
                  setConfirmationSuppression(true)
                }
              >
                🗑 Supprimer mon compte
              </button>
            ) : (
              <div className="profile-delete-confirm">
                <p>
                  Cette action est irréversible : ton compte
                  et tous tes livres seront définitivement
                  supprimés. Confirmes-tu ?
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
                    onClick={() =>
                      setConfirmationSuppression(false)
                    }
                    disabled={suppressionEnCours}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {erreurSuppression && (
              <p className="profile-avatar-error">
                {erreurSuppression}
              </p>
            )}
          </div>
        </div>

        <div className="profile-legal-links">
          <Link to="/legal/mentions">
            Mentions légales
          </Link>

          <span aria-hidden="true">·</span>

          <Link to="/legal/cgu">
            CGU
          </Link>

          <span aria-hidden="true">·</span>

          <Link to="/legal/confidentialite">
            Confidentialité
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Profile;
