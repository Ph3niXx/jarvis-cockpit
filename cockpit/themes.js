// Three distinct visual directions — each a full design system
window.THEMES = {
  // ═══════════════════════════════════════════════════════════
  // 1. DAWN — Editorial warm. Le matin, presse haut de gamme.
  //    Ivoire crémeux, encre profonde, accent orange rouille.
  // ═══════════════════════════════════════════════════════════
  dawn: {
    id: "dawn",
    name: "Dawn",
    subtitle: "Éditorial · chaleureux",
    tag: "Presse du matin",
    vars: {
      // Base
      "--bg": "#F5EFE4",
      "--bg2": "#EDE5D6",
      "--bg3": "#FBF7EF",
      "--surface": "#FFFFFF",
      "--tx": "#1F1815",
      "--tx2": "#5E524A",
      "--tx3": "#9A8D82",
      "--bd": "#E0D5C0",
      "--bd2": "#C9BBA3",
      // Accents
      "--brand": "#C2410C",         // rouille / orange brûlé
      "--brand-ink": "#7C2D12",
      "--brand-tint": "#FBEADA",
      "--positive": "#4D6A3A",
      "--positive-tint": "#E9EFDE",
      "--alert": "#B54B3B",
      "--alert-tint": "#F4DDD6",
      // Type
      "--font-display": "'Fraunces', 'Times New Roman', serif",
      "--font-body": "'Inter', system-ui, sans-serif",
      "--font-mono": "'JetBrains Mono', 'SF Mono', monospace",
      // Aliases (newer panels use these names)
      "--font-serif": "'Fraunces', 'Times New Roman', serif",
      "--font-sans": "'Inter', system-ui, sans-serif",
      // Tone
      "--radius": "6px",
      "--radius-lg": "12px",
      "--shadow-sm": "0 1px 2px rgba(48, 32, 24, 0.05)",
      "--shadow-md": "0 4px 14px rgba(48, 32, 24, 0.08)",
      "--shadow-lg": "0 16px 40px rgba(48, 32, 24, 0.10)",
      "--grid-line": "rgba(31, 24, 21, 0.06)",
      // Spacing — échelle 4px
      "--space-1": "4px",
      "--space-2": "8px",
      "--space-3": "12px",
      "--space-4": "16px",
      "--space-5": "24px",
      "--space-6": "32px",
      "--space-7": "48px",
      "--space-8": "64px",
      // Type scale
      "--text-2xs": "10px",
      "--text-xs":  "11px",
      "--text-sm":  "12px",
      "--text-md":  "13px",
      "--text-lg":  "15px",
      "--text-xl":  "18px",
      "--text-2xl": "22px",
      "--text-3xl": "28px",
      "--text-display": "54px",
    },
    vibe: {
      displayWeight: 500,
      displayItalic: true,
      numberStyle: "display", // use display font for hero numbers
      density: "spacious",
      dividerStyle: "rule",   // classic 1px rules
      cardStyle: "paper",
      corner: "rounded",
      kickerCase: "uppercase",
      accentShape: "underline",
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 2. OBSIDIAN — Cockpit sombre. Mission control, le terminal
  //    pro. Charbon profond, halo cyan électrique, mono-first.
  // ═══════════════════════════════════════════════════════════
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    subtitle: "Terminal · haute densité",
    tag: "Mission control",
    vars: {
      "--bg": "#0B0D0F",
      "--bg2": "#13161A",
      "--bg3": "#1A1E23",
      "--surface": "#13161A",
      "--tx": "#E8ECEF",
      "--tx2": "#9AA3AD",
      "--tx3": "#5C6670",
      "--bd": "#23282E",
      "--bd2": "#353C43",
      "--brand": "#60E0D4",          // cyan mint électrique
      "--brand-ink": "#2CB3A4",
      "--brand-tint": "rgba(96, 224, 212, 0.12)",
      "--positive": "#9FE870",       // lime
      "--positive-tint": "rgba(159, 232, 112, 0.12)",
      "--alert": "#F97366",
      "--alert-tint": "rgba(249, 115, 102, 0.12)",
      "--font-display": "'Inter', system-ui, sans-serif",
      "--font-body": "'Inter', system-ui, sans-serif",
      "--font-mono": "'JetBrains Mono', 'SF Mono', monospace",
      "--font-serif": "'Instrument Serif', Georgia, serif",
      "--font-sans": "'Inter', system-ui, sans-serif",
      "--radius": "4px",
      "--radius-lg": "6px",
      "--shadow-sm": "0 1px 0 rgba(0, 0, 0, 0.4)",
      "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.5)",
      "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.6)",
      "--grid-line": "rgba(255, 255, 255, 0.04)",
      // Spacing — échelle 4px
      "--space-1": "4px",
      "--space-2": "8px",
      "--space-3": "12px",
      "--space-4": "16px",
      "--space-5": "24px",
      "--space-6": "32px",
      "--space-7": "48px",
      "--space-8": "64px",
      // Type scale
      "--text-2xs": "10px",
      "--text-xs":  "11px",
      "--text-sm":  "12px",
      "--text-md":  "13px",
      "--text-lg":  "15px",
      "--text-xl":  "18px",
      "--text-2xl": "22px",
      "--text-3xl": "28px",
      "--text-display": "54px",
    },
    vibe: {
      displayWeight: 600,
      displayItalic: false,
      numberStyle: "mono",
      density: "dense",
      dividerStyle: "grid",    // grid lines everywhere
      cardStyle: "console",
      corner: "sharp",
      kickerCase: "uppercase",
      accentShape: "bar",      // left accent bar
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 3. ATLAS — Papier blanc cassé, typographie Swiss, accent
  //    encre bleu indigo. Sobre, structuré, très lisible.
  // ═══════════════════════════════════════════════════════════
  atlas: {
    id: "atlas",
    name: "Atlas",
    subtitle: "Swiss · structuré",
    tag: "Bureau d'études",
    vars: {
      "--bg": "#F4F4F1",
      "--bg2": "#EAEAE4",
      "--bg3": "#FFFFFF",
      "--surface": "#FFFFFF",
      "--tx": "#111315",
      "--tx2": "#4A4F55",
      "--tx3": "#8A9096",
      "--bd": "#DCDDD7",
      "--bd2": "#C0C2BB",
      "--brand": "#2D3FE0",          // indigo encre
      "--brand-ink": "#1E2BA3",
      "--brand-tint": "#E2E5FB",
      "--positive": "#0E7A5F",
      "--positive-tint": "#DBF0E9",
      "--alert": "#C53030",
      "--alert-tint": "#F8DCDC",
      "--font-display": "'Instrument Serif', Georgia, serif",
      "--font-body": "'Inter', system-ui, sans-serif",
      "--font-mono": "'JetBrains Mono', 'SF Mono', monospace",
      "--font-serif": "'Instrument Serif', Georgia, serif",
      "--font-sans": "'Inter', system-ui, sans-serif",
      "--radius": "2px",
      "--radius-lg": "4px",
      "--shadow-sm": "0 1px 0 rgba(17, 19, 21, 0.04)",
      "--shadow-md": "0 2px 0 rgba(17, 19, 21, 0.04)",
      "--shadow-lg": "0 12px 32px rgba(17, 19, 21, 0.08)",
      "--grid-line": "rgba(17, 19, 21, 0.06)",
      // Spacing — échelle 4px
      "--space-1": "4px",
      "--space-2": "8px",
      "--space-3": "12px",
      "--space-4": "16px",
      "--space-5": "24px",
      "--space-6": "32px",
      "--space-7": "48px",
      "--space-8": "64px",
      // Type scale
      "--text-2xs": "10px",
      "--text-xs":  "11px",
      "--text-sm":  "12px",
      "--text-md":  "13px",
      "--text-lg":  "15px",
      "--text-xl":  "18px",
      "--text-2xl": "22px",
      "--text-3xl": "28px",
      "--text-display": "54px",
    },
    vibe: {
      displayWeight: 400,
      displayItalic: false,
      numberStyle: "display",
      density: "balanced",
      dividerStyle: "rule",
      cardStyle: "paper",
      corner: "sharp",
      kickerCase: "uppercase",
      accentShape: "dot",
    },
  },
};

window.THEME_ORDER = ["dawn", "obsidian", "atlas"];
