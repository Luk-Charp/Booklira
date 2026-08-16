import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { UserContext } from "./UserContext";
import Profile from "./Profile";

import Login from "./Login";
import AddBookForm from "./AddBookForm";
import BookList from "./BookList";
import ImportCSV from "./ImportCSV";
import BookDetail from "./BookDetail";
import Stats from "./Stats";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Firebase ne déclenche pas onAuthStateChanged quand on modifie
  // juste le profil (nom, photo) via updateProfile. On rafraîchit
  // donc manuellement l'utilisateur courant pour que le header
  // (nom + avatar) se mette à jour tout de suite après une
  // modification faite depuis la page Profil.
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  }, []);

  if (loading) {
    return <p>Chargement...</p>;
  }

  if (!user) {
    return <Login />;
  }

  const nomUtilisateur =
    user.displayName ||
    user.email?.split("@")[0] ||
    "lecteur";

  return (
    <UserContext.Provider value={{ user, refreshUser }}>
      <div className="app">
        <header className="app-header">
          <div className="app-header-greeting">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={nomUtilisateur}
                className="header-avatar"
              />
            ) : (
              <div className="header-avatar header-avatar-placeholder">
                👤
              </div>
            )}

            <h1>
              Bonjour {nomUtilisateur} 
            </h1>
          </div>

          <div className="header-actions">
            <Link to="/profile" className="profile-link">
              👤 Profil
            </Link>

            <Link to="/stats" className="stats-link">
              📊 Stats
            </Link>

            <button onClick={() => signOut(auth)}>
              Déconnexion
            </button>
          </div>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <ImportCSV />
                <AddBookForm />
                <BookList />
              </>
            }
          />

          <Route
            path="/book/:id"
            element={<BookDetail />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/stats"
            element={<Stats />}
          />
        </Routes>
      </div>
    </UserContext.Provider>
  );
}

export default App;