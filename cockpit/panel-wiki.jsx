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
      list.sort((a, b) => (a.updated === "hier" ? 9999 : 0) - (b.updated === "hier" ? 9999 : 0));
    } else if (sort === "alpha") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "popular") {
      list.sort((a, b) => b.read_count - a.read_count);
    }
    return list;
  }, [w.entries, category, kind, query, sort]);

  const pinned = w.entries.filter(e => e.pinned);

  // ─── Detail view ───────────────────
  if (active) {
    return <WikiDetail entry={active} allEntries={w.entries} onBack={() => setActive(null)} onOpen={(e) => setActive(e)} />;
  }

  // ─── Create flow ──────────────────
  if (creating) {
    return <WikiCreate onBack={() => setCreating(false)} onDone={(newEntry) => { setCreating(false); setActive(newEntry); }} />;
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
function WikiDetail({ entry: e, allEntries, onBack, onOpen }) {
  const related = e.related.map(id => allEntries.find(x => x.id === id)).filter(Boolean);
  const backlinks = e.backlinks.map(id => allEntries.find(x => x.id === id)).filter(Boolean);

  // parse markdown-lite
  const parts = useMemoWiki(() => {
    const lines = e.content.split(/\n/);
    const out = [];
    let inList = false;
    let listItems = [];
    const flushList = () => {
      if (listItems.length) {
        out.push({ type: "list", items: listItems });
        listItems = [];
      }
      inList = false;
    };
    lines.forEach((ln) => {
      if (ln.startsWith("## ")) {
        flushList();
        out.push({ type: "h2", text: ln.slice(3) });
      } else if (ln.startsWith("# ")) {
        flushList();
        out.push({ type: "h1", text: ln.slice(2) });
      } else if (ln.startsWith("> ")) {
        flushList();
        out.push({ type: "quote", text: ln.slice(2) });
      } else if (ln.startsWith("- ")) {
        inList = true;
        listItems.push(ln.slice(2));
      } else if (ln.match(/^\d+\. /)) {
        inList = true;
        listItems.push(ln.replace(/^\d+\. /, ""));
      } else if (ln.trim() === "") {
        flushList();
        out.push({ type: "br" });
      } else {
        flushList();
        out.push({ type: "p", text: ln });
      }
    });
    flushList();
    return out;
  }, [e.content]);

  // render with ** bold ** and * italic * simple parsing
  const renderInline = (t) => {
    const tokens = [];
    let rest = t;
    let key = 0;
    while (rest.length) {
      const m = rest.match(/\*\*([^*]+)\*\*/);
      const mI = rest.match(/\*([^*]+)\*/);
      if (m && (!mI || m.index <= mI.index)) {
        tokens.push(rest.slice(0, m.index));
        tokens.push(<strong key={key++}>{m[1]}</strong>);
        rest = rest.slice(m.index + m[0].length);
      } else if (mI) {
        tokens.push(rest.slice(0, mI.index));
        tokens.push(<em key={key++}>{mI[1]}</em>);
        rest = rest.slice(mI.index + mI[0].length);
      } else {
        tokens.push(rest);
        rest = "";
      }
    }
    return tokens;
  };

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
          <button className="btn btn--ghost btn--sm"><Icon name="bookmark" size={12} stroke={1.75} /> Épingler</button>
          <button className="btn btn--ghost btn--sm"><Icon name="share" size={12} stroke={1.75} /> Partager</button>
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

          <div className="wiki-detail-content">
            {parts.map((part, i) => {
              if (part.type === "h1") return <h2 key={i} className="wiki-content-h2">{renderInline(part.text)}</h2>;
              if (part.type === "h2") return <h3 key={i} className="wiki-content-h3">{renderInline(part.text)}</h3>;
              if (part.type === "p") return <p key={i} className="wiki-content-p">{renderInline(part.text)}</p>;
              if (part.type === "quote") return <blockquote key={i} className="wiki-content-quote">{renderInline(part.text)}</blockquote>;
              if (part.type === "list") return (
                <ul key={i} className="wiki-content-list">
                  {part.items.map((li, j) => <li key={j}>{renderInline(li)}</li>)}
                </ul>
              );
              if (part.type === "br") return null;
              return null;
            })}
          </div>

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
              {parts.filter(p => p.type === "h1").map((p, i) => (
                <li key={i}><a href="#" onClick={ev => ev.preventDefault()}>{p.text}</a></li>
              ))}
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
            <button className="btn btn--ghost btn--sm wiki-ask-btn">
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
// Create flow — Jarvis génère
// ─────────────────────────────────────────────────────────
function WikiCreate({ onBack, onDone }) {
  const [step, setStep] = useStateWiki("brief"); // brief | generating | review
  const [subject, setSubject] = useStateWiki("");
  const [sources, setSources] = useStateWiki({ veille: true, notes: true, web: true });
  const [depth, setDepth] = useStateWiki("standard"); // quick | standard | deep
  const [category, setCategory] = useStateWiki("agents");
  const [genProgress, setGenProgress] = useStateWiki(0);

  useEffectWiki(() => {
    if (step !== "generating") return;
    const timer = setInterval(() => {
      setGenProgress(p => {
        if (p >= 100) { clearInterval(timer); setStep("review"); return 100; }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [step]);

  const handleGenerate = () => {
    if (!subject.trim()) return;
    setStep("generating");
    setGenProgress(0);
  };

  const handleSave = () => {
    // Fake entry
    const e = {
      id: "new-" + Date.now(),
      kind: "auto",
      category,
      category_label: window.WIKI_DATA.categories.find(c => c.id === category)?.label || "Général",
      title: subject,
      excerpt: `Synthèse générée à partir de ta veille et du web sur « ${subject} ».`,
      updated: "à l'instant",
      created: new Date().toISOString().slice(0, 10),
      word_count: depth === "deep" ? 2400 : depth === "standard" ? 1200 : 500,
      read_count: 0,
      read_time: depth === "deep" ? 11 : depth === "standard" ? 6 : 3,
      tags: ["nouveau", "généré"],
      related: [],
      backlinks: [],
      pinned: false,
      content: `# ${subject}

Cette synthèse vient d'être générée par Jarvis. Elle s'appuie sur les sources que tu as choisies et reflète l'état de ta veille au moment de la demande.

## Vue d'ensemble

${subject} est un sujet identifié comme pertinent pour ton contexte RTE et ton radar compétences. Jarvis a analysé les signaux récents et les corrélations avec tes lectures passées.

## Points clés

- Point 1 synthétisé à partir de tes notes et du web
- Point 2 croisé avec les papers de ta veille IA
- Point 3 mis en perspective avec ton métier RTE

## À approfondir

Quelques questions que cette synthèse ne couvre pas encore. Tu peux demander à Jarvis de creuser chacune d'entre elles.

> Cette entrée sera maintenue automatiquement et relue à chaque évolution majeure du sujet dans tes signaux.`,
    };
    onDone(e);
  };

  // ─── UI ────────────────────────────
  if (step === "generating") {
    return (
      <div className="panel-page panel-page--quiz" data-screen-label="Wiki — génération">
        <div className="quiz-topbar">
          <button className="quiz-topbar-back" onClick={onBack}>
            <Icon name="arrow_left" size={14} stroke={2} /> Annuler
          </button>
          <div className="quiz-topbar-title">Génération en cours</div>
          <div className="quiz-topbar-progress">{genProgress}%</div>
        </div>
        <div className="wiki-gen">
          <div className="wiki-gen-pulse" />
          <div className="section-kicker">Jarvis rédige</div>
          <h2 className="wiki-gen-title">
            <em className="serif-italic">Synthèse</em> sur {subject}
          </h2>
          <ul className="wiki-gen-steps">
            <li className={genProgress > 10 ? "is-done" : "is-active"}>Collecte des sources ({Object.values(sources).filter(Boolean).length} activées)</li>
            <li className={genProgress > 30 ? "is-done" : genProgress > 10 ? "is-active" : ""}>Extraction des points saillants</li>
            <li className={genProgress > 60 ? "is-done" : genProgress > 30 ? "is-active" : ""}>Croisement avec ton radar compétences</li>
            <li className={genProgress > 85 ? "is-done" : genProgress > 60 ? "is-active" : ""}>Rédaction de la synthèse ({depth === "deep" ? "~2400" : depth === "standard" ? "~1200" : "~500"} mots)</li>
            <li className={genProgress === 100 ? "is-done" : genProgress > 85 ? "is-active" : ""}>Extraction des tags et liens</li>
          </ul>
          <div className="wiki-gen-progress">
            <div className="wiki-gen-progress-track">
              <div className="wiki-gen-progress-fill" style={{ width: `${genProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="panel-page panel-page--quiz" data-screen-label="Wiki — revue">
        <div className="quiz-topbar">
          <button className="quiz-topbar-back" onClick={onBack}>
            <Icon name="arrow_left" size={14} stroke={2} /> Annuler
          </button>
          <div className="quiz-topbar-title">Prêt à ajouter</div>
          <div className="quiz-topbar-progress">✓ Généré</div>
        </div>
        <div className="wiki-review">
          <div className="section-kicker">Jarvis a terminé</div>
          <h2 className="wiki-review-title">
            Ta synthèse sur <em className="serif-italic">{subject}</em> est prête
          </h2>
          <p className="wiki-review-body">
            Environ {depth === "deep" ? "2400" : depth === "standard" ? "1200" : "500"} mots · {depth === "deep" ? 11 : depth === "standard" ? 6 : 3} min de lecture · catégorie <strong>{window.WIKI_DATA.categories.find(c => c.id === category)?.label}</strong>.
            Jarvis la maintiendra automatiquement à chaque évolution significative du sujet dans ta veille.
          </p>
          <div className="wiki-review-cta">
            <button className="btn btn--ghost btn--lg" onClick={onBack}>Jeter</button>
            <button className="btn btn--primary btn--lg" onClick={handleSave}>
              Ajouter au wiki <Icon name="arrow_right" size={14} stroke={2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="section-kicker">Demander à Jarvis</div>
        <h1 className="wiki-create-title">
          Sur quoi veux-tu <em className="serif-italic">une synthèse</em> ?
        </h1>
        <p className="wiki-create-body">
          Donne un sujet, Jarvis croise ta veille, tes notes perso et le web pour produire une entrée maintenue automatiquement.
        </p>

        <div className="wiki-create-field">
          <label className="wiki-create-label">Sujet</label>
          <input
            type="text"
            className="wiki-create-input"
            placeholder="Ex : Context engineering, évaluations d'agents, AI Act phase 3…"
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

        <div className="wiki-create-field">
          <label className="wiki-create-label">Sources à utiliser</label>
          <div className="wiki-source-grid">
            <label className={`wiki-source ${sources.veille ? "is-on" : ""}`}>
              <input type="checkbox" checked={sources.veille} onChange={e => setSources({...sources, veille: e.target.checked})} />
              <div className="wiki-source-head">
                <Icon name="wave" size={14} stroke={1.75} />
                <span>Ta veille IA</span>
              </div>
              <div className="wiki-source-desc">340 articles lus ces 30 derniers jours</div>
            </label>
            <label className={`wiki-source ${sources.notes ? "is-on" : ""}`}>
              <input type="checkbox" checked={sources.notes} onChange={e => setSources({...sources, notes: e.target.checked})} />
              <div className="wiki-source-head">
                <Icon name="file_text" size={14} stroke={1.75} />
                <span>Tes notes perso</span>
              </div>
              <div className="wiki-source-desc">44 notes, dont celles rattachées au sujet</div>
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
          <span className="wiki-create-hint">Génération estimée : {depth === "deep" ? "90" : depth === "standard" ? "50" : "25"} secondes</span>
        </div>
      </div>
    </div>
  );
}

window.PanelWiki = PanelWiki;
