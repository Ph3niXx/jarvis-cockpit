// Panel Wiki IA — Bibliothèque vivante
// États : hub (recherche + liste) → detail (entrée ouverte) → create (flow Jarvis génère)
const { useState: useStateWiki, useMemo: useMemoWiki, useEffect: useEffectWiki } = React;

function PanelWiki({ data, onNavigate }) {
  const w = window.WIKI_DATA;
  const [active, setActive] = useStateWiki(null); // entry in detail view
  const [creating, setCreating] = useStateWiki(false); // create flow open
  const [query, setQuery] = useStateWiki("");
  const [category, setCategory] = useStateWiki("all");
  const [kind, setKind] = useStateWiki("all"); // all | auto | perso
  const [sort, setSort] = useStateWiki("recent"); // recent | alpha | popular

  // Consume deep-link stash from app.jsx (#wiki/slug) — single-use.
  useEffectWiki(() => {
    try {
      const slug = localStorage.getItem("wiki-open-entry");
      if (slug) {
        localStorage.removeItem("wiki-open-entry");
        const entry = (w.entries || []).find(e => e.id === slug || e.slug === slug);
        if (entry) setActive(entry);
      }
    } catch {}
  }, []);

  const filtered = useMemoWiki(() => {
    let list = w.entries.slice();
    if (category !== "all") list = list.filter(e => e.category === category);
    if (kind !== "all") list = list.filter(e => e.kind === kind);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.excerpt.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (sort === "recent") {
      const ts = (e) => {
        if (e.updated_iso) { const t = new Date(e.updated_iso).getTime(); if (!isNaN(t)) return t; }
        if (e.updated === "aujourd'hui" || e.updated === "hier") return Date.now();
        return 0;
      };
      list.sort((a, b) => ts(b) - ts(a));
    } else if (sort === "alpha") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "popular") {
      list.sort((a, b) => b.read_count - a.read_count);
    }
    return list;
  }, [w.entries, category, kind, query, sort]);

  // Pinned state : combine DB flag + localStorage overrides
  const pinnedIds = getPinnedIds();
  const pinned = w.entries.filter(e => e.pinned || pinnedIds.has(e.id));

  // ─── Detail view ───────────────────
  if (active) {
    return <WikiDetail entry={active} allEntries={w.entries} onBack={() => setActive(null)} onOpen={(e) => setActive(e)} onNavigate={onNavigate} />;
  }

  // ─── Create flow ──────────────────
  if (creating) {
    return <WikiCreate onBack={() => setCreating(false)} onDone={(newEntry) => { setCreating(false); setActive(newEntry); }} onNavigate={onNavigate} />;
  }

  // ─── HUB ───────────────────────────
  return (
    <div className="panel-page" data-screen-label="Wiki IA">
      {/* Hero compact — bibliothèque vivante */}
      <div className="panel-hero panel-hero--compact">
        <div className="panel-hero-eyebrow">Apprentissage · Wiki IA · Bibliothèque vivante</div>
        <h1 className="panel-hero-title">
          Cherche ce que tu sais déjà,<br/>
          <em className="serif-italic">demande à Jarvis</em> le reste.
        </h1>
        <p className="panel-hero-sub">
          <strong>{w.stats.total} entrées</strong> — {w.stats.auto} synthèses maintenues par Jarvis, {w.stats.perso} de tes notes perso. <strong>{w.stats.updated_this_week}</strong> mises à jour cette semaine.
        </p>
      </div>

      {/* Search bar — proéminente */}
      <div className="wiki-searchbar">
        <div className="wiki-search-input-wrap">
          <Icon name="search" size={18} stroke={1.5} />
          <input
            type="text"
            className="wiki-search-input"
            placeholder="Recherche une entrée, un terme, un tag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="wiki-search-clear" onClick={() => setQuery("")}>×</button>
          )}
          <kbd className="wiki-search-kbd">⌘K</kbd>
        </div>
        <button className="btn btn--primary wiki-create-btn" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} stroke={2} /> Demander à Jarvis
        </button>
      </div>

      {/* Filters row */}
      <div className="wiki-filters">
        <div className="wiki-filter-group">
          <span className="wiki-filter-label">Catégorie</span>
          <div className="wiki-filter-pills">
            {w.categories.map(c => (
              <button key={c.id} className={`pill ${category === c.id ? "is-active" : ""}`} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="wiki-filter-row-bottom">
          <div className="wiki-filter-inline">
            <span className="wiki-filter-label">Source</span>
            <div className="wiki-filter-pills">
              <button className={`pill ${kind === "all" ? "is-active" : ""}`} onClick={() => setKind("all")}>Tout</button>
              <button className={`pill ${kind === "auto" ? "is-active" : ""}`} onClick={() => setKind("auto")}>Synthèses Jarvis</button>
              <button className={`pill ${kind === "perso" ? "is-active" : ""}`} onClick={() => setKind("perso")}>Mes notes</button>
            </div>
          </div>
          <div className="wiki-filter-inline">
            <span className="wiki-filter-label">Tri</span>
            <div className="wiki-filter-pills">
              <button className={`pill ${sort === "recent" ? "is-active" : ""}`} onClick={() => setSort("recent")}>Récent</button>
              <button className={`pill ${sort === "popular" ? "is-active" : ""}`} onClick={() => setSort("popular")}>Plus lus</button>
              <button className={`pill ${sort === "alpha" ? "is-active" : ""}`} onClick={() => setSort("alpha")}>A–Z</button>
            </div>
          </div>
          <div className="wiki-result-count">{filtered.length} entrée{filtered.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Pinned (quick access) — only if no filter */}
      {!query && category === "all" && kind === "all" && pinned.length > 0 && (
        <section className="wiki-pinned">
          <div className="section-kicker">Épinglées · accès rapide</div>
          <div className="wiki-pinned-list">
            {pinned.map(e => (
              <button key={e.id} className="wiki-pinned-item" onClick={() => setActive(e)}>
                <span className={`wiki-kind-dot wiki-kind-dot--${e.kind}`} />
                <span className="wiki-pinned-title">{e.title}</span>
                <span className="wiki-pinned-meta">{e.read_time} min · {e.category_label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Entry list — éditorial dense */}
      {filtered.length > 0 ? (
        <div className="wiki-list">
          {filtered.map(e => (
            <WikiListItem key={e.id} entry={e} onOpen={() => setActive(e)} query={query} />
          ))}
        </div>
      ) : (
        <div className="wiki-empty">
          <div className="section-kicker">Aucun résultat</div>
          <h3 className="wiki-empty-title">Rien dans la bibliothèque sur <em className="serif-italic">« {query} »</em></h3>
          <p className="wiki-empty-body">Jarvis peut préparer une synthèse sur ce sujet à partir de ta veille et du web.</p>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} stroke={2} /> Demander à Jarvis une entrée sur ce sujet
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// List item — ligne éditoriale
// ─────────────────────────────────────────────────────────
function WikiListItem({ entry: e, onOpen, query }) {
  const highlight = (text) => {
    if (!query || !query.trim()) return text;
    const re = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(re);
    return parts.map((p, i) => re.test(p) ? <mark key={i}>{p}</mark> : p);
  };
  return (
    <article className={`wiki-item wiki-item--${e.kind}`} onClick={onOpen}>
      <header className="wiki-item-head">
        <span className={`wiki-kind-dot wiki-kind-dot--${e.kind}`} />
        <span className="wiki-item-kind">{e.kind === "auto" ? "Synthèse Jarvis" : "Note perso"}</span>
        <span className="wiki-item-sep">·</span>
        <span className="wiki-item-cat">{e.category_label}</span>
        <span className="wiki-item-sep">·</span>
        <span className="wiki-item-updated">màj {e.updated}</span>
      </header>
      <h3 className="wiki-item-title">{highlight(e.title)}</h3>
      <p className="wiki-item-excerpt">{highlight(e.excerpt)}</p>
      <footer className="wiki-item-foot">
        <span className="wiki-item-time">
          <Icon name="clock" size={11} stroke={1.75} /> {e.read_time} min
        </span>
        <span className="wiki-item-sep">·</span>
        <span className="wiki-item-words">{e.word_count.toLocaleString("fr")} mots</span>
        <span className="wiki-item-sep">·</span>
        <span className="wiki-item-reads">lu {e.read_count}×</span>
        <div className="wiki-item-tags">
          {e.tags.slice(0, 3).map(t => <span key={t} className="wiki-item-tag">#{t}</span>)}
        </div>
      </footer>
    </article>
  );
}

// ─────────────────────────────────────────────────────────
// Detail view — contenu + sidebar
// ─────────────────────────────────────────────────────────
function wikiPinKey(){ return "wiki-pinned-ids"; }
function getPinnedIds(){
  try { return new Set(JSON.parse(localStorage.getItem(wikiPinKey()) || "[]")); }
  catch { return new Set(); }
}
function togglePinnedId(id){
  const s = getPinnedIds();
  if (s.has(id)) s.delete(id); else s.add(id);
  try { localStorage.setItem(wikiPinKey(), JSON.stringify([...s])); } catch {}
  return s.has(id);
}

function WikiDetail({ entry: e, allEntries, onBack, onOpen, onNavigate }) {
  const related = e.related.map(id => allEntries.find(x => x.id === id)).filter(Boolean);
  const backlinks = e.backlinks.map(id => allEntries.find(x => x.id === id)).filter(Boolean);
  const [pinned, setPinned] = useStateWiki(() => getPinnedIds().has(e.id));
  const [shareState, setShareState] = useStateWiki(""); // "" | "copied"

  const handlePin = () => {
    const nowPinned = togglePinnedId(e.id);
    setPinned(nowPinned);
    try { window.track && window.track("wiki_pin_toggled", { id: e.id, pinned: nowPinned }); } catch {}
  };
  const handleShare = async () => {
    const url = `${location.origin}${location.pathname}#wiki/${encodeURIComponent(e.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: e.title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState(""), 2000);
      }
      try { window.track && window.track("wiki_shared", { id: e.id }); } catch {}
    } catch {}
  };
  const handleAsk = () => {
    const prompt = `J'ai une question sur l'entrée wiki « ${e.title} » (catégorie ${e.category_label}).\n\nContexte de l'entrée :\n${e.excerpt}\n\nMa question : `;
    try { localStorage.setItem("jarvis-prefill-input", prompt); } catch {}
    if (onNavigate) onNavigate("jarvis");
  };

  // Markdown rendering via marked + DOMPurify (both loaded via CDN).
  // Strategy: lex the source to pull heading metadata for the TOC, then
  // feed the same token list to the default parser. After rendering,
  // regex-inject stable ids into the top-level heading tags so the TOC
  // scroll-to works. Avoids overriding the renderer (API quirks in
  // marked v11).
  const { contentHtml, tocItems } = useMemoWiki(() => {
    const src = e.content || "";
    if (typeof window.marked === "undefined") {
      const escaped = src.replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
      return { contentHtml: `<pre>${escaped}</pre>`, tocItems: [] };
    }
    const slug = (s) => String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
    const tokens = window.marked.lexer(src);
    const toc = [];
    const ids = [];  // parallel list of ids for every heading, depth ≤ 3 OR higher
    const seen = new Set();
    tokens.forEach(t => {
      if (t.type === "heading") {
        let id = slug(t.text || t.raw) || `h-${ids.length}`;
        let i = 1;
        while (seen.has(id)) { id = slug(t.text || t.raw) + "-" + i++; }
        seen.add(id);
        ids.push(id);
        if (t.depth <= 3) toc.push({ id, depth: t.depth, text: t.text });
      }
    });
    let html = window.marked.parser(tokens);
    let headingIdx = 0;
    html = html.replace(/<h([1-6])>/g, (_, d) => {
      const id = ids[headingIdx++];
      return id ? `<h${d} id="${id}">` : `<h${d}>`;
    });
    const safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : html;
    return { contentHtml: safeHtml, tocItems: toc };
  }, [e.content]);

  return (
    <div className="panel-page panel-page--wiki-detail" data-screen-label="Wiki — détail">
      {/* Top bar */}
      <div className="quiz-topbar wiki-detail-topbar">
        <button className="quiz-topbar-back" onClick={onBack}>
          <Icon name="arrow_left" size={14} stroke={2} /> Retour au Wiki
        </button>
        <div className="quiz-topbar-title">
          <span className={`wiki-kind-badge wiki-kind-badge--${e.kind}`}>
            {e.kind === "auto" ? "Synthèse Jarvis" : "Note perso"}
          </span>
          <span className="quiz-topbar-sep">·</span>
          <span className="quiz-topbar-axis">{e.category_label}</span>
        </div>
        <div className="wiki-detail-actions">
          <button className={`btn btn--sm ${pinned ? "btn--primary" : "btn--ghost"}`} onClick={handlePin}>
            <Icon name="bookmark" size={12} stroke={1.75} /> {pinned ? "Épinglée" : "Épingler"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={handleShare}>
            <Icon name="share" size={12} stroke={1.75} /> {shareState === "copied" ? "Lien copié" : "Partager"}
          </button>
        </div>
      </div>

      <div className="wiki-detail-wrap">
        {/* Contenu principal */}
        <article className="wiki-detail-article">
          <header className="wiki-detail-header">
            <div className="section-kicker">{e.category_label} · {e.kind === "auto" ? "Maintenu automatiquement" : "Tes notes perso"}</div>
            <h1 className="wiki-detail-title">{e.title}</h1>
            <div className="wiki-detail-meta">
              <span>Créé {formatDate(e.created)}</span>
              <span className="wiki-item-sep">·</span>
              <span>Màj {e.updated}</span>
              <span className="wiki-item-sep">·</span>
              <span>{e.read_time} min de lecture</span>
              <span className="wiki-item-sep">·</span>
              <span>{e.word_count.toLocaleString("fr")} mots</span>
            </div>
            <div className="wiki-detail-tags">
              {e.tags.map(t => <span key={t} className="wiki-detail-tag">#{t}</span>)}
            </div>
          </header>

          <div
            className="wiki-detail-content wiki-markdown"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {e.kind === "auto" && (
            <div className="wiki-detail-foot-auto">
              <Icon name="sparkles" size={14} stroke={1.75} />
              <span>Cette synthèse est maintenue par Jarvis. Dernière relecture automatique : {e.updated}. Signale une erreur pour déclencher une révision.</span>
            </div>
          )}
        </article>

        {/* Sidebar */}
        <aside className="wiki-detail-aside">
          <section className="wiki-aside-section">
            <div className="section-kicker">Dans cette entrée</div>
            <ul className="wiki-toc">
              {tocItems.map((it) => (
                <li key={it.id} className={`wiki-toc-depth-${it.depth}`}>
                  <a
                    href={`#${it.id}`}
                    onClick={ev => {
                      ev.preventDefault();
                      const el = document.getElementById(it.id);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {it.text}
                  </a>
                </li>
              ))}
              {tocItems.length === 0 && (
                <li className="wiki-toc-empty">Pas de sous-titres</li>
              )}
            </ul>
          </section>

          {related.length > 0 && (
            <section className="wiki-aside-section">
              <div className="section-kicker">Articles liés</div>
              <ul className="wiki-linked">
                {related.map(r => (
                  <li key={r.id}>
                    <button className="wiki-linked-item" onClick={() => onOpen(r)}>
                      <span className={`wiki-kind-dot wiki-kind-dot--${r.kind}`} />
                      <span className="wiki-linked-title">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {backlinks.length > 0 && (
            <section className="wiki-aside-section">
              <div className="section-kicker">Cité par</div>
              <ul className="wiki-linked">
                {backlinks.map(r => (
                  <li key={r.id}>
                    <button className="wiki-linked-item" onClick={() => onOpen(r)}>
                      <span className={`wiki-kind-dot wiki-kind-dot--${r.kind}`} />
                      <span className="wiki-linked-title">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="wiki-aside-section wiki-aside-ask">
            <div className="section-kicker">Une question sur cette entrée ?</div>
            <button className="btn btn--ghost btn--sm wiki-ask-btn" onClick={handleAsk}>
              <Icon name="sparkles" size={12} stroke={1.75} /> Demander à Jarvis
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function formatDate(s) {
  if (!s) return "";
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const d = new Date(s);
    return d.toLocaleDateString("fr", { day: "numeric", month: "short", year: "numeric" });
  }
  return s;
}

// ─────────────────────────────────────────────────────────
// Perso write path — POST wiki_concepts with source_type='perso'.
// Slug derived from the title (stripped + dashed). Idempotent via
// on_conflict=slug (returns the upserted row).
// ─────────────────────────────────────────────────────────
function wikiSlugify(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function persistPersoWikiEntry({ title, slug, category, content, tags }){
  if (!window.sb || !window.SUPABASE_URL) return null;
  const payload = {
    slug,
    name: title,
    category: category || "general",
    source_type: "perso",
    summary_intermediate: content,
    mention_count: 0,
    first_seen: new Date().toISOString().slice(0, 10),
    last_mentioned: new Date().toISOString().slice(0, 10),
    related_concepts: [],
  };
  if (Array.isArray(tags) && tags.length) payload.sources = tags;
  const url = `${window.SUPABASE_URL}/rest/v1/wiki_concepts?on_conflict=slug`;
  try {
    const rows = await window.sb.postJSON(url, payload, { upsert: true });
    try { window.track && window.track("wiki_perso_created", { slug }); } catch {}
    return Array.isArray(rows) && rows[0] ? rows[0] : payload;
  } catch (e) {
    console.error("[wiki] perso persist failed", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Create flow — 2 modes : demande à Jarvis OU note perso manuelle
// ─────────────────────────────────────────────────────────
function WikiCreate({ onBack, onDone, onNavigate }) {
  const [mode, setMode] = useStateWiki("jarvis"); // jarvis | perso
  const [subject, setSubject] = useStateWiki("");
  const [sources, setSources] = useStateWiki({ veille: true, notes: true, web: true });
  const [depth, setDepth] = useStateWiki("standard"); // quick | standard | deep
  const [category, setCategory] = useStateWiki("agents");
  const [persoContent, setPersoContent] = useStateWiki("");
  const [persoTags, setPersoTags] = useStateWiki("");
  const [persoPending, setPersoPending] = useStateWiki(false);

  // Delegate to Jarvis with a pre-filled prompt — unchanged. The panel
  // doesn't stream the generation; Jarvis owns the RAG + LLM.
  const handleGenerate = () => {
    if (!subject.trim()) return;
    const depthHint = depth === "deep" ? "2000-2500 mots, détail technique" : depth === "quick" ? "~500 mots, synthèse rapide" : "~1200 mots, équilibré";
    const prompt = `Rédige une synthèse wiki sur « ${subject} » pour ma veille IA.

Cible : ${depthHint}.
Catégorie : ${window.WIKI_DATA?.categories?.find(c => c.id === category)?.label || category}.

Structure :
1. Vue d'ensemble (3-4 phrases)
2. Points clés (3-5 bullets)
3. Concepts liés (à croiser avec mon wiki existant)
4. À approfondir (2-3 pistes)

Sors en markdown, je collerai le résultat comme entrée wiki.`;
    try { localStorage.setItem("jarvis-prefill-input", prompt); } catch {}
    if (onNavigate) onNavigate("jarvis");
    else onBack && onBack();
  };

  // Save a personal note directly — no LLM, just a user-authored entry.
  const handleSavePerso = async () => {
    if (!subject.trim() || !persoContent.trim()) return;
    setPersoPending(true);
    const slug = wikiSlugify(subject);
    const tags = persoTags.split(",").map(t => t.trim()).filter(Boolean);
    const saved = await persistPersoWikiEntry({
      title: subject.trim(),
      slug,
      category,
      content: persoContent,
      tags,
    });
    setPersoPending(false);
    if (!saved) {
      alert("Impossible de sauvegarder la note. Vérifie ta connexion Supabase.");
      return;
    }
    // Optimistic local insert so the panel shows it immediately.
    const w = window.WIKI_DATA;
    if (w && Array.isArray(w.entries)) {
      const newEntry = {
        id: slug,
        slug,
        kind: "perso",
        category: (category || "general").toLowerCase(),
        category_label: w.categories?.find(c => c.id === category)?.label || category,
        title: subject.trim(),
        excerpt: persoContent.split("\n")[0].slice(0, 220),
        updated: "aujourd'hui",
        updated_iso: new Date().toISOString(),
        created: new Date().toISOString().slice(0, 10),
        word_count: persoContent.trim().split(/\s+/).length,
        read_count: 0,
        read_time: Math.max(1, Math.round(persoContent.trim().split(/\s+/).length / 200)),
        tags,
        related: [],
        backlinks: [],
        pinned: false,
        content: persoContent,
        mention_count: 0,
      };
      // Replace if slug exists, otherwise prepend.
      const idx = w.entries.findIndex(e => e.slug === slug);
      if (idx >= 0) w.entries[idx] = newEntry; else w.entries.unshift(newEntry);
      w.stats = { ...(w.stats || {}), total: w.entries.length, perso: (w.stats?.perso || 0) + (idx >= 0 ? 0 : 1) };
      if (onDone) onDone(newEntry);
    } else {
      onBack && onBack();
    }
  };

  // Brief
  return (
    <div className="panel-page panel-page--quiz" data-screen-label="Wiki — nouvelle entrée">
      <div className="quiz-topbar">
        <button className="quiz-topbar-back" onClick={onBack}>
          <Icon name="arrow_left" size={14} stroke={2} /> Retour
        </button>
        <div className="quiz-topbar-title">Nouvelle entrée</div>
        <div></div>
      </div>

      <div className="wiki-create">
        <div className="section-kicker">Nouvelle entrée wiki</div>
        <h1 className="wiki-create-title">
          {mode === "jarvis" ? <>Sur quoi veux-tu <em className="serif-italic">une synthèse</em> ?</> : <>Ta note <em className="serif-italic">perso</em></>}
        </h1>

        {/* Mode switcher — 2 options */}
        <div className="wiki-create-modes">
          <button
            className={`wiki-create-mode ${mode === "jarvis" ? "is-active" : ""}`}
            onClick={() => setMode("jarvis")}
          >
            <div className="wiki-create-mode-title"><Icon name="sparkles" size={14} stroke={1.75} /> Demande à Jarvis</div>
            <div className="wiki-create-mode-desc">Jarvis croise ta veille + notes + web → synthèse maintenue</div>
          </button>
          <button
            className={`wiki-create-mode ${mode === "perso" ? "is-active" : ""}`}
            onClick={() => setMode("perso")}
          >
            <div className="wiki-create-mode-title"><Icon name="file_text" size={14} stroke={1.75} /> J'écris ma note</div>
            <div className="wiki-create-mode-desc">Entrée perso en markdown, enregistrée immédiatement</div>
          </button>
        </div>

        <div className="wiki-create-field">
          <label className="wiki-create-label">{mode === "jarvis" ? "Sujet" : "Titre"}</label>
          <input
            type="text"
            className="wiki-create-input"
            placeholder={mode === "jarvis" ? "Ex : Context engineering, évaluations d'agents, AI Act phase 3…" : "Titre de ta note"}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            autoFocus
          />
        </div>

        <div className="wiki-create-field">
          <label className="wiki-create-label">Catégorie</label>
          <div className="wiki-filter-pills">
            {window.WIKI_DATA.categories.filter(c => c.id !== "all").map(c => (
              <button key={c.id} className={`pill ${category === c.id ? "is-active" : ""}`} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "jarvis" && (
          <>
            <div className="wiki-create-field">
              <label className="wiki-create-label">Sources à utiliser</label>
              <div className="wiki-source-grid">
                <label className={`wiki-source ${sources.veille ? "is-on" : ""}`}>
                  <input type="checkbox" checked={sources.veille} onChange={e => setSources({...sources, veille: e.target.checked})} />
                  <div className="wiki-source-head">
                    <Icon name="wave" size={14} stroke={1.75} />
                    <span>Ta veille IA</span>
                  </div>
                  <div className="wiki-source-desc">Articles des 30 derniers jours</div>
                </label>
                <label className={`wiki-source ${sources.notes ? "is-on" : ""}`}>
                  <input type="checkbox" checked={sources.notes} onChange={e => setSources({...sources, notes: e.target.checked})} />
                  <div className="wiki-source-head">
                    <Icon name="file_text" size={14} stroke={1.75} />
                    <span>Tes notes perso</span>
                  </div>
                  <div className="wiki-source-desc">Notes et entrées wiki liées</div>
                </label>
                <label className={`wiki-source ${sources.web ? "is-on" : ""}`}>
                  <input type="checkbox" checked={sources.web} onChange={e => setSources({...sources, web: e.target.checked})} />
                  <div className="wiki-source-head">
                    <Icon name="search" size={14} stroke={1.75} />
                    <span>Web (dernières 4 semaines)</span>
                  </div>
                  <div className="wiki-source-desc">Papers, blogs techniques, docs officielles</div>
                </label>
              </div>
            </div>

            <div className="wiki-create-field">
              <label className="wiki-create-label">Profondeur</label>
              <div className="wiki-depth-grid">
                <button className={`wiki-depth ${depth === "quick" ? "is-on" : ""}`} onClick={() => setDepth("quick")}>
                  <div className="wiki-depth-name">Rapide</div>
                  <div className="wiki-depth-meta">~500 mots · 3 min</div>
                </button>
                <button className={`wiki-depth ${depth === "standard" ? "is-on" : ""}`} onClick={() => setDepth("standard")}>
                  <div className="wiki-depth-name">Standard</div>
                  <div className="wiki-depth-meta">~1200 mots · 6 min</div>
                </button>
                <button className={`wiki-depth ${depth === "deep" ? "is-on" : ""}`} onClick={() => setDepth("deep")}>
                  <div className="wiki-depth-name">Approfondie</div>
                  <div className="wiki-depth-meta">~2400 mots · 11 min</div>
                </button>
              </div>
            </div>

            <div className="wiki-create-cta">
              <button className="btn btn--primary btn--lg" onClick={handleGenerate} disabled={!subject.trim()}>
                Lancer Jarvis <Icon name="arrow_right" size={14} stroke={2} />
              </button>
              <span className="wiki-create-hint">Jarvis s'ouvre avec ton prompt, tu peux ensuite coller sa réponse en note perso.</span>
            </div>
          </>
        )}

        {mode === "perso" && (
          <>
            <div className="wiki-create-field">
              <label className="wiki-create-label">Contenu (markdown)</label>
              <textarea
                className="wiki-create-textarea"
                placeholder={"## Vue d'ensemble\n\nEcris ici en markdown. Les `code blocks`, **gras**, *italique*, listes, liens sont supportés."}
                value={persoContent}
                onChange={e => setPersoContent(e.target.value)}
                rows={14}
              />
            </div>

            <div className="wiki-create-field">
              <label className="wiki-create-label">Tags (séparés par virgule)</label>
              <input
                type="text"
                className="wiki-create-input"
                placeholder="prompting, agents, rag…"
                value={persoTags}
                onChange={e => setPersoTags(e.target.value)}
              />
            </div>

            <div className="wiki-create-cta">
              <button
                className="btn btn--primary btn--lg"
                onClick={handleSavePerso}
                disabled={!subject.trim() || !persoContent.trim() || persoPending}
              >
                {persoPending ? "Enregistrement…" : <>Enregistrer la note <Icon name="arrow_right" size={14} stroke={2} /></>}
              </button>
              <span className="wiki-create-hint">Stockée comme `source_type=perso` dans wiki_concepts — visible immédiatement dans le filtre "Mes notes".</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.PanelWiki = PanelWiki;
