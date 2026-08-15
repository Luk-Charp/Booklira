import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import StarRating from "./StarRating";
import "./BookList.css";

const STATUTS = [
  { key: "a_lire", label: "À lire" },
  { key: "en_cours", label: "En cours" },
  { key: "lu", label: "Lu" },
];

const TRIS = [
  { key: "date", label: "Date d'ajout" },
  { key: "auteur", label: "Auteur (A-Z)" },
  { key: "note_desc", label: "Note (meilleure d'abord)" },
  { key: "note_asc", label: "Note (moins bonne d'abord)" },
];

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo

function BookList() {
  const [books, setBooks] = useState([]);
  const [filtre, setFiltre] = useState("a_lire");
  const [tri, setTri] = useState("date");

  const [editionCouverture, setEditionCouverture] = useState(null);

  const [uploadCouvertureEnCours, setUploadCouvertureEnCours] =
    useState(false);

  const [erreurUploadCouverture, setErreurUploadCouverture] =
    useState("");

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "books"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const livresRecuperes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setBooks(livresRecuperes);
      },
      (error) => {
        console.error("Erreur récupération livres :", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const changerStatut = async (id, nouveauStatut) => {
    try {
      await updateDoc(doc(db, "books", id), {
        statut: nouveauStatut,
      });
    } catch (err) {
      console.error("Erreur changement statut :", err);
    }
  };

  const changerNote = async (id, nouvelleNote) => {
    try {
      await updateDoc(doc(db, "books", id), {
        note: nouvelleNote,
      });
    } catch (err) {
      console.error("Erreur changement note :", err);
    }
  };

  const importerCouvertureDepuisGalerie = async (id, fichier) => {
    if (!fichier) return;

    // --------------------------------
    // Vérification du fichier
    // --------------------------------

    if (!fichier.type.startsWith("image/")) {
      setErreurUploadCouverture(
        "Merci de choisir un fichier image."
      );
      return;
    }

    if (fichier.size > TAILLE_MAX_IMAGE) {
      setErreurUploadCouverture(
        "Image trop lourde (8 Mo maximum)."
      );
      return;
    }

    setErreurUploadCouverture("");
    setUploadCouvertureEnCours(true);

    try {
      // --------------------------------
      // Vérification configuration Cloudinary
      // --------------------------------

      const cloudName =
        import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

      const uploadPreset =
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      console.log(
        "Cloudinary cloud name :",
        cloudName
      );

      console.log(
        "Cloudinary upload preset :",
        uploadPreset
      );

      if (!cloudName) {
        throw new Error(
          "VITE_CLOUDINARY_CLOUD_NAME est manquant dans le fichier .env"
        );
      }

      if (!uploadPreset) {
        throw new Error(
          "VITE_CLOUDINARY_UPLOAD_PRESET est manquant dans le fichier .env"
        );
      }

      // --------------------------------
      // Préparation upload
      // --------------------------------

      const formData = new FormData();

      formData.append("file", fichier);
      formData.append(
        "upload_preset",
        uploadPreset
      );

      const url =
        `https://api.cloudinary.com/v1_1/` +
        `${cloudName}/image/upload`;

      console.log(
        "Upload Cloudinary vers :",
        url
      );

      // --------------------------------
      // Upload Cloudinary
      // --------------------------------

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });

      // --------------------------------
      // Gestion erreur Cloudinary
      // --------------------------------

      if (!res.ok) {
        let erreurCloudinary = null;

        try {
          erreurCloudinary = await res.json();
        } catch {
          // Rien si Cloudinary ne renvoie pas du JSON
        }

        console.error(
          "Erreur Cloudinary :",
          erreurCloudinary
        );

        const message =
          erreurCloudinary?.error?.message ||
          `Cloudinary a refusé l'image (${res.status})`;

        throw new Error(message);
      }

      // --------------------------------
      // Récupération réponse
      // --------------------------------

      const data = await res.json();

      console.log(
        "Réponse Cloudinary :",
        data
      );

      if (!data.secure_url) {
        throw new Error(
          "Cloudinary n'a pas retourné d'URL d'image."
        );
      }

      // --------------------------------
      // Enregistrement URL dans Firebase
      // --------------------------------

      await updateDoc(
        doc(db, "books", id),
        {
          couverture: data.secure_url,
        }
      );

      console.log(
        "Couverture enregistrée dans Firebase."
      );

      // Fermeture du panneau
      setEditionCouverture(null);

      setErreurUploadCouverture("");

    } catch (err) {
      console.error(
        "Erreur complète upload couverture :",
        err
      );

      setErreurUploadCouverture(
        err.message ||
          "L'import a échoué, réessaie."
      );

    } finally {
      setUploadCouvertureEnCours(false);
    }
  };

  const supprimerLivre = async (id) => {
    try {
      await deleteDoc(doc(db, "books", id));
    } catch (err) {
      console.error(
        "Erreur suppression livre :",
        err
      );
    }
  };

  const trierLivres = (liste) => {
    const copie = [...liste];

    switch (tri) {
      case "auteur":
        return copie.sort((a, b) => {
          const comparaisonAuteur =
            (a.auteur || "").localeCompare(
              b.auteur || ""
            );

          if (comparaisonAuteur !== 0) {
            return comparaisonAuteur;
          }

          return (
            (a.annee || 0) -
            (b.annee || 0)
          );
        });

      case "note_desc":
        return copie.sort(
          (a, b) =>
            (b.note || 0) -
            (a.note || 0)
        );

      case "note_asc":
        return copie.sort(
          (a, b) =>
            (a.note || 0) -
            (b.note || 0)
        );

      case "date":
      default:
        return copie.sort(
          (a, b) =>
            new Date(b.dateAjout) -
            new Date(a.dateAjout)
        );
    }
  };

  const livresFiltres = trierLivres(
    books.filter(
      (b) => b.statut === filtre
    )
  );

  return (
    <div className="book-list">

      {/* ----------------------------- */}
      {/* Onglets statut */}
      {/* ----------------------------- */}

      <div className="tabs">
        {STATUTS.map((s) => (
          <button
            key={s.key}
            className={
              filtre === s.key
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setFiltre(s.key)
            }
          >
            {s.label} (
            {
              books.filter(
                (b) =>
                  b.statut === s.key
              ).length
            }
            )
          </button>
        ))}
      </div>

      {/* ----------------------------- */}
      {/* Tri */}
      {/* ----------------------------- */}

      <div className="sort-bar">
        <label htmlFor="tri-select">
          Trier par :
        </label>

        <select
          id="tri-select"
          value={tri}
          onChange={(e) =>
            setTri(e.target.value)
          }
        >
          {TRIS.map((t) => (
            <option
              key={t.key}
              value={t.key}
            >
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* ----------------------------- */}
      {/* Aucun livre */}
      {/* ----------------------------- */}

      {livresFiltres.length === 0 && (
        <p className="empty-message">
          Aucun livre dans cette catégorie.
        </p>
      )}

      {/* ----------------------------- */}
      {/* Livres */}
      {/* ----------------------------- */}

      <div className="books-grid">

        {livresFiltres.map((book) => (

          <div
            key={book.id}
            className={`book-card spine-${book.statut}`}
          >

            {/* ----------------------------- */}
            {/* Couverture */}
            {/* ----------------------------- */}

            <div className="cover-wrapper">

              {book.couverture ? (
                <img
                  src={book.couverture}
                  alt={book.titre}
                  onLoad={(e) =>
                    e.target.classList.add(
                      "loaded"
                    )
                  }
                  onError={(e) => {
                    console.error(
                      "Erreur chargement couverture :",
                      book.couverture
                    );

                    e.target.style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="cover-placeholder">
                  <span className="cover-placeholder-icon">
                    📖
                  </span>

                  Pas de couverture
                </div>
              )}

              {/* ----------------------------- */}
              {/* Bouton modifier couverture */}
              {/* ----------------------------- */}

              <button
                className="edit-cover-btn"
                onClick={() => {
                  setErreurUploadCouverture("");

                  setEditionCouverture(
                    editionCouverture === book.id
                      ? null
                      : book.id
                  );
                }}
              >
                ✎
              </button>

              {/* ----------------------------- */}
              {/* Panneau import */}
              {/* ----------------------------- */}

              {editionCouverture ===
                book.id && (

                <div className="edit-cover-panel">

                  <p className="cover-search-status">
                    Importe une photo depuis
                    ta galerie.
                  </p>

                  <label className="import-cover-btn">

                    {uploadCouvertureEnCours
                      ? "Import en cours..."
                      : "📁 Choisir une image"}

                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={
                        uploadCouvertureEnCours
                      }
                      onChange={(e) => {
                        const fichier =
                          e.target.files?.[0];

                        importerCouvertureDepuisGalerie(
                          book.id,
                          fichier
                        );

                        // Permet de sélectionner
                        // à nouveau le même fichier
                        e.target.value = "";
                      }}
                    />

                  </label>

                  {/* ----------------------------- */}
                  {/* Erreur */}
                  {/* ----------------------------- */}

                  {erreurUploadCouverture && (
                    <p className="cover-upload-error">
                      {erreurUploadCouverture}
                    </p>
                  )}

                  {/* ----------------------------- */}
                  {/* Annuler */}
                  {/* ----------------------------- */}

                  <button
                    className="cancel-cover-btn"
                    onClick={() => {
                      setEditionCouverture(
                        null
                      );

                      setErreurUploadCouverture(
                        ""
                      );
                    }}
                  >
                    Annuler
                  </button>

                </div>
              )}

            </div>

            {/* ----------------------------- */}
            {/* Informations livre */}
            {/* ----------------------------- */}

            <div className="book-info">

              <strong>
                {book.titre}
              </strong>

              <p>
                {book.auteur}
              </p>

              {book.pages ? (
                <p className="book-pages">
                  {book.pages} pages
                </p>
              ) : null}

              {/* ----------------------------- */}
              {/* Note */}
              {/* ----------------------------- */}

              {filtre === "lu" && (
                <StarRating
                  note={book.note || 0}
                  onChange={(valeur) =>
                    changerNote(
                      book.id,
                      valeur
                    )
                  }
                />
              )}

              {/* ----------------------------- */}
              {/* Actions */}
              {/* ----------------------------- */}

              <div className="book-actions">

                <select
                  value={book.statut}
                  onChange={(e) =>
                    changerStatut(
                      book.id,
                      e.target.value
                    )
                  }
                >
                  {STATUTS.map((s) => (
                    <option
                      key={s.key}
                      value={s.key}
                    >
                      {s.label}
                    </option>
                  ))}
                </select>

                <button
                  className="delete-btn"
                  onClick={() =>
                    supprimerLivre(
                      book.id
                    )
                  }
                >
                  🗑
                </button>

              </div>

            </div>

          </div>
        ))}

      </div>
    </div>
  );
}

export default BookList;