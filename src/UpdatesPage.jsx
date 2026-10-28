import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./UpdatesPage.css";

const ADMIN_UID = "REMPLACER_PAR_TON_UID_FIREBASE";
const COLLECTION_NAME = "announcements";

const exemplesInitiaux = [
  {
    date: "2026-10-27",
    titre: "Statistiques par année sur les profils amis",
    description:
      "Le graphique des lectures annuelles est désormais visible sur les profils partagés, selon les réglages de confidentialité.",
    categorie: "Statistiques",
    emoji: "📊",
  },
  {
    date: "2026-10-27",
    titre: "Synchronisation du profil dans les listes d’amis",
    description:
      "Le changement de pseudo et de photo est répercuté dans les fiches d’amitié.",
    categorie: "Amis",
    emoji: "👥",
  },
  {
    date: "2026-10-27",
    titre: "Fenêtre des nouveautés",
    description:
      "Un récapitulatif présente les nouvelles fonctionnalités lors de leur première mise à disposition.",
    categorie: "Interface",
    emoji: "✨",
  },
  {
    date: "2026-10-27",
    titre: "Améliorations de la bibliothèque et de la visibilité",
    description:
      "Corrections autour de l’affichage des livres lus et de leur visibilité auprès des amis.",
    categorie: "Bibliothèque",
    emoji: "📚",
  },
];

const dateLisible = (date) => {
  if (!date) return "Date non précisée";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const formulaireVide = {
  date: new Date().toISOString().slice(0, 10),
  titre: "",
  description: "",
  categorie: "Nouveauté",
  emoji: "✨",
};

function UpdatesPage() {
  const [misesAJour, setMisesAJour] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [formulaire, setFormulaire] = useState(formulaireVide);
  const [editionId, setEditionId] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const tentativeInitialisation = useRef(false);
  const estAdmin = auth.currentUser?.uid === ADMIN_UID;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTION_NAME),
      async (snapshot) => {
        setMisesAJour(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        );
        setChargement(false);

        // Reprise de l’historique existant dans Firestore une seule fois,
        // par le compte administrateur, si la collection est encore vide.
        if (
          estAdmin &&
          snapshot.empty &&
          !tentativeInitialisation.current
        ) {
          tentativeInitialisation.current = true;
          try {
            for (const maj of exemplesInitiaux) {
              await addDoc(collection(db, COLLECTION_NAME), {
                ...maj,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: ADMIN_UID,
              });
            }
          } catch (initialisationError) {
            console.error("Initialisation de l’historique impossible :", initialisationError);
            setErreur("Impossible d’initialiser l’historique. Vérifie les règles Firestore.");
          }
        }
      },
      (loadError) => {
        console.error("Chargement des mises à jour impossible :", loadError);
        setErreur("Impossible de charger les annonces. Les règles Firestore doivent autoriser leur lecture.");
        setChargement(false);
      }
    );

    return unsubscribe;
  }, [estAdmin]);

  const changerChamp = (event) => {
    const { name, value } = event.target;
    setFormulaire((current) => ({ ...current, [name]: value }));
  };

  const ouvrirCreation = () => {
    setEditionId(null);
    setFormulaire({ ...formulaireVide, date: new Date().toISOString().slice(0, 10) });
    setFormVisible(true);
    setErreur("");
  };

  const ouvrirEdition = (maj) => {
    setEditionId(maj.id);
    setFormulaire({
      date: maj.date || new Date().toISOString().slice(0, 10),
      titre: maj.titre || "",
      description: maj.description || "",
      categorie: maj.categorie || "Nouveauté",
      emoji: maj.emoji || "✨",
    });
    setFormVisible(true);
    setErreur("");
  };

  const enregistrerMaj = async (event) => {
    event.preventDefault();
    if (!estAdmin || !formulaire.titre.trim() || !formulaire.description.trim()) return;

    setEnregistrement(true);
    setErreur("");
    const donnees = {
      date: formulaire.date,
      titre: formulaire.titre.trim(),
      description: formulaire.description.trim(),
      categorie: formulaire.categorie.trim() || "Nouveauté",
      emoji: formulaire.emoji.trim() || "✨",
      updatedAt: serverTimestamp(),
    };

    try {
      if (editionId) {
        await updateDoc(doc(db, COLLECTION_NAME, editionId), donnees);
      } else {
        await addDoc(collection(db, COLLECTION_NAME), {
          ...donnees,
          createdAt: serverTimestamp(),
          createdBy: ADMIN_UID,
        });
      }
      setFormVisible(false);
      setEditionId(null);
      setFormulaire(formulaireVide);
    } catch (saveError) {
      console.error("Enregistrement de la mise à jour impossible :", saveError);
      setErreur("Enregistrement refusé. Vérifie que les règles Firestore autorisent ton compte administrateur.");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimerMaj = async (maj) => {
    if (!estAdmin || !window.confirm(`Supprimer « ${maj.titre} » ?`)) return;
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, maj.id));
    } catch (deleteError) {
      console.error("Suppression impossible :", deleteError);
      setErreur("Suppression refusée. Vérifie les règles Firestore.");
    }
  };

  return (
    <div className="updates-page">
      <section className="updates-hero">
        <div className="updates-hero-icon" aria-hidden="true">📢</div>
        <span className="page-eyebrow">RESTER INFORMÉ</span>
        <h2>Journal des mises à jour</h2>
        <p>Toutes les nouveautés et améliorations de Booklira, réunies au même endroit.</p>
        <div className="updates-hero-bottom">
          <div className="updates-count">
            <span>{misesAJour.length}</span>
            <span>{misesAJour.length > 1 ? "mises à jour" : "mise à jour"}</span>
          </div>
          {estAdmin && (
            <button className="updates-add-button" type="button" onClick={ouvrirCreation}>
              <span aria-hidden="true">＋</span> Ajouter une mise à jour
            </button>
          )}
        </div>
      </section>

      {erreur && <div className="updates-error" role="alert">{erreur}</div>}

      {estAdmin && formVisible && (
        <section className="updates-editor">
          <div className="updates-editor-heading">
            <div>
              <span className="page-eyebrow">ESPACE ADMINISTRATEUR</span>
              <h3>{editionId ? "Modifier la mise à jour" : "Nouvelle mise à jour"}</h3>
            </div>
            <button type="button" className="updates-cancel-button" onClick={() => setFormVisible(false)}>
              Annuler
            </button>
          </div>

          <form onSubmit={enregistrerMaj} className="updates-form">
            <label>
              Titre
              <input name="titre" value={formulaire.titre} onChange={changerChamp} maxLength={120} required />
            </label>
            <label>
              Description
              <textarea name="description" value={formulaire.description} onChange={changerChamp} rows={3} maxLength={700} required />
            </label>
            <div className="updates-form-grid">
              <label>
                Date
                <input type="date" name="date" value={formulaire.date} onChange={changerChamp} required />
              </label>
              <label>
                Catégorie
                <input name="categorie" value={formulaire.categorie} onChange={changerChamp} maxLength={40} required />
              </label>
              <label>
                Emoji
                <input name="emoji" value={formulaire.emoji} onChange={changerChamp} maxLength={8} />
              </label>
            </div>
            <button className="updates-add-button updates-save-button" type="submit" disabled={enregistrement}>
              {enregistrement ? "Enregistrement…" : editionId ? "Enregistrer les changements" : "Publier la mise à jour"}
            </button>
          </form>
        </section>
      )}

      <section className="updates-timeline-section" aria-labelledby="updates-timeline-title">
        <div className="updates-section-heading">
          <div>
            <span className="page-eyebrow">HISTORIQUE</span>
            <h3 id="updates-timeline-title">Les dernières nouveautés</h3>
          </div>
          <span className="updates-section-badge">{new Date().getFullYear()}</span>
        </div>

        {chargement ? (
          <p className="updates-status">Chargement des annonces…</p>
        ) : misesAJour.length === 0 ? (
          <p className="updates-status">Aucune mise à jour pour le moment.</p>
        ) : (
          <div className="updates-timeline">
            {misesAJour.map((maj) => (
              <article className="updates-entry" key={maj.id}>
                <div className="updates-timeline-marker" aria-hidden="true"><span>{maj.emoji || "✨"}</span></div>
                <div className="updates-entry-card">
                  <div className="updates-entry-meta">
                    <time dateTime={maj.date}>{dateLisible(maj.date)}</time>
                    <span className="updates-category">{maj.categorie || "Nouveauté"}</span>
                  </div>
                  <h4>{maj.titre}</h4>
                  <p>{maj.description}</p>
                  {estAdmin && (
                    <div className="updates-entry-actions">
                      <button type="button" onClick={() => ouvrirEdition(maj)}>Modifier</button>
                      <button type="button" className="updates-delete-button" onClick={() => supprimerMaj(maj)}>Supprimer</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="updates-footer-note">
        Booklira évolue régulièrement grâce à tes retours. Merci de faire partie de l’aventure !
      </p>
    </div>
  );
}

export default UpdatesPage;
