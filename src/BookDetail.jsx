import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import StarRating from "./StarRating";
import "./BookDetail.css";

const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

const MOIS_LONGS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [livre, setLivre] = useState(null);
  const [chargement, setChargement] = useState(true);

  const [description, setDescription] = useState("");
  const [notePerso, setNotePerso] = useState("");
  const [tome, setTome] = useState("");
  const [dateParution, setDateParution] = useState("");
  const [dateFinLecture, setDateFinLecture] = useState("");
  const [note, setNote] = useState(0);

  const [sauvegarde, setSauvegarde] = useState(false);

  // =========================
  // CALENDRIER
  // =========================

  const [calendrierOuvert, setCalendrierOuvert] = useState(false);

  const calendrierRef = useRef(null);

  const aujourdHui = new Date();

  const [anneeCalendrier, setAnneeCalendrier] = useState(
    aujourdHui.getFullYear()
  );

  // =========================
  // CHARGEMENT DU LIVRE
  // =========================

  useEffect(() => {
    const chargerLivre = async () => {
      const ref = doc(db, "books", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();

        setLivre(data);
        setDescription(data.description || "");
        setNotePerso(data.notePerso || "");
        setTome(data.tome || "");
        setDateParution(data.dateParution || "");
        setDateFinLecture(data.dateFinLecture || "");
        setNote(data.note || 0);

        // Si une date existe déjà, ouvrir le calendrier
        // sur l'année correspondante.
        if (data.dateFinLecture) {
          const [annee] = data.dateFinLecture.split("-");

          if (annee) {
            setAnneeCalendrier(parseInt(annee, 10));
          }
        }
      }

      setChargement(false);
    };

    chargerLivre();
  }, [id]);

  // =========================
  // FERMER LE CALENDRIER
  // EN CLIQUANT À L'EXTÉRIEUR
  // =========================

  useEffect(() => {
    const fermerCalendrier = (event) => {
      if (
        calendrierRef.current &&
        !calendrierRef.current.contains(event.target)
      ) {
        setCalendrierOuvert(false);
      }
    };

    document.addEventListener("mousedown", fermerCalendrier);

    return () => {
      document.removeEventListener("mousedown", fermerCalendrier);
    };
  }, []);

  // =========================
  // CALENDRIER
  // =========================

  const choisirMois = (mois) => {
    const moisFormate = String(mois + 1).padStart(2, "0");

    setDateFinLecture(`${anneeCalendrier}-${moisFormate}`);
    setCalendrierOuvert(false);
  };

  const changerAnnee = (direction) => {
    setAnneeCalendrier((ancienneAnnee) => ancienneAnnee + direction);
  };

  const effacerDate = () => {
    setDateFinLecture("");
    setCalendrierOuvert(false);
  };

  const choisirCeMois = () => {
    const annee = aujourdHui.getFullYear();
    const mois = String(aujourdHui.getMonth() + 1).padStart(2, "0");

    setAnneeCalendrier(annee);
    setDateFinLecture(`${annee}-${mois}`);
    setCalendrierOuvert(false);
  };

  const afficherDate = () => {
    if (!dateFinLecture) {
      return "Choisir un mois";
    }

    const [annee, mois] = dateFinLecture.split("-");

    const indexMois = parseInt(mois, 10) - 1;

    if (!annee || indexMois < 0 || indexMois > 11) {
      return "Choisir un mois";
    }

    return `${MOIS_LONGS[indexMois]} ${annee}`;
  };

  const moisSelectionne =
    dateFinLecture &&
    parseInt(dateFinLecture.split("-")[0], 10) === anneeCalendrier
      ? parseInt(dateFinLecture.split("-")[1], 10) - 1
      : null;

  // =========================
  // SAUVEGARDE
  // =========================

  const enregistrer = async () => {
    setSauvegarde(true);

    try {
      await updateDoc(doc(db, "books", id), {
        description: description.trim(),
        notePerso: notePerso.trim(),
        tome: tome ? parseInt(tome, 10) : null,
        dateParution: dateParution.trim(),
        dateFinLecture: dateFinLecture || null,
        note,
      });
    } catch (err) {
      console.error("Erreur sauvegarde détail livre :", err);
    } finally {
      setSauvegarde(false);
    }
  };

  // =========================
  // AFFICHAGE
  // =========================

  if (chargement) {
    return <p className="detail-loading">Chargement...</p>;
  }

  if (!livre) {
    return <p className="detail-loading">Livre introuvable.</p>;
  }

  return (
    <div className="book-detail">
      <button className="back-btn" onClick={() => navigate("/")}>
        ← Retour à la bibliothèque
      </button>

      <div className="detail-content">
        <div className="detail-cover">
          {livre.couverture ? (
            <img src={livre.couverture} alt={livre.titre} />
          ) : (
            <div className="detail-cover-placeholder">📖</div>
          )}
        </div>

        <div className="detail-info">
          <h1>{livre.titre}</h1>

          <p className="detail-auteur">
            {livre.auteur}
          </p>

          {/* =========================
              NOTE
          ========================= */}

          <div className="detail-field">
            <label>Note</label>

            <StarRating
              note={note}
              onChange={setNote}
            />
          </div>

          {/* =========================
              TOME
          ========================= */}

          <div className="detail-field">
            <label>Tome / ordre de parution</label>

            <input
              type="number"
              placeholder="Ex : 1, 2, 3..."
              value={tome}
              onChange={(e) => setTome(e.target.value)}
            />
          </div>

          {/* =========================
              DATE FIN DE LECTURE
          ========================= */}

          <div className="detail-field">
            <label>Mois de fin de lecture</label>

            <div
              className="custom-month-picker"
              ref={calendrierRef}
            >
              {/* CHAMP */}

              <button
                type="button"
                className={`month-picker-trigger ${
                  calendrierOuvert ? "open" : ""
                } ${!dateFinLecture ? "empty" : ""}`}
                onClick={() => {
                  if (!calendrierOuvert && dateFinLecture) {
                    const [annee] = dateFinLecture.split("-");

                    if (annee) {
                      setAnneeCalendrier(
                        parseInt(annee, 10)
                      );
                    }
                  }

                  setCalendrierOuvert(
                    !calendrierOuvert
                  );
                }}
              >
                <span>
                  {afficherDate()}
                </span>

                <span className="month-picker-icon">
                  ▾
                </span>
              </button>

              {/* CALENDRIER */}

              {calendrierOuvert && (
                <div className="month-picker-dropdown">
                  {/* HEADER */}

                  <div className="month-picker-header">
                    <button
                      type="button"
                      className="month-year-arrow"
                      onClick={() =>
                        changerAnnee(-1)
                      }
                      aria-label="Année précédente"
                    >
                      ‹
                    </button>

                    <span className="month-picker-year">
                      {anneeCalendrier}
                    </span>

                    <button
                      type="button"
                      className="month-year-arrow"
                      onClick={() =>
                        changerAnnee(1)
                      }
                      aria-label="Année suivante"
                    >
                      ›
                    </button>
                  </div>

                  {/* LIGNE */}

                  <div className="month-picker-divider" />

                  {/* MOIS */}

                  <div className="month-grid">
                    {MOIS.map((mois, index) => (
                      <button
                        key={mois}
                        type="button"
                        className={`month-option ${
                          moisSelectionne === index
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          choisirMois(index)
                        }
                      >
                        {mois}
                      </button>
                    ))}
                  </div>

                  {/* BAS */}

                  <div className="month-picker-divider" />

                  <div className="month-picker-footer">
                    <button
                      type="button"
                      className="month-footer-btn"
                      onClick={effacerDate}
                    >
                      Effacer
                    </button>

                    <button
                      type="button"
                      className="month-footer-btn today"
                      onClick={choisirCeMois}
                    >
                      Ce mois
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =========================
              DESCRIPTION
          ========================= */}

          <div className="detail-field">
            <label>Description</label>

            <textarea
              placeholder="Résumé du livre..."
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              rows={5}
            />
          </div>

          {/* =========================
              NOTE PERSONNELLE
          ========================= */}

          <div className="detail-field">
            <label>Ma note personnelle</label>

            <textarea
              placeholder="Tes impressions, ce que tu as pensé de ce livre..."
              value={notePerso}
              onChange={(e) =>
                setNotePerso(e.target.value)
              }
              rows={5}
            />
          </div>

          {/* =========================
              SAUVEGARDER
          ========================= */}

          <button
            className="save-btn"
            onClick={enregistrer}
            disabled={sauvegarde}
          >
            {sauvegarde
              ? "Enregistrement..."
              : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookDetail;