import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";
import "./Friends.css";

function InvitePage() {
  const { uid: hoteId } = useParams();
  const moi = auth.currentUser?.uid;

  const [statut, setStatut] = useState("chargement"); // chargement | succes | soi-meme | deja_ami | introuvable | erreur
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

        const dejaAmi = await getDoc(
          doc(db, "users", moi, "friends", hoteId)
        );

        if (dejaAmi.exists()) {
          setStatut("deja_ami");
          return;
        }

        const moiSnap = await getDoc(doc(db, "users", moi));
        const moiData = moiSnap.exists() ? moiSnap.data() : {};

        const batch = writeBatch(db);

        batch.set(doc(db, "users", moi, "friends", hoteId), {
          pseudo: hote.pseudo || "",
          photoURL: hote.photoURL || "",
          since: serverTimestamp(),
        });

        batch.set(doc(db, "users", hoteId, "friends", moi), {
          pseudo: moiData.pseudo || auth.currentUser.displayName || "",
          photoURL: moiData.photoURL || auth.currentUser.photoURL || "",
          since: serverTimestamp(),
        });

        await batch.commit();

        setStatut("succes");
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
