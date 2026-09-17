import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
import { rechercherCouvertures } from "./coverSearch";
import "./BookList.css";

const STATUTS = [
  { key: "lu", label: "Lus" },
  { key: "en_cours", label: "En cours" },
  { key: "a_lire", label: "À lire" },
  { key: "inacheve", label: "Inachevées" },
  { key: "abandonnee", label: "Séries abandonnées" },
];

const TRIS = [
  { key: "auteur", label: "Auteur (A-Z)" },
  { key: "note_desc", label: "Note (meilleure d'abord)" },
  { key: "note_asc", label: "Note (pire d'abord)" },
  { key: "titre", label: "Titre (A-Z)" },
];

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo

function normaliserTexte(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function BookList() {
  const navigate = useNavigate();

  const [books, setBooks] = useState([]);
  const [filtre, setFiltre] = useState(
    sessionStorage.getItem("filtreLivres") || "lu"
  );
  const [tri, setTri] = useState("auteur");
  const [vueCompacte, setVueCompacte] = useState(sessionStorage.getItem("vueCompacte") === "true");
  const [recherche, setRecherche] = useState(
    sessionStorage.getItem("rechercheLivres") || ""
  );

  const [confirmationSuppression, setConfirmationSuppression] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const [editionCouverture, setEditionCouverture] = useState(null);

  const [uploadCouvertureEnCours, setUploadCouvertureEnCours] =
    useState(false);

  const [erreurUploadCouverture, setErreurUploadCouverture] =
    useState("");

  // --- Suggestions de couvertures trouvées automatiquement ---
  const [suggestionsCouverture, setSuggestionsCouverture] = useState([]);
  const [rechercheCouvertureEnCours, setRechercheCouvertureEnCours] =
    useState(false);

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

  useEffect(() => {
    const positionSauvegardee = sessionStorage.getItem("bookListScrollY");
    if (positionSauvegardee !== null && books.length > 0) {
      window.scrollTo(0, parseInt(positionSauvegardee, 10));
      sessionStorage.removeItem("bookListScrollY");
    }
  }, [books]);

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

      const formData = new FormData();
      formData.append("file", fichier);
      formData.append("upload_preset", uploadPreset);

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let erreurCloudinary = null;

        try {
          erreurCloudinary = await res.json();
        } catch {
          // Rien si Cloudinary ne renvoie pas du JSON
        }

        const message =
          erreurCloudinary?.error?.message ||
          `Cloudinary a refusé l'image (${res.status})`;

        throw new Error(message);
      }

      const data = await res.json();

      if (!data.secure_url) {
        throw new Error("Cloudinary n'a pas retourné d'URL d'image.");
      }

      await updateDoc(doc(db, "books", id), {
        couverture: data.secure_url,
      });

      setEditionCouverture(null);
      setErreurUploadCouverture("");
    } catch (err) {
      console.error("Erreur complète upload couverture :", err);

      setErreurUploadCouverture(
        err.message || "L'import a échoué, réessaie."
      );
    } finally {
      setUploadCouvertureEnCours(false);
    }
  };

  // Lance la recherche automatique de couvertures possibles pour un livre
  // (appelée dès l'ouverture du panneau d'édition de couverture).
  const rechercherCouverturesPourLivre = async (book) => {
    setRechercheCouvertureEnCours(true);
    setSuggestionsCouverture([]);

    const resultats = await rechercherCouvertures(book.titre, book.auteur);

    setSuggestionsCouverture(resultats);
    setRechercheCouvertureEnCours(false);
  };

  const choisirCouvertureTrouvee = async (id, urlCouverture) => {
    try {
      await updateDoc(doc(db, "books", id), {
        couverture: urlCouverture,
      });

      setEditionCouverture(null);
      setSuggestionsCouverture([]);
    } catch (err) {
      console.error("Erreur mise à jour couverture :", err);
      setErreurUploadCouverture("Impossible d'appliquer cette couverture.");
    }
  };

  const supprimerLivre = async () => {
    if (!confirmationSuppression?.id) return;

    setSuppressionEnCours(true);

    try {
      await deleteDoc(doc(db, "books", confirmationSuppression.id));
      setConfirmationSuppression(null);
    } catch (err) {
      console.error("Erreur suppression livre :", err);
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const trierLivres = (liste) => {
    const copie = [...liste];

    switch (tri) {
      case "auteur":
        return copie.sort((a, b) => {
          const comparaisonAuteur = (a.auteur || "").localeCompare(
            b.auteur || "",
            "fr",
            { sensitivity: "base" }
          );

          if (comparaisonAuteur !== 0) {
            return comparaisonAuteur;
          }

          return (a.titre || "").localeCompare(b.titre || "", "fr", {
            sensitivity: "base",
          });
        });

      case "note_desc":
        return copie.sort((a, b) => {
          const noteA = Number(a.note) || 0;
          const noteB = Number(b.note) || 0;

          if (noteA !== noteB) {
            return noteB - noteA;
          }

          return (a.titre || "").localeCompare(b.titre || "", "fr", {
            sensitivity: "base",
          });
        });

      case "note_asc":
        return copie.sort((a, b) => {
          const noteA = Number(a.note) || 0;
          const noteB = Number(b.note) || 0;

          if (noteA !== noteB) {
            return noteA - noteB;
          }

          return (a.titre || "").localeCompare(b.titre || "", "fr", {
            sensitivity: "base",
          });
        });

      case "titre":
      default:
        return copie.sort((a, b) =>
          (a.titre || "").localeCompare(b.titre || "", "fr", {
            sensitivity: "base",
          })
        );
    }
  };

  const rechercheNormalisee = normaliserTexte(recherche);

  const livresFiltres = trierLivres(
    books.filter((b) => {
      if (b.statut !== filtre) return false;
      if (!rechercheNormalisee) return true;

      const champs = [
        b.titre,
        b.auteur,
        b.annee,
        b.pages,
        b.annee,
        b.tome ? `tome ${b.tome}` : "",
        b.description,
        b.notePerso,
      ];

      return champs
        .map(normaliserTexte)
        .some((champ) => champ.includes(rechercheNormalisee));
    })
  );

  const allerVersLivre = (bookId) => {
    sessionStorage.setItem("bookListScrollY", window.scrollY);
    navigate(`/book/${bookId}`);
  };

  return (
    <div className="book-list">
      {/* ----------------------------- */}
      {/* Onglets statut */}
      {/* ----------------------------- */}

      <div className="tabs">
        {STATUTS.map((s) => (
          <button
            key={s.key}
            className={filtre === s.key ? "tab active" : "tab"}
            onClick={() => {
              setFiltre(s.key);
              sessionStorage.setItem("filtreLivres", s.key);
            }}
          >
            {s.label} ({books.filter((b) => b.statut === s.key).length})
          </button>
        ))}
      </div>

      {/* ----------------------------- */}
      {/* Tri + bascule vue */}
      {/* ----------------------------- */}

      <div className="library-tools">
        <label className="library-search">
          <span>Rechercher</span>
          <input
            type="search"
            placeholder="Titre, auteur, année..."
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              sessionStorage.setItem("rechercheLivres", e.target.value);
            }}
          />
        </label>
      </div>

      <div className="sort-bar">
        <button
          type="button"
          className="view-toggle-btn"
          onClick={() => {
            const nouvelleValeur = !vueCompacte;
            setVueCompacte(nouvelleValeur);
            sessionStorage.setItem("vueCompacte", nouvelleValeur);
          }}
          title={vueCompacte ? "Vue grille" : "Vue compacte"}
        >
          {vueCompacte ? "⊞ Grille" : "☰ Compact"}
        </button>

        <label htmlFor="tri-select">Trier par :</label>

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

      {/* ----------------------------- */}
      {/* Aucun livre */}
      {/* ----------------------------- */}

      {livresFiltres.length === 0 && (
        <p className="empty-message">
          {rechercheNormalisee
            ? "Aucun livre ne correspond à cette recherche."
            : "Aucun livre dans cette catégorie."}
        </p>
      )}

      {/* ----------------------------- */}
      {/* Vue compacte */}
      {/* ----------------------------- */}

      {vueCompacte ? (
        <div className="books-compact-list">
          {livresFiltres.map((book) => (
            <div
              key={book.id}
              className="book-compact-row"
              onClick={() => allerVersLivre(book.id)}
            >
              <div className="book-compact-cover">
                {book.couverture ? (
                  <img src={book.couverture} alt={book.titre} />
                ) : (
                  <span className="book-compact-placeholder">📖</span>
                )}
              </div>
              <span className="book-compact-titre">{book.titre}</span>
            </div>
          ))}
        </div>
      ) : (
        /* ----------------------------- */
        /* Vue grille (habituelle) */
        /* ----------------------------- */

        <div className="books-grid">
          {livresFiltres.map((book) => (
            <div key={book.id} className={`book-card spine-${book.statut}`}>
              {/* ----------------------------- */}
              {/* Couverture */}
              {/* ----------------------------- */}

              <div className="cover-wrapper">
                <div
                  className="cover-clickable"
                  onClick={() => allerVersLivre(book.id)}
                >
                  {book.couverture ? (
                    <img
                      src={book.couverture}
                      alt={book.titre}
                      onLoad={(e) => e.target.classList.add("loaded")}
                      onError={(e) => {
                        console.error(
                          "Erreur chargement couverture :",
                          book.couverture
                        );

                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="cover-placeholder">
                      <span className="cover-placeholder-icon">📖</span>
                      Pas de couverture
                    </div>
                  )}
                </div>

                {/* ----------------------------- */}
                {/* Bouton modifier couverture */}
                {/* ----------------------------- */}

                <button
                  className="edit-cover-btn"
                  onClick={() => {
                    setErreurUploadCouverture("");

                    const nouvelId =
                      editionCouverture === book.id ? null : book.id;

                    setEditionCouverture(nouvelId);
                    setSuggestionsCouverture([]);

                    if (nouvelId) {
                      rechercherCouverturesPourLivre(book);
                    }
                  }}
                >
                  ✎
                </button>

                {/* ----------------------------- */}
                {/* Panneau import */}
                {/* ----------------------------- */}

                {editionCouverture === book.id &&
                  createPortal(
                    <div className="cover-modal-layer">
                      <div
                        className="edit-cover-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Choisir une couverture pour ${book.titre}`}
                      >
                        <div className="cover-edit-header">
                          <div className="cover-edit-heading">
                            <span className="cover-edit-eyebrow">
                              Couverture
                            </span>
                            <strong>Choisir une couverture</strong>
                            <span>{book.titre}</span>
                          </div>

                          <button
                            type="button"
                            className="cover-edit-close"
                            onClick={() => {
                              setEditionCouverture(null);
                              setErreurUploadCouverture("");
                              setSuggestionsCouverture([]);
                            }}
                            aria-label="Fermer"
                          >
                            ×
                          </button>
                        </div>

                        <p className="cover-search-status">
                          {rechercheCouvertureEnCours
                            ? "Recherche de couvertures..."
                            : suggestionsCouverture.length > 0
                            ? "Choisis une couverture, ou importe la tienne :"
                            : "Aucune couverture trouvée. Importe la tienne :"}
                        </p>

                        {suggestionsCouverture.length > 0 && (
                          <>
                            <div className="cover-suggestions-grid">
                              {suggestionsCouverture.map((c, index) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="cover-suggestion-card"
                                  onClick={() =>
                                    choisirCouvertureTrouvee(book.id, c.large)
                                  }
                                  aria-label={`Choisir la couverture ${index + 1}`}
                                >
                                  <span className="cover-suggestion-image">
                                    <img
                                      src={c.thumbnail}
                                      alt=""
                                      className="cover-suggestion-item"
                                      loading="lazy"
                                    />
                                  </span>
                                  <span className="cover-suggestion-label">
                                    Option {index + 1}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <p className="cover-suggestions-attribution">
                              Couvertures fournies par{" "}
                              <a
                                href="https://openlibrary.org"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open Library
                              </a>
                            </p>
                          </>
                        )}

                        <label className="import-cover-btn">
                          <span>
                            {uploadCouvertureEnCours
                              ? "Import en cours..."
                              : "📁 Choisir ma propre couverture"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={uploadCouvertureEnCours}
                            onChange={(e) => {
                              const fichier = e.target.files?.[0];
                              importerCouvertureDepuisGalerie(
                                book.id,
                                fichier
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {erreurUploadCouverture && (
                          <p className="cover-upload-error">
                            {erreurUploadCouverture}
                          </p>
                        )}

                        <button
                          type="button"
                          className="cancel-cover-btn"
                          onClick={() => {
                            setEditionCouverture(null);
                            setErreurUploadCouverture("");
                            setSuggestionsCouverture([]);
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>,
                    document.body,
                    book.id
                  )}
              </div>

              {/* ----------------------------- */}
              {/* Informations livre */}
              {/* ----------------------------- */}

              <div className="book-info">
                <div className="book-title-row">
                  <strong>{book.titre}</strong>
                  <span className={`book-status status-${book.statut}`}>
                    {STATUTS.find((s) => s.key === book.statut)?.label || book.statut}
                  </span>
                </div>

                <p>{book.auteur}</p>

                <div className="book-meta">
                  {book.annee ? <span>{book.annee}</span> : null}
                  {book.pages ? <span>{book.pages} pages</span> : null}
                  {book.tome ? <span>Tome {book.tome}</span> : null}
                </div>

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
                    aria-label={`Statut de ${book.titre}`}
                  >
                    {STATUTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="edit-book-btn"
                    onClick={() => allerVersLivre(book.id)}
                    title={`Modifier ${book.titre}`}
                    aria-label={`Modifier ${book.titre}`}
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => setConfirmationSuppression({
                      id: book.id,
                      titre: book.titre,
                    })}
                    title={`Supprimer ${book.titre}`}
                    aria-label={`Supprimer ${book.titre}`}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmationSuppression &&
        createPortal(
          <div
            className="delete-modal-layer"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !suppressionEnCours) {
                setConfirmationSuppression(null);
              }
            }}
          >
            <div
              className="delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
            >
              <span className="delete-modal-eyebrow">Suppression</span>
              <h2 id="delete-modal-title">Supprimer ce livre ?</h2>
              <p>
                Tu es sur le point de supprimer <strong>
                  {confirmationSuppression.titre}
                </strong> de ta bibliothèque. Cette action est définitive.
              </p>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="delete-modal-cancel"
                  onClick={() => setConfirmationSuppression(null)}
                  disabled={suppressionEnCours}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="delete-modal-confirm"
                  onClick={supprimerLivre}
                  disabled={suppressionEnCours}
                >
                  {suppressionEnCours ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default BookList;
