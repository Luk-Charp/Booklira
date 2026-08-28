// Recherche plusieurs couvertures possibles pour un livre (titre + auteur)
// via l'API Open Library, pour proposer un choix à l'utilisateur plutôt que
// de se limiter à la seule couverture trouvée lors de l'ajout du livre.
//
// Utilisé par BookList.jsx et BookDetail.jsx.

export async function rechercherCouvertures(titre, auteur) {
  if (!titre || !titre.trim()) return [];

  const requete = `${titre} ${auteur || ""}`.trim();
  const champs = "cover_i,title,author_name";

  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        requete
      )}&limit=30&fields=${champs}`
    );

    if (!res.ok) {
      throw new Error(`Open Library a répondu avec le statut ${res.status}`);
    }

    const data = await res.json();

    // Plusieurs éditions d'un même livre peuvent avoir la même couverture
    // (même cover_i) : on déduplique pour ne pas proposer plusieurs fois
    // visuellement la même image.
    const idsVus = new Set();
    const couvertures = [];

    (data.docs || []).forEach((doc) => {
      if (doc.cover_i && !idsVus.has(doc.cover_i)) {
        idsVus.add(doc.cover_i);
        couvertures.push({
          id: doc.cover_i,
          thumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
          large: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
        });
      }
    });

    // On limite le nombre de propositions affichées pour ne pas surcharger
    // le panneau (les résultats Open Library sont déjà triés par pertinence).
    return couvertures.slice(0, 12);
  } catch (err) {
    console.error("Erreur recherche de couvertures :", err);
    return [];
  }
}
