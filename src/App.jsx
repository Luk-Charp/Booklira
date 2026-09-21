import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";
import { UserContext } from "./UserContext";
import Profile from "./Profile";

import Login from "./Login";
import LandingPage from "./LandingPage";
import BookList from "./BookList";
import BookDetail from "./BookDetail";
import Stats from "./Stats";
import SearchPage from "./SearchPage";
import LegalPages from "./LegalPages";
import Friends from "./Friends";
import FriendProfile from "./FriendProfile";
import InvitePage from "./InvitePage";
import ImportCSV from "./ImportCSV";

import "./App.css";

function NavIcon({ type }) {
  if (type === "library") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
        <path d="M7 20V6a2 2 0 0 1 2-2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (type === "stats") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 19V10" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 5 5" />
      </svg>
    );
  }

  if (type === "friends") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8.5" cy="8" r="3" />
        <path d="M2.5 19c.6-3 2.7-4.6 6-4.6s5.4 1.6 6 4.6" />
        <circle cx="17" cy="8.5" r="2.3" />
        <path d="M15.8 14.6c2.4.4 3.9 1.9 4.4 4.4" />
      </svg>
    );
  }

  if (type === "profile") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.4 3.2-5.2 7-5.2s6.2 1.8 7 5.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="m15 17 5-5-5-5" />
      <path d="M20 12H9" />
    </svg>
  );
}

function MobileBottomNavigation({ location }) {
  const isLibraryPage = location.pathname === "/";

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale">
      <Link
        to="/"
        className={`mobile-bottom-nav-link ${isLibraryPage ? "active" : ""}`}
        aria-label="Bibliothèque"
      >
        <NavIcon type="library" />
        <span>Bibliothèque</span>
      </Link>

      <Link
        to="/search"
        className={`mobile-bottom-nav-link ${
          location.pathname === "/search" ? "active" : ""
        }`}
        aria-label="Rechercher"
      >
        <NavIcon type="search" />
        <span>Recherche</span>
      </Link>

      <Link
        to="/stats"
        className={`mobile-bottom-nav-link ${
          location.pathname === "/stats" ? "active" : ""
        }`}
        aria-label="Statistiques"
      >
        <NavIcon type="stats" />
        <span>Stats</span>
      </Link>

      <Link
        to="/friends"
        className={`mobile-bottom-nav-link ${
          location.pathname === "/friends" ? "active" : ""
        }`}
        aria-label="Amis"
      >
        <NavIcon type="friends" />
        <span>Amis</span>
      </Link>

      <Link
        to="/profile"
        className={`mobile-bottom-nav-link ${
          location.pathname === "/profile" ? "active" : ""
        }`}
        aria-label="Profil"
      >
        <NavIcon type="profile" />
        <span>Profil</span>
      </Link>
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;

    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  }, []);

  useEffect(() => {
    if (user && location.pathname === "/login") {
      navigate("/", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    }
  };

  useEffect(() => {
    const synchroniserProfilPublic = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const pseudoParDefaut =
          user.displayName || user.email?.split("@")[0] || "lecteur";

        await setDoc(ref, {
          pseudo: pseudoParDefaut,
          pseudoLower: pseudoParDefaut.toLowerCase(),
          email: user.email || "",
          photoURL: user.photoURL || "",
          visibilite: {
            livres: true,
            notes: true,
            stats: true,
          },
          createdAt: serverTimestamp(),
        });
      } else {
        const donnees = snap.data();
        if (donnees.photoURL !== (user.photoURL || "")) {
          await setDoc(
            ref,
            { photoURL: user.photoURL || "" },
            { merge: true }
          );
        }
      }
    };

    synchroniserProfilPublic();
  }, [user]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>Ouverture de Booklira...</p>
      </div>
    );
  }

  const isLegalPage = location.pathname.startsWith("/legal");

  if (!user && isLegalPage) {
    return (
      <div className="app-shell legal-standalone">
        <Routes>
          <Route path="/legal/:page" element={<LegalPages />} />
        </Routes>
      </div>
    );
  }

  // Public landing page: Google and new visitors can see Booklira
  // without being authenticated. Authenticated users keep the library
  // directly at "/".
  if (!user && location.pathname === "/") {
    return <LandingPage />;
  }

  if (!user) {
    return <Login />;
  }

  const nomUtilisateur =
    user.displayName ||
    user.email?.split("@")[0] ||
    "lecteur";

  const initiale = nomUtilisateur.trim().charAt(0).toUpperCase();

  const isLibraryPage = location.pathname === "/";

  return (
    <UserContext.Provider value={{ user, refreshUser }}>
      <div className="app-shell">
        <div className="app-background-glow glow-one"></div>
        <div className="app-background-glow glow-two"></div>

        <div className="app">
          <header className="app-header">
            <div className="brand-area">
              <Link to="/" className="app-brand">
                <div className="app-brand-icon">
                  <span className="mini-book mini-green"></span>
                  <span className="mini-book mini-pink"></span>
                  <span className="mini-book mini-blue"></span>
                </div>

                <div className="app-brand-text">
                  <span>Booklira</span>
                  <small>BOOKTRACKER</small>
                </div>
              </Link>

              <div className="brand-divider"></div>

              <div className="welcome-area">
                <span className="welcome-small">Ton espace lecture</span>
                <h1>Bonjour <strong>{nomUtilisateur}</strong></h1>
              </div>
            </div>

            <div className="header-actions">
              <nav className="main-navigation">
                <Link
                  to="/"
                  className={`nav-link ${isLibraryPage ? "active" : ""}`}
                >
                  <NavIcon type="library" />
                  <span>Bibliothèque</span>
                </Link>

                <Link
                  to="/search"
                  className={`nav-link ${
                    location.pathname === "/search" ? "active" : ""
                  }`}
                >
                  <NavIcon type="search" />
                  <span>Rechercher</span>
                </Link>

                <Link
                  to="/stats"
                  className={`nav-link ${
                    location.pathname === "/stats" ? "active" : ""
                  }`}
                >
                  <NavIcon type="stats" />
                  <span>Statistiques</span>
                </Link>

                <Link
                  to="/friends"
                  className={`nav-link ${
                    location.pathname === "/friends" ? "active" : ""
                  }`}
                >
                  <NavIcon type="friends" />
                  <span>Amis</span>
                </Link>

                <Link
                  to="/profile"
                  className={`nav-link ${
                    location.pathname === "/profile" ? "active" : ""
                  }`}
                >
                  <NavIcon type="profile" />
                  <span>Profil</span>
                </Link>
              </nav>

              <div className="user-menu">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={nomUtilisateur}
                    className="header-avatar"
                  />
                ) : (
                  <div className="header-avatar header-avatar-placeholder">
                    {initiale}
                  </div>
                )}

                <button
                  className="logout-button"
                  onClick={handleLogout}
                  title="Se déconnecter"
                >
                  <NavIcon type="logout" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          </header>

          <div className="mobile-welcome">
            <span>Ton espace lecture</span>
            <h1>Bonjour <strong>{nomUtilisateur}</strong></h1>
          </div>

          <main className="app-main">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="library-page">
                    <section className="page-intro">
                      <div>
                        <span className="page-eyebrow">TA COLLECTION</span>
                        <h2>Mes livres</h2>
                        <p>
                          Garde une trace de tes lectures,
                          découvre tes habitudes et construis
                          ta bibliothèque.
                        </p>
                      </div>

                      <div className="page-decoration">
                        <span>✦</span>
                        <span>📖</span>
                        <span>✦</span>
                      </div>
                    </section>

                    <div className="content-separator">
                      <span></span>
                      <i>Une histoire à la fois</i>
                      <span></span>
                    </div>

                    <div className="library-content">
                      <ImportCSV />
                      <BookList />
                    </div>
                  </div>
                }
              />

              <Route path="/book/:id" element={<BookDetail />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/friends/:uid" element={<FriendProfile />} />
              <Route path="/invite/:uid" element={<InvitePage />} />
              <Route path="/legal/:page" element={<LegalPages />} />
            </Routes>
          </main>

          <MobileBottomNavigation location={location} />

          <footer className="app-footer">
            <span></span>
            <p>Booklira · Mes livres, mes histoires.</p>
            <span></span>
          </footer>

          <div className="legal-footer-links">
            <Link to="/legal/mentions">Mentions légales</Link>
            <span aria-hidden="true">·</span>
            <Link to="/legal/cgu">CGU</Link>
            <span aria-hidden="true">·</span>
            <Link to="/legal/confidentialite">Confidentialité</Link>
          </div>
        </div>
      </div>
    </UserContext.Provider>
  );
}

export default App;
