import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./Friends.css";
import "./FriendProfile.css";

const LIVRES_PAR_PAGE = 35;

function FriendProfile() {
  const { uid: amiId } = useParams();
  const navigate = useNavigate();
  const moi = auth.currentUser?.uid;

  const [chargement, setChargement] = useState(true);
  const [estAmi, setEstAmi] = useState(false);
  const [profilAmi, setProfilAmi] = useState(null);
  const [livres, setLivres] = useState([]);
  const [erreur, setErreur] = useState("");

  const [onglet, setOnglet] = useState("lus");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      setErreur("");

      try {
        const lienAmitie = await getDoc(
          doc(db, "users", moi, "friends", amiId)
        );

        if (!lienAmitie.exists()) {
          setEstAmi(false);
          setChargement(false);
          return;
        }

        setEstAmi(true);

        const profilSnap = await getDoc(
          doc(db, "users", amiId)
        );

        if (!profilSnap.exists()) {
          setErreur("Ce profil n'existe plus.");
          setChargement(false);
          return;
        }

        const profil = profilSnap.data();

        const visibiliteNormalisee = {
          livres: profil.visibilite?.livres ?? true,
          notes: profil.visibilite?.notes ?? true,
          stats: profil.visibilite?.stats ?? true,
        };

        setProfilAmi({
          ...profil,
          visibilite: visibiliteNormalisee,
        });

        if (visibiliteNormalisee.livres) {
          const q = query(
            collection(db, "books"),
            where("userId", "==", amiId),
            where("statut", "==", "lu")
          );

          const snap = await getDocs(q);

          setLivres(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
        }
      } catch (err) {
        console.error("Erreur chargement profil ami :", err);
        setErreur(
          "Impossible de charger ce profil pour le moment."
        );
      } finally {
        setChargement(false);
      }
    };

    if (moi && amiId) {
      charger();
    }
  }, [moi, amiId]);

  if (chargement) {
    return <p className="detail-loading">Chargement...</p>;
  }

  if (!estAmi) {
    return (
      <div className="friend-profile-page">
        <button
          className="back-btn"
          onClick={() => navigate("/friends")}
        >
          ← Retour aux amis
        </button>

        <p className="friends-empty">
          Vous n'êtes pas amis, ou cette personne n'existe pas.
        </p>
      </div>
    );
  }

  const visibilite = profilAmi?.visibilite || {};

  const nbLivres = livres.length;

  const totalPages = livres.reduce(
    (s, l) => s + (l.pages || 0),
    0
  );

  const notes = livres
    .filter((l) => l.note)
    .map((l) => l.note);

  const noteMoyenne =
    notes.length > 0
      ? (
          notes.reduce((s, n) => s + n, 0) /
          notes.length
        ).toFixed(1)
      : null;

  // =========================================================
  // FAVORIS
  // =========================================================

  const livresFavoris = livres.filter(
    (livre) =>
      livre.favori === true ||
      livre.favorite === true ||
      livre.isFavorite === true
  );

  const livresAffiches =
    onglet === "favoris" ? livresFavoris : livres;

  // =========================================================
  // PAGINATION
  // 7 livres x 5 lignes = 35 livres par page
  // =========================================================

  const totalPagesPagination = Math.max(
    1,
    Math.ceil(
      livresAffiches.length / LIVRES_PAR_PAGE
    )
  );

  const debut = (page - 1) * LIVRES_PAR_PAGE;

  const livresPage = livresAffiches.slice(
    debut,
    debut + LIVRES_PAR_PAGE
  );

  const changerOnglet = (nouvelOnglet) => {
    setOnglet(nouvelOnglet);
    setPage(1);
  };

  const changerPage = (nouvellePage) => {
    if (
      nouvellePage < 1 ||
      nouvellePage > totalPagesPagination
    ) {
      return;
    }

    setPage(nouvellePage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="friend-profile-page">

      {/* =====================================================
          RETOUR
      ===================================================== */}

      <button
        className="back-btn"
        onClick={() => navigate("/friends")}
      >
        ← Retour aux amis
      </button>

      {/* =====================================================
          PROFIL
      ===================================================== */}

      <div className="friend-profile-header">
        {profilAmi.photoURL ? (
          <img
            src={profilAmi.photoURL}
            alt={profilAmi.pseudo}
            className="friend-profile-avatar"
          />
        ) : (
          <div className="friend-profile-avatar friend-avatar-placeholder">
            {(profilAmi.pseudo || "?")
              .charAt(0)
              .toUpperCase()}
          </div>
        )}

        <h1>{profilAmi.pseudo}</h1>
      </div>

      {erreur && (
        <p className="friends-error">
          {erreur}
        </p>
      )}

      {/* =====================================================
          STATISTIQUES
      ===================================================== */}

      {visibilite.stats ? (
        <div className="friends-card friend-stats-grid">

          <div className="friend-stat">
            <strong>{nbLivres}</strong>
            <span>Livres lus</span>
          </div>

          <div className="friend-stat">
            <strong>{totalPages}</strong>
            <span>Pages lues</span>
          </div>

          <div className="friend-stat">
            <strong>{noteMoyenne ?? "—"}</strong>
            <span>Note moyenne</span>
          </div>

        </div>
      ) : (
        <p className="friends-empty">
          {profilAmi.pseudo} a choisi de ne pas partager
          ses statistiques.
        </p>
      )}

      {/* =====================================================
          BIBLIOTHÈQUE
      ===================================================== */}

      <div className="friends-card friend-library-card">

        {!visibilite.livres ? (
          <>
            <h3>Bibliothèque</h3>

            <p className="friends-empty">
              {profilAmi.pseudo} a choisi de garder sa
              bibliothèque privée.
            </p>
          </>
        ) : (
          <>
            {/* ONGLET */}

            <div className="friend-library-tabs">

              <button
                type="button"
                className={`friend-library-tab ${
                  onglet === "lus" ? "active" : ""
                }`}
                onClick={() => changerOnglet("lus")}
              >
                Livres lus
                <span>{livres.length}</span>
              </button>

              <button
                type="button"
                className={`friend-library-tab ${
                  onglet === "favoris" ? "active" : ""
                }`}
                onClick={() => changerOnglet("favoris")}
              >
                ★ Favoris
                <span>{livresFavoris.length}</span>
              </button>

            </div>

            {/* LIVRES */}

            {livresAffiches.length === 0 ? (
              <div className="friend-books-empty">

                <div className="friend-books-empty-icon">
                  {onglet === "favoris" ? "★" : "📖"}
                </div>

                <h4>
                  {onglet === "favoris"
                    ? "Aucun favori"
                    : "Aucun livre lu"}
                </h4>

                <p>
                  {onglet === "favoris"
                    ? "Les livres ajoutés aux favoris apparaîtront ici."
                    : "Aucun livre lu pour le moment."}
                </p>

              </div>
            ) : (
              <>
                <ul className="friend-books-grid">

                  {livresPage.map((livre) => (
                    <li
                      key={livre.id}
                      className="friend-book-card"
                    >
                      <div className="friend-book-cover">
                        {livre.couverture ? (
                          <img
                            src={livre.couverture}
                            alt={livre.titre}
                            loading="lazy"
                          />
                        ) : (
                          <span>📖</span>
                        )}
                      </div>

                      <div className="friend-book-info">

                        <strong title={livre.titre}>
                          {livre.titre}
                        </strong>

                        <p title={livre.auteur}>
                          {livre.auteur}
                        </p>

                        {visibilite.notes &&
                        livre.note ? (
                          <span className="friend-book-note">
                            {"★".repeat(livre.note)}
                            {"☆".repeat(
                              5 - livre.note
                            )}
                          </span>
                        ) : null}

                      </div>
                    </li>
                  ))}

                </ul>

                {/* PAGINATION */}

                {totalPagesPagination > 1 && (
                  <div className="friend-pagination">

                    <button
                      type="button"
                      className="friend-pagination-arrow"
                      onClick={() =>
                        changerPage(page - 1)
                      }
                      disabled={page === 1}
                    >
                      ←
                    </button>

                    <div className="friend-pagination-pages">

                      {Array.from(
                        {
                          length: totalPagesPagination,
                        },
                        (_, index) => index + 1
                      ).map((numeroPage) => (
                        <button
                          key={numeroPage}
                          type="button"
                          className={
                            page === numeroPage
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            changerPage(numeroPage)
                          }
                        >
                          {numeroPage}
                        </button>
                      ))}

                    </div>

                    <button
                      type="button"
                      className="friend-pagination-arrow"
                      onClick={() =>
                        changerPage(page + 1)
                      }
                      disabled={
                        page === totalPagesPagination
                      }
                    >
                      →
                    </button>

                  </div>
                )}

                <p className="friend-pagination-info">
                  Page {page} sur {totalPagesPagination}
                  {" · "}
                  {livresAffiches.length} livre
                  {livresAffiches.length > 1
                    ? "s"
                    : ""}
                </p>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default FriendProfile;