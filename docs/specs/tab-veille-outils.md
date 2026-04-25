# Veille outils

> Synthèse hebdo des nouveautés Claude (Code, Cowork, skills, écosystème), classée pour décider vite ce qu'on applique au projet et ce qu'on garde de côté.

## Scope
pro

## Finalité fonctionnelle
Tenir l'utilisateur à jour sur les évolutions de Claude sans le noyer dans le bruit RSS. Une routine hebdomadaire externe synthétise les sources non couvertes par les flux RSS quotidiens (analyses de fond, blogs, threads communautaires, retours d'expérience) et propose pour chaque nouveauté retenue : à quoi elle sert, est-elle applicable au projet Jarvis, et comment l'appliquer concrètement.

## Parcours utilisateur
1. Ouvre la section "Veille outils" depuis la sidebar — un en-tête indique la date du dernier passage de la routine et 4 chiffres clés (total d'items, nouveaux à lire, priorités hautes en attente, déjà appliqués).
2. Lit la synthèse exécutive en tête de page — une note courte qui résume la semaine côté Claude : un titre, les 3 tendances de fond, le quick win de la semaine, et un point à surveiller.
3. Filtre la liste — par priorité (haute / moyenne / basse) et un toggle pour masquer les items déjà appliqués ou écartés. Les choix de filtre sont mémorisés entre les sessions.
4. Parcourt les 4 sections classées : Applicables Jarvis, Claude usage général, Outils complémentaires, Autres news. Dans chaque section les items sont triés par priorité décroissante puis effort croissant.
5. Pour chaque item : voit le titre cliquable vers la source, un résumé court, son applicabilité au projet (si l'item s'y prête), et un volet repliable "Comment l'appliquer" avec les étapes concrètes — ouvert par défaut sur les items applicables Jarvis, replié ailleurs.
6. Marque sa décision sur l'item — le passe à "en cours", "appliqué" ou "écarté" selon ce qu'il en fait. Le choix est sauvegardé immédiatement et la carte se grise / se barre selon l'état.
7. Ajoute une note perso si besoin — quitte le champ pour sauvegarder, sans bouton de validation explicite.

## Fonctionnalités
- **En-tête compteurs** : date du dernier run hebdo et 4 chiffres clés (total, nouveaux, priorités hautes en attente, déjà appliqués) — pour situer la backlog veille en un coup d'œil.
- **Synthèse exécutive** : encart en tête de page qui résume la semaine en 4 points (headline, 3 tendances, 1 quick win, 1 point à surveiller) — pour avoir une vue d'ensemble avant de plonger dans les items.
- **4 sections classées** : Applicables Jarvis, Claude usage général, Outils complémentaires, Autres news — pour décider d'un coup d'œil quoi lire en priorité.
- **Volet "Comment l'appliquer"** : pour chaque item, une recette concrète (commande à tester, élément du projet à modifier, prompt à copier) — ouvert par défaut sur les items applicables au projet, replié ailleurs.
- **Statut éditable** : 4 états (Nouveau → En cours → Appliqué / Écarté) modifiables directement depuis la carte — pour avancer dans la backlog sans changer d'écran.
- **Notes perso** : champ libre par item, sauvegardé en quittant le champ — pour capturer une réflexion ou un follow-up sans perdre le fil.
- **Filtres** : sélecteur de priorité et masquage des items déjà appliqués/écartés — pour focaliser sur ce qui demande une décision.

## Front — structure UI
Panel `cockpit/panel-veille-outils.jsx`, exposé sur `window.PanelVeilleOutils`. Stylesheet dédié `cockpit/styles-veille-outils.css` (préfixe `.vo-*`).

- `<PanelVeilleOutils>` — racine, lit `window.VEILLE_OUTILS_DATA` (items + summary + last_run + by_category + total).
- `<VOSummaryHero>` — encart synthèse exécutive, rend `_summary.summary` via `marked` + `DOMPurify`.
- `<VOSection>` — section par catégorie, reçoit la liste filtrée et triée.
- `<VOItemCard>` — carte item : badges (status, priorité, effort), titre+source (lien externe), summary, applicability, how_to_apply (collapsible, déplié par défaut sur `jarvis_applicable`), trend_context, menu de transitions de status, textarea de notes (save on blur).
- Filtres en haut : pills priorité (Toutes/Haute/Moyenne/Basse) + checkbox "Masquer appliqués + écartés".
- Persistance UI : `localStorage["vo.priFilter"]`, `localStorage["vo.hideDone"]`.
- Empty state : message + hint mentionnant la routine Cowork si la table est vide.

## Front — fonctions JS
| Fonction | Rôle | Fichier |
|----------|------|---------|
| `PanelVeilleOutils` | Composant racine : filtres + tri + dispatch des patches | `cockpit/panel-veille-outils.jsx` |
| `patchItem(id, patch)` | PATCH REST sur `claude_veille?id=eq.<id>`, mute en mémoire l'item correspondant, telemetry | `cockpit/panel-veille-outils.jsx` |
| `voSafeHtml(md)` | `marked.parse` + `DOMPurify.sanitize` pour `summary` et `how_to_apply` | `cockpit/panel-veille-outils.jsx` |
| `loadPanel("veille-outils")` (case T2) | Fetch `claude_veille`, sépare la ligne `_summary` des items, mute `window.VEILLE_OUTILS_DATA` | `cockpit/lib/data-loader.js` |
| `T2.veille_outils()` | Wrapper `once()` du fetch Supabase | `cockpit/lib/data-loader.js` |

## Back — sources de données
Table Supabase `claude_veille` (15 colonnes, RLS authenticated pour SELECT + UPDATE, INSERT/DELETE réservés au service_role) :

- Identification : `id` (uuid, gen_random_uuid), `run_date` (date, défaut CURRENT_DATE), `created_at` (timestamptz)
- Catégorie : `category` (CHECK : `jarvis_applicable`, `claude_general`, `complementary_tools`, `other_news`, `_summary`)
- Contenu : `title` (NOT NULL), `source_url`, `source_name`, `summary`, `applicability`, `how_to_apply`, `trend_context`
- Tri / déclassement : `priority` (high/medium/low), `effort` (XS/S/M/L)
- Workflow user : `status` (new → in_progress → applied/dismissed, défaut `new`, NOT NULL), `notes`

Indexes : `run_date DESC`, `category`, `status`, et un partial unique sur `source_url WHERE source_url IS NOT NULL` pour la dédup côté DB. Migration : `sql/011_claude_veille.sql`.

## Back — pipelines qui alimentent
- **Routine Cowork hebdomadaire** ("Veille Claude hebdo", samedi matin par défaut) : créée dans Cowork desktop via le skill `schedule`. Web search ciblé sur les sources non-RSSables (Simon Willison, Hamel Husain, Eugene Yan, swyx/Latent Space, Drew Breunig, smol.ai, r/ClaudeAI top week, Cowork help center, nouveaux MCP/plugins). Filtrage qualité dur, classification en 4 buckets + ligne `_summary`, INSERT via MCP Supabase, archive markdown dans `docs/veille-claude/YYYY-MM-DD.md`.
- Pas de pipeline GitHub Actions : la routine tourne sur le PC de l'utilisateur quand Cowork est ouvert.
- Pas de doublon avec `main.py` : le pipeline RSS quotidien couvre les sources Anthropic officielles (section `claude` de la table `articles`) ; la routine Cowork se concentre sur la synthèse + sources non-RSS.

## Appels externes
- Front : Supabase REST `GET /rest/v1/claude_veille` (Tier 2) + `PATCH /rest/v1/claude_veille?id=eq.<id>` (status + notes).
- Routine Cowork : web_search Cowork natif + connecteur MCP Supabase (`apply_migration`/`execute_sql` pour INSERT).

## Dépendances
- Onglets : aucun lien transverse direct.
- Pipelines : routine Cowork "Veille Claude hebdo" (définie dans Cowork desktop, prompt v2 documenté en session de design).
- Variables d'env / secrets : aucun spécifique côté front. La routine Cowork hérite de la session authentifiée Cowork (MCP Supabase).

## États & edge cases
- **Loading Tier 2** : panel masqué pendant que `loadPanel("veille-outils")` fetch ; un loader skeleton est rendu par `app.jsx`.
- **Empty (filtres trop restrictifs)** : message "Aucun item ne matche les filtres" avec hint pour relancer la routine.
- **Empty (table vide)** : même rendu, hint mentionnant le skill `schedule` Cowork.
- **PATCH échec (offline, RLS, JWT expiré)** : log console, le statut UI reste sur l'ancienne valeur, pas d'alerte intrusive.
- **MCP Supabase indisponible côté routine** : la routine doit logger un warning et écrire au moins le markdown ; le panel ne change pas (les anciens items restent visibles).

## Limitations connues / TODO
- [ ] Le prompt de la routine Cowork n'est pas versionné dans le repo (à committer dans `docs/cowork-routines/veille-claude.md` pour reproductibilité).
- [ ] Pas de notification email récap après le run (mentionné dans le prompt v2, à câbler côté routine ou via un trigger Supabase).
- [ ] Pas de feedback loop : la routine pourrait lire les items `applied`/`dismissed` des 4 dernières semaines pour ajuster ses sources et son tri (à câbler dans le prompt).
- [ ] Pas de filtrage par catégorie au-dessus des sections — pour l'instant on déroule les 4 sections.
- [ ] Le champ `applicability` est sous-utilisé (la routine v1 a tout mis dans `how_to_apply`) — à corriger dans le prompt v2 pour distinguer "à quoi ça sert" vs "comment l'appliquer".

## Dernière MAJ
2026-04-25 — création initiale : panel + table Supabase (migration 011) + intégration sidebar + routine Cowork v1 (11 items écrits le 25/04/2026).
