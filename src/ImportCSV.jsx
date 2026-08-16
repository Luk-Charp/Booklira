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

// Convertit une date ISO ("2025-11-08T00:00:00.000") en "AAAA-MM"
function versMoisAnnee(dateIso) {
  if (!dateIso) return null;
  const date = new Date(dateIso);
  if (isNaN(date.getTime())) return null;
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}`;
}

// Convertit un timestamp Unix (en secondes) en "AAAA-MM"
function epochVersMoisAnnee(epochSecondes) {
  const valeur = parseInt(epochSecondes, 10);
  if (isNaN(valeur) || valeur <= 0) return null;
  const date = new Date(valeur * 1000);
  if (isNaN(date.getTime())) return null;
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}`;
}

// Extrait le mois/année de fin de lecture à partir du champ "readings"
// Format attendu : "dateDebutISO|dateFinISO|" (parfois un 3e segment = epoch)
function extraireMoisFinLecture(row) {
  const readings = String(row.readings || "").trim();

  if (readings) {
    const parts = readings.split("|");
    const dateFinIso = parts[1] ? parts[1].trim() : "";
    const epochAlternatif = parts[2] ? parts[2].trim() : "";

    if (dateFinIso) {
      const resultat = versMoisAnnee(dateFinIso);
      if (resultat) return resultat;
    }

    if (epochAlternatif) {
      const resultat = epochVersMoisAnnee(epochAlternatif);
      if (resultat) return resultat;
    }
  }

  // Repli : si le livre est marqué "finished", on utilise date_modified
  const statut = normaliser(row.status);
  if (statut === "finished" && row.date_modified) {
    return versMoisAnnee(row.date_modified);
  }

  return null;
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
          // Construire un dico titre -> { pages, moisFin } depuis le CSV
          // --------------------------------

          const infosParTitre = {};
          parsed.data.forEach((row) => {
            const titre = normaliser(row.title);
            if (!titre) return;

            const pages = mapPages(row.pages || row.page_count);
            const moisFin = extraireMoisFinLecture(row);

            infosParTitre[titre] = {
              pages,
              moisFin,
            };
          });

          console.log(
            "Titres trouvés dans le CSV :",
            Object.keys(infosParTitre).length
          );

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
          // Préparer les mises à jour (pages ET/OU moisFin)
          // --------------------------------

          const misesAJour = [];

          livresExistants.forEach((livre) => {
            const titreNorm = normaliser(livre.titre);
            const infos = infosParTitre[titreNorm];
            if (!infos) return;

            const champsAMettreAJour = {};

            if (infos.pages && livre.pages !== infos.pages) {
              champsAMettreAJour.pages = infos.pages;
            }

            if (infos.moisFin && livre.dateFinLecture !== infos.moisFin) {
              champsAMettreAJour.dateFinLecture = infos.moisFin;
            }

            if (Object.keys(champsAMettreAJour).length > 0) {
              misesAJour.push({ id: livre.id, champs: champsAMettreAJour });
            }
          });

          if (misesAJour.length === 0) {
            setResultat(
              "Aucune correspondance trouvée, ou tous les livres sont déjà à jour."
            );
            setEnCours(false);
            e.target.value = "";
            return;
          }

          // --------------------------------
          // Mise à jour par lots (pages / dateFinLecture uniquement)
          // --------------------------------

          const CHUNK = 400;
          let misAJour = 0;

          for (let i = 0; i < misesAJour.length; i += CHUNK) {
            const batch = writeBatch(db);
            const morceau = misesAJour.slice(i, i + CHUNK);

            morceau.forEach(({ id, champs }) => {
              batch.update(doc(db, "books", id), champs);
              misAJour++;
            });

            await batch.commit();
          }

          setResultat(
            `✅ ${misAJour} livre(s) mis à jour (pages et/ou mois de fin de lecture, couvertures inchangées).`
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
        {enCours
          ? "Mise à jour en cours..."
          : "📄 Mettre à jour pages + dates (CSV OpenReads)"}
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
