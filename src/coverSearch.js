// Recherche plusieurs couvertures possibles pour un livre (titre + auteur)
// via l'API Open Library, pour proposer un choix à l'utilisateur plutôt que
// de se limiter à la seule couverture trouvée lors de l'ajout du livre.
//
// Utilisé par BookList.jsx et BookDetail.jsx.
//
// IMPORTANT : search.json regroupe ses résultats par "œuvre" (un livre au
// sens large) et ne renvoie qu'UNE SEULE couverture par œuvre correspondante.
// Pour avoir une vraie variété (éditions, traductions, formats poche/grand
// format, rééditions...), il faut d'abord repérer l'œuvre correspondante
// puis aller chercher la liste de TOUTES ses éditions, chacune pouvant avoir
// sa propre couverture.

function versCouverture(coverId) {
  return {
    id: coverId,
    thumbnail: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
    large: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
  };
}

export async function rechercherCouvertures(titre, auteur) {
  if (!titre || !titre.trim()) return [];

  const requete = `${titre} ${auteur || ""}`.trim();

  try {
    // 1. Repérer l'œuvre correspondant le mieux à la recherche.
    const resRecherche = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        requete
      )}&limit=1&fields=key,cover_i`
    );

    if (!resRecherche.ok) {
      throw new Error(
        `Recherche Open Library : statut ${resRecherche.status}`
      );
    }

    const dataRecherche = await resRecherche.json();
    const oeuvre = dataRecherche.docs?.[0];

    if (!oeuvre?.key) return [];

    const idsVus = new Set();
    const couvertures = [];

    // 2. Récupérer toutes les éditions connues de cette œuvre : c'est là
    // que se trouve la vraie variété, chaque édition pouvant avoir sa
    // propre couverture (contrairement à la recherche par mot-clé, qui ne
    // donne qu'une couverture par œuvre correspondante).
    const resEditions = await fetch(
      `https://openlibrary.org${oeuvre.key}/editions.json?limit=50`
    );

    if (resEditions.ok) {
      const dataEditions = await resEditions.json();

      (dataEditions.entries || []).forEach((edition) => {
        const coverId = (edition.covers || []).find((c) => c && c > 0);

        if (coverId && !idsVus.has(coverId)) {
          idsVus.add(coverId);
          couvertures.push(versCouverture(coverId));
        }
      });
    }

    // Repli : si l'œuvre a une couverture "principale" pas encore présente
    // dans la liste des éditions, on la place en premier (c'est en général
    // la couverture la plus représentative du livre).
    if (oeuvre.cover_i && !idsVus.has(oeuvre.cover_i)) {
      couvertures.unshift(versCouverture(oeuvre.cover_i));
    }

    return couvertures.slice(0, 24);
  } catch (err) {
    console.error("Erreur recherche de couvertures :", err);
    return [];
  }
}
