import { useState } from "react";
import Papa from "papaparse";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./ImportCSV.css";

function mapStatut(status) {
  switch ((status || "").toLowerCase()) {
    case "finished":
      return "lu";
    case "in_progress":
      return "en_cours";
    case "for_later":
    default:
      return "a_lire";
  }
}

function mapNote(rating) {
  const valeur = parseFloat(rating);
  if (isNaN(valeur) || valeur <= 0) return 0;
  return Math.min(5, Math.round(valeur));
}

function ImportCSV() {
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEnCours(true);
    setResultat(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const lignes = parsed.data.filter(
          (row) => row.title && row.deleted !== "true"
        );

        try {
          const CHUNK = 400;
          let importes = 0;

          for (let i = 0; i < lignes.length; i += CHUNK) {
            const batch = writeBatch(db);
            const morceau = lignes.slice(i, i + CHUNK);

            morceau.forEach((row) => {
              const nouveauDoc = doc(collection(db, "books"));
              const couverture = row.isbn
                ? `https://covers.openlibrary.org/b/isbn/${row.isbn}-M.jpg`
                : "";

              batch.set(nouveauDoc, {
                titre: row.title,
                auteur: row.author || "Auteur inconnu",
                couverture,
                annee: row.publication_year ? parseInt(row.publication_year) : null,
                statut: mapStatut(row.status),
                note: mapNote(row.rating),
                userId: auth.currentUser.uid,
                dateAjout: row.date_added || new Date().toISOString(),
                });
              importes++;
            });

            await batch.commit();
          }

          setResultat(`${importes} livre(s) importé(s) avec succès.`);
        } catch (err) {
          console.error("Erreur import :", err);
          setResultat("Une erreur est survenue pendant l'import.");
        } finally {
          setEnCours(false);
          e.target.value = "";
        }
      },
    });
  };

  return (
    <div className="import-csv">
      <label className="import-btn">
        {enCours ? "Import en cours..." : "📥 Importer depuis OpenReads (CSV)"}
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={enCours}
          hidden
        />
      </label>
      {resultat && <p className="import-result">{resultat}</p>}
    </div>
  );
}

export default ImportCSV;