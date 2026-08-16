import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./Friends.css";

function Friends() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [terme, setTerme] = useState("");
  const [resultats, setResultats] = useState([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [aRecherche, setARecherche] = useState(false);

  const [demandesRecues, setDemandesRecues] = useState([]);
  const [demandesEnvoyees, setDemandesEnvoyees] = useState([]);
  const [amis, setAmis] = useState([]);

  const [lienCopie, setLienCopie] = useState(false);
  const [erreur, setErreur] = useState("");

  const lienInvitation = `${window.location.origin}/invite/${uid}`;

  // =========================
  // ÉCOUTE TEMPS RÉEL
  // =========================

  useEffect(() => {
    if (!uid) return;

    const qRecues = query(
      collection(db, "friendRequests"),
      where("to", "==", uid),
      where("status", "==", "pending")
    );
    const unsubRecues = onSnapshot(qRecues, (snap) => {
      setDemandesRecues(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });

    const qEnvoyees = query(
      collection(db, "friendRequests"),
      where("from", "==", uid),
      where("status", "==", "pending")
    );
    const unsubEnvoyees = onSnapshot(qEnvoyees, (snap) => {
      setDemandesEnvoyees(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });

    const qAmis = query(collection(db, "users", uid, "friends"));
    const unsubAmis = onSnapshot(qAmis, (snap) => {
      setAmis(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRecues();
      unsubEnvoyees();
      unsubAmis();
    };
  }, [uid]);

  // =========================
  // RECHERCHE PAR PSEUDO
  // =========================

  const rechercher = async (e) => {
    e.preventDefault();
    const termeNormalise = terme.trim().toLowerCase();
    if (!termeNormalise) return;

    setRechercheEnCours(true);
    setARecherche(true);
    setErreur("");

    try {
      const q = query(
        collection(db, "users"),
        orderBy("pseudoLower"),
        where("pseudoLower", ">=", termeNormalise),
        where("pseudoLower", "<=", termeNormalise + "\uf8ff"),
        limit(10)
      );

      const snap = await getDocs(q);

      const trouves = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== uid);

      setResultats(trouves);
    } catch (err) {
      console.error("Erreur recherche utilisateurs :", err);
      setErreur("La recherche a échoué, réessaie.");
    } finally {
      setRechercheEnCours(false);
    }
  };

  // =========================
  // ENVOYER UNE DEMANDE
  // =========================

  const envoyerDemande = async (utilisateurCible) => {
    if (!uid) return;
    setErreur("");

    try {
      const requestId = `${uid}_${utilisateurCible.id}`;

      await setDoc(doc(db, "friendRequests", requestId), {
        from: uid,
        to: utilisateurCible.id,
        fromPseudo:
          auth.currentUser.displayName || auth.currentUser.email || "",
        fromPhoto: auth.currentUser.photoURL || "",
        toPseudo: utilisateurCible.pseudo || "",
        toPhoto: utilisateurCible.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Erreur envoi demande d'ami :", err);
      setErreur("Impossible d'envoyer la demande.");
    }
  };

  // =========================
  // ACCEPTER UNE DEMANDE
  // =========================

  const accepterDemande = async (demande) => {
    setErreur("");

    try {
      const batch = writeBatch(db);

      batch.set(doc(db, "users", uid, "friends", demande.from), {
        pseudo: demande.fromPseudo || "",
        photoURL: demande.fromPhoto || "",
        since: serverTimestamp(),
      });

      batch.set(doc(db, "users", demande.from, "friends", uid), {
        pseudo: auth.currentUser.displayName || "",
        photoURL: auth.currentUser.photoURL || "",
        since: serverTimestamp(),
      });

      batch.delete(doc(db, "friendRequests", demande.id));

      await batch.commit();
    } catch (err) {
      console.error("Erreur acceptation demande :", err);
      setErreur("Impossible d'accepter cette demande.");
    }
  };

  // =========================
  // REFUSER / ANNULER UNE DEMANDE
  // =========================

  const refuserDemande = async (demandeId) => {
    try {
      await deleteDoc(doc(db, "friendRequests", demandeId));
    } catch (err) {
      console.error("Erreur refus demande :", err);
    }
  };

  // =========================
  // RETIRER UN AMI
  // =========================

  const retirerAmi = async (amiId) => {
    if (!window.confirm("Retirer cette personne de tes amis ?")) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", uid, "friends", amiId));
      batch.delete(doc(db, "users", amiId, "friends", uid));
      await batch.commit();
    } catch (err) {
      console.error("Erreur suppression ami :", err);
    }
  };

  // =========================
  // COPIER LE LIEN D'INVITATION
  // =========================

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienInvitation);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 2000);
    } catch (err) {
      console.error("Erreur copie lien :", err);
    }
  };

  const idsExistants = new Set([
    ...amis.map((a) => a.id),
    ...demandesEnvoyees.map((d) => d.to),
    ...demandesRecues.map((d) => d.from),
  ]);

  return (
    <div className="friends-page">
      <button className="back-btn" onClick={() => navigate("/")}>
        ← Retour à la bibliothèque
      </button>

      <section className="page-intro friends-intro">
        <div>
          <span className="page-eyebrow">SOCIAL</span>
          <h2>Mes amis</h2>
          <p>
            Retrouve d'autres lecteurs, compare vos bibliothèques et vos
            statistiques.
          </p>
        </div>
      </section>

      {/* ----------------------------- */}
      {/* Lien d'invitation */}
      {/* ----------------------------- */}

      <div className="friends-card invite-card">
        <h3>Inviter un ami</h3>
        <p>
          Partage ce lien : la personne qui l'ouvre en étant connectée devient
          automatiquement ton amie.
        </p>
        <div className="invite-link-row">
          <input type="text" readOnly value={lienInvitation} />
          <button type="button" onClick={copierLien}>
            {lienCopie ? "✓ Copié" : "Copier"}
          </button>
        </div>
      </div>

      {/* ----------------------------- */}
      {/* Recherche */}
      {/* ----------------------------- */}

      <div className="friends-card">
        <h3>Rechercher par pseudo</h3>

        <form onSubmit={rechercher} className="friends-search-bar">
          <input
            type="text"
            placeholder="Pseudo d'un lecteur..."
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
          />
          <button type="submit" disabled={rechercheEnCours}>
            {rechercheEnCours ? "..." : "Rechercher"}
          </button>
        </form>

        {erreur && <p className="friends-error">{erreur}</p>}

        {aRecherche && !rechercheEnCours && resultats.length === 0 && (
          <p className="friends-empty">Aucun lecteur trouvé.</p>
        )}

        {resultats.length > 0 && (
          <ul className="friends-list">
            {resultats.map((u) => (
              <li key={u.id} className="friend-row">
                <div className="friend-identity">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.pseudo} />
                  ) : (
                    <div className="friend-avatar-placeholder">
                      {(u.pseudo || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{u.pseudo}</span>
                </div>

                {idsExistants.has(u.id) ? (
                  <span className="friend-status-tag">
                    {amis.some((a) => a.id === u.id)
                      ? "Déjà ami"
                      : "Demande en cours"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="friend-action-btn"
                    onClick={() => envoyerDemande(u)}
                  >
                    + Ajouter
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ----------------------------- */}
      {/* Demandes reçues */}
      {/* ----------------------------- */}

      {demandesRecues.length > 0 && (
        <div className="friends-card">
          <h3>Demandes reçues ({demandesRecues.length})</h3>

          <ul className="friends-list">
            {demandesRecues.map((d) => (
              <li key={d.id} className="friend-row">
                <div className="friend-identity">
                  {d.fromPhoto ? (
                    <img src={d.fromPhoto} alt={d.fromPseudo} />
                  ) : (
                    <div className="friend-avatar-placeholder">
                      {(d.fromPseudo || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{d.fromPseudo}</span>
                </div>

                <div className="friend-row-actions">
                  <button
                    type="button"
                    className="friend-action-btn accept"
                    onClick={() => accepterDemande(d)}
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    className="friend-action-btn decline"
                    onClick={() => refuserDemande(d.id)}
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ----------------------------- */}
      {/* Demandes envoyées */}
      {/* ----------------------------- */}

      {demandesEnvoyees.length > 0 && (
        <div className="friends-card">
          <h3>Demandes envoyées ({demandesEnvoyees.length})</h3>

          <ul className="friends-list">
            {demandesEnvoyees.map((d) => (
              <li key={d.id} className="friend-row">
                <div className="friend-identity">
                  {d.toPhoto ? (
                    <img src={d.toPhoto} alt={d.toPseudo} />
                  ) : (
                    <div className="friend-avatar-placeholder">
                      {(d.toPseudo || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{d.toPseudo}</span>
                </div>

                <button
                  type="button"
                  className="friend-action-btn decline"
                  onClick={() => refuserDemande(d.id)}
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ----------------------------- */}
      {/* Liste d'amis */}
      {/* ----------------------------- */}

      <div className="friends-card">
        <h3>Mes amis ({amis.length})</h3>

        {amis.length === 0 ? (
          <p className="friends-empty">
            Tu n'as pas encore d'amis sur Booklira.
          </p>
        ) : (
          <ul className="friends-list">
            {amis.map((a) => (
              <li key={a.id} className="friend-row">
                <Link to={`/friends/${a.id}`} className="friend-identity">
                  {a.photoURL ? (
                    <img src={a.photoURL} alt={a.pseudo} />
                  ) : (
                    <div className="friend-avatar-placeholder">
                      {(a.pseudo || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{a.pseudo}</span>
                </Link>

                <div className="friend-row-actions">
                  <Link
                    to={`/friends/${a.id}`}
                    className="friend-action-btn"
                  >
                    Voir le profil
                  </Link>
                  <button
                    type="button"
                    className="friend-action-btn decline"
                    onClick={() => retirerAmi(a.id)}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Friends;
