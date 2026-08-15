import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import AddBookForm from "./AddBookForm";
import "./App.css";
import BookList from "./BookList";
import ImportCSV from "./ImportCSV";
import BookDetail from "./BookDetail";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p>Chargement...</p>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📚 Ma bibliothèque</h1>
        <button onClick={() => signOut(auth)}>Déconnexion</button>
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
        <Route path="/book/:id" element={<BookDetail />} />
      </Routes>
    </div>
  );
}

export default App;