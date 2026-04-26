// Wiki tooltip — auto-link contextuel des termes wiki dans le cockpit.
// Survol d'un terme indexé → tooltip 2 lignes + deep-link #wiki/<slug>.
// Polling 1.5s sur sélecteurs stables (pas de MutationObserver pour éviter les boucles).
(function () {
  let trie = null;
  let trieBuiltAt = 0;
  let initialized = false;

  // Termes courants à exclure du matching (faux positifs fréquents).
  const STOPWORDS = new Set([
    "tout", "tous", "rien", "plus", "moins", "très", "tres", "bien", "mal",
    "fait", "faire", "voir", "avoir", "etre", "être", "dans", "pour", "avec",
    "sans", "sous", "sur", "que", "qui", "quoi", "dont", "où", "ou",
    "the", "and", "for", "with", "from", "this", "that", "have", "has",
  ]);

  // Construit la map { term → entry } à partir de WIKI_DATA.entries.
  // - On préfère les titres courts (≤ 3 mots, ≤ 30 chars).
  // - On dérive aussi un alias depuis le slug ("agent-memory" → "agent memory")
  //   et depuis le premier tag pertinent.
  // - Les stopwords et les fragments < 3 chars sont ignorés.
  function buildTrie() {
    const entries = (window.WIKI_DATA && window.WIKI_DATA.entries) || [];
    const map = new Map();
    entries.forEach((e) => {
      if (!e) return;
      const slug = e.slug || e.id;
      if (!slug) return;
      const candidates = new Set();

      const title = String(e.title || "").trim();
      if (title) {
        const wordCount = title.split(/\s+/).length;
        if (wordCount <= 3 && title.length <= 30) {
          candidates.add(title.toLowerCase());
        }
      }

      const slugTerm = String(slug).replace(/-/g, " ").trim();
      if (slugTerm) {
        const wordCount = slugTerm.split(/\s+/).length;
        if (wordCount <= 3 && slugTerm.length <= 30) {
          candidates.add(slugTerm.toLowerCase());
        }
      }

      (e.tags || []).forEach((t) => {
        const k = String(t || "").trim().toLowerCase();
        if (k && k.length <= 30 && k.split(/\s+/).length <= 3) candidates.add(k);
      });

      candidates.forEach((k) => {
        if (k.length < 3) return;
        if (STOPWORDS.has(k)) return;
        if (!map.has(k)) map.set(k, e);
      });
    });
    return map;
  }

  function ensureTrie() {
    const entries = (window.WIKI_DATA && window.WIKI_DATA.entries) || [];
    // Rebuild si le nombre d'entries a changé (Tier 2 hydratation arrive).
    if (!trie || entries.length !== trieBuiltAt) {
      trie = buildTrie();
      trieBuiltAt = entries.length;
    }
    return trie;
  }

  // Trouve les occurrences d'un terme indexé dans `text`.
  // - Une seule occurrence par concept (premier match).
  // - Word boundary char (non-alphanum) avant et après.
  function findMatches(text) {
    const t = ensureTrie();
    if (!t || !t.size) return [];
    const matches = [];
    const lower = text.toLowerCase();
    for (const [term, entry] of t) {
      let idx = lower.indexOf(term);
      if (idx === -1) continue;
      while (idx !== -1) {
        const before = lower[idx - 1];
        const after = lower[idx + term.length];
        const okBefore = !before || /\W/.test(before);
        const okAfter = !after || /\W/.test(after);
        if (okBefore && okAfter) {
          matches.push({ start: idx, end: idx + term.length, entry });
          break;
        }
        idx = lower.indexOf(term, idx + term.length);
      }
    }
    // Dédoublonne les overlaps : on garde le plus long match qui démarre le plus tôt.
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    let cursor = 0;
    matches.forEach((m) => {
      if (m.start >= cursor) {
        kept.push(m);
        cursor = m.end;
      }
    });
    return kept;
  }

  // ─── Tooltip flottant ─────────────────────────────────────
  let activeTooltip = null;
  let activeTarget = null;

  function showTooltip(target, entry) {
    hideTooltip();
    const tip = document.createElement("div");
    tip.className = "wiki-tt";
    const safe = (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const desc = (entry.excerpt || "").trim().slice(0, 140);
    const slug = entry.slug || entry.id;
    tip.innerHTML =
      '<div class="wiki-tt-name">' + safe(entry.title || slug) + "</div>" +
      '<div class="wiki-tt-desc">' + safe(desc) + "</div>" +
      '<a class="wiki-tt-link" href="#wiki/' + encodeURIComponent(slug) + '">Voir le wiki →</a>';
    document.body.appendChild(tip);
    const r = target.getBoundingClientRect();
    const tipW = 300;
    const tipH = tip.offsetHeight || 100;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = (spaceBelow >= tipH + 12)
      ? (window.scrollY + r.bottom + 6)
      : (window.scrollY + r.top - tipH - 6);
    let left = r.left;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    if (left < 8) left = 8;
    tip.style.top = top + "px";
    tip.style.left = left + "px";
    activeTooltip = tip;
    activeTarget = target;
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
      activeTarget = null;
    }
  }

  // ─── Décoration : enveloppe les matches dans <span data-wiki=…> ─────
  // Le tree walker rejette tout text node déjà sous .wiki-decorated, ce qui
  // évite la double-décoration sans MutationObserver.
  function decorate(root) {
    const t = ensureTrie();
    if (!t || !t.size) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length < 4) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(".wiki-tt, .wiki-decorated, code, pre, kbd, button, input, textarea, script, style, svg, [data-wiki]")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);

    targets.forEach((textNode) => {
      const text = textNode.nodeValue;
      const matches = findMatches(text);
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach((m) => {
        if (m.start > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
        }
        const span = document.createElement("span");
        span.className = "wiki-decorated";
        span.dataset.wiki = m.entry.slug || m.entry.id;
        span.textContent = text.slice(m.start, m.end);
        frag.appendChild(span);
        cursor = m.end;
      });
      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });
  }

  // ─── Hover handling ──────────────────────────────────────
  function onPointerOver(e) {
    const t = e.target && e.target.closest && e.target.closest(".wiki-decorated");
    if (!t) {
      // Si on quitte la cible vers ailleurs (et pas vers le tooltip lui-même), on cache.
      if (activeTooltip && !(e.target.closest && e.target.closest(".wiki-tt"))) hideTooltip();
      return;
    }
    if (t === activeTarget) return;
    const slug = t.dataset.wiki;
    const entries = (window.WIKI_DATA && window.WIKI_DATA.entries) || [];
    const entry = entries.find((x) => x.slug === slug || x.id === slug);
    if (entry) showTooltip(t, entry);
  }

  // Sélecteurs des conteneurs à scanner périodiquement.
  // .jv-bubble couvre les messages Jarvis (le prompt mentionnait .jv-msg-body
  // qui n'existe pas dans le code actuel).
  const SELECTORS = ".top-summary, .hero-body, .sig-card-context, .jv-bubble";

  function init() {
    if (initialized) return;
    initialized = true;
    document.addEventListener("mouseover", onPointerOver);
    document.addEventListener("scroll", hideTooltip, { capture: true, passive: true });
    window.addEventListener("hashchange", hideTooltip);

    // Scan régulier (1.5s) — assez réactif pour les changements de panel,
    // assez espacé pour rester quasi-gratuit côté CPU.
    setInterval(() => {
      try {
        document.querySelectorAll(SELECTORS).forEach(decorate);
      } catch (_) {}
    }, 1500);
  }

  // Démarrage différé : on laisse Tier 1 + premier render React s'installer.
  if (document.readyState === "complete") {
    setTimeout(init, 800);
  } else {
    window.addEventListener("load", () => setTimeout(init, 800));
  }
})();
