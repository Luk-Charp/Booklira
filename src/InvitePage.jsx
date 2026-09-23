import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import "./Friends.css";

function InvitePage() {
  const { uid: hoteId } = useParams();
  const moi = auth.currentUser?.uid;

  // chargement | succes | deja_ami | soi-meme | introuvable | erreur
  const [statut, setStatut] = useState("chargement");
  const [pseudoHote, setPseudoHote] = useState("");

  useEffect(() => {
    const traiter = async () => {
      // Le lien peut être ouvert avant la connexion.
      if (!moi) {
        setStatut("connexion");
        return;
      }

      if (!hoteId) {
        setStatut("introuvable");
        return;
      }

      if (moi === hoteId) {
        setStatut("soi-meme");
        return;
      }

      try {
        // Récupérer les deux profils.
        const [hoteSnap, moiSnap, dejaAmi] = await Promise.all([
          getDoc(doc(db, "users", hoteId)),
          getDoc(doc(db, "users", moi)),
          getDoc(doc(db, "users", moi, "friends", hoteId)),
        ]);

        if (!hoteSnap.exists()) {
          setStatut("introuvable");
          return;
        }

        const hote = hoteSnap.data();
        const monProfil = moiSnap.exists() ? moiSnap.data() : {};

        setPseudoHote(hote.pseudo || "ce lecteur");

        if (dejaAmi.exists()) {
          setStatut("deja_ami");
          return;
        }

        // Le lien d'invitation est une invitation directe :
        // il crée l'amitié des deux côtés dans une seule opération.
        //
        // Important : on ne lit/supprime PAS friendRequests ici.
        // Les règles Firestore actuelles utilisent resource.data pour
        // les lectures/suppressions de cette collection, ce qui peut
        // provoquer une permission-denied lorsqu'une demande n'existe pas.
        const batch = writeBatch(db);

        batch.set(doc(db, "users", moi, "friends", hoteId), {
          pseudo: hote.pseudo || "",
          photoURL: hote.photoURL || "",
          since: serverTimestamp(),
        });

        batch.set(doc(db, "users", hoteId, "friends", moi), {
          pseudo:
            monProfil.pseudo ||
            auth.currentUser.displayName ||
            auth.currentUser.email ||
            "",
          photoURL:
            monProfil.photoURL ||
            auth.currentUser.photoURL ||
            "",
          since: serverTimestamp(),
        });

        await batch.commit();

        setStatut("succes");
      } catch (err) {
        console.error(
          "Erreur traitement invitation :",
          err.code,
          err.message,
          err
        );
        setStatut("erreur");
      }
    };

    traiter();
  }, [moi, hoteId]);

  return (
    <div className="friends-page">
      <div className="friends-card" style={{ textAlign: "center" }}>
        {statut === "chargement" && (
          <p>Traitement de l'invitation...</p>
        )}

        {statut === "connexion" && (
          <>
            <h3>Connecte-toi pour accepter l'invitation</h3>
            <p>
              Connecte-toi à Booklira puis ouvre à nouveau ce lien
              d'invitation.
            </p>
          </>
        )}

        {statut === "succes" && (
          <>
            <h3>C'est fait ! 🎉</h3>
            <p>
              Tu es maintenant ami avec <strong>{pseudoHote}</strong> sur
              Booklira.
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
          <>
            <h3>Impossible de traiter l'invitation</h3>
            <p>
              Une erreur est survenue. Vérifie que tu es bien connecté
              puis réessaie.
            </p>
          </>
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
