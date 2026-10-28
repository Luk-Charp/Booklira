import React from "react";
import "./UpdatesPage.css";

const misesAJour = [
  {
    date: "27 octobre 2026",
    titre: "Statistiques par année sur les profils amis",
    description:
      "Le graphique des lectures annuelles est désormais visible sur les profils partagés, selon les réglages de confidentialité.",
    categorie: "Statistiques",
    emoji: "📊",
  },
  {
    date: "27 octobre 2026",
    titre: "Synchronisation du profil dans les listes d’amis",
    description:
      "Le changement de pseudo et de photo est répercuté dans les fiches d’amitié.",
    categorie: "Amis",
    emoji: "👥",
  },
  {
    date: "27 octobre 2026",
    titre: "Fenêtre des nouveautés",
    description:
      "Un récapitulatif présente les nouvelles fonctionnalités lors de leur première mise à disposition.",
    categorie: "Interface",
    emoji: "✨",
  },
  {
    date: "27 octobre 2026",
    titre: "Améliorations de la bibliothèque et de la visibilité",
    description:
      "Corrections autour de l’affichage des livres lus et de leur visibilité auprès des amis.",
    categorie: "Bibliothèque",
    emoji: "📚",
  },
];

function UpdatesPage() {
  return (
    <div className="updates-page">
      <section className="updates-hero">
        <div className="updates-hero-icon" aria-hidden="true">📢</div>
        <span className="page-eyebrow">RESTER INFORMÉ</span>
        <h2>Journal des mises à jour</h2>
        <p>
          Toutes les nouveautés et améliorations de Booklira, réunies au même endroit.
        </p>
        <div className="updates-count">
          <span>{misesAJour.length}</span>
          <span>mises à jour récentes</span>
        </div>
      </section>

      <section className="updates-timeline-section" aria-labelledby="updates-timeline-title">
        <div className="updates-section-heading">
          <div>
            <span className="page-eyebrow">HISTORIQUE</span>
            <h3 id="updates-timeline-title">Les dernières nouveautés</h3>
          </div>
          <span className="updates-section-badge">2026</span>
        </div>

        <div className="updates-timeline">
          {misesAJour.map((maj, index) => (
            <article className="updates-entry" key={`${maj.titre}-${index}`}>
              <div className="updates-timeline-marker" aria-hidden="true">
                <span>{maj.emoji}</span>
              </div>
              <div className="updates-entry-card">
                <div className="updates-entry-meta">
                  <time>{maj.date}</time>
                  <span className="updates-category">{maj.categorie}</span>
                </div>
                <h4>{maj.titre}</h4>
                <p>{maj.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="updates-footer-note">
        Booklira évolue régulièrement grâce à tes retours. Merci de faire partie de l’aventure !
      </p>
    </div>
  );
}

export default UpdatesPage;
