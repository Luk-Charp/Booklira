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
  { key: "inacheve", label: "Inachevé" },
  { key: "abandonnee", label: "Série abandonnée" },
];

const TAILLE_MAX_IMAGE = 8 * 1024 * 1024;

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
  const [mode, setMode] = useState("recherche");

  // Recherche Open Library
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");

  // Ajout manuel
  const [manualTitre, setManualTitre] = useState("");
  const [manualAuteur, setManualAuteur] = useState("");
  const [manualAnnee, setManualAnnee] = useState("");
  const [manualPages, setManualPages] = useState("");
  const [manualStatut, setManualStatut] = useState("a_lire");
  const [selectedCover, setSelectedCover] = useState("");
  const [rechercheInfosEnCours, setRechercheInfosEnCours] = useState(false);
  const [uploadCouvertureEnCours, setUploadCouvertureEnCours] = useState(false);
  const [erreurUploadCouverture, setErreurUploadCouverture] = useState("");
  const [messageManuel, setMessageManuel] = useState("");

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

      if (!res.ok) throw new Error(`Open Library (${res.status})`);

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

      setResults((precedent) =>
        precedent.filter((item) => item.id !== book.id)
      );
      setMessage(`"${titre}" a été ajouté à ta bibliothèque.`);
    } catch (err) {
      console.error("Erreur ajout livre :", err);
      setMessage("Impossible d'ajouter ce livre pour le moment.");
    } finally {
      setAddingId(null);
    }
  };

  const rechercherInfosAuto = async () => {
    if (!manualTitre.trim()) return;

    setRechercheInfosEnCours(true);

    try {
      const requete = `${manualTitre} ${manualAuteur}`.trim();
      const champs = "first_publish_year,number_of_pages_median";
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          requete
        )}&limit=1&fields=${champs}`
      );
      const data = await res.json();
      const info = data.docs?.[0];

      if (info) {
        if (info.number_of_pages_median) {
          setManualPages(String(info.number_of_pages_median));
        }
        if (info.first_publish_year && !manualAnnee) {
          setManualAnnee(String(info.first_publish_year));
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

    setMessageManuel("");

    try {
      const titreFinal = manualTitre.trim();
      const auteurFinal = manualAuteur.trim() || "Auteur inconnu";

      if (await livreDejaPresent(titreFinal, auteurFinal)) {
        setMessageManuel("Ce livre est déjà dans ta bibliothèque.");
        return;
      }

      await addDoc(collection(db, "books"), {
        titre: titreFinal,
        auteur: auteurFinal,
        couverture: selectedCover || "",
        annee: manualAnnee ? parseInt(manualAnnee, 10) : null,
        pages: manualPages ? parseInt(manualPages, 10) : null,
        statut: manualStatut,
        userId: auth.currentUser.uid,
        dateAjout: new Date().toISOString(),
      });

      resetManuel();
      setMessageManuel(`"${titreFinal}" a été ajouté à ta bibliothèque.`);
    } catch (err) {
      console.error("Erreur ajout livre manuel :", err);
      setMessageManuel("Impossible d'ajouter ce livre pour le moment.");
    }
  };

  return (
    <section className="search-page">
      <div className="search-page-header">
        <div>
          <span className="search-page-eyebrow">BIBLIOTHÈQUE</span>
          <h1>{mode === "recherche" ? "Rechercher" : "Ajouter un livre"}</h1>
          <p>
            {mode === "recherche"
              ? "Retrouve un livre sur Open Library et ajoute-le directement à ta bibliothèque."
              : "Ajoute un livre qui n'est pas disponible dans les résultats Open Library."
            }
          </p>
        </div>
      </div>

      <div className="search-mode-switch" role="tablist" aria-label="Mode d'ajout de livre">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "recherche"}
          className={mode === "recherche" ? "active" : ""}
          onClick={() => {
            setMode("recherche");
            setMessageManuel("");
          }}
        >
          Recherche de livre
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manuel"}
          className={mode === "manuel" ? "active" : ""}
          onClick={() => {
            setMode("manuel");
            setMessage("");
          }}
        >
          Ajout manuel
        </button>
      </div>

      {mode === "recherche" ? (
        <>
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
            <span>
              Résultats fournis par{" "}
              <a
                href="https://openlibrary.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Library
              </a>
            </span>
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
                      {STATUTS.slice(0, 3).map((statut) => (
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
        </>
      ) : (
        <form className="manual-search-form" onSubmit={handleManualSubmit}>
          <div className="manual-search-fields">
            <div className="manual-search-cover-picker">
              {selectedCover ? (
                <img
                  src={selectedCover}
                  alt="Couverture choisie"
                  className="manual-search-cover"
                />
              ) : (
                <div className="manual-search-cover-placeholder">
                  <span>📖</span>
                  Pas de couverture
                </div>
              )}

              <label className="manual-search-cover-btn">
                {uploadCouvertureEnCours
                  ? "Import en cours..."
                  : selectedCover
                  ? "Changer la couverture"
                  : "📁 Importer une couverture"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadCouvertureEnCours}
                  onChange={handleCoverFileChange}
                />
              </label>

              {erreurUploadCouverture && (
                <p className="manual-search-error">{erreurUploadCouverture}</p>
              )}
            </div>

            <div className="manual-search-inputs">
              <label>
                <span>Titre *</span>
                <input
                  type="text"
                  value={manualTitre}
                  onChange={(e) => setManualTitre(e.target.value)}
                  placeholder="Titre du livre"
                  required
                />
              </label>

              <label>
                <span>Auteur</span>
                <input
                  type="text"
                  value={manualAuteur}
                  onChange={(e) => setManualAuteur(e.target.value)}
                  placeholder="Nom de l'auteur"
                />
              </label>

              <div className="manual-search-row">
                <label>
                  <span>Année</span>
                  <input
                    type="number"
                    value={manualAnnee}
                    onChange={(e) => setManualAnnee(e.target.value)}
                    placeholder="2026"
                  />
                </label>

                <label>
                  <span>Pages</span>
                  <input
                    type="number"
                    value={manualPages}
                    onChange={(e) => setManualPages(e.target.value)}
                    placeholder="320"
                  />
                </label>
              </div>

              <button
                type="button"
                className="manual-search-auto"
                onClick={rechercherInfosAuto}
                disabled={!manualTitre.trim() || rechercheInfosEnCours}
              >
                {rechercheInfosEnCours
                  ? "Recherche des informations..."
                  : "✨ Remplir automatiquement l'année et les pages"}
              </button>

              <label>
                <span>Statut</span>
                <select
                  value={manualStatut}
                  onChange={(e) => setManualStatut(e.target.value)}
                >
                  {STATUTS.map((statut) => (
                    <option key={statut.key} value={statut.key}>
                      {statut.label}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="manual-search-submit">
                Ajouter à ma bibliothèque
              </button>

              {messageManuel && (
                <p className="search-page-message">{messageManuel}</p>
              )}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

export default SearchPage;
