import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";
import "./Login.css";

function BookIcon({ type }) {
  if (type === "user") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.4 3.2-5.2 7-5.2s6.2 1.8 7 5.2" />
      </svg>
    );
  }

  if (type === "mail") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function BookliraLogo() {
  return (
    <div className="brand">
      <div className="brand-logo" aria-hidden="true">
        <span className="book book-green"></span>
        <span className="book book-pink"></span>
        <span className="book book-blue"></span>
      </div>

      <div className="brand-name">
        <span>Booklira</span>
        <small>BOOKTRACKER</small>
      </div>
    </div>
  );
}

function Login() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        if (!nom.trim()) {
          setError("Merci d'indiquer ton nom.");
          setLoading(false);
          return;
        }

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await updateProfile(userCredential.user, {
          displayName: nom.trim(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }
    } catch (err) {
      setError(traduireErreur(err.code));
    } finally {
      setLoading(false);
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

      case "auth/user-not-found":
        return "Aucun compte ne correspond à cet email.";

      case "auth/wrong-password":
        return "Email ou mot de passe incorrect.";

      case "auth/too-many-requests":
        return "Trop de tentatives. Réessaie dans quelques instants.";

      default:
        return "Une erreur est survenue.";
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
    setPassword("");
  };

  return (
    <main className="login-page">
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>
      <div className="ambient ambient-three"></div>

      <div className="login-content">
        <header className="login-header">
          <BookliraLogo />

          <p className="login-tagline">
            Mes livres, mes histoires.
          </p>
        </header>

        <section className="login-card">
          <div className="card-decoration"></div>

          <div className="card-header">
            <span className="eyebrow">
              {isRegistering
                ? "Bienvenue dans Booklira"
                : "Bon retour parmi nous"}
            </span>

            <h1>
              {isRegistering
                ? "Crée ton univers"
                : "Retrouve ta bibliothèque"}
            </h1>

            <p>
              {isRegistering
                ? "Commence à organiser toutes tes lectures au même endroit."
                : "Connecte-toi pour retrouver tes livres et tes histoires."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {isRegistering && (
              <label className="field">
                <span className="field-label">Nom</span>

                <div className="input-wrapper">
                  <span className="input-icon">
                    <BookIcon type="user" />
                  </span>

                  <input
                    type="text"
                    placeholder="Ton nom"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </label>
            )}

            <label className="field">
              <span className="field-label">Email</span>

              <div className="input-wrapper">
                <span className="input-icon">
                  <BookIcon type="mail" />
                </span>

                <input
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Mot de passe</span>

              <div className="input-wrapper">
                <span className="input-icon">
                  <BookIcon type="lock" />
                </span>

                <input
                  type="password"
                  placeholder="Ton mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    isRegistering
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />
              </div>
            </label>

            {error && (
              <div className="error-message" role="alert">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Chargement..."
                  : isRegistering
                    ? "Créer mon compte"
                    : "Se connecter"}
              </span>

              {!loading && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M5 12h13" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              )}
            </button>
          </form>

          <div className="card-footer">
            <span>
              {isRegistering
                ? "Tu as déjà un compte ?"
                : "Pas encore de compte ?"}
            </span>

            <button
              type="button"
              className="toggle-button"
              onClick={toggleMode}
            >
              {isRegistering
                ? "Se connecter"
                : "Créer un compte"}
            </button>
          </div>
        </section>

        <footer className="login-footer">
          <span className="footer-line"></span>
          <span>Ta bibliothèque, toujours avec toi</span>
          <span className="footer-line"></span>
        </footer>
      </div>
    </main>
  );
}

export default Login;