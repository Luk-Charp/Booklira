import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./AddBookForm.css";

const STATUTS = [
  { key: "a_lire", label: "À lire" },
  { key: "en_cours", label: "En cours" },
  { key: "lu", label: "Lu" },
];

function AddBookForm() {
  const [mode, setMode] = useState("recherche"); // "recherche" | "manuel"

  // --- Recherche rapide (titre/auteur -> livres Google Books) ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Ajout manuel ---
  const [manualTitre, setManualTitre] = useState("");
  const [manualAuteur, setManualAuteur] = useState("");
  const [manualAnnee, setManualAnnee] = useState("");
  const [manualStatut, setManualStatut] = useState("a_lire");

  // --- Recherche de couverture indépendante (pour le mode manuel) ---
  const COVER_PAGE_SIZE = 12;
  const [showCoverSearch, setShowCoverSearch] = useState(false);
  const [coverQuery, setCoverQuery] = useState("");
  const [coverResults, setCoverResults] = useState([]);
  const [coverLoading, setCoverLoading] = useState(false);
  const [selectedCover, setSelectedCover] = useState("");
  const [coverStartIndex, setCoverStartIndex] = useState(0);
  const [coverTotalItems, setCoverTotalItems] = useState(0);

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
        annee: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null,
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

  const ouvrirRechercheCouverture = () => {
    setShowCoverSearch(true);
    setCoverQuery(`${manualTitre} ${manualAuteur}`.trim());
    setCoverResults([]);
    setCoverStartIndex(0);
    setCoverTotalItems(0);
  };

  const fetchCoverPage = async (startIndex) => {
    if (!coverQuery.trim()) return;
    setCoverLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          coverQuery
        )}&maxResults=${COVER_PAGE_SIZE}&startIndex=${startIndex}&key=${apiKey}`
      );
      const data = await res.json();
      const images = (data.items || [])
        .map((item) => item.volumeInfo.imageLinks?.thumbnail)
        .filter(Boolean);
      setCoverResults(images);
      setCoverTotalItems(data.totalItems || 0);
      setCoverStartIndex(startIndex);
    } catch (err) {
      console.error("Erreur recherche couverture :", err);
    } finally {
      setCoverLoading(false);
    }
  };

  const handleCoverSearch = (e) => {
    e.preventDefault();
    fetchCoverPage(0);
  };

  const pageCouverturePrecedente = () => {
    fetchCoverPage(Math.max(0, coverStartIndex - COVER_PAGE_SIZE));
  };

  const pageCouvertureSuivante = () => {
    fetchCoverPage(coverStartIndex + COVER_PAGE_SIZE);
  };

  const aPagePrecedente = coverStartIndex > 0;
  const aPageSuivante = coverStartIndex + COVER_PAGE_SIZE < coverTotalItems;
  const numeroPage = Math.floor(coverStartIndex / COVER_PAGE_SIZE) + 1;

  const choisirCouverture = (url) => {
    setSelectedCover(url);
    setShowCoverSearch(false);
  };

  const resetManuel = () => {
    setManualTitre("");
    setManualAuteur("");
    setManualAnnee("");
    setManualStatut("a_lire");
    setSelectedCover("");
    setShowCoverSearch(false);
    setCoverQuery("");
    setCoverResults([]);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualTitre.trim()) return;
    try {
      await addDoc(collection(db, "books"), {
        titre: manualTitre.trim(),
        auteur: manualAuteur.trim() || "Auteur inconnu",
        couverture: selectedCover || "",
        annee: manualAnnee ? parseInt(manualAnnee, 10) : null,
        statut: manualStatut,
        userId: auth.currentUser.uid,
        dateAjout: new Date().toISOString(),
      });
      resetManuel();
    } catch (err) {
      console.error("Erreur ajout livre (manuel) :", err);
    }
  };

  return (
    <div className="add-book-form">
      <div className="mode-tabs">
        <button
          type="button"
          className={mode === "recherche" ? "mode-tab active" : "mode-tab"}
          onClick={() => setMode("recherche")}
        >
          Recherche rapide
        </button>
        <button
          type="button"
          className={mode === "manuel" ? "mode-tab active" : "mode-tab"}
          onClick={() => setMode("manuel")}
        >
          Ajout manuel
        </button>
      </div>

      {mode === "recherche" && (
        <>
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
        </>
      )}

      {mode === "manuel" && (
        <form onSubmit={handleManualSubmit} className="manual-form">
          <div className="manual-fields">
            <div className="manual-cover-picker">
              {selectedCover ? (
                <img src={selectedCover} alt="Couverture choisie" className="manual-cover-preview" />
              ) : (
                <div className="manual-cover-placeholder">Pas de couverture</div>
              )}
              <button type="button" className="cover-search-btn" onClick={ouvrirRechercheCouverture}>
                {selectedCover ? "Changer la couverture" : "Choisir une couverture"}
              </button>
            </div>

            <div className="manual-inputs">
              <input
                type="text"
                placeholder="Titre *"
                value={manualTitre}
                onChange={(e) => setManualTitre(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Auteur"
                value={manualAuteur}
                onChange={(e) => setManualAuteur(e.target.value)}
              />
              <input
                type="number"
                placeholder="Année"
                value={manualAnnee}
                onChange={(e) => setManualAnnee(e.target.value)}
              />
              <select value={manualStatut} onChange={(e) => setManualStatut(e.target.value)}>
                {STATUTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="manual-submit-btn">
                Ajouter le livre
              </button>
            </div>
          </div>

          {showCoverSearch && (
            <div className="cover-search-panel">
              <form onSubmit={handleCoverSearch} className="cover-search-bar">
                <input
                  type="text"
                  placeholder="Chercher une couverture (titre, auteur...)"
                  value={coverQuery}
                  onChange={(e) => setCoverQuery(e.target.value)}
                />
                <button type="submit">Chercher</button>
                <button
                  type="button"
                  className="cover-search-close"
                  onClick={() => setShowCoverSearch(false)}
                >
                  Fermer
                </button>
              </form>

              {coverLoading && <p className="cover-search-status">Recherche...</p>}
              {!coverLoading && coverResults.length === 0 && (
                <p className="cover-search-status">
                  Tape un titre ou un auteur puis clique sur "Chercher".
                </p>
              )}

              <div className="cover-options-grid">
                {coverResults.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Option ${index + 1}`}
                    className="cover-option"
                    onClick={() => choisirCouverture(url)}
                  />
                ))}
              </div>

              {coverResults.length > 0 && (
                <div className="cover-pagination">
                  <button
                    type="button"
                    onClick={pageCouverturePrecedente}
                    disabled={!aPagePrecedente || coverLoading}
                  >
                    ◀ Précédent
                  </button>
                  <span className="cover-page-indicator">Page {numeroPage}</span>
                  <button
                    type="button"
                    onClick={pageCouvertureSuivante}
                    disabled={!aPageSuivante || coverLoading}
                  >
                    Suivant ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default AddBookForm;
