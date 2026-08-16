import { useState } from "react";
import Papa from "papaparse";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./ImportCSV.css";

function mapPages(pages) {
  const valeur = parseInt(pages, 10);
  if (isNaN(valeur) || valeur <= 0) return null;
  return valeur;
}

function normaliser(texte) {
  return String(texte || "").trim().toLowerCase();
}

function ImportCSV() {
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnCours(true);
    setResultat(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header.replace(/^\uFEFF/, "").trim().toLowerCase(),

      complete: async (parsed) => {
        try {
          if (parsed.errors && parsed.errors.length > 0) {
            console.error("Erreurs CSV :", parsed.errors);
            const premiereErreur = parsed.errors[0];
            throw new Error(
              `Erreur CSV ligne ${premiereErreur.row ?? "inconnue"} : ${premiereErreur.message}`
            );
          }

          if (!auth.currentUser) {
            throw new Error("Aucun utilisateur connecté.");
          }

          // --------------------------------
          // Construire un dico titre -> pages depuis le CSV
          // --------------------------------

          const pagesParTitre = {};
          parsed.data.forEach((row) => {
            const titre = normaliser(row.title);
            const pages = mapPages(row.pages || row.page_count);
            if (titre && pages) {
              pagesParTitre[titre] = pages;
            }
          });

          console.log("Titres trouvés dans le CSV :", Object.keys(pagesParTitre).length);

          // --------------------------------
          // Récupérer tous les livres existants de l'utilisateur
          // --------------------------------

          const q = query(
            collection(db, "books"),
            where("userId", "==", auth.currentUser.uid)
          );
          const snapshot = await getDocs(q);

          const livresExistants = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          // --------------------------------
          // Trouver les correspondances et préparer la mise à jour
          // --------------------------------

          const aMettreAJour = livresExistants.filter((livre) => {
            const titreNorm = normaliser(livre.titre);
            return (
              pagesParTitre[titreNorm] &&
              livre.pages !== pagesParTitre[titreNorm]
            );
          });

          if (aMettreAJour.length === 0) {
            setResultat(
              "Aucune correspondance trouvée, ou tous les livres ont déjà leur nombre de pages à jour."
            );
            setEnCours(false);
            e.target.value = "";
            return;
          }

          // --------------------------------
          // Mise à jour par lots (uniquement le champ "pages")
          // --------------------------------

          const CHUNK = 400;
          let misAJour = 0;

          for (let i = 0; i < aMettreAJour.length; i += CHUNK) {
            const batch = writeBatch(db);
            const morceau = aMettreAJour.slice(i, i + CHUNK);

            morceau.forEach((livre) => {
              const titreNorm = normaliser(livre.titre);
              batch.update(doc(db, "books", livre.id), {
                pages: pagesParTitre[titreNorm],
              });
              misAJour++;
            });

            await batch.commit();
          }

          setResultat(
            `✅ ${misAJour} livre(s) mis à jour (nombre de pages uniquement, couvertures inchangées).`
          );
        } catch (err) {
          console.error("Erreur import CSV :", err);
          setResultat(
            `❌ ${err.message || "Une erreur est survenue pendant l'import."}`
          );
        } finally {
          setEnCours(false);
          e.target.value = "";
        }
      },

      error: (error) => {
        console.error("Erreur PapaParse :", error);
        setResultat(`❌ Impossible de lire le CSV : ${error.message}`);
        setEnCours(false);
        e.target.value = "";
      },
    });
  };

  return (
    <div className="import-csv">
      <label className="import-btn">
        {enCours ? "Mise à jour en cours..." : "📄 Mettre à jour les pages (CSV OpenReads)"}
        <input
          type="file"
          accept=".csv,text/csv"
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