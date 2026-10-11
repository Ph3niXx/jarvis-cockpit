// Bouton « Rafraîchir » de l'onglet Once Upon a Nerd (ADR-56).
// Les chiffres en base ne changent qu'au passage de pipelines/creator_sync.py.
// Relire Supabase plus souvent ne montrerait rien de neuf : ce qu'il faut
// relancer, c'est la collecte. Cette fonction déclenche le workflow
// creator-sync.yml (workflow_dispatch) et rend la main tout de suite ; le
// front surveille ensuite creator_posts.updated_at pour savoir quand le run
// a écrit.
//
// Le jeton GitHub ne peut pas vivre dans le front : le dépôt est public.
// Il vit dans les secrets Supabase (GITHUB_DISPATCH_TOKEN), à grain fin,
// limité à ce dépôt et à « Actions : écriture ».
//
// Mêmes garde-fous que igdb-proxy : verify_jwt à true au déploiement, rôle
// `authenticated` contrôlé ici (la publishable key passe verify_jwt), CORS
// borné à l'origine Pages. Aucune écriture en base.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ORIGIN = "https://ph3nixx.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISPATCH_URL =
  "https://api.github.com/repos/Ph3niXx/jarvis-cockpit/actions/workflows/creator-sync.yml/dispatches";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload),
    { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Copie de igdb-proxy::isAuthenticatedUser — voir le commentaire là-bas :
// décoder sans revalider la signature est sûr parce que la passerelle l'a
// déjà fait (verify_jwt), et la publishable key n'est pas un JWT.
function isAuthenticatedUser(req: Request): boolean {
  const raw = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return payload.role === "authenticated";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  if (!isAuthenticatedUser(req)) return json({ error: "authentification requise" }, 403);

  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  if (!token) return json({ error: "secret GITHUB_DISPATCH_TOKEN absent" }, 500);

  // L'heure de référence vient du serveur, pas du navigateur : le front la
  // compare à updated_at, écrit par le runner. Une horloge de PC décalée de
  // deux minutes ferait sinon conclure trop tôt ou jamais.
  const dispatchedAt = new Date().toISOString();
  try {
    const r = await fetch(DISPATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "jarvis-cockpit-creator-refresh",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (r.status !== 204) return json({ error: `github ${r.status}` }, 502);
    return json({ dispatched_at: dispatchedAt }, 202);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
