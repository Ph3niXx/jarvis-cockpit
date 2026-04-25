# Veille outils

> Synthèse hebdo des nouveautés Claude **et** catalogue stable des outils qui se branchent à Claude (ou inversement) — un seul écran, deux sous-onglets.

## Scope
pro

## Finalité fonctionnelle
Tenir l'utilisateur à jour sur les évolutions Claude et son écosystème, en deux logiques complémentaires :
1. **Veille hebdo** : ce que la routine externe a vu cette semaine côté Claude (analyses, blogs, retours d'expérience non couverts par les flux RSS quotidiens), classé en 4 buckets pour décider vite ce qu'on applique.
2. **Catalogue écosystème** : un répertoire pérenne des outils qui se pluggent à Claude (MCP servers, skills, plugins Cowork) ou auxquels Claude se plugge (SDKs, IDE, frameworks, intégrations). Mis à jour mensuellement par une routine dédiée + ajouts manuels.

## Parcours utilisateur
1. Ouvre la section "Veille outils" depuis la sidebar — un en-tête indique le contexte (date du dernier passage de la routine ou nombre d'intégrations actives selon le sous-onglet) et 4 chiffres clés contextuels.
2. Bascule entre **Veille hebdo** et **Catalogue écosystème** via les deux pastilles juste sous le titre. Le choix est mémorisé entre les sessions.
3. **Sur Veille hebdo** : lit la synthèse exécutive en tête, filtre par priorité, déroule les 4 sections (Applicables Jarvis, Claude usage général, Outils complémentaires, Autres news), passe le statut de chaque item à "en cours", "appliqué" ou "écarté", ajoute des notes perso.
4. **Sur Catalogue écosystème** : voit deux colonnes côte-à-côte — "Se pluggent à Claude" (inbound) et "Claude s'y plugge" (outbound), avec une bande "Bidirectionnels" au-dessus si pertinent.
5. Filtre le catalogue par type d'outil (MCP, skill, IDE, framework, SDK, plugin, connecteur, agent) et par tags. Toggle pour masquer ce qu'il a déjà écarté ou archivé.
6. Pour chaque intégration : lit la description, déroule les volets repliables "Applicabilité projet" et "Comment l'installer / tester", parcourt les tags. Épingle ses favoris (étoile en haut à droite), définit une priorité personnelle, écarte ce qui ne l'intéresse pas, écrit ses notes.
7. Ajoute manuellement une intégration : bouton "+ Ajouter une intégration" en haut du catalogue ouvre une fenêtre où il renseigne nom, direction, type, source, description et tags. Le slug d'identification se génère automatiquement depuis le nom mais reste éditable.
8. La routine mensuelle revoit le catalogue : ce qu'elle reconnaît voit son "vu pour la dernière fois" mis à jour, ce qu'elle ne voit plus depuis longtemps passe automatiquement en archivé. Les choix de l'utilisateur (statut, priorité, pin, notes) ne sont jamais touchés par la routine.

## Fonctionnalités
- **Bascule veille / catalogue** : deux sous-onglets sous l'en-tête, avec compteur d'items pour chacun et mémorisation du choix entre les sessions — pour rester sur le mode qui sert ton intention du moment.
- **En-tête contextualisé** : titre, date du dernier run et 4 chiffres clés qui changent selon le sous-onglet actif (items / nouveaux / haute priorité / appliqués pour la veille ; actives / inbound / outbound / épinglés pour le catalogue).
- **Synthèse exécutive (veille)** : encart en tête avec headline, 3 tendances, 1 quick win et 1 point à surveiller — pour avoir une vue d'ensemble avant de plonger.
- **4 sections classées (veille)** : Applicables Jarvis, Claude usage général, Outils complémentaires, Autres news — pour décider vite quoi lire en priorité.
- **Volet "Comment l'appliquer" (veille)** : pour chaque item, recette concrète repliable, ouverte par défaut sur les items applicables au projet.
- **Statut + notes (veille)** : 4 états et champ libre, pour avancer dans la backlog sans changer d'écran.
- **Catalogue 2 colonnes** : intégrations groupées par direction — inbound (qui s'ajoute à Claude) à gauche, outbound (où Claude est utilisé) à droite, plus une bande dédiée aux outils bidirectionnels au-dessus si présent.
- **Filtres catalogue** : pastilles par type d'outil, chips dynamiques par tags les plus présents, et toggle pour masquer écartés/archivés.
- **Carte intégration** : nom cliquable vers la source, direction et type en badges, vendeur, description, volets repliables (applicabilité, install hint), tags et 4 actions — épingler, définir priorité (haute/moyenne/basse), écarter ou réactiver, notes.
- **Pin + priorité user** : l'utilisateur épingle ses favoris (remontent en haut de leur colonne) et marque sa propre priorité — distincte du tri de la routine.
- **Ajout manuel** : bouton "+ Ajouter une intégration" qui ouvre une fenêtre formulaire (nom, direction, type, vendeur, source, description, applicabilité, install hint, tags). Le slug d'identification est auto-généré depuis le nom mais reste éditable. Si le slug existe déjà, message d'erreur explicite.
- **Décisions user préservées** : la routine mensuelle qui rafraîchit le catalogue ne touche jamais aux choix de l'utilisateur (statut, priorité, pin, notes) — elle ne fait que bumper le "vu pour la dernière fois" et enrichir les champs descriptifs.

## Front — structure UI
Panel `cockpit/panel-veille-outils.jsx`, exposé sur `window.PanelVeilleOutils`. Stylesheet dédié `cockpit/styles-veille-outils.css` (préfixe `.vo-*`).

- `<PanelVeilleOutils>` — racine, lit `window.VEILLE_OUTILS_DATA` (items + summary + last_run + ecosystem + by_category + total). Tab state stocké dans `localStorage["vo.tab"]` (valeurs : `veille` | `catalogue`).
- **Sous-onglet Veille hebdo** :
  - `<VOSummaryHero>` — encart `_summary` rendu via `marked` + `DOMPurify`.
  - `<VOSection>` — section par catégorie, items triés `priority desc, effort asc`.
  - `<VOItemCard>` — carte item : badges (status, priorité, effort), titre+source, summary, applicability, how_to_apply (collapsible, déplié par défaut sur `jarvis_applicable`), trend_context, menu de transitions de status, textarea de notes (save on blur).
  - Filtres : pills priorité + checkbox "Masquer appliqués + écartés".
- **Sous-onglet Catalogue écosystème** :
  - `<CatalogueView>` — racine du catalogue, gère filtres type/tags + groupement par direction.
  - `<VOEcoCard>` — carte intégration : badges (direction, type), pin star, vendor, name (lien externe), description, applicability + install_hint (collapsibles), tags, priority buttons (high/medium/low), status button (Écarter/Réactiver), notes textarea.
  - Layout : section "Bidirectionnels" au-dessus si non-vide, puis 2 colonnes responsive `inbound | outbound`.
  - Filtres : pills par `type`, chips dynamiques par tags top 16, toggle "Masquer écartés + archivés".
  - Bouton "+ Ajouter une intégration" en haut à droite → ouvre `<AddIntegrationModal>`.
  - `<AddIntegrationModal>` — formulaire complet : name, slug (auto/custom), direction, type, vendor, source_url, description, applicability, install_hint, tags. Submit POST + handle 23505 (duplicate slug).
- Persistance UI : `localStorage["vo.tab"]`, `vo.priFilter`, `vo.hideDone`, `vo.eco.typeFilter`, `vo.eco.hideDismissed`.

## Front — fonctions JS
| Fonction | Rôle | Fichier |
|----------|------|---------|
| `PanelVeilleOutils` | Composant racine : tab state + filtres + dispatch des patches | `cockpit/panel-veille-outils.jsx` |
| `patchItem(id, patch)` | PATCH REST sur `claude_veille?id=eq.<id>`, mute en mémoire | `cockpit/panel-veille-outils.jsx` |
| `patchEcoItem(id, patch)` | PATCH REST sur `claude_ecosystem?id=eq.<id>`, mute en mémoire, telemetry contextualisée par patch | `cockpit/panel-veille-outils.jsx` |
| `addEcoManual(payload)` | POST REST sur `claude_ecosystem`, gère 23505 (duplicate slug) | `cockpit/panel-veille-outils.jsx` |
| `voSlugify(s)` | Génère slug kebab-case depuis le name (NFD strip + lowercase + cap 64) | `cockpit/panel-veille-outils.jsx` |
| `voSafeHtml(md)` | `marked.parse` + `DOMPurify.sanitize` | `cockpit/panel-veille-outils.jsx` |
| `loadPanel("veille-outils")` (case T2) | Fetch parallèle `claude_veille` + `claude_ecosystem`, sépare la ligne `_summary` des items, mute `window.VEILLE_OUTILS_DATA` | `cockpit/lib/data-loader.js` |
| `T2.veille_outils()`, `T2.claude_ecosystem()` | Wrappers `once()` des fetchs Supabase | `cockpit/lib/data-loader.js` |

## Back — sources de données

### Table `claude_veille` (veille hebdo, 15 colonnes)
RLS authenticated SELECT + UPDATE, INSERT/DELETE service_role.

- Identification : `id` (uuid), `run_date`, `created_at`
- Catégorie : `category` (CHECK : `jarvis_applicable`, `claude_general`, `complementary_tools`, `other_news`, `_summary`)
- Contenu : `title` (NOT NULL), `source_url`, `source_name`, `summary`, `applicability`, `how_to_apply`, `trend_context`
- Tri / déclassement : `priority` (high/medium/low), `effort` (XS/S/M/L)
- Workflow user : `status` (default `new`, NOT NULL, CHECK 4 valeurs), `notes`

Indexes : `run_date DESC`, `category`, `status`, partial unique sur `source_url`. Migration : `sql/011_claude_veille.sql`.

### Table `claude_ecosystem` (catalogue stable, 17 colonnes)
RLS authenticated SELECT + INSERT + UPDATE (le user peut ajouter manuellement). Trigger `updated_at` auto-bump.

- Identification : `id` (uuid), `slug` (TEXT UNIQUE NOT NULL — clé de dédup pour `ON CONFLICT (slug) DO UPDATE`), `name` (NOT NULL), `created_at`, `updated_at`, `added_date`, `last_seen`
- Classification : `direction` (CHECK : `inbound`/`outbound`/`both`), `type` (CHECK : 9 valeurs), `vendor`
- Contenu : `source_url`, `description` (NOT NULL), `applicability`, `install_hint`, `tags TEXT[]`
- Workflow user : `status` (default `active`, CHECK : `active`/`dismissed`/`archived`), `user_priority` (high/medium/low ou null), `is_pinned` (bool), `user_notes`

Indexes : `direction`, `type`, `status`, `is_pinned WHERE TRUE` (partial). Migration : `sql/012_claude_ecosystem.sql` avec seed initial de 13 entrées de référence (7 inbound + 6 outbound).

## Back — pipelines qui alimentent
- **Routine Cowork hebdomadaire "Veille Claude hebdo"** (samedi matin par défaut) : alimente `claude_veille`. Synthèse + 4 buckets + `_summary`.
- **Routine Cowork mensuelle "Catalogue écosystème Claude"** (1er samedi du mois) : alimente `claude_ecosystem` via `INSERT ... ON CONFLICT (slug) DO UPDATE`. Préserve `status`, `user_priority`, `is_pinned`, `user_notes`. Bump `last_seen`. Archive doux après 90j sans `last_seen`. Prompt complet : `docs/cowork-routines/catalogue-ecosystem.md`.
- Pas de pipeline GitHub Actions : les deux routines tournent sur le PC de l'utilisateur quand Cowork est ouvert.

## Appels externes
- Front : Supabase REST `GET /rest/v1/claude_veille` + `GET /rest/v1/claude_ecosystem` (Tier 2, fetch parallèle), `PATCH` les deux tables (status + notes + pin + priorité), `POST /rest/v1/claude_ecosystem` (ajout manuel).
- Routines Cowork : web_search natif + connecteur MCP Supabase (`execute_sql` pour SELECT snapshot + UPSERT).

## Dépendances
- Onglets : aucun lien transverse direct.
- Pipelines : 2 routines Cowork (`docs/cowork-routines/catalogue-ecosystem.md` versionné ; le prompt veille hebdo n'est pas encore versionné).
- Variables d'env / secrets : aucun spécifique côté front. Les routines héritent de la session authentifiée Cowork.

## États & edge cases
- **Loading Tier 2** : panel masqué par `app.jsx` jusqu'à ce que `loadPanel("veille-outils")` résolve (skeleton).
- **Empty (filtres veille)** : message + hint mentionnant la routine veille.
- **Empty (catalogue)** : message + hint suggérant d'élargir les filtres ou d'ajouter manuellement.
- **PATCH échec** : log console, status UI inchangé, pas d'alerte intrusive.
- **POST manual duplicate slug** : message d'erreur explicite dans la modal, l'utilisateur édite le slug et resubmit.
- **MCP Supabase indisponible côté routine catalogue** : log warning + écrit le rapport markdown sans toucher la base.
- **Routine catalogue détecte <5 outils** : refuse l'UPSERT (anomalie), écrit juste un rapport diagnostic.

## Limitations connues / TODO
- [ ] Le prompt de la routine **veille hebdo** n'est pas encore versionné (à committer dans `docs/cowork-routines/veille-claude.md`).
- [ ] Pas de notification email récap après les runs (mentionné dans le prompt v2 veille, à câbler côté routine ou trigger Supabase).
- [ ] Pas de feedback loop catalogue : la routine ne lit pas `user_priority`/`status` pour ajuster ses sources. À ajouter si le catalogue grossit.
- [ ] Pas de versioning des outils catalogue : breaking changes invisibles tant que le repo upstream existe.
- [ ] Pas de filtrage par catégorie au-dessus des sections veille — pour l'instant on déroule les 4 sections.
- [ ] Le champ `applicability` côté veille est sous-utilisé (la routine v1 a tout mis dans `how_to_apply`) — à corriger dans le prompt v2 veille.

## Dernière MAJ
2026-04-25 — ajout du sous-onglet Catalogue écosystème, table `claude_ecosystem` (migration 012, seed 13 entrées), modal d'ajout manuel, prompt routine catalogue mensuelle versionné dans `docs/cowork-routines/`.
