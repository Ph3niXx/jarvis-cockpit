// Panel : Top du jour — magazine style
const { useState: useStateTop } = React;

// Opens article URL + marks read in localStorage (shared helper).
function openArticleTop(t){
  const url = t._url || t.url;
  if (!url) return;
  try {
    const id = t._id || t.id;
    if (id) {
      const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
      rm[id] = { ts: Date.now() };
      localStorage.setItem("read-articles", JSON.stringify(rm));
    }
  } catch {}
  window.open(url, "_blank", "noopener");
}

// Additional fake items for a fuller "top 8" list
const TOP_EXTRA = [
  { rank: 4, source: "Hugging Face", section: "LLMs", date: "il y a 7h", score: 76, title: "Phi-4 mini publié — 3.8B paramètres, niveau GPT-4o-mini sur le raisonnement", summary: "Microsoft publie les poids sous licence MIT. Benchmarks serrés face à Llama 3.3 8B. Déploiement edge mobile désormais viable.", tags: ["#llms", "#opensource", "#edge"] },
  { rank: 5, source: "OpenAI", section: "Agents", date: "il y a 9h", score: 72, title: "Swarm v2 SDK — orchestration multi-agents avec handoffs explicites", summary: "Réponse directe à Claude Agents. Focus sur le debug et la traçabilité des handoffs entre agents spécialisés.", tags: ["#agents", "#openai"] },
  { rank: 6, source: "Arxiv", section: "Recherche", date: "il y a 12h", score: 68, title: "Context engineering : une taxonomie des patterns de contexte pour agents", summary: "Papier qui remplace 'prompt engineering' par une grammaire systématique de 12 patterns observés en production.", tags: ["#arxiv", "#agents", "#prompting"] },
  { rank: 7, source: "Le Monde", section: "Régulation", date: "il y a 14h", score: 64, title: "CNIL publie son référentiel IA — focus explicite sur l'assurance santé", summary: "Guidelines précises pour les traitements automatisés côté santé. Impact direct sur les outils de souscription Malakoff.", tags: ["#régulation", "#cnil", "#santé"] },
  { rank: 8, source: "a16z", section: "FinServ", date: "il y a 18h", score: 59, title: "The AI insurance stack — 2026 state of the market", summary: "Mapping des 140 startups IA en assurance. Trois segments dominants : underwriting, claims, customer experience.", tags: ["#finserv", "#marché"] },
];

function PanelTop({ data, onNavigate }) {
  const [filter, setFilter] = useStateTop("all");
  const allTop = [...data.top, ...TOP_EXTRA];
  const sections = ["all", ...new Set(allTop.map((t) => t.section))];
  const filtered = filter === "all" ? allTop : allTop.filter((t) => t.section === filter);
  const [feat1, feat2, feat3, ...rest] = filtered;

  return (
    <div className="panel-page">
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Top du jour · S17 · Mardi 21 avril</div>
        <h1 className="panel-hero-title">Les 8 lectures incontournables, triées par impact métier</h1>
        <p className="panel-hero-sub">
          Score calculé sur la pertinence pour ton rôle (RTE, assurance), la fraîcheur, et la convergence de signaux entre sources. Les 3 premiers sont des incontournables — lecture chaudement recommandée avant 9h.
        </p>
      </div>

      <div className="panel-toolbar">
        <span className="panel-toolbar-label">Filtrer</span>
        <div className="panel-toolbar-group">
          {sections.map((s) => (
            <button
              key={s}
              className={`pill ${filter === s ? "is-active" : ""}`}
              onClick={() => setFilter(s)}
            >
              <span>{s === "all" ? "Tout" : s}</span>
              <span className="pill-count">{s === "all" ? allTop.length : allTop.filter((t) => t.section === s).length}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }} className="panel-toolbar-group">
          <button className="btn btn--ghost">
            <Icon name="download" size={14} stroke={1.75} /> Exporter
          </button>
        </div>
      </div>

      <div className="top-list-wrap">
        {feat1 && (
          <div className="top-list-feat">
            <article className="top-feat-main" onClick={() => openArticleTop(feat1)} style={feat1._url ? { cursor: "pointer" } : null}>
              <div className="top-feat-rank">01</div>
              <div className="top-feat-meta">
                <span>{feat1.source}</span>
                <span>·</span>
                <span>{feat1.section}</span>
                <span>·</span>
                <span>{feat1.date}</span>
              </div>
              <h2 className="top-feat-title">{feat1.title}</h2>
              <p className="top-feat-summary">{feat1.summary}</p>
              <div className="top-feat-foot">
                <div className="top-feat-score">
                  <span className="top-feat-score-num">{feat1.score}</span>
                  <span>/ 100 · impact</span>
                </div>
                <span>Lire →</span>
              </div>
            </article>
            {feat2 && (
              <article className="top-feat-side" onClick={() => openArticleTop(feat2)} style={feat2._url ? { cursor: "pointer" } : null}>
                <div className="top-feat-side-rank">02</div>
                <div className="top-feat-side-meta">
                  <span>{feat2.source}</span><span>·</span><span>{feat2.date}</span>
                </div>
                <h3 className="top-feat-side-title">{feat2.title}</h3>
                <p className="top-feat-side-summary">{feat2.summary}</p>
                <div className="top-feat-side-foot">
                  <span>{feat2.section}</span>
                  <span>{feat2.score}/100</span>
                </div>
              </article>
            )}
            {feat3 && (
              <article className="top-feat-side" onClick={() => openArticleTop(feat3)} style={feat3._url ? { cursor: "pointer" } : null}>
                <div className="top-feat-side-rank">03</div>
                <div className="top-feat-side-meta">
                  <span>{feat3.source}</span><span>·</span><span>{feat3.date}</span>
                </div>
                <h3 className="top-feat-side-title">{feat3.title}</h3>
                <p className="top-feat-side-summary">{feat3.summary}</p>
                <div className="top-feat-side-foot">
                  <span>{feat3.section}</span>
                  <span>{feat3.score}/100</span>
                </div>
              </article>
            )}
          </div>
        )}

        {rest.length > 0 && (
          <>
            <div className="top-rest-title">La suite du classement</div>
            <div className="top-rest-list">
              {rest.map((t) => (
                <div key={t.rank} className="top-rest-item" onClick={() => openArticleTop(t)} style={t._url ? { cursor: "pointer" } : null}>
                  <span className="top-rest-rank">{String(t.rank).padStart(2, "0")}</span>
                  <span className="top-rest-source top-rest-col--source">{t.source}</span>
                  <span className="top-rest-title-text">{t.title}</span>
                  <span className="top-rest-section top-rest-col--score">{t.section}</span>
                  <span className="top-rest-date top-rest-col--date">{t.date}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.PanelTop = PanelTop;
