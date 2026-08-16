import { useParams, useNavigate, Link } from "react-router-dom";
import "./LegalPages.css";

// =========================================================
// CONTENU DES PAGES
//
// Un seul composant pour les 3 pages légales, afin de ne pas
// multiplier les fichiers pour un contenu somme toute assez
// simple. Le contenu ci-dessous est un point de départ
// générique : à faire relire/compléter par un professionnel
// avant mise en ligne commerciale.
// =========================================================

const PAGES = {
  mentions: {
    titre: "Mentions légales",
    contenu: (
      <>
        <h2>Éditeur du site</h2>
        <p>
          Booklira est édité à titre personnel. Pour toute question relative
          à l'édition du site, un contact est disponible ci-dessous.
        </p>

        <h2>Hébergement</h2>
        <p>
          Les données de l'application (comptes, livres) sont hébergées par
          Google Firebase (Google Ireland Limited, Gordon House, Barrow
          Street, Dublin 4, Irlande). Le site web est hébergé par le
          prestataire de déploiement utilisé pour la mise en ligne du
          front-end.
        </p>

        <h2>Contact</h2>
        <p>
          Pour toute question, réclamation ou signalement de contenu,
          contacter lukcharp2@yahoo.com.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          Le nom « Booklira », le logo et l'interface de l'application sont
          la propriété de leur éditeur. Les couvertures de livres et
          métadonnées affichées proviennent de l'API Google Books ou de
          fichiers importés par les utilisateurs ; elles restent la
          propriété de leurs ayants droit respectifs.
        </p>
      </>
    ),
  },

  cgu: {
    titre: "Conditions Générales d'Utilisation",
    contenu: (
      <>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent l'utilisation de Booklira, une
          application permettant de suivre ses lectures, gérer sa
          bibliothèque personnelle et importer des données depuis d'autres
          services.
        </p>

        <h2>2. Compte utilisateur</h2>
        <p>
          L'accès à l'application nécessite la création d'un compte. Tu es
          responsable de la confidentialité de tes identifiants et de
          l'ensemble des actions effectuées depuis ton compte.
        </p>

        <h2>3. Contenus importés par l'utilisateur</h2>
        <p>
          Tu peux importer des images (couvertures de livres, photo de
          profil) depuis ta galerie personnelle. En les important, tu
          garantis détenir les droits nécessaires sur ces images ou disposer
          des autorisations requises pour les utiliser dans ce cadre.
          Booklira n'exerce aucun contrôle éditorial préalable sur ces
          contenus.
        </p>
        <p>
          Tout contenu signalé comme contrefaisant ou portant atteinte aux
          droits d'un tiers pourra être retiré sur simple demande motivée
          adressée à l'éditeur.
        </p>

        <h2>4. Données issues de Google Books</h2>
        <p>
          Les résultats de recherche de livres (titres, auteurs, couvertures,
          nombre de pages) sont fournis par l'API Google Books et restent la
          propriété de Google et des éditeurs concernés. Booklira ne fait
          qu'afficher ces informations à titre indicatif.
        </p>

        <h2>5. Utilisation autorisée</h2>
        <p>
          Tu t'engages à utiliser Booklira à des fins personnelles, dans le
          respect des lois en vigueur, et à ne pas tenter de perturber le
          fonctionnement du service.
        </p>

        <h2>6. Responsabilité</h2>
        <p>
          Booklira est fourni « en l'état ». L'éditeur ne saurait être tenu
          responsable d'une perte de données, d'une indisponibilité
          temporaire du service, ou d'un contenu déposé par un autre
          utilisateur.
        </p>

        <h2>7. Modification des CGU</h2>
        <p>
          Ces conditions peuvent évoluer. En cas de changement substantiel,
          les utilisateurs en seront informés au sein de l'application.
        </p>
      </>
    ),
  },

  confidentialite: {
    titre: "Politique de confidentialité",
    contenu: (
      <>
        <h2>Données collectées</h2>
        <p>
          Booklira collecte les données suivantes : email et mot de passe
          (gérés par Firebase Authentication), nom affiché et photo de
          profil (facultatifs), ainsi que les livres et informations de
          lecture que tu ajoutes toi-même (titres, auteurs, notes,
          couvertures, dates).
        </p>

        <h2>Finalité du traitement</h2>
        <p>
          Ces données sont utilisées uniquement pour faire fonctionner
          l'application : authentification, affichage de ta bibliothèque
          personnelle, et personnalisation de ton profil.
        </p>

        <h2>Hébergement et sous-traitants</h2>
        <p>
          Les données sont hébergées par Google Firebase. Les images
          (couvertures, photos de profil) sont hébergées par Cloudinary. Les
          recherches de livres interrogent l'API Google Books. Ces
          prestataires peuvent traiter des données en dehors de l'Union
          européenne, dans le cadre de garanties contractuelles standard
          (clauses contractuelles types).
        </p>

        <h2>Durée de conservation</h2>
        <p>
          Tes données sont conservées tant que ton compte est actif. Tu peux
          les supprimer à tout moment depuis la page Profil.
        </p>

        <h2>Tes droits</h2>
        <p>
          Conformément au RGPD, tu disposes d'un droit d'accès, de
          rectification, de portabilité et de suppression de tes données.
          Tu peux exporter l'intégralité de tes données ou supprimer ton
          compte directement depuis la page « Profil » de l'application.
        </p>

        <h2>Cookies</h2>
        <p>
          Booklira utilise uniquement des mécanismes techniques nécessaires
          au fonctionnement du service (session d'authentification, cache
          local). Aucun cookie publicitaire ou de traçage tiers n'est
          utilisé.
        </p>

        <h2>Contact</h2>
        <p>
          Pour exercer tes droits ou pour toute question relative à tes
          données personnelles, contacte l'éditeur via l'adresse email
          associée à ton compte.
        </p>
      </>
    ),
  },
};

function LegalPages() {
  const { page } = useParams();
  const navigate = useNavigate();

  const infos = PAGES[page] || PAGES.mentions;

  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Retour
        </button>

        <div className="legal-card">
          <h1>{infos.titre}</h1>

          <div className="legal-content">{infos.contenu}</div>

          <nav className="legal-nav">
            <Link
              to="/legal/mentions"
              className={page === "mentions" ? "active" : ""}
            >
              Mentions légales
            </Link>
            <Link to="/legal/cgu" className={page === "cgu" ? "active" : ""}>
              CGU
            </Link>
            <Link
              to="/legal/confidentialite"
              className={page === "confidentialite" ? "active" : ""}
            >
              Confidentialité
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default LegalPages;
