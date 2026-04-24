# Recherche

> Command-K unifié : recherche live Supabase sur les articles + historique local + basculable en "Mode IA" (placeholder vers Jarvis).

## Scope
mixte

## Finalité fonctionnelle
Point d'entrée rapide "retrouve-moi ça" accessible partout avec `Cmd/Ctrl+K`. Le modal fait une recherche **ilike** en parallèle sur 4 tables (`articles`, `wiki_concepts`, `business_ideas`, `jarvis_conversations`), affiche les résultats unifiés en liste navigable au clavier, et expose un bouton "Demander à Jarvis" qui bascule vers le panel `jarvis` avec la requête pré-remplie. Le panel stocke l'historique des recherches (récentes auto, sauvegardées manuellement) en localStorage.

## Parcours utilisateur
1. **Entrée 1** — clic sidebar "Recherche" : vue pleine page avec hero, bouton d'ouverture du modal et trois aperçus des états possibles.
2. **Entrée 2** — Cmd/Ctrl+K depuis n'importe quel panel du cockpit : le modal s'ouvre instantanément (une seule frappe suffit).
3. **Entrée 3** — clic sur un signal faible depuis le panel Signaux : la recherche s'ouvre déjà pré-remplie avec le terme du signal.
4. Dans le modal, le champ de saisie est focalisé automatiquement, l'utilisateur tape sa requête.
5. En dessous de deux caractères, le modal affiche les cinq dernières recherches récentes + cinq recherches sauvegardées + quelques raccourcis clavier (desktop uniquement).
6. Dès deux caractères, les résultats remontent en parallèle depuis articles, fiches wiki, idées business et messages Jarvis, avec un léger délai pour éviter les requêtes à chaque frappe. Chaque résultat est tagué par type (section article / WIKI / IDÉE / USER / ASSISTANT) avec un extrait court.
7. Navigation au clavier (↑ / ↓ pour parcourir, Entrée pour ouvrir) — un article ouvre en onglet externe, un résultat wiki/idée/Jarvis bascule sur le panel correspondant.
8. Clic sur "Demander à Jarvis" dès qu'un terme est saisi : le modal se ferme et Jarvis s'ouvre avec la question déjà pré-remplie.
9. Clic sur "⭐ Sauvegarder" dans le header des résultats pour donner un nom à la requête en cours et la garder sous la main.
10. Échap ou clic sur l'arrière-plan ferme le modal et remet la recherche à zéro.

## Fonctionnalités
- **Raccourci universel Cmd/Ctrl+K** : ouverture du modal de recherche depuis n'importe où dans le cockpit, le raccourci affiché s'adapte à l'OS (⌘ sur Mac, Ctrl ailleurs).
- **Recherche live multi-sources** : dès deux caractères, la recherche croise en parallèle articles, fiches wiki, idées business et messages Jarvis, avec un léger délai pour éviter les requêtes à chaque frappe.
- **Navigation clavier** : flèches ↑ ↓ pour parcourir les résultats, Entrée pour ouvrir, Échap pour fermer.
- **Ouverture contextuelle** : un article s'ouvre dans un nouvel onglet, un résultat wiki/idée/Jarvis bascule sur le panel correspondant en un clic.
- **Recherches récentes** : les cinq dernières requêtes abouties sont rappelées en tête quand la barre est vide, pour rejouer une recherche en un clic.
- **Recherches sauvegardées** : un bouton « ⭐ Sauvegarder » qui donne un nom à la requête en cours et la garde sous la main pour plus tard.
- **Demander à Jarvis** : bouton qui envoie la requête en cours vers l'assistant Jarvis pour obtenir une réponse en langage naturel quand le corpus ne remonte rien.
- **Pré-remplissage depuis Signaux** : un clic sur un signal faible ouvre la recherche déjà pré-remplie avec le terme.
- **Astuces clavier** : en bas du modal, rappel des raccourcis disponibles (↵ ouvrir, ↑↓ naviguer, Esc fermer) sur desktop.
- **Message vide** : quand aucun résultat ne sort, un texte explicite invite à basculer sur Jarvis.

## Front — structure UI
Fichier : [cockpit/panel-search.jsx](cockpit/panel-search.jsx) — 406 lignes, monté par [app.jsx:383](cockpit/app.jsx:383).

Structure DOM :
- `.panel-page > .panel-hero` (eyebrow + h1 + sub + `.cmdk-trigger`)
- `.cmdk-demos` — 4 pills de démo (ouvrir modal / query "agents" / question IA / 0 résultat)
- `.cmdk-previews` — 3 cartes d'aperçu des états
- **Modal** (rendu conditionnel via `open`) :
  - `.cmdk-overlay` (overlay cliquable, ferme au clic)
  - `.cmdk-modal`
    - `.cmdk-input-row` — icon + input + `.cmdk-ai-toggle` + `.cmdk-esc` (ou `.cmdk-close-touch` sur mobile)
    - `.cmdk-body`
      - `.cmdk-ai-response` (si `aiMode && query`)
      - `.cmdk-group` × N ("Recherches récentes", "Raccourcis", résultats live)
    - `.cmdk-footer` (desktop only, 4 items de hints)

Pas d'id HTML stable. Route id = `"search"`. Panel Tier 1 (non listé dans `TIER2_PANELS`) mais ne fait pas de fetch au boot — il fetch **à la frappe**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelSearch({ data, onNavigate })` | Composant racine — state `open / query / selectedIdx / liveResults` | [panel-search.jsx](cockpit/panel-search.jsx) |
| `OS_INFO` (IIFE) | Détecte os / modKey / modSymbol / isTouch au chargement | [panel-search.jsx:5](cockpit/panel-search.jsx:5) |
| `CmdKModal({ query, setQuery, filtered, onAskJarvis, onSaveSearch, ... })` | Modal avec input focusé, navigation clavier, rendu résultats unifiés | [panel-search.jsx](cockpit/panel-search.jsx) |
| `openResult(r, onClose, onAskJarvis)` | Dispatch ouverture résultat : `window.open(r.url)` ou `onNavigate(r.navTo)` | [panel-search.jsx](cockpit/panel-search.jsx) |
| `Kbd({ children })` | Helper d'affichage d'une touche clavier | [panel-search.jsx:63](cockpit/panel-search.jsx:63) |
| `readRecentQueries()` | Lit `localStorage.search.recent` avec validation + limit 5 | [panel-search.jsx:28](cockpit/panel-search.jsx:28) |
| `pushRecentQuery(q, resultsCount)` | Dédupe + prepend + `slice(0, 10)` → localStorage | [panel-search.jsx:36](cockpit/panel-search.jsx:36) |
| `readSavedSearches()` | Lit `localStorage.search.saved` | [panel-search.jsx:53](cockpit/panel-search.jsx:53) |
| `saveCurrentSearch(q)` | `prompt()` → dédup par nom + prepend + limit 20 → localStorage | [panel-search.jsx](cockpit/panel-search.jsx) |
| `stripSnippet(html)` | Helper `<div>.textContent` pour nettoyer le HTML RSS | [panel-search.jsx](cockpit/panel-search.jsx) |
| `relTimeSearch(iso)` | Formate une date ISO en "il y a Xh / hier / il y a N jours" | [panel-search.jsx:43](cockpit/panel-search.jsx:43) |
| Effet "live search 4-tables" (anonyme) | Debounce 220 ms + 4× `window.sb.fetchJSON().catch(()=>[])` en parallèle + mapping unifié | [panel-search.jsx](cockpit/panel-search.jsx) |
| Effet "Cmd+K local" (anonyme) | Ouvre le modal quand l'utilisateur est déjà sur le panel | [panel-search.jsx](cockpit/panel-search.jsx) |
| Effet "flag open-on-mount" (anonyme) | Consomme `window.__openSearchOnMount` posé par app.jsx (fix "deux frappes") | [panel-search.jsx](cockpit/panel-search.jsx) |
| Effet "expose navigator" (anonyme) | `window.__cockpitNavigate = onNavigate` pour `openResult` | [panel-search.jsx](cockpit/panel-search.jsx) |
| Effet "prefill signals" (anonyme) | Consomme `localStorage.veille-prefill-query` au mount | [panel-search.jsx](cockpit/panel-search.jsx) |
| `askJarvis(q)` | Stashe `localStorage.jarvis-prefill-input` + `onNavigate("jarvis")` | [panel-search.jsx](cockpit/panel-search.jsx) |
| `handleSaveSearch(q)` | Wrapper qui appelle `saveCurrentSearch` + émet une télémétrie | [panel-search.jsx](cockpit/panel-search.jsx) |
| `close()` (inline) | Ferme + reset state (query, selectedIdx, liveResults) | [panel-search.jsx](cockpit/panel-search.jsx) |

Event listeners globaux : `keydown` Cmd+K (app-level et panel-level), `keydown` navigation ↑↓↵ (depuis `CmdKModal`).

## Back — sources de données

| Table | Colonnes lues (filtres ilike sur) | Limit |
|-------|-----------------------------------|-------|
| `articles` | `title, summary, source` | 10 |
| `wiki_concepts` | `name, slug, summary_beginner, summary_intermediate` | 5 |
| `business_ideas` | `title, description, teaser` | 5 |
| `jarvis_conversations` | `content` (sélectionne aussi `session_id, role, created_at`) | 5 |

Les 4 requêtes partent en parallèle via `Promise.all`, chacune protégée par `.catch(() => [])` — une table inaccessible (RLS 401, etc.) n'empêche pas les autres de remonter.

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) : nourrit `articles` via RSS → Gemini + `wiki_concepts` via détection de termes IA.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : enrichit les descriptions `wiki_concepts` (summary_beginner/intermediate/expert) via Claude Haiku.
- **Jarvis (local)** : écrit `jarvis_conversations` à chaque message utilisateur/assistant via le serveur FastAPI ; écrit `business_ideas` seulement via édition manuelle front.

## Appels externes
- **Supabase REST** : 4× `GET /rest/v1/<table>?or=(...)` via `window.sb.fetchJSON(url)`, en parallèle.
- **localStorage** : 4 clés utilisées — `search.recent` (auto), `search.saved` (manuel), `veille-prefill-query` (consommée), `jarvis-prefill-input` (posée au clic "Demander à Jarvis").
- **`window.open(url, "_blank")`** : ouverture article externe pour les résultats `article` uniquement.
- **`window.track(...)`** : télémétrie `usage_events` via le wrapper telemetry (events `search_performed` et `search_saved`).
- **`window.__cockpitNavigate(panelId)`** : router exposé par le panel pour navigation interne des résultats wiki/ideas/jarvis.

## Dépendances
- **Onglets in** : `signals` (via `veille-prefill-query`), `app.jsx` global shortcut (Cmd+K + flag).
- **Onglets out** : `wiki`, `ideas`, `jarvis` via `onNavigate` selon le type de résultat cliqué. `jarvis` aussi ciblé par le bouton "Demander à Jarvis".
- **Pipelines** : `daily_digest.yml` (articles + wiki) obligatoire. `weekly_analysis.yml` pour l'enrichissement wiki. Serveur Jarvis local pour peupler `jarvis_conversations`.
- **Variables d'env / secrets** : aucune côté front (utilise `window.SUPABASE_URL` global défini dans `cockpit/lib/supabase.js`).

## États & edge cases
- **Loading** : pas de skeleton. L'input est focusé dès ouverture du modal, le body reste vide tant que `query.length < 2`.
- **Query < 2 caractères** : `liveResults = []`, pas de requête réseau, bloc "Recherches récentes / sauvegardées / raccourcis" ou astuce selon l'historique.
- **Zéro résultat global** : message `"Aucun résultat dans ton corpus. Clic sur « Demander à Jarvis » pour une réponse en langage naturel."`
- **Une table 401/500 et pas les autres** : grâce au `.catch(() => [])` par fetch, les résultats des tables accessibles s'affichent quand même. Un warning `console.error` est loggé.
- **Erreur globale (ex : Supabase down)** : `catch` wrap autour du `Promise.all` → `setLiveResults([])` + `console.error`. Pas de feedback UI.
- **Race condition** : chaque ensemble de fetches a un `token = Math.random()` ; une réponse stale est ignorée.
- **Mobile / touch** : pas de footer, bouton `×` dans l'input row à la place de `esc`. Bouton "Demander à Jarvis" visible aussi.
- **Save sans nom** : si l'utilisateur annule le `prompt()` ou entre un nom vide, `saveCurrentSearch` retourne `false`, rien n'est écrit.
- **Save dédup** : deux saves avec le même nom écrasent l'ancienne entrée (tri par prepend + filter).
- **`veille-prefill-query` consommé** : le `localStorage.removeItem` est fait avant le `setQuery` — OK en cas de re-mount.
- **`__openSearchOnMount` consommé** : `delete` (via `= false`) puis `setOpen(true)` — flag à usage unique, pas de boucle.
- **Cross-panel navigation** : clic sur un résultat wiki/idea/jarvis ferme le modal puis appelle `window.__cockpitNavigate(panelId)`. Si l'ID panel n'est pas reconnu par le router, le comportement de fallback est `<Stub>`.

## Limitations connues / TODO
- [x] ~~Cmd+K global ne déclenche PAS l'ouverture du modal~~ → **fixé** via flag `window.__openSearchOnMount` posé par app.jsx et consommé au mount.
- [x] ~~Mode IA non fonctionnel~~ → **remplacé** par bouton "Demander à Jarvis" qui stashe la query dans `localStorage.jarvis-prefill-input` et navigue vers le panel `jarvis` (qui consomme déjà cette clé à [panel-jarvis.jsx:331-333](cockpit/panel-jarvis.jsx:331)).
- [x] ~~Recherches sauvegardées read-only~~ → **fixé** : bouton ⭐ Sauvegarder dans le header des résultats, `prompt()` pour nommer, persisté dans `localStorage.search.saved` (dédup par nom, limit 20).
- [x] ~~Corpus ilike limité à articles~~ → **étendu** aux 4 tables (articles, wiki_concepts, business_ideas, jarvis_conversations) en `Promise.all`.
- [ ] **URL construite en string-concat** avec `encodeURIComponent(q)` — marche mais peu robuste ; préférable d'utiliser `new URL(...).searchParams`.
- [ ] **Pas de pagination** sur aucune des 4 tables. Fixé à 10 articles + 5/5/5 pour le reste. Un match massif sur wiki/ideas passe sous le seuil.
- [ ] **Snippet stripping via DOM** : `stripSnippet` crée un `<div>` temporaire à chaque résultat — OK en volume mais attention XSS : `<div>.innerHTML = userContent` est dangereux si on affichait le HTML. Ici on ne lit que `textContent`, safe.
- [ ] **Pas de feedback "recherche en cours"** pendant les 220 ms de debounce + latence réseau. L'UI montre "0 résultats" de façon trompeuse pendant la période d'attente.
- [ ] **Démos hardcodées dans le hero** : "agents", prompts Jarvis — hardcodés dans `.cmdk-demos-row` et `.cmdk-preview-grid`. OK pour une vitrine.
- [ ] **`prompt()` natif pour le nom de save** est moche. Upgrade : modal inline dédiée avec validation + édition de la query.
- [ ] **`window.__cockpitNavigate` fuit dans `window`** : exposé pour que `openResult` puisse naviguer sans prop-drilling, mais sale en soi. À nettoyer quand on aura un contexte React.
- [ ] **Pas d'icônes par type distinctes dans les résultats** : les 4 types utilisent `sparkles / book / lightbulb / assistant`, ce qui est OK. Les "scopes" affichent le type (WIKI / IDÉE / USER / ASSISTANT / SECTION ARTICLE).
- [ ] **Résultats jarvis sans contexte de conversation** : on ne montre que le message isolé, pas le thread. Un clic navigue vers `jarvis` mais n'ouvre pas la bonne session (`session_id` perdu).
- [ ] **CSS `.cmdk-ai-toggle`** réutilisé pour le bouton "Demander à Jarvis" — nom de classe périmé. À renommer `.cmdk-jarvis-action` si on remanie le CSS.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — refonte 4-tables + Demander à Jarvis + save + fix Cmd+K (local, non pushé)
