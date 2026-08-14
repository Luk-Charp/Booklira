import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import AddBookForm from "./AddBookForm";
import "./App.css";
import BookList from "./BookList";

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

      <AddBookForm />

      <BookList />
    </div>
  );
}

export default App;