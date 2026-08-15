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

function BookList() {
  const [books, setBooks] = useState([]);
  const [filtre, setFiltre] = useState("a_lire");
  const [tri, setTri] = useState("date");
  const [editionCouverture, setEditionCouverture] = useState(null);
  const [resultatsCouverture, setResultatsCouverture] = useState([]);
  const [rechercheCouvertureEnCours, setRechercheCouvertureEnCours] =
    useState(false);

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

  const rechercherCouvertures = async (titre, auteur) => {
    setRechercheCouvertureEnCours(true);
    setResultatsCouverture([]);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
      const requete = `${titre} ${auteur}`;
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          requete
        )}&maxResults=12&key=${apiKey}`
      );
      const data = await res.json();
      const images = (data.items || [])
        .map((item) => item.volumeInfo.imageLinks?.thumbnail)
        .filter(Boolean);
      setResultatsCouverture([...new Set(images)]);
    } catch (err) {
      console.error("Erreur recherche couvertures :", err);
    } finally {
      setRechercheCouvertureEnCours(false);
    }
  };

  const choisirCouverture = async (id, url) => {
    await updateDoc(doc(db, "books", id), { couverture: url });
    setEditionCouverture(null);
    setResultatsCouverture([]);
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
                <img src={book.couverture} alt={book.titre} />
              ) : (
                <div className="cover-placeholder">Pas de couverture</div>
              )}

              <button
                className="edit-cover-btn"
                onClick={() => {
                  if (editionCouverture === book.id) {
                    setEditionCouverture(null);
                    setResultatsCouverture([]);
                  } else {
                    setEditionCouverture(book.id);
                    rechercherCouvertures(book.titre, book.auteur);
                  }
                }}
              >
                ✎
              </button>

              {editionCouverture === book.id && (
                <div className="edit-cover-panel">
                  {rechercheCouvertureEnCours && (
                    <p className="cover-search-status">Recherche...</p>
                  )}

                  {!rechercheCouvertureEnCours &&
                    resultatsCouverture.length === 0 && (
                      <p className="cover-search-status">
                        Aucune couverture trouvée.
                      </p>
                    )}

                  <div className="cover-options-grid">
                    {resultatsCouverture.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Option ${index + 1}`}
                        className="cover-option"
                        onClick={() => choisirCouverture(book.id, url)}
                      />
                    ))}
                  </div>

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
