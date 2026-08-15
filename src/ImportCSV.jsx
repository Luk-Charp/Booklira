import { useState } from "react";
import Papa from "papaparse";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./ImportCSV.css";

function mapStatut(status) {
  const valeur = (status || "").trim().toLowerCase();

  switch (valeur) {
    case "finished":
      return "lu";

    case "in_progress":
      return "en_cours";

    case "planned":
    case "for_later":
      return "a_lire";

    case "abandoned":
      // Pas d'équivalent exact dans ton application.
      // On le place dans "À lire" par défaut.
      return "a_lire";

    default:
      return "a_lire";
  }
}

function mapNote(rating) {
  const valeur = parseFloat(
    String(rating || "").replace(",", ".")
  );

  if (isNaN(valeur) || valeur <= 0) {
    return 0;
  }

  return Math.min(5, Math.round(valeur));
}

function mapPages(pages) {
  const valeur = parseInt(pages, 10);

  if (isNaN(valeur) || valeur <= 0) {
    return null;
  }

  return valeur;
}

function mapAnnee(annee) {
  const valeur = parseInt(annee, 10);

  if (isNaN(valeur) || valeur <= 0) {
    return null;
  }

  return valeur;
}

function nettoyerISBN(isbn) {
  if (!isbn) return "";

  return String(isbn)
    .trim()
    .replace(/[-\s]/g, "");
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

      // Évite les problèmes avec les espaces ou le BOM UTF-8
      transformHeader: (header) =>
        header
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase(),

      complete: async (parsed) => {
        try {
          // --------------------------------
          // Vérification du parsing CSV
          // --------------------------------

          if (parsed.errors && parsed.errors.length > 0) {
            console.error("Erreurs CSV :", parsed.errors);

            const premiereErreur = parsed.errors[0];

            throw new Error(
              `Erreur CSV ligne ${
                premiereErreur.row ?? "inconnue"
              } : ${premiereErreur.message}`
            );
          }

          console.log("CSV parsé :", parsed.data);
          console.log("Nombre de lignes :", parsed.data.length);

          // --------------------------------
          // Vérification de l'utilisateur
          // --------------------------------

          if (!auth.currentUser) {
            throw new Error(
              "Aucun utilisateur connecté."
            );
          }

          // --------------------------------
          // Filtrage des livres
          // --------------------------------

          const lignes = parsed.data.filter((row) => {
            const titre = String(row.title || "").trim();

            const deleted = String(
              row.deleted ?? ""
            )
              .trim()
              .toLowerCase();

            // On ignore uniquement les livres explicitement supprimés
            const estSupprime =
              deleted === "true" ||
              deleted === "1";

            return titre !== "" && !estSupprime;
          });

          console.log(
            `Livres valides : ${lignes.length}`
          );

          if (lignes.length === 0) {
            throw new Error(
              "Aucun livre valide trouvé dans le CSV. Vérifie notamment la colonne 'title'."
            );
          }

          // --------------------------------
          // Import Firestore
          // --------------------------------

          const CHUNK = 400;
          let importes = 0;

          for (
            let i = 0;
            i < lignes.length;
            i += CHUNK
          ) {
            const batch = writeBatch(db);

            const morceau = lignes.slice(
              i,
              i + CHUNK
            );

            morceau.forEach((row) => {
              const nouveauDoc = doc(
                collection(db, "books")
              );

              const isbn = nettoyerISBN(
                row.isbn
              );

              const couverture = isbn
                ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
                : "";

              const titre = String(
                row.title || ""
              ).trim();

              const auteur = String(
                row.author || "Auteur inconnu"
              ).trim();

              batch.set(nouveauDoc, {
                titre: titre || "Titre inconnu",

                auteur:
                  auteur || "Auteur inconnu",

                couverture,

                annee: mapAnnee(
                  row.publication_year
                ),

                pages: mapPages(
                  row.pages || row.page_count
                ),

                statut: mapStatut(
                  row.status
                ),

                note: mapNote(
                  row.rating
                ),

                userId:
                  auth.currentUser.uid,

                dateAjout:
                  row.date_added ||
                  new Date().toISOString(),
              });

              importes++;
            });

            await batch.commit();

            console.log(
              `Batch importé : ${morceau.length} livre(s)`
            );
          }

          // --------------------------------
          // Succès
          // --------------------------------

          setResultat(
            `✅ ${importes} livre(s) importé(s) avec succès.`
          );

        } catch (err) {
          console.error(
            "Erreur import CSV :",
            err
          );

          setResultat(
            `❌ ${err.message || "Une erreur est survenue pendant l'import."}`
          );

        } finally {
          setEnCours(false);

          // Permet de réimporter le même fichier
          e.target.value = "";
        }
      },

      error: (error) => {
        console.error(
          "Erreur PapaParse :",
          error
        );

        setResultat(
          `❌ Impossible de lire le CSV : ${error.message}`
        );

        setEnCours(false);
        e.target.value = "";
      },
    });
  };

  return (
    <div className="import-csv">
      <label className="import-btn">
        {enCours
          ? "Import en cours..."
          : "📥 Importer depuis OpenReads (CSV)"}

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={enCours}
          hidden
        />
      </label>

      {resultat && (
        <p className="import-result">
          {resultat}
        </p>
      )}
    </div>
  );
}

export default ImportCSV;