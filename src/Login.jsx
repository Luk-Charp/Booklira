import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
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
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1" />
      <path d="M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
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

  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);

  const [modeMotDePasseOublie, setModeMotDePasseOublie] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetEnvoye, setResetEnvoye] = useState(false);

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

      case "auth/missing-email":
        return "Merci d'indiquer ton email.";

      case "auth/wrong-password":
        return "Email ou mot de passe incorrect.";

      case "auth/too-many-requests":
        return "Trop de tentatives. Réessaie dans quelques instants.";

      default:
        return "Une erreur est survenue.";
    }
  };

  const ouvrirMotDePasseOublie = () => {
    setModeMotDePasseOublie(true);
    setResetEmail(email);
    setResetError("");
    setResetEnvoye(false);
  };

  const fermerMotDePasseOublie = () => {
    setModeMotDePasseOublie(false);
    setResetError("");
    setResetEnvoye(false);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetEnvoye(true);
    } catch (err) {
      setResetError(traduireErreur(err.code));
    } finally {
      setResetLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
    setPassword("");
    setModeMotDePasseOublie(false);
    setAfficherMotDePasse(false);
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

          {modeMotDePasseOublie ? (
            <>
              <div className="card-header">
                <span className="eyebrow">
                  Mot de passe oublié
                </span>

                <h1>
                  Réinitialise ton mot de passe
                </h1>

                <p>
                  Indique ton email, on t'envoie un lien pour
                  choisir un nouveau mot de passe.
                </p>
              </div>

              {resetEnvoye ? (
                <div className="reset-success">
                  <p>
                    ✓ Un email a été envoyé à{" "}
                    <strong>{resetEmail}</strong>. Vérifie ta
                    boîte de réception (et tes spams).
                  </p>

                  <button
                    type="button"
                    className="toggle-button"
                    onClick={fermerMotDePasseOublie}
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleResetSubmit}
                  className="login-form"
                >
                  <label className="field">
                    <span className="field-label">Email</span>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <BookIcon type="mail" />
                      </span>

                      <input
                        type="email"
                        placeholder="ton@email.com"
                        value={resetEmail}
                        onChange={(e) =>
                          setResetEmail(e.target.value)
                        }
                        autoComplete="email"
                        required
                      />
                    </div>
                  </label>

                  {resetError && (
                    <div className="error-message" role="alert">
                      <span>!</span>
                      <p>{resetError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="login-button"
                    disabled={resetLoading}
                  >
                    <span>
                      {resetLoading
                        ? "Envoi..."
                        : "Envoyer le lien"}
                    </span>
                  </button>

                  <div className="card-footer">
                    <button
                      type="button"
                      className="toggle-button"
                      onClick={fermerMotDePasseOublie}
                    >
                      ← Retour à la connexion
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
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

              <div className="input-wrapper input-wrapper-password">
                <span className="input-icon">
                  <BookIcon type="lock" />
                </span>

                <input
                  type={afficherMotDePasse ? "text" : "password"}
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

                <button
                  type="button"
                  className="toggle-visibility-btn"
                  onClick={() =>
                    setAfficherMotDePasse(!afficherMotDePasse)
                  }
                  aria-label={
                    afficherMotDePasse
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  tabIndex={-1}
                >
                  <EyeIcon visible={afficherMotDePasse} />
                </button>
              </div>

              {!isRegistering && (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={ouvrirMotDePasseOublie}
                >
                  Mot de passe oublié ?
                </button>
              )}
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
            </>
          )}
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