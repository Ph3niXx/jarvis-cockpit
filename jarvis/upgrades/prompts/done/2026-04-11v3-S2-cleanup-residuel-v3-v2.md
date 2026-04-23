# Migration AI Cockpit → Design cible « Dawn / Obsidian / Atlas »

Tu es un ingénieur frontend senior. Ta mission : **transformer le `index.html` actuel du repo `-ai-daily-digest` (GitHub Pages, vanilla JS monolithique) en l'architecture React + design system qui a été maquettée** dans le projet `cockpit/`. Tu ne pars **PAS** de zéro : une maquette complète et fonctionnelle existe déjà, elle est ta **source de vérité absolue**. Ton travail est un portage contrôlé, pas un redesign.

---

## 0 — Règle d'or

**La maquette `cockpit/` est la cible. Le `index.html` est la source de données et de logique métier.**

- Tu trouveras toute la doc cible dans jarvis/migration-package
- Tu ne modifies **pas** le rendu, la typographie, les tokens de couleur, la grille, l'espacement ou les composants visuels de la maquette.
- Tu ne réintroduis **pas** le CSS monolithique de l'`index.html` actuel (palette bg/bg2/bg3 ivoire, Fraunces + Space Grotesk, `--sidebar-w:240px`, `.sb-link`, `.sb-section`, etc.).
- Tu câbles la logique réelle (Supabase, auth, télémétrie, Jarvis, etc.) **derrière** les composants maquettés.
- Si un composant maquetté n'a pas d'équivalent dans l'actuel → tu laisses des fake data de la maquette en fallback.
- Si une fonctionnalité de l'actuel n'a pas de slot dans la maquette → tu **demandes** avant d'improviser. Pas d'ajout silencieux.

---

## 1 — État des lieux

### Ce qui existe AUJOURD'HUI 
- `index.html` — **11 018 lignes**, un seul fichier HTML/CSS/JS vanilla.
- Sidebar à base de `.sb-link[data-panel="..."]` + `.sb-section[data-section="..."]`.
- Thème clair ivoire (`--bg:#F5EFE4`) + dark `obsidian` médiocre via `prefers-color-scheme`.
- Auth Google OAuth via `supabase-js`, RLS `authenticated`, télémétrie `usage_events`, Jarvis gateway `localhost:8765`, DOMPurify pour l'injection HTML, CSP stricte.
- Panels déclarés (data-panel) : `brief, top, myweek, search, veille, sport, gaming_news, anime, news, radar, recos, challenges, wiki, signals, opportunities, ideas, rte, jarvis, profile, perf-overview, music-overview, gaming-overview, stacks, history, costs, perf-history, tft, jarvis-project`.

### Ce qui EST LA CIBLE (à porter)
Dossier `cockpit/` — React 18 + JSX compilé in-browser via `@babel/standalone`, CSS multi-fichiers, 3 thèmes commutables (`dawn` éditorial crème, `obsidian` terminal sombre, `atlas` swiss structuré).

Fichier d'entrée : **`AI Cockpit - Home.html`** (77 lignes, déjà au format GitHub Pages-compatible) qui charge :
```
cockpit/data.js              ← fake data (à remplacer par vrai data layer Supabase)
cockpit/data-*.js            ← corpus fake par domaine (veille, sport, gaming, anime, news,
                                apprentissage, challenges, wiki, signals, opportunities,
                                ideas, jarvis, profile, forme, musique, gaming-perso,
                                stacks, history)
cockpit/themes.js            ← THEMES = { dawn, obsidian, atlas } + THEME_ORDER
cockpit/icons.jsx            ← <Icon name="..." size=... stroke=... /> (système commun)
cockpit/sidebar.jsx          ← Sidebar collapsible 264→56px, groupes, sparkline coût API
cockpit/home.jsx             ← Brief du jour (hero macro + top 3 + signaux + radar + ma semaine)
cockpit/panel-*.jsx          ← un fichier par panel
cockpit/app.jsx              ← router, theme switcher, sticky "mode historique"
cockpit/styles.css           ← reset + shell (.app grid 264px 1fr, .main)
cockpit/styles-*.css         ← un stylesheet par domaine
```

Navigation cible (`COCKPIT_DATA.nav`) :
| Groupe | IDs |
|---|---|
| Aujourd'hui | `brief`, `top`, `week`, `search` |
| Veille | `updates`, `sport`, `gaming_news`, `anime`, `news` |
| Apprentissage | `radar`, `recos`, `challenges`, `wiki`, `signals` |
| Business | `opps`, `ideas` |
| Personnel | `jarvis`, `profile`, `perf`, `music`, `gaming` |
| Système | `stacks`, `history` |

**⚠ Mapping d'IDs à opérer** (l'actuel ≠ cible) :
```
actuel           → cible
myweek           → week
opportunities    → opps
perf-overview    → perf
music-overview   → music
gaming-overview  → gaming
rte              → (pas de slot dédié dans la maquette — DEMANDER où le câbler, piste : panel dédié ou section dans `ideas`/`profile`)
costs            → stacks (Stacks & Limits gère déjà les coûts)
perf-history     → intégré dans `perf` (panel-forme.jsx a Vue d'ensemble + Historique en onglets)
tft              → (absent de la maquette — DEMANDER : rattacher à `gaming` en onglet, ou dropper)
jarvis-project   → (absent — DEMANDER : onglet dans `jarvis`, ou dropper)
```

---

## 2 — Plan de migration en 6 phases

Tu procèdes **phase par phase**, tu commits à la fin de chaque phase, et tu ne passes pas à la suivante sans valider que la précédente tourne en prod GitHub Pages. **Pas de big bang.**

### Phase 1 — Structure de fichiers & shell minimal ✅ (fondation)

1. À la racine du repo, crée :
   ```
   index.html              ← nouvelle coquille (celle de AI Cockpit - Home.html)
   index.legacy.html       ← copie de l'actuel index.html (filet de sécurité, accessible via /index.legacy.html)
   cockpit/                ← copie 1:1 du dossier cockpit/ du projet design
   ```
2. **Important** : la CSP de l'actuel `index.html` doit être portée dans le nouveau `<head>`. Elle doit autoriser `unpkg.com` (React/Babel) en plus de `cdnjs.cloudflare.com` et `cdn.jsdelivr.net`. Ajoute :
   ```
   script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
   ```
   `'unsafe-eval'` est **obligatoire** pour `@babel/standalone` (pas de workaround, c'est le coût du build in-browser).
3. Porte aussi les `<meta>` PWA (manifest, theme-color, apple-mobile-web-app-*) et le `<link rel="icon">` SVG.
4. Déploie et vérifie que la maquette (données fake) s'affiche sur GitHub Pages exactement comme en local. **Pas de logique réelle encore.**

### Phase 2 — Data layer : remplacer les fake `cockpit/data*.js` par du vrai Supabase

Chaque `cockpit/data-*.js` aujourd'hui expose un objet global (`window.VEILLE_DATA`, `window.SPORT_DATA`, etc.) consommé par les panels. Tu ne touches pas à cette interface ; tu remplaces **l'implémentation** :

1. Crée `cockpit/lib/supabase.js` (ES module chargé comme script classique, pas `type="module"`) qui expose :
   - `window.supabase` (client initialisé avec la publishable key + session Google OAuth restaurée)
   - `window.sb.query(table, filters)` — wrapper REST avec JWT attaché
   - `window.sb.rpc(fn, args)`
2. Crée `cockpit/lib/auth.js` : login overlay identique à l'actuel (Google button + `signInWithOAuth`), appel à `checkAuth()` **avant** `ReactDOM.createRoot(...).render(<App/>)`. Tant que pas de session, `<App/>` n'est pas monté.
3. Crée `cockpit/lib/data-loader.js` qui :
   - Charge en parallèle tous les corpus nécessaires depuis Supabase (articles, daily_briefs, wiki_concepts, signal_tracking, skill_radar, learning_recommendations, weekly_challenges, weekly_opportunities, business_ideas, rte_usecases, user_profile, strava_activities, music_*, steam_*, tft_*, weekly_analysis).
   - Mappe chaque résultat vers la **forme de données exacte** attendue par les panels actuels (regarde les shapes dans `cockpit/data-veille.js` etc. — chaque champ est utilisé par le JSX et doit être rempli).
   - Expose `window.COCKPIT_DATA`, `window.VEILLE_DATA`, etc. avant le montage React.
4. Les anciens `cockpit/data-*.js` deviennent des **schémas de référence** (commentés `// SHAPE EXPECTED BY panel-X.jsx`) — ne les supprime pas, ils documentent le contrat.
5. XSS : tout `dangerouslySetInnerHTML` dans les panels doit passer par `DOMPurify.sanitize(html, {ALLOWED_TAGS:[...]})`. Charge DOMPurify via CDN en haut du `<head>`.

**Critère de succès phase 2** : tu peux désactiver tous les `cockpit/data-*.js` fake, la maquette affiche les vraies données de Supabase.

### Phase 3 — Télémétrie + navigation

1. Dans `cockpit/app.jsx`, `handleNavigate(id)` doit appeler `track("section_opened", {section: id})`. Réutilise la fonction `track()` actuelle (à extraire dans `cockpit/lib/telemetry.js`).
2. Events à re-instrumenter à l'identique de CLAUDE.md :
   | event_type | où |
   |---|---|
   | `section_opened` | `handleNavigate` dans `app.jsx` |
   | `search_performed` | `panel-search.jsx` après fetch |
   | `link_clicked` | event delegation globale dans `app.jsx` sur `a[target="_blank"]` |
   | `pipeline_triggered` | `panel-jarvis.jsx` avant chaque `jarvisSend()` |
   | `error_shown` | wrapper `showError()` centralisé |
3. Deep-link : remplace la hash nav actuelle (`#panel=xxx`) par un hash router simple dans `app.jsx` — `useEffect(() => { window.location.hash = activePanel; }, [activePanel])` + lecture initiale de `location.hash`.
4. Raccourci Cmd/Ctrl+K → panel `search` (déjà prévu dans la maquette sidebar, câble-le).

### Phase 4 — Panels côté métier (un par un, dans cet ordre)

Pour **chaque panel**, l'ordre de travail est : (a) identifier les queries Supabase dans l'actuel `index.html` via grep sur le `data-panel` correspondant, (b) les porter dans `cockpit/lib/data-loader.js`, (c) tester sur Pages, (d) commit.

Ordre de priorité (fréquence d'usage) :

1. **`brief`** (home) — `daily_briefs` (dernier), macro synthèse Gemini, stats (articles_today = count aujourd'hui dans `articles`, signals_rising = count `signal_tracking` where trend='rising' week courante, streak = calcul JS sur `usage_events`), next_brief = prochain cron (hardcodé côté front).
2. **`top`** — articles sélectionnés par score dans le daily_brief du jour.
3. **`week`** — agrégat des 7 derniers jours d'`articles` + `usage_events` (lu/non lu par localStorage + section_opened).
4. **`search`** — full-text `ilike` sur `articles.title` et `articles.summary` (l'existant le fait déjà, porte-le tel quel).
5. **`updates` / `sport` / `gaming_news` / `anime` / `news`** — même composant `PanelVeille` déjà prêt, câblé sur `articles` filtré par section. Crée une table `articles.domain` si nécessaire pour séparer IA / sport / gaming / anime / news (actuellement tout est `section` dans la même table — vérifier et migrer si besoin).
6. **`radar`** — `skill_radar` (8 axes).
7. **`recos`** — `learning_recommendations`.
8. **`challenges`** — `weekly_challenges`.
9. **`wiki`** — `wiki_concepts`.
10. **`signals`** — `signal_tracking` + `weekly_analysis.signals_summary`.
11. **`opps`** — `weekly_opportunities`.
12. **`ideas`** — `business_ideas` (CRUD complet : insert, update, delete — RLS `authenticated` autorise ces ops).
13. **`jarvis`** — fetch `http://localhost:8765` + fallback cloud. **Conserve exactement** le comportement actuel (`jarvisSend`, streaming, traces LLM). Connect-src CSP doit toujours autoriser `localhost:8765` et `https://*.trycloudflare.com`.
14. **`profile`** — `user_profile` key/value, édition live.
15. **`perf`** — `strava_activities` (onglets Vue / Historique).
16. **`music`** — `music_scrobbles, music_stats_daily, music_top_weekly, music_loved_tracks, music_genre_weekly, music_insights_weekly`.
17. **`gaming`** — `steam_games_snapshot, gaming_stats_daily, steam_achievements, steam_game_details`. **Décision à prendre** : rattacher le TFT en 3e onglet du panel gaming ou créer un panel dédié — DEMANDER.
18. **`stacks`** — agrégat `weekly_analysis.tokens_used` + coûts API + quotas restants.
19. **`history`** — groupement `articles` par `fetch_date`, composant déjà prêt.

**Pour chaque panel porté, check final** : diff visuel avec la maquette (ouvrir les deux côte à côte), diff comportemental (liens cliquables, bouton "marquer lu" persistant via localStorage comme avant).

### Phase 5 — Fonctionnalités transverses (à recâbler)

Ces fonctionnalités existent dans l'actuel et n'ont pas toutes un slot évident dans la maquette :
- **Deep work timer** (`.deep-work-btn`) → demander : à remettre dans le header ou dropper ?
- **Voice mode** (`.voice-btn`, `.voice-overlay-bg`) → panel `jarvis` via bouton Dicter du header Home ? DEMANDER.
- **Résumé audio 4 min** (`Lecture audio · 4 min` dans le header Home) → brancher TTS (quel provider ? ElevenLabs ? Gemini TTS ?). DEMANDER.
- **Mode historique** (bandeau sticky de `app.jsx`) → déjà dans la maquette, câble-le sur le panel `history`.
- **Theme switcher** (dawn/obsidian/atlas) → **conserve** le sélecteur dans la sidebar (pied de page). Migration du thème sombre actuel → `obsidian` par défaut si `prefers-color-scheme: dark` ET premier chargement.
- **PWA + manifest.json + sw.js** → garde le service worker actuel, mets à jour le cache-list pour inclure les nouveaux `cockpit/*.jsx` et `cockpit/*.css`. Attention : les `?v=N` dans `AI Cockpit - Home.html` sont du cache-busting — **conserve-les** et incrémente à chaque modif.

### Phase 6 — Nettoyage

1. Supprime `index.legacy.html` après 2 semaines de run stable.
2. Supprime les `cockpit/data-*.js` fake (seuls les schémas en commentaires restent).
3. Retire le fichier `AI Cockpit - Home.html` (la cible est `index.html`).
4. Mets à jour `CLAUDE.md` : section "Architecture technique" → mentionner React via Babel, organisation `cockpit/`, data-loader, et retirer les mentions "un seul fichier vanilla".

---

## 3 — Contraintes non négociables

1. **GitHub Pages only** — pas de build step, pas de bundler, pas de Node. Tout doit marcher en ouvrant directement l'HTML.
2. **React via unpkg + `@babel/standalone`** — versions **pinnées** avec `integrity` SHA384 (exactement comme `AI Cockpit - Home.html` le fait déjà).
3. **Pas de `type="module"`** sur les scripts — ça casse avec Babel standalone. Utilise `window.X = ...` et `<script src>` classiques.
4. **Pas de `const styles = {...}` sans préfixe** dans les JSX — chaque fichier doit nommer ses objets style (`const homeStyles`, `const sidebarStyles`, etc.) sinon collision globale.
5. **Réexporte explicitement chaque composant** sur `window` en fin de fichier pour qu'il soit visible dans `app.jsx` :
   ```js
   Object.assign(window, { Home, Sidebar, Icon /*, etc.*/ });
   ```
6. **CSP** : toute nouvelle origine utilisée (ex: API TTS) doit être ajoutée au meta CSP. Ne jamais retirer `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`.
7. **Sécurité** : toute valeur issue de Supabase injectée en HTML passe par DOMPurify. Pas d'exception.
8. **Service_role key** ne doit **jamais** apparaître dans le front. Seule la publishable (`sb_publishable_...`) est en dur, comme aujourd'hui.
9. **Télémétrie best-effort** : un fail de `track()` ne doit jamais casser l'UI (try/catch silencieux).
10. **Perf** : lazy-load les panels hors Brief du jour — `React.lazy` n'existe pas sans build, donc utilise un pattern de rendering conditionnel + import dynamique de `<script src>` si un panel pèse lourd (wiki 142 concepts, music, gaming). À évaluer après phase 4.

---

## 4 — Checklist avant chaque commit

- [ ] Ouverture du site sur GitHub Pages → login Google fonctionnel → montage React sans erreur console.
- [ ] Switch dawn ↔ obsidian ↔ atlas → tous les panels restent lisibles.
- [ ] Navigation sidebar (click + Cmd/Ctrl+K + hash deep-link) fonctionne.
- [ ] Télémétrie : un `section_opened` visible dans `usage_events` pour chaque clic.
- [ ] Pas de régression offline (SW cache à jour).
- [ ] Pas de CSP violation dans la console.
- [ ] Lighthouse accessibility ≥ 90 (aria-labels, contraste, focus-visible — la maquette les a déjà, ne les perds pas).

---

## 5 — Questions à poser AVANT de commencer

Ne commence pas avant d'avoir ces réponses :

1. On garde les 3 thèmes (dawn / obsidian / atlas) dans le sélecteur final, ou seulement 1 ?
2. Quel est le **thème par défaut** pour un nouveau visiteur ?
3. RTE Toolbox : panel dédié, onglet dans `ideas`, ou dropper ?
4. TFT Tracker : onglet dans `gaming`, panel dédié, ou dropper ?
5. Jarvis Project status : onglet dans `jarvis`, ou dropper ?
6. Deep work timer / Voice mode / Audio brief TTS : garder, déplacer, ou dropper ?
7. Séparation des corpus veille (IA / sport / gaming / anime / news) : déjà en place via `articles.section` ou faut-il migrer le schéma Supabase ?
8. On conserve `index.legacy.html` accessible en parallèle pendant la migration (2 semaines) ?

---

## 6 — Livrables

À la fin de chaque phase, je veux un message structuré :
```
Phase N terminée
→ Fichiers créés/modifiés : [liste]
→ Migrations SQL exécutées : [liste ou "aucune"]
→ Fonctionnalités portées : [liste]
→ Fonctionnalités en attente : [liste + question si besoin]
→ Déploiement Pages : [OK / bloqué par X]
→ Prochaine phase : [N+1]
```

**Lis `CLAUDE.md` en entier avant de commencer, puis lis `AI Cockpit - Home.html`, puis `cockpit/app.jsx`, `cockpit/sidebar.jsx`, `cockpit/home.jsx` et 2 panels au choix pour imprégner le style. Puis pose tes questions. Puis commence la phase 1.**
