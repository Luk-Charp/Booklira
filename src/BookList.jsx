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
import "./BookList.css";

const STATUTS = [
  { key: "a_lire", label: "À lire" },
  { key: "en_cours", label: "En cours" },
  { key: "lu", label: "Lu" },
];

function BookList() {
  const [books, setBooks] = useState([]);
  const [filtre, setFiltre] = useState("a_lire");

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

  const supprimerLivre = async (id) => {
    await deleteDoc(doc(db, "books", id));
  };

  const livresFiltres = books.filter((b) => b.statut === filtre);

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

      {livresFiltres.length === 0 && (
        <p className="empty-message">Aucun livre dans cette catégorie.</p>
      )}

      <div className="books-grid">
        {livresFiltres.map((book) => (
          <div key={book.id} className="book-card">
            {book.couverture && <img src={book.couverture} alt={book.titre} />}
            <div className="book-info">
              <strong>{book.titre}</strong>
              <p>{book.auteur}</p>
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