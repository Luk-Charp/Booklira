import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebase";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(traduireErreur(err.code));
    }
  };

  const traduireErreur = (code) => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Cet email est déjà utilisé.";
      case "auth/invalid-email":
        return "Email invalide.";
      case "auth/weak-password":
        return "Mot de passe trop court (6 caractères minimum).";
      case "auth/invalid-credential":
        return "Email ou mot de passe incorrect.";
      default:
        return "Une erreur est survenue.";
    }
  };

  return (
    <div className="login-container">
      <h1>📚 Ma bibliothèque</h1>
      <form onSubmit={handleSubmit} className="login-form">
        <h2>{isRegistering ? "Créer un compte" : "Connexion"}</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit">
          {isRegistering ? "S'inscrire" : "Se connecter"}
        </button>

        <p className="toggle-text" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering
            ? "Déjà un compte ? Se connecter"
            : "Pas de compte ? S'inscrire"}
        </p>
      </form>
    </div>
  );
}

export default Login;