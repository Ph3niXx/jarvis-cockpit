// Sidebar — shared component across themes
// Features: Collapsible rail mode, enriched footer

const SB_COLLAPSED_KEY = "cockpit-sb-collapsed";

function useSbLocalState(key, defaultVal) {
  const [val, setVal] = React.useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? defaultVal : JSON.parse(raw);
    } catch { return defaultVal; }
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// Compact sparkline (SVG) for API cost 7d
function SbSparkline({ values, width = 48, height = 14 }) {
  if (!values || !values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(0.001, max - min);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = values[values.length - 1];
  const lastX = (values.length - 1) * step;
  const lastY = height - 2 - ((last - min) / span) * (height - 4);
  return (
    <svg className="sb-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="1.6" fill="currentColor" />
    </svg>
  );
}

function Sidebar({ theme, activeId, onSelect, data, onThemeChange, mobileOpen = false, onMobileClose }) {
  const [openGroups, setOpenGroups] = React.useState(
    () => Object.fromEntries(data.nav.map((g) => [g.group, true]))
  );
  const [collapsed, setCollapsed] = useSbLocalState(SB_COLLAPSED_KEY, false);
  const vibe = theme.vibe;

  const renderLink = (item) => {
    const isActive = activeId === item.id;
    return (
      <li key={item.id}>
        <button
          className={`sb-link ${isActive ? "is-active" : ""}`}
          onClick={() => onSelect(item.id)}
          title={collapsed ? item.label : undefined}
        >
          <Icon name={item.icon} size={15} stroke={1.75} />
          <span className="sb-link-label">{item.label}</span>
          {item.unread ? (
            <span className="sb-unread">{item.unread}</span>
          ) : item.count ? (
            <span className="sb-count">{item.count}</span>
          ) : null}
        </button>
      </li>
    );
  };

  const platform = (typeof navigator !== 'undefined' && navigator.platform) || '';
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Mac/.test(platform) && !isIOS;
  const kbdSym = (isMac || isIOS) ? '⌘' : 'Ctrl';

  const streak = data.stats.streak || 14;
  const costMonth = data.stats.cost_month || "—";
  const costBudget = data.stats.cost_budget || "—";
  const costHist = data.stats.cost_history_7d || [];

  return (
    <aside
      className={`sb ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
      data-vibe-density={vibe.density}
    >
      <div className="sb-head">
        <div className="sb-brand">
          <span className="sb-logo-mark" aria-hidden="true">
            {theme.id === "obsidian" ? "◈" : theme.id === "atlas" ? "◼" : "✦"}
          </span>
          <div className="sb-logo-text">
            <div className="sb-logo-name">Jarvis</div>
          </div>
        </div>
        <button
          className="sb-rail-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Déplier la sidebar" : "Réduire en rail"}
          aria-label={collapsed ? "Déplier" : "Réduire"}
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size={12} stroke={2} />
        </button>
      </div>

      <nav className="sb-nav" aria-label="Navigation principale">
        {data.nav.map((group) => {
          const open = openGroups[group.group];
          const hasHiddenUnread = !open && group.items.some(it => it.unread);
          return (
            <div key={group.group} className={`sb-group ${open ? "is-open" : ""}`}>
              <button
                className="sb-group-label"
                onClick={() => setOpenGroups({ ...openGroups, [group.group]: !open })}
                aria-expanded={open}
              >
                <span className="sb-group-chev">
                  <Icon name="chevron_right" size={10} stroke={2.5} />
                </span>
                <span>{group.group}</span>
                {hasHiddenUnread && <span className="sb-group-hotdot" title="Nouvelles notifs" />}
              </button>
              {open && (
                <ul className="sb-items">
                  {group.items.map((item) => renderLink(item))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* ═══════ FOOTER v2 ═══════ */}
      <div className="sb-foot">
        {/* Row 1: Streak + next brief */}
        <div className="sb-foot-streak">
          <div className="sb-foot-streak-main">
            <span className="sb-foot-streak-icon" aria-hidden="true">
              <Icon name="flame" size={13} stroke={1.75} />
            </span>
            <span className="sb-foot-streak-num">{streak}</span>
            <span className="sb-foot-streak-unit">j</span>
          </div>
          <div className="sb-foot-streak-meta">
            <span>streak veille</span>
            <span className="sb-foot-next">prochain 06:00</span>
          </div>
        </div>

        {/* Row 2: API cost + sparkline */}
        <div className="sb-foot-cost">
          <div className="sb-foot-cost-body">
            <span className="sb-foot-cost-label">API</span>
            <span className="sb-foot-cost-val">{costMonth}</span>
            <span className="sb-foot-cost-budget">/ {costBudget}</span>
          </div>
          <SbSparkline values={costHist} />
        </div>

        {/* Row 3: Theme toggle + Ctrl+K hint */}
        <div className="sb-foot-bottom">
          <div className="sb-theme-toggle" role="group" aria-label="Thème">
            <button
              className={`sb-theme-btn ${theme.id === "dawn" ? "is-active" : ""}`}
              onClick={() => onThemeChange && onThemeChange("dawn")}
              title="Thème Dawn"
              aria-label="Thème Dawn"
            >
              <Icon name="sun" size={12} stroke={1.75} />
            </button>
            <button
              className={`sb-theme-btn ${theme.id === "obsidian" ? "is-active" : ""}`}
              onClick={() => onThemeChange && onThemeChange("obsidian")}
              title="Thème Obsidian"
              aria-label="Thème Obsidian"
            >
              <Icon name="moon" size={12} stroke={1.75} />
            </button>
          </div>
          <div className="sb-foot-kbd">
            <span className="sb-kbd">{kbdSym}</span>
            <span className="sb-kbd">K</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
