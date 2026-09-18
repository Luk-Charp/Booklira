import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export const LANGUAGES = {
  fr: { code: "FR", name: "Français" },
  en: { code: "EN", name: "English" },
  es: { code: "ES", name: "Español" },
};

// Traduction de l'interface existante. Les contenus saisis par les utilisateurs
// (titres, auteurs, pseudos...) ne sont pas concernés.
const UI = {
  "Bibliothèque": ["Library", "Biblioteca"],
  "Statistiques": ["Statistics", "Estadísticas"],
  "Amis": ["Friends", "Amigos"],
  "Profil": ["Profile", "Perfil"],
  "Déconnexion": ["Log out", "Cerrar sesión"],
  "Ton espace lecture": ["Your reading space", "Tu espacio de lectura"],
  "Bonjour": ["Hello", "Hola"],
  "TA COLLECTION": ["YOUR COLLECTION", "TU COLECCIÓN"],
  "Mes livres": ["My books", "Mis libros"],
  "Garde une trace de tes lectures, découvre tes habitudes et construis ta bibliothèque.": ["Keep track of your reading, discover your habits and build your library.", "Registra tus lecturas, descubre tus hábitos y construye tu biblioteca."],
  "Une histoire à la fois": ["One story at a time", "Una historia a la vez"],
  "Booklira · Mes livres, mes histoires.": ["Booklira · My books, my stories.", "Booklira · Mis libros, mis historias."],
  "Ta bibliothèque, toujours avec toi": ["Your library, always with you", "Tu biblioteca, siempre contigo"],
  "Mentions légales": ["Legal notice", "Aviso legal"],
  "CGU": ["Terms of Service", "Términos de servicio"],
  "Confidentialité": ["Privacy", "Privacidad"],
  "Recherche rapide": ["Quick search", "Búsqueda rápida"],
  "Ajout manuel": ["Manual entry", "Añadir manualmente"],
  "Rechercher": ["Search", "Buscar"],
  "Rechercher un livre (titre, auteur...)": ["Search for a book (title, author...)", "Buscar un libro (título, autor...)"],
  "Recherche...": ["Searching...", "Buscando..."],
  "À lire": ["To read", "Por leer"],
  "En cours": ["Reading", "En curso"],
  "Lu": ["Read", "Leído"],
  "Lus": ["Read", "Leídos"],
  "Inachevé": ["Unfinished", "Inacabado"],
  "Inachevées": ["Unfinished", "Inacabados"],
  "Série abandonnée": ["Dropped series", "Serie abandonada"],
  "Séries abandonnées": ["Dropped series", "Series abandonadas"],
  "Ajouter le livre": ["Add book", "Añadir libro"],
  "Pas de couverture": ["No cover", "Sin portada"],
  "Auteur inconnu": ["Unknown author", "Autor desconocido"],
  "Année": ["Year", "Año"],
  "Pages": ["Pages", "Páginas"],
  "Titre": ["Title", "Título"],
  "Auteur": ["Author", "Autor"],
  "Description": ["Description", "Descripción"],
  "Ma note personnelle": ["My personal rating", "Mi valoración personal"],
  "Mot de passe": ["Password", "Contraseña"],
  "Mot de passe actuel": ["Current password", "Contraseña actual"],
  "Nouveau mot de passe": ["New password", "Nueva contraseña"],
  "Nom": ["Name", "Nombre"],
  "Nom affiché": ["Display name", "Nombre mostrado"],
  "Email": ["Email", "Correo electrónico"],
  "Note": ["Rating", "Valoración"],
  "Note moyenne": ["Average rating", "Valoración media"],
  "Livres lus": ["Books read", "Libros leídos"],
  "Livres au total": ["Total books", "Libros totales"],
  "Pages lues": ["Pages read", "Páginas leídas"],
  "Le plus long lu": ["Longest book read", "Libro más largo leído"],
  "Auteurs les plus lus": ["Most-read authors", "Autores más leídos"],
  "Lectures par année": ["Reading by year", "Lecturas por año"],
  "Détail par mois": ["Monthly details", "Detalle por mes"],
  "Aucune donnée pour l'instant.": ["No data yet.", "No hay datos por ahora."],
  "Inviter un ami": ["Invite a friend", "Invitar a un amigo"],
  "Mes amis": ["My friends", "Mis amigos"],
  "Demandes reçues": ["Received requests", "Solicitudes recibidas"],
  "Demandes envoyées": ["Sent requests", "Solicitudes enviadas"],
  "Accepter": ["Accept", "Aceptar"],
  "Refuser": ["Decline", "Rechazar"],
  "Annuler": ["Cancel", "Cancelar"],
  "Retirer": ["Remove", "Eliminar"],
  "Voir le profil": ["View profile", "Ver perfil"],
  "Rechercher par pseudo": ["Search by username", "Buscar por nombre de usuario"],
  "Déjà amis": ["Already friends", "Ya son amigos"],
  "Demande envoyée ✉️": ["Request sent ✉️", "Solicitud enviada ✉️"],
  "Aucun lecteur trouvé.": ["No reader found.", "No se encontró ningún lector."],
  "Tu n'as pas encore d'amis sur Booklira.": ["You don't have any friends on Booklira yet.", "Todavía no tienes amigos en Booklira."],
  "Retour à la bibliothèque": ["Back to library", "Volver a la biblioteca"],
  "Retour aux amis": ["Back to friends", "Volver a amigos"],
  "Chargement...": ["Loading...", "Cargando..."],
  "Ouverture de Booklira...": ["Opening Booklira...", "Abriendo Booklira..."],
  "Livre introuvable.": ["Book not found.", "Libro no encontrado."],
  "Choisir une couverture": ["Choose a cover", "Elegir una portada"],
  "Couverture": ["Cover", "Portada"],
  "Annuler": ["Cancel", "Cancelar"],
  "Trier par :": ["Sort by:", "Ordenar por:"],
  "Date d'ajout": ["Date added", "Fecha de adición"],
  "Auteur (A-Z)": ["Author (A-Z)", "Autor (A-Z)"],
  "Note (meilleure d'abord)": ["Rating (highest first)", "Valoración (mejor primero)"],
  "Note (moins bonne d'abord)": ["Rating (lowest first)", "Valoración (peor primero)"],
  "Aucun livre dans cette catégorie.": ["No books in this category.", "No hay libros en esta categoría."],
  "Aucun livre ne correspond à cette recherche.": ["No books match this search.", "Ningún libro coincide con esta búsqueda."],
  "SOCIAL": ["SOCIAL", "SOCIAL"],
  "Mes données": ["My data", "Mis datos"],
  "Sécurité": ["Security", "Seguridad"],
  "Ce que voient mes amis": ["What my friends can see", "Lo que pueden ver mis amigos"],
  "Mes livres lus": ["My read books", "Mis libros leídos"],
  "Mes notes (étoiles)": ["My ratings (stars)", "Mis valoraciones (estrellas)"],
  "Mes statistiques": ["My statistics", "Mis estadísticas"],
  "Langue": ["Language", "Idioma"],
  "Personnalise ton espace BookTracker.": ["Customize your BookTracker space.", "Personaliza tu espacio de BookTracker."],
  "Import en cours...": ["Importing...", "Importando..."],
  "Mise à jour en cours...": ["Updating...", "Actualizando..."],
  "Ajouter une photo": ["Add a photo", "Añadir una foto"],
  "Changer la photo": ["Change photo", "Cambiar foto"],
  "Photo de profil": ["Profile picture", "Foto de perfil"],
};

const reverse = new Map();
Object.entries(UI).forEach(([fr, values]) => {
  reverse.set(fr, fr);
  reverse.set(values[0], fr);
  reverse.set(values[1], fr);
});

function translateExact(value, language) {
  const key = reverse.get(value);
  if (!key || language === "fr") return key || value;
  return UI[key]?.[language === "en" ? 0 : 1] ?? value;
}

function translatePattern(value, language) {
  const request = value.match(/^(Demandes envoyées|Demandes reçues|Sent requests|Received requests|Solicitudes enviadas|Solicitudes recibidas) \((\d+)\)$/);
  if (request) {
    const sent = request[1].includes("envoyées") || request[1].includes("Sent") || request[1].includes("enviadas");
    const word = sent
      ? (language === "en" ? "Sent requests" : language === "es" ? "Solicitudes enviadas" : "Demandes envoyées")
      : (language === "en" ? "Received requests" : language === "es" ? "Solicitudes recibidas" : "Demandes reçues");
    return `${word} (${request[2]})`;
  }

  const month = value.match(/^(Janv|Fév|Mars|Avr|Mai|Juin|Juil|Août|Sept|Oct|Nov|Déc) (\d{4})$/);
  if (month && language !== "fr") {
    const months = language === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const frMonths = ["Janv", "Fév", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
    return `${months[frMonths.indexOf(month[1])]} ${month[2]}`;
  }

  return translateExact(value, language);
}

const LanguageContext = createContext(null);

function DomTranslator({ language }) {
  useEffect(() => {
    const originals = new WeakMap();
    const attributeOriginals = new WeakMap();

    const shouldIgnore = (node) => {
      const parent = node.parentElement;
      return parent && ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName);
    };

    const translateNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (shouldIgnore(node)) return;
        const original = originals.get(node) ?? node.nodeValue;
        originals.set(node, original);
        const trimmed = original.trim();
        if (!trimmed) return;
        const translated = translatePattern(trimmed, language);
        let nextValue = original;
        if (translated !== trimmed) {
          const start = original.indexOf(trimmed);
          nextValue = original.slice(0, start) + translated + original.slice(start + trimmed.length);
        }

        // Évite une boucle infinie : modifier nodeValue déclenche
        // un événement characterData observé par le MutationObserver.
        if (node.nodeValue !== nextValue) {
          node.nodeValue = nextValue;
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      ["placeholder", "title", "aria-label"].forEach((attr) => {
        if (!node.hasAttribute(attr)) return;
        let attrs = attributeOriginals.get(node);
        if (!attrs) { attrs = {}; attributeOriginals.set(node, attrs); }
        const original = attrs[attr] ?? node.getAttribute(attr);
        attrs[attr] = original;
        node.setAttribute(attr, translatePattern(original, language));
      });

      node.childNodes.forEach(translateNode);
    };

    const root = document.body;
    translateNode(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") mutation.addedNodes.forEach(translateNode);
        if (mutation.type === "characterData") translateNode(mutation.target);
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [language]);

  return null;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem("booklira-language");
    return LANGUAGES[saved] ? saved : "fr";
  });

  const [loadedFromFirestore, setLoadedFromFirestore] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("booklira-language", language);
  }, [language]);

  useEffect(() => {
    const load = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const saved = snap.data()?.langue;
        if (LANGUAGES[saved]) setLanguageState(saved);
      } catch (err) {
        console.error("Erreur chargement langue :", err);
      } finally {
        setLoadedFromFirestore(true);
      }
    };
    load();
  }, [auth.currentUser?.uid]);

  const setLanguage = async (nextLanguage) => {
    if (!LANGUAGES[nextLanguage]) return;
    setLanguageState(nextLanguage);
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { langue: nextLanguage }, { merge: true });
      }
    } catch (err) {
      console.error("Erreur sauvegarde langue :", err);
    }
  };

  const value = useMemo(() => ({ language, setLanguage, languages: LANGUAGES }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      <DomTranslator language={language} />
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage doit être utilisé dans LanguageProvider");
  return context;
}

export function LanguageSelector({ compact = false }) {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span aria-hidden="true">🌐</span>
      {!compact && <span className="sr-only">Langue</span>}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Langue"
        style={{
          border: "1px solid var(--border-color, #d8c8b8)",
          borderRadius: "999px",
          padding: "7px 10px",
          background: "var(--surface, #fffaf5)",
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        {Object.entries(languages).map(([code, item]) => (
          <option key={code} value={code}>{item.code} · {item.name}</option>
        ))}
      </select>
    </label>
  );
}
