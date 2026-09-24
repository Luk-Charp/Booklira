import "./StarRating.css";

function StarRating({
  note = 0,
  onChange,
  readOnly = false,
  favori = false,
  onToggleFavorite,
  favoriteReadOnly = false,
  showFavorite = true,
}) {
  const etoiles = [1, 2, 3, 4, 5];
  const peutModifierFavori = !favoriteReadOnly && onToggleFavorite;

  return (
    <div className={`star-rating ${readOnly ? "readonly" : ""}`}>
      {etoiles.map((valeur) => (
        <span
          key={valeur}
          className={valeur <= note ? "star filled" : "star"}
          onClick={() => !readOnly && onChange && onChange(valeur)}
        >
          ★
        </span>
      ))}

      {showFavorite && (
        <button
          type="button"
          className={`favorite-star ${favori ? "active" : ""} ${
            favoriteReadOnly ? "readonly" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (peutModifierFavori) onToggleFavorite();
          }}
          aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={favori}
          disabled={!peutModifierFavori}
        >
          ★
        </button>
      )}
    </div>
  );
}

export default StarRating;
