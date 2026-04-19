// cockpit/lib/auth.js
// Google OAuth overlay. Gates React mount — <App/> is not rendered until a
// valid session is in place. Reuses the rendering pattern of the legacy
// index.html but styled with Dawn tokens so it sits naturally on top of
// the new shell.
(function(){
  function makeOverlay(){
    const o = document.createElement("div");
    o.id = "login-overlay";
    o.style.cssText = [
      "position:fixed","inset:0","z-index:9999",
      "display:flex","align-items:center","justify-content:center",
      "background:var(--bg, #F5EFE4)",
      "font-family:'Inter',system-ui,sans-serif",
    ].join(";");
    o.innerHTML = `
      <div style="max-width:380px;padding:40px 36px;text-align:center">
        <div style="font-family:'Fraunces',serif;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#C2410C;margin-bottom:18px;font-weight:600">
          AI Cockpit
        </div>
        <h1 style="font-family:'Fraunces',serif;font-size:28px;font-weight:500;line-height:1.15;color:#1F1815;margin-bottom:12px;letter-spacing:-.02em">
          Connecte-toi pour ouvrir ton cockpit
        </h1>
        <p style="font-size:14px;line-height:1.6;color:#5E524A;margin-bottom:28px">
          Accès restreint. Google OAuth via Supabase.
        </p>
        <button id="login-btn" style="display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:6px;background:#1F1815;color:#EDE5D6;border:none;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background 120ms">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 12.27c0-.77-.07-1.51-.2-2.22h-10.3v4.21h5.89a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.26-4.72 3.26-8.05z"/><path d="M12 23c2.95 0 5.43-.98 7.24-2.65l-3.54-2.75c-.98.66-2.24 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.23v2.84A10.99 10.99 0 0 0 12 23z"/><path d="M5.88 14.15a6.6 6.6 0 0 1 0-4.3V7.01H2.23a11 11 0 0 0 0 9.98l3.65-2.84z"/><path d="M12 5.34c1.6 0 3.05.55 4.19 1.63l3.14-3.14A10.98 10.98 0 0 0 12 1a10.99 10.99 0 0 0-9.77 6.01l3.65 2.84C6.74 7.27 9.15 5.34 12 5.34z"/></svg>
          Se connecter avec Google
        </button>
        <div id="login-msg" style="margin-top:18px;font-size:12px;color:#9A8D82;min-height:18px"></div>
      </div>
    `;
    document.body.appendChild(o);
    o.querySelector("#login-btn").onclick = handleLogin;
  }

  async function handleLogin(){
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    const { error } = await window.sb.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      btn.disabled = false;
      const msg = document.getElementById("login-msg");
      if (msg) msg.textContent = "Erreur : " + error.message;
    }
  }

  async function handleLogout(){
    await window.sb.client.auth.signOut();
    location.reload();
  }

  function hideOverlay(){
    const o = document.getElementById("login-overlay");
    if (o) o.remove();
  }

  // Returns a Promise that resolves with the Supabase session once the user
  // is authenticated. Shows the overlay until that happens.
  async function waitForAuth(){
    if (!document.getElementById("login-overlay")) makeOverlay();
    const { data: { session } } = await window.sb.client.auth.getSession();
    if (session) {
      window.sb.setSession(session);
      hideOverlay();
      wireAuthWatcher();
      return session;
    }
    return new Promise((resolve) => {
      const sub = window.sb.client.auth.onAuthStateChange((event, sess) => {
        if (event === "SIGNED_IN" && sess) {
          window.sb.setSession(sess);
          hideOverlay();
          wireAuthWatcher();
          sub?.data?.subscription?.unsubscribe?.();
          resolve(sess);
        }
      });
    });
  }

  function wireAuthWatcher(){
    // Keep the token fresh; log out → reload.
    window.sb.client.auth.onAuthStateChange((event, sess) => {
      if (event === "TOKEN_REFRESHED" && sess) window.sb.setSession(sess);
      if (event === "SIGNED_OUT") location.reload();
    });
  }

  window.cockpitAuth = { waitForAuth, handleLogin, handleLogout };
})();
