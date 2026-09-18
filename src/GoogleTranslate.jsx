import { useEffect, useState } from "react";

const LANGUAGES = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
];

function getCurrentLanguage() {
  const match = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  if (!match) return "fr";

  const value = decodeURIComponent(match[1]);
  const parts = value.split("/");
  return parts[parts.length - 1] || "fr";
}

function changeLanguage(language) {
  if (language === "fr") {
    document.cookie = "googtrans=/fr/fr; path=/";
    document.cookie = "googtrans=/fr/fr; path=/; domain=" + window.location.hostname;
  } else {
    document.cookie = `googtrans=/fr/${language}; path=/`;
    document.cookie = `googtrans=/fr/${language}; path=/; domain=${window.location.hostname}`;
  }

  const combo = document.querySelector(".goog-te-combo");
  if (combo) {
    combo.value = language;
    combo.dispatchEvent(new Event("change"));
  } else {
    window.location.reload();
  }
}

export function GoogleTranslate({ compact = false }) {
  const [language, setLanguage] = useState("fr");

  useEffect(() => {
    setLanguage(getCurrentLanguage());

    window.googleTranslateElementInit = function () {
      if (!window.google?.translate?.TranslateElement) return;
      if (!document.getElementById("google_translate_element")) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "fr",
          includedLanguages: "fr,en,es",
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    if (!document.querySelector('script[data-booklira-google-translate]')) {
      const script = document.createElement("script");
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.dataset.bookliraGoogleTranslate = "true";
      document.head.appendChild(script);
    } else if (window.google?.translate?.TranslateElement) {
      window.googleTranslateElementInit();
    }

    const checkWidget = setInterval(() => {
      const combo = document.querySelector(".goog-te-combo");
      if (combo) {
        clearInterval(checkWidget);
        const current = getCurrentLanguage();
        combo.value = current;
      }
    }, 300);

    return () => {
      clearInterval(checkWidget);
      delete window.googleTranslateElementInit;
    };
  }, []);

  const handleChange = (event) => {
    const value = event.target.value;
    setLanguage(value);
    changeLanguage(value);
  };

  return (
    <div className={`google-translate-selector ${compact ? "compact" : ""}`}>
      <span aria-hidden="true">🌐</span>
      <select
        value={language}
        onChange={handleChange}
        aria-label="Choisir la langue"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <div id="google_translate_element" className="google-translate-hidden" />
    </div>
  );
}
