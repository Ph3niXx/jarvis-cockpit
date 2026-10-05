// Panel "Atlas" — porte d'entrée vers Atlas, l'app de révisions (flashcards,
// quiz, examens blancs). Atlas vit sur son propre domaine avec sa propre
// connexion : pas d'iframe possible (CSP frame-src none ici, X-Frame-Options
// DENY là-bas), donc des liens qui s'ouvrent dans un nouvel onglet.
const ATLAS_URL = "https://atlas-orpin-eight.vercel.app";

const ATLAS_LINKS = [
  { hash: "#/", label: "Séance du jour" },
  { hash: "#/subjects", label: "Parcours" },
  { hash: "#/progress", label: "Progrès" },
];

function PanelAtlas() {
  return (
    <div className="review-empty">
      <div className="review-empty-eyebrow">Apprentissage · Atlas</div>
      <h2 className="review-empty-title">Tes révisions sont dans Atlas.</h2>
      <p className="review-empty-body">
        Flashcards, quiz et examens blancs, avec une séance du jour qui mêle tes sujets actifs.
        Atlas s'ouvre dans un nouvel onglet, avec sa propre connexion.
      </p>
      <a className="btn btn--primary" href={ATLAS_URL + "/"} target="_blank" rel="noopener">
        Ouvrir Atlas ↗
      </a>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
        {ATLAS_LINKS.map(l => (
          <a key={l.hash} className="btn btn--ghost btn--sm" href={ATLAS_URL + "/" + l.hash} target="_blank" rel="noopener">
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
window.PanelAtlas = PanelAtlas;
