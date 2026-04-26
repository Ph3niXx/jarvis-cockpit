// Snooze — reporter un article à plus tard sans le marquer lu.
// Stockage localStorage clé "snoozed-articles" : { id → { until, snoozedAt } }.
// Cleanup auto au chargement : retire les entrées dont le until est passé depuis +7j.
(function () {
  const KEY = "snoozed-articles";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
  }

  window.snooze = {
    add(id, days) {
      if (!id) return;
      const map = read();
      map[id] = {
        until: Date.now() + days * 86400000,
        snoozedAt: Date.now(),
      };
      write(map);
    },
    remove(id) {
      const map = read();
      delete map[id];
      write(map);
    },
    isActive(id) {
      const map = read();
      const e = map[id];
      return !!(e && e.until > Date.now());
    },
    dueToday() {
      const map = read();
      const now = Date.now();
      const due = [];
      Object.entries(map).forEach(([id, e]) => {
        if (e && e.until <= now) due.push(id);
      });
      return due;
    },
    cleanup() {
      const map = read();
      const now = Date.now();
      let changed = false;
      Object.keys(map).forEach((id) => {
        if (!map[id] || map[id].until <= now - 7 * 86400000) {
          delete map[id];
          changed = true;
        }
      });
      if (changed) write(map);
    },
  };

  window.snooze.cleanup();
})();
