import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./AddBookForm.css";

const STATUTS = [
  { key: "a_lire", label: "À lire" },
  { key: "en_cours", label: "En cours" },
  { key: "lu", label: "Lu" },
  { key: "abandonnee", label: "Série abandonnée" },
];

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo

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
  const [manualPages, setManualPages] = useState("");
  const [manualStatut, setManualStatut] = useState("a_lire");
  const [rechercheInfosEnCours, setRechercheInfosEnCours] = useState(false);

  // --- Couverture importée depuis la galerie (mode manuel) ---
  const [selectedCover, setSelectedCover] = useState("");
  const [uploadCouvertureEnCours, setUploadCouvertureEnCours] = useState(false);
  const [erreurUploadCouverture, setErreurUploadCouverture] = useState("");

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
        pages: info.pageCount || null,
        statut: statut,
        userId: auth.currentUser.uid,
        dateAjout: new Date().toISOString(),
      });
      // On reste sur la recherche : on retire juste le livre ajouté
      // de la liste, la requête et les autres résultats restent affichés.
      setResults((precedent) => precedent.filter((b) => b.id !== book.id));
    } catch (err) {
      console.error("Erreur ajout livre :", err);
    }
  };

  // Va chercher automatiquement le nombre de pages (et l'année si vide)
  // sur Google Books à partir du titre/auteur tapés en ajout manuel.
  const rechercherInfosAuto = async () => {
    if (!manualTitre.trim()) return;
    setRechercheInfosEnCours(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
      const requete = `${manualTitre} ${manualAuteur}`.trim();
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(requete)}&maxResults=1&key=${apiKey}`
      );
      const data = await res.json();
      const info = data.items?.[0]?.volumeInfo;
      if (info) {
        if (info.pageCount) setManualPages(String(info.pageCount));
        if (info.publishedDate && !manualAnnee) {
          setManualAnnee(info.publishedDate.slice(0, 4));
        }
      }
    } catch (err) {
      console.error("Erreur recherche infos auto :", err);
    } finally {
      setRechercheInfosEnCours(false);
    }
  };

  const handleCoverFileChange = async (e) => {
    const fichier = e.target.files[0];
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
      setSelectedCover(data.secure_url);
    } catch (err) {
      console.error("Erreur upload couverture :", err);
      setErreurUploadCouverture("L'import a échoué, réessaie.");
    } finally {
      setUploadCouvertureEnCours(false);
      e.target.value = "";
    }
  };

  const resetManuel = () => {
    setManualTitre("");
    setManualAuteur("");
    setManualAnnee("");
    setManualPages("");
    setManualStatut("a_lire");
    setSelectedCover("");
    setErreurUploadCouverture("");
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
        pages: manualPages ? parseInt(manualPages, 10) : null,
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

          <p className="search-attribution">
            Résultats fournis par{" "}
            <a
              href="https://developers.google.com/books"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Books
            </a>
          </p>

          {loading && <p>Recherche...</p>}

          <div className="search-results">
            {results.map((book) => {
              const info = book.volumeInfo;
              return (
                <div key={book.id} className="search-result-item">
                  {info.imageLinks?.thumbnail && (
                    <img
                      src={info.imageLinks.thumbnail}
                      alt={info.title}
                      onLoad={(e) => e.target.classList.add("loaded")}
                    />
                  )}
                  <div className="search-result-info">
                    <strong>{info.title}</strong>
                    <p>{info.authors ? info.authors.join(", ") : "Auteur inconnu"}</p>
                    {info.pageCount ? (
                      <p className="search-result-pages">{info.pageCount} pages</p>
                    ) : null}
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
                <img
                  src={selectedCover}
                  alt="Couverture choisie"
                  className="manual-cover-preview"
                  onLoad={(e) => e.target.classList.add("loaded")}
                />
              ) : (
                <div className="manual-cover-placeholder">
                  <span className="manual-cover-placeholder-icon">📖</span>
                  Pas de couverture
                </div>
              )}

              <label className="cover-search-btn">
                {uploadCouvertureEnCours
                  ? "Import en cours..."
                  : selectedCover
                  ? "Changer la couverture"
                  : "📁 Importer depuis la galerie"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadCouvertureEnCours}
                  onChange={handleCoverFileChange}
                />
              </label>

              {erreurUploadCouverture && (
                <p className="cover-upload-error">{erreurUploadCouverture}</p>
              )}
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

              <div className="pages-row">
                <input
                  type="number"
                  placeholder="Pages"
                  value={manualPages}
                  onChange={(e) => setManualPages(e.target.value)}
                />
                <button
                  type="button"
                  className="auto-infos-btn"
                  onClick={rechercherInfosAuto}
                  disabled={!manualTitre.trim() || rechercheInfosEnCours}
                  title="Récupérer automatiquement le nombre de pages et l'année"
                >
                  {rechercheInfosEnCours ? "..." : "🔍 Auto"}
                </button>
              </div>

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
        </form>
      )}
    </div>
  );
}

export default AddBookForm;
