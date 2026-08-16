import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./Stats.css";

function Stats() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "books"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBooks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  const livresLus = books.filter((b) => b.statut === "lu");
  const totalPages = livresLus.reduce((somme, b) => somme + (b.pages || 0), 0);

  const notesValides = livresLus.filter((b) => b.note > 0);
  const noteMoyenne =
    notesValides.length > 0
      ? (
          notesValides.reduce((somme, b) => somme + b.note, 0) /
          notesValides.length
        ).toFixed(1)
      : null;

  // Répartition par auteur (livres lus uniquement)
  const parAuteur = {};
  livresLus.forEach((b) => {
    const nom = b.auteur || "Auteur inconnu";
    parAuteur[nom] = (parAuteur[nom] || 0) + 1;
  });
  const topAuteurs = Object.entries(parAuteur)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Répartition par année de lecture (basée sur dateAjout, année où tu l'as marqué "lu")
// Répartition par année de lecture (basée sur dateAjout, année où tu l'as marqué "lu")
    const parAnnee = {};
    livresLus.forEach((b) => {
    if (!b.dateAjout) return;
    const annee = new Date(b.dateAjout).getFullYear();
    parAnnee[annee] = (parAnnee[annee] || 0) + 1;
    });
    const anneesTriees = Object.entries(parAnnee).sort((a, b) => a[0] - b[0]);
    const maxParAnnee = Math.max(1, ...anneesTriees.map(([, n]) => n));

    const anneeCourante = new Date().getFullYear();
    const anneesDisponibles = anneesTriees.map(([annee]) => parseInt(annee, 10));
    const [anneeSelectionnee, setAnneeSelectionnee] = useState(
    anneesDisponibles.includes(anneeCourante)
        ? anneeCourante
        : anneesDisponibles[anneesDisponibles.length - 1] || anneeCourante
    );

    const NOMS_MOIS = [
    "Janv", "Fév", "Mars", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
    ];

    const parMois = Array(12).fill(0);
    livresLus.forEach((b) => {
    if (!b.dateAjout) return;
    const date = new Date(b.dateAjout);
    if (date.getFullYear() === anneeSelectionnee) {
        parMois[date.getMonth()]++;
    }
    });
    const maxParMois = Math.max(1, ...parMois);

    const [moisSelectionne, setMoisSelectionne] = useState(null);

const livresDuMoisSelectionne =
  moisSelectionne !== null
    ? livresLus.filter((b) => {
        if (!b.dateAjout) return false;
        const date = new Date(b.dateAjout);
        return (
          date.getFullYear() === anneeSelectionnee &&
          date.getMonth() === moisSelectionne
        );
      })
    : [];

  const livrePlusLong = livresLus.reduce(
    (max, b) => (b.pages && (!max || b.pages > max.pages) ? b : max),
    null
  );

  return (
    <div className="stats-page">
      <button className="back-btn" onClick={() => navigate("/")}>
        ← Retour à la bibliothèque
      </button>

      <h1>📊 Statistiques</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{livresLus.length}</span>
          <span className="stat-label">Livres lus</span>
        </div>

        <div className="stat-card">
          <span className="stat-value">{totalPages.toLocaleString()}</span>
          <span className="stat-label">Pages lues</span>
        </div>

        <div className="stat-card">
          <span className="stat-value">{noteMoyenne ?? "—"}</span>
          <span className="stat-label">Note moyenne</span>
        </div>

        <div className="stat-card">
          <span className="stat-value">{books.length}</span>
          <span className="stat-label">Livres au total</span>
        </div>
      </div>

      {livrePlusLong && (
        <div className="stats-highlight">
          <span className="highlight-label">Le plus long lu</span>
          <span className="highlight-value">
            {livrePlusLong.titre} — {livrePlusLong.pages} pages
          </span>
        </div>
      )}

      <div className="stats-section">
        <h2>Auteurs les plus lus</h2>
        {topAuteurs.length === 0 ? (
          <p className="stats-empty">Aucune donnée pour l'instant.</p>
        ) : (
          <ul className="top-list">
            {topAuteurs.map(([nom, count]) => (
              <li key={nom}>
                <span>{nom}</span>
                <span className="top-count">
                  {count} livre{count > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stats-section">
        <h2>Lectures par année</h2>
        {anneesTriees.length === 0 ? (
          <p className="stats-empty">Aucune donnée pour l'instant.</p>
        ) : (
          <div className="year-bars">
            {anneesTriees.map(([annee, count]) => (
              <div key={annee} className="year-bar-row">
                <span className="year-label">{annee}</span>
                <div className="year-bar-track">
                  <div
                    className="year-bar-fill"
                    style={{ width: `${(count / maxParAnnee) * 100}%` }}
                  />
                </div>
                <span className="year-count">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {anneesTriees.length > 0 && (
  <div className="stats-section">
    <div className="stats-section-header">
      <h2>Détail par mois</h2>
      <select
        value={anneeSelectionnee}
        onChange={(e) => {
            setAnneeSelectionnee(parseInt(e.target.value, 10));
            setMoisSelectionne(null);
        }}
        >
        {anneesDisponibles.map((annee) => (
          <option key={annee} value={annee}>
            {annee}
          </option>
        ))}
      </select>
    </div>

<div className="month-bars">
  {parMois.map((count, index) => (
    <div
      key={index}
      className={`month-bar-col ${moisSelectionne === index ? "selected" : ""}`}
      onClick={() =>
        count > 0 &&
        setMoisSelectionne(moisSelectionne === index ? null : index)
      }
    >
      <div className="month-bar-track">
        <div
          className="month-bar-fill"
          style={{ height: `${(count / maxParMois) * 100}%` }}
        />
      </div>
      <span className="month-count">{count}</span>
      <span className="month-label">{NOMS_MOIS[index]}</span>
    </div>
  ))}
</div>

        {moisSelectionne !== null && (
        <div className="month-detail">
            <h3>
            {NOMS_MOIS[moisSelectionne]} {anneeSelectionnee}
            </h3>
            <ul className="month-detail-list">
            {livresDuMoisSelectionne.map((b) => (
                <li key={b.id}>
                <span className="month-detail-titre">{b.titre}</span>
                <span className="month-detail-auteur">{b.auteur}</span>
                </li>
            ))}
            </ul>
        </div>
        )}
  </div>
)}
    </div>
  );
}

export default Stats;