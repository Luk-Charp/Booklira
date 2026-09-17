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

const CACHE_PREFIX = "booklira:cover-search:";
const CACHE_TTL = 24 * 60 * 60 * 1000;

function lireCacheCle(cle) {
  try {
    const brut = sessionStorage.getItem(CACHE_PREFIX + cle);

    if (!brut) return null;

    const donnees = JSON.parse(brut);

    if (
      !donnees ||
      !Array.isArray(donnees.resultats) ||
      typeof donnees.date !== "number" ||
      Date.now() - donnees.date > CACHE_TTL
    ) {
      sessionStorage.removeItem(CACHE_PREFIX + cle);
      return null;
    }

    return donnees.resultats;
  } catch {
    return null;
  }
}

function ecrireCacheCle(cle, resultats) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + cle,
      JSON.stringify({
        date: Date.now(),
        resultats,
      })
    );
  } catch {
    // Le cache est facultatif : une sessionStorage indisponible
    // ne doit jamais empêcher la recherche.
  }
}

function normaliserCle(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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
  const cacheKey = normaliserCle(requete);

  // Évite de refaire les mêmes requêtes Open Library pendant 24 h.
  const resultatsEnCache = lireCacheCle(cacheKey);

  if (resultatsEnCache) {
    return resultatsEnCache;
  }

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

    if (!oeuvre?.key) {
      ecrireCacheCle(cacheKey, []);
      return [];
    }

    const idsVus = new Set();
    const couvertures = [];

    // 2. Récupérer les différentes éditions de l'œuvre.
    const resEditions = await fetch(
      `https://openlibrary.org${oeuvre.key}/editions.json?limit=50`
    );

    if (resEditions.ok) {
      const dataEditions = await resEditions.json();

      (dataEditions.entries || []).forEach((edition) => {
        const coverId = (edition.covers || []).find(
          (c) => c && c > 0
        );

        if (coverId && !idsVus.has(coverId)) {
          idsVus.add(coverId);
          couvertures.push(versCouverture(coverId));
        }
      });
    }

    // Repli : ajouter la couverture principale si elle n'est
    // pas déjà présente dans les éditions.
    if (oeuvre.cover_i && !idsVus.has(oeuvre.cover_i)) {
      couvertures.unshift(versCouverture(oeuvre.cover_i));
    }

    const resultats = couvertures.slice(0, 24);

    ecrireCacheCle(cacheKey, resultats);

    return resultats;
  } catch (err) {
    console.error("Erreur recherche de couvertures :", err);
    return [];
  }
}