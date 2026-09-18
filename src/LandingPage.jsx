import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

const translations = {
  fr: {
    code: "FR",
    name: "Français",
    eyebrow: "VOTRE BOOK TRACKER PERSONNEL",
    title1: "Vos livres.",
    title2: "Vos histoires.",
    description:
      "Découvrez, organisez et suivez vos lectures dans une bibliothèque personnelle, simple et élégante.",
    create: "Créer ma bibliothèque",
    learn: "En savoir plus",
    organize: "Organisez",
    organizeText:
      "Rassemblez toute votre collection personnelle au même endroit.",
    track: "Suivez",
    trackText: "Gardez une trace de vos lectures et de votre progression.",
    discover: "Découvrez",
    discoverText:
      "Trouvez de nouveaux livres et gardez vos prochaines lectures à portée de main.",
    footer: "Booklira · Votre bibliothèque, toujours avec vous.",
    legal: "Mentions légales",
    terms: "CGU",
    privacy: "Confidentialité",
    login: "Se connecter",
    language: "Langue",
  },
  en: {
    code: "EN",
    name: "English",
    eyebrow: "YOUR PERSONAL BOOK TRACKER",
    title1: "Your books.",
    title2: "Your stories.",
    description:
      "Discover, organize and track your reading in one simple and elegant personal library.",
    create: "Create my library",
    learn: "Learn more",
    organize: "Organize",
    organizeText: "Keep your entire personal collection in one place.",
    track: "Track",
    trackText: "Keep track of your reading and your progress.",
    discover: "Discover",
    discoverText:
      "Find new books and keep your next reads close at hand.",
    footer: "Booklira · Your library, always with you.",
    legal: "Legal",
    terms: "Terms",
    privacy: "Privacy",
    login: "Log in",
    language: "Language",
  },
  es: {
    code: "ES",
    name: "Español",
    eyebrow: "TU BOOK TRACKER PERSONAL",
    title1: "Tus libros.",
    title2: "Tus historias.",
    description:
      "Descubre, organiza y sigue tus lecturas en una biblioteca personal, sencilla y elegante.",
    create: "Crear mi biblioteca",
    learn: "Saber más",
    organize: "Organiza",
    organizeText:
      "Reúne toda tu colección personal en un solo lugar.",
    track: "Sigue",
    trackText: "Lleva un registro de tus lecturas y de tu progreso.",
    discover: "Descubre",
    discoverText:
      "Encuentra nuevos libros y ten tus próximas lecturas siempre a mano.",
    footer: "Booklira · Tu biblioteca, siempre contigo.",
    legal: "Aviso legal",
    terms: "Términos",
    privacy: "Privacidad",
    login: "Iniciar sesión",
    language: "Idioma",
  },
};

function LandingPage() {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("booklira-language") || "fr";
  });

  const [languageOpen, setLanguageOpen] = useState(false);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem("booklira-language", language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (code) => {
    setLanguage(code);
    setLanguageOpen(false);
  };

  return (
    <main className="landing-page">
      <div className="landing-glow landing-glow-one"></div>
      <div className="landing-glow landing-glow-two"></div>

      <nav className="landing-nav">
        <Link to="/" className="landing-brand">
          <img src="/pwa-192x192.png" alt="" />
          <span>Booklira</span>
        </Link>

        <div className="landing-nav-actions">
          <div className="language-selector">
            <button
              type="button"
              className="language-button"
              onClick={() => setLanguageOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={languageOpen}
              aria-label={t.language}
            >
              <span>🌐</span>
              <strong>{t.code}</strong>
              <span className="language-chevron">⌄</span>
            </button>

            {languageOpen && (
              <div className="language-menu" role="menu">
                {Object.entries(translations).map(([code, translation]) => (
                  <button
                    key={code}
                    type="button"
                    role="menuitem"
                    className={`language-option ${
                      language === code ? "selected" : ""
                    }`}
                    onClick={() => changeLanguage(code)}
                  >
                    <span>{translation.name}</span>
                    <strong>{translation.code}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link to="/login" className="landing-login">
            {t.login}
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-eyebrow">{t.eyebrow}</span>

          <h1>
            {t.title1}
            <br />
            <em>{t.title2}</em>
          </h1>

          <p>{t.description}</p>

          <div className="landing-actions">
            <Link to="/login" className="landing-primary">
              {t.create}
              <span>→</span>
            </Link>

            <Link to="/legal/mentions" className="landing-secondary">
              {t.learn}
            </Link>
          </div>
        </div>

        <div className="landing-visual" aria-hidden="true">
          <div className="book-stack">
            <div className="book-shape book-shape-one"></div>
            <div className="book-shape book-shape-two"></div>
            <div className="book-shape book-shape-three"></div>
            <div className="book-shape book-shape-four"></div>
          </div>

          <div className="landing-logo-card">
            <img src="/pwa-512x512.png" alt="" />
          </div>
        </div>
      </section>

      <section className="landing-features">
        <article>
          <span>01</span>
          <h2>{t.organize}</h2>
          <p>{t.organizeText}</p>
        </article>

        <article>
          <span>02</span>
          <h2>{t.track}</h2>
          <p>{t.trackText}</p>
        </article>

        <article>
          <span>03</span>
          <h2>{t.discover}</h2>
          <p>{t.discoverText}</p>
        </article>
      </section>

      <footer className="landing-footer">
        <span>{t.footer}</span>

        <div>
          <Link to="/legal/mentions">{t.legal}</Link>
          <Link to="/legal/cgu">{t.terms}</Link>
          <Link to="/legal/confidentialite">{t.privacy}</Link>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
