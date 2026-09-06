import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "./firebase";
import "./Friends.css";

function InvitePage() {
  const { uid: hoteId } = useParams();
  const moi = auth.currentUser?.uid;

  // chargement | succes | deja_ami | demande_envoyee | soi-meme | introuvable | erreur
  const [statut, setStatut] = useState("chargement");
  const [pseudoHote, setPseudoHote] = useState("");

  useEffect(() => {
    const traiter = async () => {
      if (!moi) return;

      if (moi === hoteId) {
        setStatut("soi-meme");
        return;
      }

      try {
        const hoteSnap = await getDoc(doc(db, "users", hoteId));

        if (!hoteSnap.exists()) {
          setStatut("introuvable");
          return;
        }

        const hote = hoteSnap.data();
        setPseudoHote(hote.pseudo || "");

        // Déjà amis ?
        const dejaAmi = await getDoc(doc(db, "users", moi, "friends", hoteId));
        if (dejaAmi.exists()) {
          setStatut("deja_ami");
          return;
        }

        // =========================================================
        // Cas 1 : l'hôte avait DÉJÀ envoyé une demande à ce visiteur
        // (ex. il a demandé son ami via la recherche par pseudo, et
        // lui envoie maintenant son lien pour accélérer). Dans ce
        // cas, ouvrir le lien vaut acceptation explicite : on appelle
        // directement la Cloud Function, qui vérifie elle-même que
        // "moi" est bien le destinataire de cette demande précise.
        // =========================================================
        const requestIdRecu = `${hoteId}_${moi}`;
        const demandeRecue = await getDoc(
          doc(db, "friendRequests", requestIdRecu)
        );

        if (demandeRecue.exists()) {
          const accepter = httpsCallable(functions, "accepterAmi");
          await accepter({ requestId: requestIdRecu });
          setStatut("succes");
          return;
        }

        // =========================================================
        // Cas 2 : premier contact. Ouvrir le lien envoie une demande
        // d'ami à l'hôte — ça ne crée PAS l'amitié. L'hôte doit
        // encore l'accepter depuis sa page "Amis" (comme n'importe
        // quelle autre demande), ce qui déclenchera la même Cloud
        // Function côté serveur.
        // =========================================================
        const requestIdEnvoyee = `${moi}_${hoteId}`;
        const demandeDejaEnvoyee = await getDoc(
          doc(db, "friendRequests", requestIdEnvoyee)
        );

        if (!demandeDejaEnvoyee.exists()) {
          await setDoc(doc(db, "friendRequests", requestIdEnvoyee), {
            from: moi,
            to: hoteId,
            fromPseudo:
              auth.currentUser.displayName || auth.currentUser.email || "",
            fromPhoto: auth.currentUser.photoURL || "",
            toPseudo: hote.pseudo || "",
            toPhoto: hote.photoURL || "",
            status: "pending",
            createdAt: serverTimestamp(),
          });
        }

        setStatut("demande_envoyee");
      } catch (err) {
        console.error("Erreur traitement invitation :", err);
        setStatut("erreur");
      }
    };

    traiter();
  }, [moi, hoteId]);

  return (
    <div className="friends-page">
      <div className="friends-card" style={{ textAlign: "center" }}>
        {statut === "chargement" && <p>Traitement de l'invitation...</p>}

        {statut === "succes" && (
          <>
            <h3>C'est fait ! 🎉</h3>
            <p>
              Tu es maintenant ami avec <strong>{pseudoHote}</strong> sur
              Booklira.
            </p>
          </>
        )}

        {statut === "demande_envoyee" && (
          <>
            <h3>Demande envoyée ✉️</h3>
            <p>
              <strong>{pseudoHote}</strong> doit encore accepter ta demande
              pour que vous deveniez amis.
            </p>
          </>
        )}

        {statut === "deja_ami" && (
          <>
            <h3>Déjà amis</h3>
            <p>
              Tu es déjà ami avec <strong>{pseudoHote}</strong>.
            </p>
          </>
        )}

        {statut === "soi-meme" && (
          <p>C'est ton propre lien d'invitation !</p>
        )}

        {statut === "introuvable" && (
          <p>Ce lien d'invitation n'est plus valide.</p>
        )}

        {statut === "erreur" && (
          <p>Une erreur est survenue, réessaie dans un instant.</p>
        )}

        <div style={{ marginTop: 16 }}>
          <Link to="/friends" className="friend-action-btn">
            Voir mes amis
          </Link>
        </div>
      </div>
    </div>
  );
}

export default InvitePage;
