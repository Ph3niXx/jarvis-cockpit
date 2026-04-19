// Panel : Recherche — Command-K avec détection OS
const { useState: useStateSearch, useEffect: useEffectSearch, useRef: useRefSearch, useMemo: useMemoSearch } = React;

// ── OS detection ──────────────────────────────────────────────
const OS_INFO = (() => {
  if (typeof navigator === "undefined") return { os: "other", modKey: "Ctrl", modSymbol: "Ctrl", isTouch: false };
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Mac/.test(platform) && !isIOS;
  const isAndroid = /Android/.test(ua);
  const isWin = /Win/.test(platform);
  const isTouch = isIOS || isAndroid || (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches);
  let os = "other", modKey = "Ctrl", modSymbol = "Ctrl";
  if (isIOS) { os = "ios"; modKey = "Cmd"; modSymbol = "⌘"; }
  else if (isMac) { os = "mac"; modKey = "Cmd"; modSymbol = "⌘"; }
  else if (isAndroid) { os = "android"; modKey = "Ctrl"; modSymbol = "Ctrl"; }
  else if (isWin) { os = "win"; modKey = "Ctrl"; modSymbol = "Ctrl"; }
  return { os, modKey, modSymbol, isTouch, isIOS, isMac, isAndroid, isWin };
})();

// ── Fake corpus ──────────────────────────────────────────────
const CORPUS = [
  { id: 1, type: "article", scope: "Veille IA", title: "Claude Agents GA — mémoire persistante et orchestration multi-outils", source: "Anthropic", date: "Hier · 14h32", snippet: "Disponibilité générale de l'API agents avec une mémoire de contexte de 1M tokens, un routage automatique entre outils…", tags: ["agents", "anthropic", "enterprise"], icon: "sparkles" },
  { id: 2, type: "article", scope: "Veille IA", title: "BNP Paribas industrialise 140 cas d'usage IA avec Mistral", source: "Les Échos", date: "Hier · 11h", snippet: "La banque déploie Mistral Large 2 en production sur son cloud souverain, dont 40 cas d'usage en assurance…", tags: ["finserv", "mistral", "souveraineté"], icon: "bank" },
  { id: 3, type: "note", scope: "Notes perso", title: "Idée : agent de veille brevets pour train Vente", source: "Carnet d'idées · 17 avr", date: "il y a 4 jours", snippet: "Un agent qui scan l'INPI chaque semaine sur les brevets déposés par la concurrence assurance et produit un…", tags: ["idée", "agents", "veille"], icon: "lightbulb" },
  { id: 4, type: "challenge", scope: "Apprentissage", title: "Fine-tune Qwen3 sur tes notes RTE", source: "Challenge · 200 XP", date: "Ouvert", snippet: "LoRA 8-bit sur tes notes de cérémonies SAFe pour qu'il propose des formulations de risque.", tags: ["fine-tuning", "lora"], icon: "trophy" },
  { id: 5, type: "wiki", scope: "Wiki IA", title: "Pattern : Agent avec mémoire persistante (RAG + context cache)", source: "Wiki · 142 entrées", date: "màj 12 avr", snippet: "Pattern qui combine un vector store pour la mémoire long-terme et le prompt caching d'Anthropic pour la…", tags: ["agents", "rag", "pattern"], icon: "book" },
  { id: 6, type: "conversation", scope: "Jarvis", title: "Comment structurer la doc technique AI Act pour Malakoff ?", source: "Jarvis · conversation", date: "il y a 2 jours", snippet: "Tu avais posé la question lundi, Jarvis t'a proposé un plan en 4 parties avec registre des systèmes, doc technique…", tags: ["ai-act", "malakoff", "régulation"], icon: "assistant" },
  { id: 7, type: "article", scope: "Veille IA", title: "Phi-4 mini publié — 3.8B paramètres, niveau GPT-4o-mini", source: "Hugging Face", date: "il y a 3 jours", snippet: "Microsoft publie les poids sous licence MIT. Benchmarks serrés face à Llama 3.3 8B…", tags: ["llms", "opensource", "edge"], icon: "cpu" },
  { id: 8, type: "opportunity", scope: "Business", title: "POC agent souscription santé Malakoff — lead identifié", source: "Opportunités", date: "Nouveau", snippet: "Client prospect identifié via salon Insurtech Paris, chef de projet digital intéressé par un POC agent…", tags: ["biz", "agent", "souscription"], icon: "lightbulb" },
  { id: 9, type: "article", scope: "Veille IA", title: "MCP 1.0 — Model Context Protocol atteint la v1 stable", source: "Anthropic Blog", date: "il y a 5 jours", snippet: "Le protocole ouvert pour connecter des agents à des outils et sources de données passe en version stable…", tags: ["mcp", "agents", "protocole"], icon: "sparkles" },
  { id: 10, type: "note", scope: "Notes perso", title: "Prompt system pour résumer les dailies SAFe", source: "Notes · 14 avr", date: "il y a 6 jours", snippet: "Template qui prend le transcript et produit blockers / achievements / risques en markdown structuré…", tags: ["prompt", "safe", "template"], icon: "notebook" },
];

const RECENT_QUERIES = [
  { q: "agent memory", ts: "il y a 2h", results: 12 },
  { q: "ai act souscription", ts: "hier", results: 8 },
  { q: "mistral bnp", ts: "hier", results: 4 },
  { q: "lora fine-tuning pratique", ts: "il y a 3 jours", results: 7 },
  { q: "mcp protocol", ts: "il y a 5 jours", results: 23 },
];

const SAVED_SEARCHES = [
  { name: "Tout sur les agents cette semaine", query: "agents week:current", count: 24 },
  { name: "AI Act + assurance", query: "\"ai act\" assurance", count: 11 },
  { name: "Papiers arxiv que j'ai bookmarkés", query: "type:arxiv saved:true", count: 7 },
];

// ── Shortcut display helper ─────────────────────────────────
function Kbd({ children }) {
  return <span className="cmdk-kbd">{children}</span>;
}

// ── The Command-K modal content ─────────────────────────────
function CmdKModal({ query, setQuery, filtered, aiMode, setAiMode, selectedIdx, setSelectedIdx, onClose }) {
  const inputRef = useRefSearch(null);

  useEffectSearch(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Keyboard navigation inside modal
  useEffectSearch(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (!query) return;
      const items = aiMode ? [] : filtered;
      if (items.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); /* would open result */ }
      // Toggle AI mode with Ctrl+I / Cmd+I
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault(); setAiMode((m) => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, filtered, aiMode, onClose, setSelectedIdx, setAiMode]);

  return (
    <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
      <div className="cmdk-input-row">
        <Icon name="search" size={18} stroke={1.75} />
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder={aiMode ? "Pose ta question à Jarvis…" : "Cherche dans tes articles, notes, wiki, conversations…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
        />
        <button
          className={`cmdk-ai-toggle ${aiMode ? "is-on" : ""}`}
          onClick={() => setAiMode(!aiMode)}
          title={`Mode IA (${OS_INFO.modKey}+I)`}
        >
          <Icon name="sparkles" size={12} stroke={1.75} />
          <span>Mode IA</span>
        </button>
        {!OS_INFO.isTouch && <span className="cmdk-esc">esc</span>}
        {OS_INFO.isTouch && (
          <button className="cmdk-close-touch" onClick={onClose} aria-label="Fermer">×</button>
        )}
      </div>

      <div className="cmdk-body">
        {aiMode && query && (
          <div className="cmdk-ai-response">
            <div className="cmdk-ai-kicker"><Icon name="sparkles" size={11} stroke={1.75} /> Réponse Jarvis · Claude Haiku 4.5</div>
            <p className="cmdk-ai-text">
              Sur <strong>{query}</strong> — tu as lu 4 articles ces 7 derniers jours, dont le papier Claude Agents GA mardi. Ton radar a progressé de <strong>+12 pts</strong> sur l'axe Agents. Le pattern dominant : mémoire persistante + orchestration MCP.
            </p>
            <div className="cmdk-ai-sources">
              <span className="cmdk-ai-sources-label">Sources</span>
              {filtered.slice(0, 3).map((r) => (
                <div key={r.id} className="cmdk-ai-source">
                  <Icon name={r.icon} size={11} stroke={1.75} />
                  <span>{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!query && (
          <>
            <div className="cmdk-group">
              <div className="cmdk-group-label">Recherches récentes</div>
              {RECENT_QUERIES.slice(0, 4).map((r, i) => (
                <button key={i} className="cmdk-item" onClick={() => setQuery(r.q)}>
                  <Icon name="clock" size={14} stroke={1.75} />
                  <span className="cmdk-item-title">{r.q}</span>
                  <span className="cmdk-item-meta">{r.results} résultats · {r.ts}</span>
                </button>
              ))}
            </div>
            <div className="cmdk-group">
              <div className="cmdk-group-label">Recherches sauvegardées</div>
              {SAVED_SEARCHES.slice(0, 3).map((s, i) => (
                <button key={i} className="cmdk-item" onClick={() => setQuery(s.query)}>
                  <Icon name="bookmark" size={14} stroke={1.75} />
                  <span className="cmdk-item-title">{s.name}</span>
                  <span className="cmdk-item-meta">{s.count} résultats</span>
                </button>
              ))}
            </div>
            {!OS_INFO.isTouch && (
              <div className="cmdk-group">
                <div className="cmdk-group-label">Raccourcis</div>
                <div className="cmdk-item cmdk-item--shortcut">
                  <Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd>
                  <span className="cmdk-item-title">Basculer en mode IA</span>
                </div>
                <div className="cmdk-item cmdk-item--shortcut">
                  <Kbd>↑</Kbd><Kbd>↓</Kbd>
                  <span className="cmdk-item-title">Naviguer dans les résultats</span>
                </div>
                <div className="cmdk-item cmdk-item--shortcut">
                  <Kbd>↵</Kbd>
                  <span className="cmdk-item-title">Ouvrir le résultat sélectionné</span>
                </div>
              </div>
            )}
          </>
        )}

        {query && !aiMode && (
          <div className="cmdk-group">
            <div className="cmdk-group-label">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</div>
            {filtered.length === 0 && (
              <div className="cmdk-noresult">
                Aucun résultat. Essaie le mode IA {!OS_INFO.isTouch && <>(<Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd>)</>} pour une réponse en langage naturel.
              </div>
            )}
            {filtered.slice(0, 6).map((r, i) => (
              <button key={r.id} className={`cmdk-item cmdk-item--result ${i === selectedIdx ? "is-selected" : ""}`}>
                <Icon name={r.icon} size={14} stroke={1.75} />
                <div className="cmdk-item-body">
                  <div className="cmdk-item-title-row">
                    <span className="cmdk-item-title">{r.title}</span>
                    <span className="cmdk-item-scope">{r.scope}</span>
                  </div>
                  <div className="cmdk-item-snippet">{r.snippet}</div>
                </div>
                {i === selectedIdx && !OS_INFO.isTouch && <span className="cmdk-item-enter">↵</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!OS_INFO.isTouch && (
        <div className="cmdk-footer">
          <div className="cmdk-footer-item"><Kbd>↑</Kbd><Kbd>↓</Kbd><span>naviguer</span></div>
          <div className="cmdk-footer-item"><Kbd>↵</Kbd><span>ouvrir</span></div>
          <div className="cmdk-footer-item"><Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd><span>mode IA</span></div>
          <div className="cmdk-footer-item" style={{ marginLeft: "auto" }}>
            <span className="cmdk-footer-brand">Cockpit</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════
function PanelSearch({ data, onNavigate }) {
  const [open, setOpen] = useStateSearch(false);
  const [query, setQuery] = useStateSearch("");
  const [aiMode, setAiMode] = useStateSearch(false);
  const [selectedIdx, setSelectedIdx] = useStateSearch(0);

  // Global shortcut to open modal
  useEffectSearch(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemoSearch(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return CORPUS.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.snippet.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
    );
  }, [query]);

  const close = () => { setOpen(false); setQuery(""); setAiMode(false); setSelectedIdx(0); };

  return (
    <div className="panel-page">
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Recherche unifiée · articles + notes + wiki + Jarvis</div>
        <h1 className="panel-hero-title">Retrouve tout ce que tu as lu, écrit, ou demandé</h1>
        <p className="panel-hero-sub">
          La recherche s'ouvre partout avec <strong>{OS_INFO.modKey}+K</strong>{OS_INFO.isTouch ? " (ou via le bouton ci-dessous)" : ""}, filtre dans ton corpus, et bascule en <strong>mode IA</strong> pour une réponse synthétique citant tes sources. Aucune page de résultats — juste un modal qui répond et disparaît.
        </p>
        <button className="cmdk-trigger" onClick={() => setOpen(true)}>
          <Icon name="search" size={16} stroke={1.75} />
          <span className="cmdk-trigger-text">Chercher dans tout ton cockpit…</span>
          {!OS_INFO.isTouch && (
            <span className="cmdk-trigger-kbd">
              <Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>K</Kbd>
            </span>
          )}
        </button>
      </div>

      <div className="cmdk-demos">
        <div className="cmdk-demos-label">À tester</div>
        <div className="cmdk-demos-row">
          <button className="pill" onClick={() => { setOpen(true); }}>
            Ouvrir le Command-K
          </button>
          <button className="pill" onClick={() => { setOpen(true); setQuery("agents"); }}>
            Démo : rechercher "agents"
          </button>
          <button className="pill" onClick={() => { setOpen(true); setQuery("mistral bnp"); setAiMode(true); }}>
            Démo : question IA
          </button>
          <button className="pill" onClick={() => { setOpen(true); setQuery("xyznothing"); }}>
            Démo : 0 résultat
          </button>
        </div>
        <div className="cmdk-demos-meta">
          Détecté : <strong>{OS_INFO.os === "other" ? "desktop" : OS_INFO.os}</strong>
          {OS_INFO.isTouch && " · mode tactile"}
          {" · raccourci "}
          <Kbd>{OS_INFO.modKey}</Kbd>+<Kbd>K</Kbd>
        </div>
      </div>

      <div className="cmdk-previews">
        <div className="cmdk-preview-head">Aperçus des états</div>
        <div className="cmdk-preview-grid">
          <button className="cmdk-preview" onClick={() => { setOpen(true); }}>
            <div className="cmdk-preview-label">État initial</div>
            <div className="cmdk-preview-desc">Recherches récentes + sauvegardées + raccourcis</div>
          </button>
          <button className="cmdk-preview" onClick={() => { setOpen(true); setQuery("agents"); }}>
            <div className="cmdk-preview-label">Résultats</div>
            <div className="cmdk-preview-desc">Filtré par mot-clé, navigation ↑↓ ↵</div>
          </button>
          <button className="cmdk-preview" onClick={() => { setOpen(true); setQuery("claude agents GA"); setAiMode(true); }}>
            <div className="cmdk-preview-label">Réponse IA</div>
            <div className="cmdk-preview-desc">Synthèse + sources citées</div>
          </button>
        </div>
      </div>

      {open && (
        <div className="cmdk-overlay" onClick={close}>
          <CmdKModal
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            aiMode={aiMode}
            setAiMode={setAiMode}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            onClose={close}
          />
        </div>
      )}
    </div>
  );
}

window.PanelSearch = PanelSearch;
