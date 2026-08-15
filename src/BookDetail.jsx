import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import StarRating from "./StarRating";
import "./BookDetail.css";


function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [livre, setLivre] = useState(null);
  const [chargement, setChargement] = useState(true);

  const [description, setDescription] = useState("");
  const [notePerso, setNotePerso] = useState("");
  const [tome, setTome] = useState("");
  const [dateParution, setDateParution] = useState("");
  const [note, setNote] = useState(0);

  const [sauvegarde, setSauvegarde] = useState(false);

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
        setNote(data.note || 0);
      }
      setChargement(false);
    };
    chargerLivre();
  }, [id]);

  const enregistrer = async () => {
    setSauvegarde(true);
    try {
      await updateDoc(doc(db, "books", id), {
        description: description.trim(),
        notePerso: notePerso.trim(),
        tome: tome ? parseInt(tome, 10) : null,
        dateParution: dateParution.trim(),
        note,
      });
    } catch (err) {
      console.error("Erreur sauvegarde détail livre :", err);
    } finally {
      setSauvegarde(false);
    }
  };

  if (chargement) return <p className="detail-loading">Chargement...</p>;
  if (!livre) return <p className="detail-loading">Livre introuvable.</p>;

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
          <p className="detail-auteur">{livre.auteur}</p>

          <div className="detail-field">
            <label>Note</label>
            <StarRating note={note} onChange={setNote} />
          </div>

          <div className="detail-field">
            <label>Tome / ordre de parution</label>
            <input
              type="number"
              placeholder="Ex : 1, 2, 3..."
              value={tome}
              onChange={(e) => setTome(e.target.value)}
            />
          </div>

          <div className="detail-field">
            <label>Date de parution</label>
            <input
              type="text"
              placeholder="Ex : 15 mars 2014"
              value={dateParution}
              onChange={(e) => setDateParution(e.target.value)}
            />
          </div>

          <div className="detail-field">
            <label>Description</label>
            <textarea
              placeholder="Résumé du livre..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div className="detail-field">
            <label>Ma note personnelle</label>
            <textarea
              placeholder="Tes impressions, ce que tu as pensé de ce livre..."
              value={notePerso}
              onChange={(e) => setNotePerso(e.target.value)}
              rows={5}
            />
          </div>

          <button
            className="save-btn"
            onClick={enregistrer}
            disabled={sauvegarde}
          >
            {sauvegarde ? "Enregistrement..." : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookDetail;