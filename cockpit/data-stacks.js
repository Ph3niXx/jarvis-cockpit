// ═══════════════════════════════════════════════════════════════
// STACKS_DATA — Claude + Gemini + GitHub + Supabase
// ─────────────────────────────────────────────
// Vue quotas / coûts / usage. Gros consommateur multi-projets.
// ═══════════════════════════════════════════════════════════════

(function () {
  const TODAY = new Date("2026-04-27");
  const DAY_OF_MONTH = TODAY.getDate(); // 27
  const DAYS_IN_MONTH = 30;
  const MONTH_PROGRESS = DAY_OF_MONTH / DAYS_IN_MONTH; // 0.9

  // ── Helper : série 30j ─────────────────────────────────────────
  function gen30(base, variance, spike = null) {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - (29 - i));
      let v = base + (Math.random() - 0.5) * variance;
      const dow = d.getDay();
      // moins de trafic le week-end
      if (dow === 0 || dow === 6) v *= 0.55;
      if (spike && i === spike) v *= 3.2;
      return { date: d.toISOString().slice(0, 10), value: Math.max(0, +v.toFixed(2)) };
    });
  }

  // ── CLAUDE ─────────────────────────────────────────────────────
  const claude_usage_30d = gen30(4.2, 2.8, 18); // ~4€/jour avec spike jour 18
  const claude_cost_mtd = claude_usage_30d.reduce((a, x) => a + x.value, 0);
  const claude_projected = claude_cost_mtd / MONTH_PROGRESS;

  const claude = {
    id: "claude",
    service: "Claude API",
    provider: "Anthropic",
    plan: "Pay-as-you-go",
    type: "paid",
    color: "#d97757",
    status: "safe",
    last_used: "il y a 3 min",
    // Limite auto-imposée (soft budget)
    quotas: [
      {
        label: "Budget mensuel",
        unit: "€",
        used: +claude_cost_mtd.toFixed(2),
        limit: 120,
        reset: "1er mai",
        projected: +claude_projected.toFixed(2),
        type: "budget",
        critical_above: 0.85,
      },
      {
        label: "Input tokens · mois",
        unit: "M tok",
        used: 47.3,
        limit: null,
        raw_used: "47 283 412",
        type: "usage",
      },
      {
        label: "Output tokens · mois",
        unit: "M tok",
        used: 8.7,
        limit: null,
        raw_used: "8 741 287",
        type: "usage",
      },
    ],
    breakdown: [
      { label: "claude-sonnet-4.5", calls: 2847, tokens_in_M: 28.4, tokens_out_M: 5.2, cost: 58.40 },
      { label: "claude-haiku-4.5", calls: 4182, tokens_in_M: 17.1, tokens_out_M: 3.1, cost: 11.87 },
      { label: "claude-opus-4", calls: 147, tokens_in_M: 1.8, tokens_out_M: 0.4, cost: 32.50 },
    ],
    series_30d: claude_usage_30d,
    series_unit: "€/jour",
    rate_limits: {
      requests_per_min: { used: 127, limit: 4000 },
      tokens_per_min: { used: 285000, limit: 400000 },
    },
    alerts: [
      { level: "info", text: "Spike le 15 avril — debug agent Jarvis, +12€ en 2h" },
    ],
  };

  // ── GEMINI ─────────────────────────────────────────────────────
  const gemini_usage_30d = gen30(340, 180);
  const gemini_today = 287;
  const gemini = {
    id: "gemini",
    service: "Gemini API",
    provider: "Google",
    plan: "Free tier",
    type: "free",
    color: "#4285f4",
    status: "warn",
    last_used: "il y a 8 min",
    quotas: [
      {
        label: "Requêtes par jour · Gemini 2.5 Pro",
        unit: "req",
        used: gemini_today,
        limit: 50,
        reset: "minuit Pacific",
        type: "daily",
        critical_above: 0.85,
        warn_above: 0.70,
        exceeded: true,
      },
      {
        label: "Requêtes par jour · Gemini 2.5 Flash",
        unit: "req",
        used: 847,
        limit: 1500,
        reset: "minuit Pacific",
        type: "daily",
        critical_above: 0.85,
        warn_above: 0.70,
      },
      {
        label: "Requêtes par minute · Flash",
        unit: "req/min",
        used: 8,
        limit: 15,
        type: "rate",
      },
      {
        label: "Tokens par minute · Pro",
        unit: "K tok/min",
        used: 42,
        limit: 250,
        type: "rate",
      },
    ],
    breakdown: [
      { label: "gemini-2.5-pro", calls: "287 / 50 auj", note: "over limit — fallback Claude activé" },
      { label: "gemini-2.5-flash", calls: "847 / 1500 auj" },
      { label: "gemini-1.5-flash-8b", calls: "2 142 · 30j" },
    ],
    series_30d: gemini_usage_30d,
    series_unit: "req/jour",
    alerts: [
      { level: "critical", text: "Quota Pro dépassé aujourd'hui (287/50). Passer payant ou attendre 9h restantes." },
      { level: "warn", text: "3 jours de dépassement cette semaine. Envisager upgrade." },
    ],
  };

  // ── GITHUB ─────────────────────────────────────────────────────
  const github = {
    id: "github",
    service: "GitHub",
    provider: "GitHub",
    plan: "Pro (personnel)",
    type: "paid",
    color: "#1f1f1f",
    status: "safe",
    last_used: "il y a 1h",
    quotas: [
      {
        label: "Actions · minutes",
        unit: "min",
        used: 1247,
        limit: 3000,
        reset: "1er mai",
        type: "monthly",
        warn_above: 0.70,
        critical_above: 0.90,
      },
      {
        label: "Codespaces · heures CPU",
        unit: "h",
        used: 72,
        limit: 180,
        reset: "1er mai",
        type: "monthly",
      },
      {
        label: "Packages · storage",
        unit: "GB",
        used: 1.2,
        limit: 2,
        type: "storage",
        warn_above: 0.70,
      },
      {
        label: "Copilot · appels/mois",
        unit: "calls",
        used: "∞",
        limit: "illimité",
        type: "info",
      },
      {
        label: "LFS · bandwidth",
        unit: "GB",
        used: 0.8,
        limit: 1,
        reset: "1er mai",
        type: "monthly",
        warn_above: 0.70,
        critical_above: 0.85,
      },
    ],
    breakdown: [
      { label: "jarvis-core", note: "repo principal", minutes: 487, copilot_suggestions: 1284 },
      { label: "cockpit-ui", minutes: 312, copilot_suggestions: 892 },
      { label: "veille-scraper", minutes: 287, copilot_suggestions: 418 },
      { label: "side-projects · 4 repos", minutes: 161, copilot_suggestions: 524 },
    ],
    series_30d: gen30(42, 20),
    series_unit: "min Actions/jour",
    rate_limits: {
      api_requests_per_hour: { used: 847, limit: 5000 },
    },
    alerts: [
      { level: "warn", text: "LFS bandwidth à 80% — penser à purger assets anciens" },
    ],
  };

  // ── SUPABASE ───────────────────────────────────────────────────
  const supabase = {
    id: "supabase",
    service: "Supabase",
    provider: "Supabase",
    plan: "Free tier",
    type: "free",
    color: "#3ecf8e",
    status: "critical",
    last_used: "il y a 12 min",
    quotas: [
      {
        label: "Database size",
        unit: "MB",
        used: 487,
        limit: 500,
        type: "storage",
        warn_above: 0.80,
        critical_above: 0.95,
      },
      {
        label: "Monthly Active Users",
        unit: "MAU",
        used: 1847,
        limit: 50000,
        reset: "1er mai",
        type: "monthly",
      },
      {
        label: "Egress · bandwidth mensuel",
        unit: "GB",
        used: 4.2,
        limit: 5,
        reset: "1er mai",
        type: "monthly",
        warn_above: 0.75,
        critical_above: 0.90,
      },
      {
        label: "Storage (assets)",
        unit: "GB",
        used: 0.72,
        limit: 1,
        type: "storage",
        warn_above: 0.70,
      },
      {
        label: "Edge Functions · invocations",
        unit: "calls",
        used: 342000,
        limit: 500000,
        reset: "1er mai",
        type: "monthly",
        warn_above: 0.70,
      },
      {
        label: "Realtime · connexions simultanées",
        unit: "connexions",
        used: 87,
        limit: 200,
        type: "rate",
      },
    ],
    breakdown: [
      { label: "jarvis-memory (table principale)", size_mb: 287, rows: "1.2M" },
      { label: "veille-cache", size_mb: 142, rows: "487K" },
      { label: "embeddings (pgvector)", size_mb: 47, rows: "34K" },
      { label: "audit_log", size_mb: 8, rows: "18K" },
      { label: "autres tables", size_mb: 3, rows: "2K" },
    ],
    series_30d: gen30(0.14, 0.06, 22),
    series_unit: "GB egress/jour",
    alerts: [
      { level: "critical", text: "DB size à 97% — purge auto-déclenchée sur audit_log ou migration Pro (25$/mois)" },
      { level: "critical", text: "Egress à 84% · +2% / jour · dépassement estimé d'ici le 30" },
    ],
  };

  const services = [claude, gemini, github, supabase];

  // ── Totals / KPIs ──────────────────────────────────────────────
  const totals = {
    services_count: services.length,
    paid_count: services.filter((s) => s.type === "paid").length,
    free_count: services.filter((s) => s.type === "free").length,
    critical_count: services.filter((s) => s.status === "critical").length,
    warn_count: services.filter((s) => s.status === "warn").length,
    safe_count: services.filter((s) => s.status === "safe").length,
    cost_mtd: +(claude_cost_mtd).toFixed(2),
    cost_projected: +(claude_projected).toFixed(2),
    cost_budget: 120,
    total_alerts: services.reduce((a, s) => a + (s.alerts?.length || 0), 0),
    critical_alerts: services.reduce(
      (a, s) => a + (s.alerts?.filter((al) => al.level === "critical").length || 0),
      0
    ),
  };

  window.STACKS_DATA = {
    today: TODAY.toISOString().slice(0, 10),
    day_of_month: DAY_OF_MONTH,
    days_in_month: DAYS_IN_MONTH,
    services,
    totals,
  };
})();
