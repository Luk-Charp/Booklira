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
  const [uploadCouvertureEnCours, setUploadCouvertureEnCours] = useState(false);
  const [erreurUploadCouverture, setErreurUploadCouverture] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "books"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livresRecuperes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBooks(livresRecuperes);
    });

    return () => unsubscribe();
  }, []);

  const changerStatut = async (id, nouveauStatut) => {
    await updateDoc(doc(db, "books", id), { statut: nouveauStatut });
  };

  const changerNote = async (id, nouvelleNote) => {
    await updateDoc(doc(db, "books", id), { note: nouvelleNote });
  };

  const importerCouvertureDepuisGalerie = async (id, fichier) => {
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setErreurUploadCouverture("Merci de choisir un fichier image.");
      return;
    }
    if (fichier.size > TAILLE_MAX_IMAGE) {
      setErreurUploadCouverture("Image trop lourde (8 Mo maximum).");
      return;
    }

    setErreurUploadCouverture("");
    setUploadCouvertureEnCours(true);
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

      await updateDoc(doc(db, "books", id), { couverture: data.secure_url });
      setEditionCouverture(null);
    } catch (err) {
      console.error("Erreur upload couverture :", err);
      setErreurUploadCouverture("L'import a échoué, réessaie.");
    } finally {
      setUploadCouvertureEnCours(false);
    }
  };

  const supprimerLivre = async (id) => {
    await deleteDoc(doc(db, "books", id));
  };

  const trierLivres = (liste) => {
    const copie = [...liste];
    switch (tri) {
      case "auteur":
        return copie.sort((a, b) => {
          const comparaisonAuteur = (a.auteur || "").localeCompare(
            b.auteur || ""
          );
          if (comparaisonAuteur !== 0) return comparaisonAuteur;
          return (a.annee || 0) - (b.annee || 0);
        });
      case "note_desc":
        return copie.sort((a, b) => (b.note || 0) - (a.note || 0));
      case "note_asc":
        return copie.sort((a, b) => (a.note || 0) - (b.note || 0));
      case "date":
      default:
        return copie.sort(
          (a, b) => new Date(b.dateAjout) - new Date(a.dateAjout)
        );
    }
  };

  const livresFiltres = trierLivres(books.filter((b) => b.statut === filtre));

  return (
    <div className="book-list">
      <div className="tabs">
        {STATUTS.map((s) => (
          <button
            key={s.key}
            className={filtre === s.key ? "tab active" : "tab"}
            onClick={() => setFiltre(s.key)}
          >
            {s.label} ({books.filter((b) => b.statut === s.key).length})
          </button>
        ))}
      </div>

      <div className="sort-bar">
        <label htmlFor="tri-select">Trier par : </label>
        <select
          id="tri-select"
          value={tri}
          onChange={(e) => setTri(e.target.value)}
        >
          {TRIS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {livresFiltres.length === 0 && (
        <p className="empty-message">Aucun livre dans cette catégorie.</p>
      )}

      <div className="books-grid">
        {livresFiltres.map((book) => (
          <div key={book.id} className={`book-card spine-${book.statut}`}>
            <div className="cover-wrapper">
              {book.couverture ? (
                <img
                  src={book.couverture}
                  alt={book.titre}
                  onLoad={(e) => e.target.classList.add("loaded")}
                />
              ) : (
                <div className="cover-placeholder">
                  <span className="cover-placeholder-icon">📖</span>
                  Pas de couverture
                </div>
              )}

              <button
                className="edit-cover-btn"
                onClick={() => {
                  setErreurUploadCouverture("");
                  setEditionCouverture(
                    editionCouverture === book.id ? null : book.id
                  );
                }}
              >
                ✎
              </button>

              {editionCouverture === book.id && (
                <div className="edit-cover-panel">
                  <p className="cover-search-status">
                    Importe une photo depuis ta galerie.
                  </p>

                  <label className="import-cover-btn">
                    {uploadCouvertureEnCours
                      ? "Import en cours..."
                      : "📁 Choisir une image"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadCouvertureEnCours}
                      onChange={(e) =>
                        importerCouvertureDepuisGalerie(
                          book.id,
                          e.target.files[0]
                        )
                      }
                    />
                  </label>

                  {erreurUploadCouverture && (
                    <p className="cover-upload-error">{erreurUploadCouverture}</p>
                  )}

                  <button
                    className="cancel-cover-btn"
                    onClick={() => setEditionCouverture(null)}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            <div className="book-info">
              <strong>{book.titre}</strong>
              <p>{book.auteur}</p>
              {book.pages ? <p className="book-pages">{book.pages} pages</p> : null}

              {filtre === "lu" && (
                <StarRating
                  note={book.note || 0}
                  onChange={(valeur) => changerNote(book.id, valeur)}
                />
              )}

              <div className="book-actions">
                <select
                  value={book.statut}
                  onChange={(e) => changerStatut(book.id, e.target.value)}
                >
                  {STATUTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  className="delete-btn"
                  onClick={() => supprimerLivre(book.id)}
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
