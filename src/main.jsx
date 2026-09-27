import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Restaure immédiatement le dernier thème utilisé avant le premier rendu.
try {
  const theme = localStorage.getItem("booklira-theme");
  const themesAutorises = ["brown", "blue", "pink", "green", "yellow", "purple"];
  if (themesAutorises.includes(theme)) {
    document.documentElement.dataset.theme = theme;
  }
} catch (error) {
  console.warn("Impossible de restaurer le thème local :", error);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)