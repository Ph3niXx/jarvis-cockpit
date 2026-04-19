// cockpit/lib/supabase.js
// Supabase client + REST wrapper (JWT attached after auth).
// Loaded as a classic script (not type="module") to be compatible with Babel standalone.
(function(){
  const SUPABASE_URL = "https://mrmgptqpflzyavdfqwwv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("[supabase] supabase-js not loaded before lib/supabase.js");
    return;
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Mutable headers — rewritten after login / token refresh.
  let headers = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
  function setSession(session){
    const token = session?.access_token || SUPABASE_KEY;
    headers = { apikey: SUPABASE_KEY, Authorization: "Bearer " + token };
  }

  async function fetchJSON(url){
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  async function postJSON(url, body){
    const r = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  async function patchJSON(url, body){
    const r = await fetch(url, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r;
  }
  async function deleteRequest(url){
    const r = await fetch(url, { method: "DELETE", headers });
    return r;
  }

  // Thin query wrapper: sb.query("articles", "fetch_date=eq.2026-04-19&order=id.desc&limit=20")
  async function query(table, qs){
    const url = SUPABASE_URL + "/rest/v1/" + table + (qs ? (qs.startsWith("?") ? qs : "?" + qs) : "");
    return fetchJSON(url);
  }
  async function rpc(fn, args){
    return postJSON(SUPABASE_URL + "/rest/v1/rpc/" + fn, args || {});
  }

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;
  window.sb = {
    client,
    setSession,
    fetchJSON,
    postJSON,
    patchJSON,
    deleteRequest,
    query,
    rpc,
    get headers(){ return headers; },
  };
  // Legacy aliases (to be dropped in Phase 6).
  window.fetchJSON = fetchJSON;
  window.postJSON = postJSON;
  window.patchJSON = patchJSON;
})();
