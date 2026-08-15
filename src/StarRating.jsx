import "./StarRating.css";

function StarRating({ note = 0, onChange, readOnly = false }) {
  const etoiles = [1, 2, 3, 4, 5];

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
    </div>
  );
}

export default StarRating;