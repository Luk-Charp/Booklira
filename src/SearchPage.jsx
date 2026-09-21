import { useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./SearchPage.css";

const STATUTS = [
  { key: "a_lire", label: "À lire" },
  { key: "en_cours", label: "En cours" },
  { key: "lu", label: "Lu" },
];

function normaliserTexte(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normaliserLivre(doc) {
  return {
    id: doc.key,
    volumeInfo: {
      title: doc.title,
      authors: doc.author_name || null,
      imageLinks: doc.cover_i
        ? {
            thumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
            large: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          }
        : undefined,
      publishedDate: doc.first_publish_year
        ? String(doc.first_publish_year)
        : undefined,
      pageCount: doc.number_of_pages_median || undefined,
    },
  };
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");

  const livreDejaPresent = async (titre, auteur) => {
    if (!auth.currentUser || !titre) return false;

    const q = firestoreQuery(
      collection(db, "books"),
      where("userId", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);
    const titreNormalise = normaliserTexte(titre);
    const auteurNormalise = normaliserTexte(auteur);

    return snapshot.docs.some((doc) => {
      const livre = doc.data();
      const memeTitre = normaliserTexte(livre.titre) === titreNormalise;
      const memeAuteur =
        !auteurNormalise ||
        !livre.auteur ||
        normaliserTexte(livre.auteur) === auteurNormalise;

      return memeTitre && memeAuteur;
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    const recherche = query.trim();
    if (!recherche) return;

    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const champs =
        "key,title,author_name,first_publish_year,number_of_pages_median,cover_i";
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          recherche
        )}&limit=24&fields=${champs}`
      );

      if (!res.ok) {
        throw new Error(`Open Library (${res.status})`);
      }

      const data = await res.json();
      const livres = (data.docs || [])
        .filter((doc) => doc.title)
        .map(normaliserLivre);

      setResults(livres);

      if (!livres.length) {
        setMessage("Aucun livre trouvé pour cette recherche.");
      }
    } catch (err) {
      console.error("Erreur recherche Open Library :", err);
      setMessage("La recherche a échoué. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (book, statut) => {
    const info = book.volumeInfo;
    const titre = info.title || "Titre inconnu";
    const auteur = info.authors?.join(", ") || "Auteur inconnu";

    setAddingId(book.id);
    setMessage("");

    try {
      if (await livreDejaPresent(titre, auteur)) {
        setMessage(`"${titre}" est déjà dans ta bibliothèque.`);
        return;
      }

      await addDoc(collection(db, "books"), {
        titre,
        auteur,
        couverture: info.imageLinks?.thumbnail || "",
        annee: info.publishedDate
          ? parseInt(info.publishedDate.slice(0, 4), 10)
          : null,
        pages: info.pageCount || null,
        statut,
        userId: auth.currentUser.uid,
        dateAjout: new Date().toISOString(),
      });

      setResults((precedent) => precedent.filter((item) => item.id !== book.id));
      setMessage(`"${titre}" a été ajouté à ta bibliothèque.`);
    } catch (err) {
      console.error("Erreur ajout livre :", err);
      setMessage("Impossible d'ajouter ce livre pour le moment.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="search-page">
      <div className="search-page-header">
        <div>
          <span className="search-page-eyebrow">EXPLORER</span>
          <h1>Rechercher un livre</h1>
          <p>Retrouve un livre sur Open Library et ajoute-le directement à ta bibliothèque.</p>
        </div>
      </div>

      <form className="search-page-form" onSubmit={handleSearch}>
        <div className="search-page-input-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titre, auteur, série..."
            aria-label="Rechercher un livre"
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Recherche..." : "Rechercher"}
        </button>
      </form>

      <div className="search-page-meta">
        <span>Résultats fournis par <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a></span>
        {results.length > 0 && <strong>{results.length} résultats</strong>}
      </div>

      {message && <p className="search-page-message">{message}</p>}

      {!loading && !results.length && !message && (
        <div className="search-page-empty">
          <div className="search-page-empty-icon">⌕</div>
          <h2>Commence ta recherche</h2>
          <p>Entre le titre d'un livre, le nom d'un auteur ou une série.</p>
        </div>
      )}

      <div className="search-page-results">
        {results.map((book) => {
          const info = book.volumeInfo;
          const auteur = info.authors?.join(", ") || "Auteur inconnu";
          const isAdding = addingId === book.id;

          return (
            <article className="search-book-card" key={book.id}>
              <div className="search-book-cover-wrap">
                {info.imageLinks?.large || info.imageLinks?.thumbnail ? (
                  <img
                    src={info.imageLinks.large || info.imageLinks.thumbnail}
                    alt={`Couverture de ${info.title}`}
                    className="search-book-cover"
                    onError={(e) => {
                      if (e.currentTarget.src !== info.imageLinks?.thumbnail) {
                        e.currentTarget.src = info.imageLinks?.thumbnail || "";
                      }
                    }}
                  />
                ) : (
                  <div className="search-book-cover-placeholder">📖</div>
                )}
              </div>

              <div className="search-book-content">
                <span className="search-book-type">LIVRE</span>
                <h2>{info.title}</h2>
                <p className="search-book-author">{auteur}</p>

                <div className="search-book-details">
                  {info.publishedDate && <span>{info.publishedDate.slice(0, 4)}</span>}
                  {info.pageCount && <span>{info.pageCount} pages</span>}
                </div>

                <div className="search-book-actions">
                  {STATUTS.map((statut) => (
                    <button
                      key={statut.key}
                      type="button"
                      disabled={isAdding}
                      onClick={() => handleAdd(book, statut.key)}
                    >
                      {isAdding ? "Ajout..." : statut.label}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default SearchPage;
