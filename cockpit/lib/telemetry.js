// cockpit/lib/telemetry.js
// Best-effort append-only telemetry to Supabase usage_events.
// A failure must NEVER break the app — all errors swallowed.
(function(){
  async function track(eventType, payload){
    try {
      if (!window.SUPABASE_URL || !window.sb) return;
      await window.sb.postJSON(window.SUPABASE_URL + "/rest/v1/usage_events", {
        event_type: eventType,
        payload: payload || {},
      });
    } catch (e) {
      console.warn("[track]", eventType, e.message);
    }
  }
  window.track = track;
})();
