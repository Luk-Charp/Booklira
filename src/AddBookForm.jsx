import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./AddBookForm.css";

function AddBookForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
        const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${apiKey}`
      );
      const data = await res.json();
      setResults(data.items || []);
    } catch (err) {
      console.error("Erreur recherche :", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (book, statut) => {
    const info = book.volumeInfo;
    try {
      await addDoc(collection(db, "books"), {
        titre: info.title || "Titre inconnu",
        auteur: info.authors ? info.authors.join(", ") : "Auteur inconnu",
        couverture: info.imageLinks?.thumbnail || "",
        statut: statut,
        userId: auth.currentUser.uid,
        dateAjout: new Date().toISOString(),
      });
      setResults([]);
      setQuery("");
    } catch (err) {
      console.error("Erreur ajout livre :", err);
    }
  };

  return (
    <div className="add-book-form">
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="Rechercher un livre (titre, auteur...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Rechercher</button>
      </form>

      {loading && <p>Recherche...</p>}

      <div className="search-results">
        {results.map((book) => {
          const info = book.volumeInfo;
          return (
            <div key={book.id} className="search-result-item">
              {info.imageLinks?.thumbnail && (
                <img src={info.imageLinks.thumbnail} alt={info.title} />
              )}
              <div className="search-result-info">
                <strong>{info.title}</strong>
                <p>{info.authors ? info.authors.join(", ") : "Auteur inconnu"}</p>
                <div className="search-result-actions">
                  <button onClick={() => handleAdd(book, "a_lire")}>À lire</button>
                  <button onClick={() => handleAdd(book, "en_cours")}>En cours</button>
                  <button onClick={() => handleAdd(book, "lu")}>Lu</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AddBookForm;