// Panel "Atlas" — porte d'entrée vers Atlas, l'app de révisions (flashcards,
// quiz, examens blancs). Atlas vit sur son propre domaine avec sa propre
// connexion : pas d'iframe possible (CSP frame-src none ici, X-Frame-Options
// DENY là-bas), donc des liens qui s'ouvrent dans un nouvel onglet.
//
// L'adresse n'est PAS dans le code : ce dépôt est public. Elle est lue dans
// user_profile.atlas_url (RLS authenticated, chargé en Tier 1), comme
// jarvis_tunnel_url, et masquée de l'onglet Profil via PROFILE_HIDDEN_KEYS.
// Boutons + window.open plutôt que <a target="_blank"> : le suivi global
// link_clicked enregistre l'URL des liens externes, l'adresse n'a pas à finir
// dans usage_events ni dans ce qu'on en tire.

const ATLAS_LINKS = [
  { hash: "#/", label: "Séance du jour" },
  { hash: "#/subjects", label: "Parcours" },
  { hash: "#/progress", label: "Progrès" },
];

// Only an https origin is used as a link target (never javascript:, data:…).
function atlasBaseUrl() {
  let raw = null;
  try { raw = window.PROFILE_DATA?._values?.atlas_url || null; } catch {}
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    return u.protocol === "https:" ? u.origin : null;
  } catch { return null; }
}

function openAtlas(base, hash) {
  try { window.open(base + "/" + (hash || ""), "_blank", "noopener,noreferrer"); } catch {}
}

function PanelAtlas() {
  const base = atlasBaseUrl();
  if (!base) {
    return (
      <div className="review-empty">
        <div className="review-empty-eyebrow">Apprentissage · Atlas</div>
        <h2 className="review-empty-title">Adresse d'Atlas introuvable.</h2>
        <p className="review-empty-body">
          L'onglet lit l'adresse d'Atlas dans ton profil, sous la clé atlas_url (une adresse en https).
          Ajoute-la dans Supabase, table user_profile, puis recharge le cockpit.
        </p>
      </div>
    );
  }
  return (
    <div className="review-empty">
      <div className="review-empty-eyebrow">Apprentissage · Atlas</div>
      <h2 className="review-empty-title">Tes révisions sont dans Atlas.</h2>
      <p className="review-empty-body">
        Flashcards, quiz et examens blancs, avec une séance du jour qui mêle tes sujets actifs.
        Atlas s'ouvre dans un nouvel onglet, avec sa propre connexion.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => openAtlas(base, "")}>
        Ouvrir Atlas ↗
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
        {ATLAS_LINKS.map(l => (
          <button type="button" key={l.hash} className="btn btn--ghost btn--sm" onClick={() => openAtlas(base, l.hash)}>
            {l.label} ↗
          </button>
        ))}
      </div>
    </div>
  );
}
window.PanelAtlas = PanelAtlas;
