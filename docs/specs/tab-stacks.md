# Stacks & Limits

> Tableau de bord coûts + quotas + usage des 4 services tech (Claude, Gemini, Supabase, GitHub) avec statut réel tiré de `weekly_analysis`, `gemini_api_calls`, RPC `get_stack_stats` et saisies manuelles dans `user_profile.stacks.*`.

## Scope
mixte

## Finalité fonctionnelle
Centraliser en un panel la santé des 4 services tech qui font tourner le cockpit (Claude pour le weekly pipeline, Gemini pour le daily pipeline, Supabase pour la DB, GitHub pour les Actions). Pour chacun : statut safe/warn/critical, quotas avec projected fin-de-mois, breakdown d'usage, rate limits, série 30j, et console_url direct. Les chiffres "officiels" qu'aucune API publique n'expose (solde Anthropic console, pic RPM Gemini constaté à chaud) sont saisis à la main via deux boutons "Mettre à jour" qui POST dans `user_profile.stacks.*` — le loader relit ces clés et en dérive le statut en priorité. Objectif principal : "ne jamais tomber en panne silencieuse parce qu'un quota a claqué la nuit" — d'où les alertes consolidées en haut de page et le flag critical piloté par le tracker Python `gemini_api_calls` qui logue chaque appel + chaque rate limit côté pipeline.

## Parcours utilisateur
1. Clic sidebar "Stacks & Limits" → `loadPanel("stacks")` lance 5 fetches en parallèle (T2 `weekly_analysis` + `articles_30d` + RPC `get_stack_stats` + `articles_today` + RPC `get_gemini_usage_stats(30)`) puis lit `profileRows` depuis le Tier 1 `__COCKPIT_RAW` pour les saisies manuelles.
2. **Hero** : eyebrow "Stacks & Limits · 4 services suivis" + bouton "↻ refresh" (invalidate cache stacks_/weekly_analysis/articles_today puis reload). Titre rouge/warn/vert selon `critical_count`/`warn_count`. Sous-titre `hero_sub` généré par `buildStacksHeroSub()` (non affiché ci-dessous, voir loader).
3. **4 KPIs** hero : coût MTD avec jour/days_in_month, projeté fin de mois (rouge si > budget), alertes actives, répartition paid/free × safe/warn/critical.
4. **Alertes consolidées** : bar en haut listant toutes les alertes critical/warn de tous les services (filtrage des "info").
5. **2 filtres** : Type (all/paid/free), Statut (all/critical/warn/safe). Aucun filtre persisté en localStorage.
6. Pour chaque service : bloc avec header (logo 1-letter coloré, nom, provider, plan, dot statut, last_used relatif, console_url + bouton "Mettre à jour" pour Claude/Gemini).
7. **Claude "Mettre à jour le solde"** → 3 prompts natifs (balance USD, crédit initial, date d'expiration) → 2-4 upserts `user_profile` → invalidate cache → reload panel.
8. **Gemini "Mettre à jour le rate limit"** → 1 confirm (rate limit atteint oui/non) + 3 prompts (modèle, pic RPM observé, limite RPM) → 5 upserts → reload.
9. Body du bloc : alertes propres + quotas (barres de progression avec level safe/warn/critical/exceeded) + breakdown (table) + rate limits instantanés + chart 30j.

## Fonctionnalités
- **Hydration 100% réelle pour 3 services** : Claude (`weekly_analysis.tokens_used` agrégé par mois en cours vs mois précédent + série 30j, projection `month_cost / monthProgress`), Gemini (RPC `get_gemini_usage_stats(30)` donne séries + today_calls + today_rate_limits + total_rate_limits), Supabase (RPC `get_stack_stats()` retourne db_size_bytes + top_tables + row_counts).
- **GitHub indicatif** : pas d'API publique free → quotas affichés à 0, alerte info "À vérifier dans github.com/settings/billing", série 30j flat à 0. Quota Actions free tier 2000 min/mois en dur.
- **Saisie manuelle 2-voies** : `stEditClaudeBalance` et `stEditGeminiRateLimit` — `window.prompt`/`confirm` natifs, puis upsert vers `user_profile` avec `on_conflict=key` + header `Prefer: resolution=merge-duplicates`.
- **Priorité manual > real > proxy** : pour Claude, si `stacks.anthropic_balance_usd` renseigné → status dérivé du solde (critical <1$ / warn <3$). Pour Gemini, ordre : rate_limits tracés aujourd'hui > flag manuel > pic RPM manuel > proxy articles × 2.
- **Série 30j uniforme** : tableau `seriesDays` pré-rempli à 0, rempli avec les runs Claude par date ISO. Chart SVG 900×90px avec barres + ligne moving-avg 7j.
- **Projection fin de mois** : `monthCost / (dayOfMonth / daysInMonth)`. Alerte critical si > budget, warn si > 75%.
- **Delta vs mois précédent** : `cost_delta_pct = (projected - prevMonthEur) / prevMonthEur × 100`. Null si prev = 0.
- **Conversion USD→EUR** : `USD_TO_EUR = 0.92` hardcoded.
- **Filtrage combinable** : type × statut, compteur "X / N services" en bas de la barre de filtres.
- **Aucune télémétrie** : le panel n'émet pas de `track()` events.
- **Aucune persistance côté front** : pas de localStorage (vs ideas/jarvis qui en ont).

## Front — structure UI
Fichier : [cockpit/panel-stacks.jsx](cockpit/panel-stacks.jsx) — 503 lignes, monté par [app.jsx:412](cockpit/app.jsx:412).

Structure DOM :
- `.st-wrap`
  - `.st-hero > (texte + .st-hero-kpis > .st-kpi × 4)` avec `.st-refresh-btn`
  - `.st-alerts` (conditionnel, liste consolidée critical+warn)
  - `.st-intro` (phrase statique)
  - `.st-filters > .st-filter-group × 2 + .st-filter-count`
  - `.st-services > StServiceBlock × N` filtré
    - `.st-service-head` : logo + name + provider + plan pill + status dot + last_used + balance/rate_limit update date + console link + bouton "Mettre à jour"
    - `.st-body > (.st-alerts + .st-section(quotas) + .st-section(breakdown) + .st-section(rate_limits) + .st-section(chart))`
    - `.st-quota` : label + values + bar `.st-quota-fill.is-{level}` + foot (reset + projected)

Route id = `"stacks"`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelStacks({ data, onNavigate })` | Composant racine + 2 filtres en state + refresh/edit | [panel-stacks.jsx:319](cockpit/panel-stacks.jsx:319) |
| `StChart({ series, unit, color })` | SVG 900×90 barres + ligne moving-avg 7j | [panel-stacks.jsx:31](cockpit/panel-stacks.jsx:31) |
| `StQuota({ q })` | Ligne quota avec barre, level dérivé, foot reset+projected | [panel-stacks.jsx:78](cockpit/panel-stacks.jsx:78) |
| `StServiceBlock({ s, onEdit })` | Bloc complet par service | [panel-stacks.jsx:205](cockpit/panel-stacks.jsx:205) |
| `stPct(used, limit)` | % safe (clamp 999, null si types invalides) | [panel-stacks.jsx:9](cockpit/panel-stacks.jsx:9) |
| `stLevelFor(quota)` | exceeded/critical/warn/safe/info selon thresholds + flag `exceeded` | [panel-stacks.jsx:13](cockpit/panel-stacks.jsx:13) |
| `stFmtNum(v)` | Format FR : `1 234` ou `N.NN` selon magnitude | [panel-stacks.jsx:23](cockpit/panel-stacks.jsx:23) |
| `stUpsertProfile(key, value)` (async) | `POST user_profile?on_conflict=key` avec `Prefer: resolution=merge-duplicates` | [panel-stacks.jsx:120](cockpit/panel-stacks.jsx:120) |
| `stEditClaudeBalance(onDone)` (async) | 3 prompts → 2-4 upserts → invalidate cache → reload panel | [panel-stacks.jsx:132](cockpit/panel-stacks.jsx:132) |
| `stEditGeminiRateLimit(onDone)` (async) | 1 confirm + 3 prompts → 5 upserts → reload | [panel-stacks.jsx:169](cockpit/panel-stacks.jsx:169) |
| `handleRefresh()` (inline) | invalidate stacks_/weekly_analysis/articles_today → `loadPanel("stacks")` | [panel-stacks.jsx:326](cockpit/panel-stacks.jsx:326) |
| `handleEdit(serviceId)` (inline) | Dispatcher vers stEditClaudeBalance/stEditGeminiRateLimit | [panel-stacks.jsx:342](cockpit/panel-stacks.jsx:342) |
| `allAlerts` useMemo (inline) | Consolide alertes critical+warn de tous les services, tri critical first | [panel-stacks.jsx:361](cockpit/panel-stacks.jsx:361) |
| `transformStacks({ weekly, articles30d, dbStats, todayArts, profileRows, gemUsage })` | Assemble toute la shape STACKS_DATA depuis 5 corpus + 1 RPC + profil manuel | [data-loader.js:3084](cockpit/lib/data-loader.js:3084) |
| `buildStacksHeroSub(...)` | Génère le sous-titre hero (claude/supabase/gemini contexte) | [data-loader.js:3537](cockpit/lib/data-loader.js:3537) |
| `loadPanel("stacks")` case | 5 promises.all → assemble shape → `Object.assign(STACKS_DATA, shape)` | [data-loader.js:4559-4575](cockpit/lib/data-loader.js:4559) |

## Back — sources de données

| Table / RPC | Usage | Volume live (2026-04-24) |
|-------------|-------|---------------------------|
| `weekly_analysis` | Lu via `T2.weekly_analysis()`. Agrégé par mois (courant + précédent) pour le coût Claude + projeté + delta. Breakdown = 6 dernières runs. | **4 runs** |
| `articles` (proxy Gemini) | Lu via `stacks_articles_30d` (fetch_date >= now-30d, select id+fetch_date, limit=5000). Comptage par date pour série 30j en fallback. | — |
| `articles` (today) | Lu via `articles_today` once. Count pour `gemToday`. | — |
| `gemini_api_calls` | Lu via RPC `get_gemini_usage_stats(p_days=30)`. Retourne `{series[{date,calls,rate_limits}], today_calls, today_rate_limits, total_calls, total_tokens, total_rate_limits, last_rate_limit_at}`. | **80 calls** |
| RPC `get_stack_stats()` | Retourne `{db_size_bytes, top_tables[{table_name, size_bytes, estimated_rows}], row_counts{articles, memories_vectors, …}, generated_at}`. Nécessaire pour Supabase. | — |
| `user_profile` clés `stacks.*` | Lu depuis `__COCKPIT_RAW.profileRows` (Tier 1). 9 clés possibles : `stacks.anthropic_balance_usd`, `_balance_updated_at`, `_credit_usd`, `_credit_expires`, `stacks.gemini_rate_limit_hit`, `_peak_rpm`, `_peak_rpm_limit`, `_model_limited`, `_observed_at`. | **0 saisies** actuellement |

**Colonnes `gemini_api_calls`** : `id bigint, created_at, pipeline, step, model, status, prompt_chars, response_chars, input_tokens, output_tokens, total_tokens, latency_ms, error_message`. Écrit par `main.py::_log_gemini_call()` à chaque appel Gemini (fire-and-forget, jamais levé).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) : à chaque `call_gemini()`, insère une ligne dans `gemini_api_calls` via `_log_gemini_call(pipeline, step, model_name, prompt, response, error, latency_ms)` ([main.py:140](main.py:140)). Status `"ok"` ou `"error"` ou `"rate_limit"` — alimente directement `today_rate_limits` et `total_rate_limits` via la RPC.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : écrit `tokens_used JSONB` dans `weekly_analysis` avec `{input_tokens, output_tokens, total_tokens, cost_usd, calls, runs}`. 1 ligne par semaine.
- **Jarvis (local)** : **ne contribue pas** — les appels locaux (LLM via LM Studio) ne loguent rien dans `gemini_api_calls` ni `weekly_analysis`. Les appels cloud Claude depuis `server.py::_call_claude` enregistrent dans `jarvis_conversations.tokens_used` mais PAS dans `weekly_analysis`. → le Stacks panel ne voit que le coût des pipelines auto, pas les coûts Jarvis cloud.

## Appels externes
- **Supabase REST** :
  - `T2.weekly_analysis()` (dans Tier 2 loader)
  - `GET articles?fetch_date=gte.{iso30}&select=id,fetch_date&order=fetch_date.desc&limit=5000` (proxy Gemini)
  - `GET articles` today (dans `loadArticlesToday` once)
  - `POST /rpc/get_stack_stats`
  - `POST /rpc/get_gemini_usage_stats` avec `{p_days: 30}`
  - `POST user_profile?on_conflict=key` (upsert manuel via boutons)
  - `GET user_profile?order=key` (refresh après edit)
- **Liens console externes** (target=_blank) : `console.anthropic.com/settings/usage`, `aistudio.google.com/app/apikey`, `supabase.com/dashboard/project/mrmgptqpflzyavdfqwwv`, `github.com/settings/billing/summary`.
- **`window.prompt` / `window.confirm`** : 3×prompt + 0×confirm pour Claude, 3×prompt + 1×confirm pour Gemini.
- **Aucun appel réseau direct externe** (tout passe par Supabase REST).

## Dépendances
- **Onglets in** : sidebar uniquement.
- **Onglets out** : aucun lien vers d'autres panels (les liens consoles pointent vers les vraies consoles externes).
- **Globals lus** : `window.STACKS_DATA`, `window.SUPABASE_URL`, `window.sb.headers`, `window.sb.query`, `window.__COCKPIT_RAW.profileRows` (pour Tier 1 reload après edit), `window.cockpitDataLoader.invalidateCache/loadPanel`.
- **Pas de composant partagé** : JvIcon absent, Icon absent — tout est inline (logo = 1ère lettre colorée, dot = `<span class="st-status-dot">`).
- **Pipelines** : `daily_digest.yml` (Gemini logging), `weekly_analysis.yml` (Claude cost).
- **RPCs** : `get_stack_stats()`, `get_gemini_usage_stats(p_days int)`.
- **Variables d'env / secrets** : rien côté front. Backend = tous les secrets existants (Gemini/Anthropic/Supabase).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 5 fetches.
- **`weekly_analysis` vide** : `monthCostUsd = 0` → status = "safe" (projection 0). Série 30j reste flat à 0. Breakdown vide.
- **RPC `get_stack_stats` 404** (migration pas appliquée) : `.catch(() => null)` → `dbBytes = 0` → `dbMB = 0` → status "safe", quota DB affiche 0 MB / 500 MB. Pas d'erreur visible.
- **RPC `get_gemini_usage_stats` 404** : `.catch(() => null)` → `gemReal = null` → fallback sur proxy articles × 2. `hasRealGem = false` → breakdown affiche "articles/jour" au lieu de "appels/jour".
- **Saisies manuelles absentes** (cas actuel, 0 lignes `stacks.*`) : `hasManualBalance = false` et `hasGemManual = false` → status Claude dérivé de la projection, status Gemini dérivé du proxy articles. Le bouton "Mettre à jour" reste visible et fonctionnel.
- **Saisie manuelle invalide** : `Number("xxx") === NaN` → `Number.isFinite(NaN)` = false → `hasManualBalance/hasGemManual` = false, le fallback prend le relais silencieusement.
- **Cancel d'un prompt** (`window.prompt` retourne `null`) : early-return, aucune écriture.
- **`stUpsertProfile` échec** : `res.ok === false` → `throw new Error("upsert 4xx")` → `handleEdit` catch et alert "Erreur : xxx".
- **prompt() "0"** : converti `Number("0") = 0`, `Number.isFinite(0) = true` → sauvé. Un solde de 0$ fait passer Claude en "critical" à juste titre.
- **projected > budget × 3** : barre clampée à `Math.min(100, pct)` côté UI mais le pourcentage affiché peut atteindre 999 (`stPct` clamp).
- **Mois en cours jour 1** : `monthProgress = 1/30 ≈ 0.033` → `projected = monthCost / 0.033 = monthCost × 30` → peut exploser tôt dans le mois. Non rétrogradé.
- **Conversion USD→EUR statique** : `0.92` hardcoded → drift non pris en compte si le taux change.
- **Alert sans `critical`** : le tri `allAlerts.sort((a,b) => a.level === "critical" ? -1 : 1)` n'est pas stable quand aucune n'est critical — mais OK car n'affecte pas l'affichage.
- **Pas de refresh auto** : l'utilisateur doit cliquer "↻ refresh" pour re-fetch. Pas de polling périodique.
- **`st-chart-bar` sans données** (`yMax = 0`) : `yMax = Math.max(...vals) * 1.1 || 1` évite la division par 0 → toutes les barres à hauteur 0, ligne plate en haut.
- **`console_url` sans http://** : `target="_blank" rel="noreferrer"` → ouvert en nouvelle fenêtre, pas de sécurité opener.
- **Boutons Mettre à jour pendant reload** : pas de disabled pendant `handleEdit` — l'utilisateur peut re-cliquer et queue plusieurs flows prompt. Non bloquant mais brouillon.

## Limitations connues / TODO
- [x] ~~**USD→EUR statique**~~ → **fixé** : nouveau `T2.fx_usd_eur()` qui fetch `https://api.frankfurter.dev/v1/latest?from=USD&to=EUR` (BCE, free, no key), cache session via `once()`. Fallback `0.92` si l'API échoue. CSP mise à jour avec `api.frankfurter.dev`. Quota Claude affiche aussi `FX {rate} du {date}`.
- [x] ~~**Projection précoce dans le mois**~~ → **fixé** : `projected = monthToDate + avg(last7days) × daysRemaining` si `dayOfMonth >= 3`. Retombe sur la projection linéaire naïve pour les 2 premiers jours du mois (pas assez de signal).
- [x] ~~**Budget Claude fixe à 10 €/mois**~~ → **fixé** : lu depuis `user_profile.stacks.claude_budget_eur` (défaut 10€). Configurable via le modal Claude (4e champ).
- [x] ~~**Coûts Jarvis cloud non comptés**~~ → **fixé** : nouveau `T2.jarvis_cloud_month()` qui fetch `jarvis_conversations?mode=eq.cloud&created_at=gte.{month_start}`. Additionne `tokens_used × $0.000004/tok` au coût mensuel Claude + répartit sur la série 30j. Quota affiche `X € (dont Y € Jarvis cloud · projeté Z €)`.
- [ ] **GitHub 100% indicatif** : pas d'API publique free-tier pour l'usage Actions. Les quotas affichés sont à 0 et l'alerte renvoie vers github.com/settings/billing.
- [ ] **Limite Gemini free tier 1500 req/jour hardcoded** : c'est le tier Flash mais le Pro est 50/j et on mélange les deux en proxy.
- [ ] **Series 30j Supabase = flat proxy** ([data-loader.js:3468](cockpit/lib/data-loader.js:3468)) : `{...d, value: dbMB / 30}` → barres identiques. Pas de vraie série (on n'a qu'un snapshot).
- [x] ~~**Prompts natifs**~~ → **fixé** : nouveau composant `StEditModal` (React inline, réutilise les classes CSS `tk-*` du TicketModal). 4 types de champs (text/number/date/boolean). `Ctrl+Entrée` save, `Escape` cancel, focus auto sur premier champ, erreurs affichées dans la modal.
- [ ] **Aucun feedback intermédiaire** sur les edits : 4 upserts séquentiels pendant lesquels le bouton affiche "Enregistre…" mais pas de barre de progression.
- [ ] **Filtres non persistés** : `typeFilter` et `statusFilter` reviennent à "all" à chaque reload.
- [ ] **Pas de polling auto** : nécessite un clic manuel sur "↻ refresh" pour voir les nouveaux appels Gemini/Claude.
- [ ] **Pas de seuil de notification navigateur** : quand un service passe en critical, aucune notification. Juste un dot rouge dans l'eyebrow.
- [ ] **Breakdown Claude = 6 dernières semaines brutes** : les `week_start` tronquées à `slice(5)` ("04-14", "04-07"…) sont peu lisibles. Pas de format localisé.
- [x] ~~**MAU Supabase hardcoded à 1**~~ → **fixé** : migration [sql/014_get_stack_stats_mau.sql](sql/014_get_stack_stats_mau.sql) étend la RPC avec `mau_30d` (distinct users `last_sign_in_at > now() - 30d`) + `users_total`. Quota affiche `X actifs / Y inscrits`.
- [ ] **Supabase `row_counts` limité** : la RPC ne renvoie que `articles` et `memories_vectors` explicites → la liste "Articles · rows" et "Memories vectors · rows" apparaît toujours, même si d'autres tables grossissent plus.
- [ ] **`projected` côté quota** sur "Budget mensuel" Claude absent : le quota est affiché dans "Solde Anthropic" si saisi manuellement, ou "Coût pipelines auto · mois" (type usage, sans limit) — pas de barre de progression visuelle vs budget.
- [ ] **Pas de dédoublement d'alertes** entre la section propre au service et la bar consolidée en haut : l'utilisateur voit la même alerte 2 fois.
- [ ] **`stacks.*` namespace user_profile** : conventions nommage non documentée en dehors du code. Si quelqu'un modifie les clés, le loader tombe en silence sur ses defaults.

## Dernière MAJ
2026-04-24 — rétro-doc + 6 fixes (modal React StEditModal, FX dynamique Frankfurter, budget configurable, coût Jarvis cloud additionné, projection stable 7j-avg, MAU réel via migration 014)
