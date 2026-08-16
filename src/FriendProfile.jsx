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

function FriendProfile() {
  const { uid: amiId } = useParams();
  const navigate = useNavigate();
  const moi = auth.currentUser?.uid;

  const [chargement, setChargement] = useState(true);
  const [estAmi, setEstAmi] = useState(false);
  const [profilAmi, setProfilAmi] = useState(null);
  const [livres, setLivres] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      setErreur("");

      try {
        // 1. Vérifier que c'est bien un ami (côté client, la
        // vraie protection reste les règles de sécurité Firestore)
        const lienAmitie = await getDoc(
          doc(db, "users", moi, "friends", amiId)
        );

        if (!lienAmitie.exists()) {
          setEstAmi(false);
          setChargement(false);
          return;
        }

        setEstAmi(true);

        // 2. Profil public de l'ami
        const profilSnap = await getDoc(doc(db, "users", amiId));
        if (!profilSnap.exists()) {
          setErreur("Ce profil n'existe plus.");
          setChargement(false);
          return;
        }

        const profil = profilSnap.data();
        setProfilAmi(profil);

        // 3. Livres lus, uniquement si autorisé
        if (profil.visibilite?.livres) {
          const q = query(
            collection(db, "books"),
            where("userId", "==", amiId),
            where("statut", "==", "lu")
          );
          const snap = await getDocs(q);
          setLivres(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error("Erreur chargement profil ami :", err);
        setErreur("Impossible de charger ce profil pour le moment.");
      } finally {
        setChargement(false);
      }
    };

    if (moi && amiId) charger();
  }, [moi, amiId]);

  if (chargement) {
    return <p className="detail-loading">Chargement...</p>;
  }

  if (!estAmi) {
    return (
      <div className="friend-profile-page">
        <button className="back-btn" onClick={() => navigate("/friends")}>
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
  const totalPages = livres.reduce((s, l) => s + (l.pages || 0), 0);
  const notes = livres.filter((l) => l.note).map((l) => l.note);
  const noteMoyenne =
    notes.length > 0
      ? (notes.reduce((s, n) => s + n, 0) / notes.length).toFixed(1)
      : null;

  return (
    <div className="friend-profile-page">
      <button className="back-btn" onClick={() => navigate("/friends")}>
        ← Retour aux amis
      </button>

      <div className="friend-profile-header">
        {profilAmi.photoURL ? (
          <img
            src={profilAmi.photoURL}
            alt={profilAmi.pseudo}
            className="friend-profile-avatar"
          />
        ) : (
          <div className="friend-profile-avatar friend-avatar-placeholder">
            {(profilAmi.pseudo || "?").charAt(0).toUpperCase()}
          </div>
        )}

        <h1>{profilAmi.pseudo}</h1>
      </div>

      {erreur && <p className="friends-error">{erreur}</p>}

      {/* ----------------------------- */}
      {/* Statistiques */}
      {/* ----------------------------- */}

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
          {profilAmi.pseudo} a choisi de ne pas partager ses statistiques.
        </p>
      )}

      {/* ----------------------------- */}
      {/* Bibliothèque */}
      {/* ----------------------------- */}

      <div className="friends-card">
        <h3>Livres lus</h3>

        {!visibilite.livres ? (
          <p className="friends-empty">
            {profilAmi.pseudo} a choisi de garder sa bibliothèque privée.
          </p>
        ) : livres.length === 0 ? (
          <p className="friends-empty">Aucun livre lu pour le moment.</p>
        ) : (
          <ul className="friend-books-list">
            {livres.map((l) => (
              <li key={l.id} className="friend-book-row">
                <div className="friend-book-cover">
                  {l.couverture ? (
                    <img src={l.couverture} alt={l.titre} />
                  ) : (
                    <span>📖</span>
                  )}
                </div>

                <div className="friend-book-info">
                  <strong>{l.titre}</strong>
                  <p>{l.auteur}</p>

                  {visibilite.notes && l.note ? (
                    <span className="friend-book-note">
                      {"★".repeat(l.note)}
                      {"☆".repeat(5 - l.note)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FriendProfile;
