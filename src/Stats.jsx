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
  const parAnnee = {};
  livresLus.forEach((b) => {
    if (!b.dateAjout) return;
    const annee = new Date(b.dateAjout).getFullYear();
    parAnnee[annee] = (parAnnee[annee] || 0) + 1;
  });
  const anneesTriees = Object.entries(parAnnee).sort((a, b) => a[0] - b[0]);
  const maxParAnnee = Math.max(1, ...anneesTriees.map(([, n]) => n));

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
    </div>
  );
}

export default Stats;