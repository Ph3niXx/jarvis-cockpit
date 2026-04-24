# Recommandations

> Flux hebdomadaire de lectures/vidéos/cours priorisés par Claude Haiku selon le radar de compétences, avec toggle "fait" persistant et filtrage multi-axe.

## Scope
pro

## Finalité fonctionnelle
Panel de "lectures obligatoires de la semaine". Chaque dimanche 22h UTC, `weekly_analysis.py` génère via Claude Haiku 4.5 une liste de micro-tâches d'apprentissage ciblant les **3 axes les plus faibles** du radar (score DB < 3 / 5 = < 60/100). Le front affiche 3 priorités visuelles (**Must / Should / Nice**), toggle "fait" persistant en base, filtres niveau/durée/axe. Les recommandations cochées "fait" nourrissent un sentiment de progression mais **ne bumpent pas** `skill_radar` (seuls les challenges réussis le font — cf. [tab-radar.md](tab-radar.md)).

## Parcours utilisateur
1. Clic sidebar "Recommandations" (ou raccourci "Voir recos" depuis le Radar).
2. Si l'utilisateur arrive depuis le Radar via "Défi cet axe", la liste est déjà pré-filtrée sur l'axe concerné.
3. Lecture du hero : "Jarvis sélectionne N lectures, M/N déjà faites" (dynamique).
4. Utilisation de la toolbar : quatre filtres combinables (Niveau / Durée / Axe / Masquer les faits) et budget temps calculé à droite (heures restantes · XP · nombre à faire).
5. Sidebar gauche : liste des huit axes IA avec barre de progression et score, cliquable pour filtrer la zone centrale.
6. Lecture verticale des trois sections priorisées : "Priorité 1 · Ne passe pas à côté" en grandes cartes, "Priorité 2 · Tu devrais creuser ça" en cartes moyennes, "Priorité 3 · Si tu as du temps" en lignes denses.
7. Clic sur une carte pour ouvrir la ressource en onglet externe — marquée faite automatiquement.
8. Clic sur "Marquer fait" pour basculer manuellement une reco en faite (mise à jour instantanée, rollback si la sauvegarde échoue).

## Fonctionnalités
- **Trois sections de priorité** : « Ne passe pas à côté » (Must), « Tu devrais creuser ça » (Should), « Si tu as du temps » (Nice), pour savoir quoi lire en premier.
- **Cartes à trois formats** : grandes cartes Must avec le « Pourquoi » en bloc de citation et progression de l'axe, cartes moyennes Should avec le pitch court, lignes denses Nice pour un balayage rapide.
- **Quatre filtres combinables** : niveau (Débutant / Intermédiaire / Avancé), durée (< 20 min / 20-60 min / > 1h), axe (via la sidebar ou pré-remplissage depuis le Radar), et bouton « Masquer les faits ».
- **Sidebar axes** : une ligne par axe IA avec barre de progression + score, cliquable pour filtrer la liste sur cet axe.
- **Toggle « Marquer fait »** : un clic passe la reco en faite (mise à jour instantanée + persistance en base, rollback si échec). Le bouton reste accessible pour basculer en arrière.
- **Clic ouvre + marque fait** : cliquer sur une carte ouvre la ressource dans un nouvel onglet et la marque faite automatiquement — utile pour ne pas avoir à cocher manuellement après lecture.
- **Budget temps dynamique** : en haut de page, total d'heures restantes + XP à gagner, recalculé au fil des faits pour voir ce qu'il reste à avaler.
- **Icônes par type** : chaque reco affiche son type (papier, vidéo, cours, guide, livre, doc, tutoriel, podcast, article) avec une icône reconnaissable.
- **Messages vides contextuels** : trois messages distincts selon la situation (corpus vide / filtres trop stricts / tout déjà fait) pour savoir pourquoi la page est vide.

## Front — structure UI
Fichier : [cockpit/panel-recos.jsx](cockpit/panel-recos.jsx) — 424 lignes, monté par [app.jsx:369](cockpit/app.jsx:369).

Structure DOM :
- `.panel-page[data-screen-label="Recommandations"] > .panel-hero` (eyebrow + h1 + sub avec compteurs)
- `.panel-toolbar` — 4 groupes de pills + `.reco-budget` (droite)
- `<RecoFlux>` :
  - `.reco-wrap.reco-wrap--flux` (2 cols)
  - `.reco-aside > .reco-axis-list` (sidebar gauche : 1 axe par ligne avec barre de score)
  - `.reco-main` — 3 `.reco-section` empilées (musts / shoulds / nices)
- Cards :
  - `.reco-big` (priorité must) — type + source + durée, titre, blockquote "Pourquoi", progression axe score→target, CTAs Ouvrir/Marquer fait, XP
  - `.reco-med` (priorité should) — même champs, why_short, footer compact
  - `.reco-row` (priorité nice) — icône type + titre + meta + check + XP

Route id = `"recos"`. **Panel Tier 2** (listé dans `TIER2_PANELS` à [data-loader.js:4251](cockpit/lib/data-loader.js:4251)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelRecos({ data, onNavigate })` | Composant racine — lit `window.APPRENTISSAGE_DATA.recos` + `.radar.axes` | [panel-recos.jsx:24](cockpit/panel-recos.jsx:24) |
| `RecoFlux({ musts, shoulds, nices, axes, ... })` | Layout 2-col avec sidebar axes + 3 sections priorités | [panel-recos.jsx:176](cockpit/panel-recos.jsx:176) |
| `RecoCardBig({ reco, axes, isCompleted, ... })` | Card grande priorité 1 | [panel-recos.jsx:269](cockpit/panel-recos.jsx:269) |
| `RecoCardMed({ reco, axes, ... })` | Card priorité 2 | [panel-recos.jsx:321](cockpit/panel-recos.jsx:321) |
| `RecoRow({ reco, ... })` | Row compacte priorité 3 | [panel-recos.jsx:361](cockpit/panel-recos.jsx:361) |
| `openReco(r)` | `window.open(r.url, "_blank", "noopener")` | [panel-recos.jsx:264](cockpit/panel-recos.jsx:264) |
| `patchRecoCompleted(id, completed)` | `PATCH /rest/v1/learning_recommendations?id=eq.{id}` avec `{completed, completed_at}` | [panel-recos.jsx:13-22](cockpit/panel-recos.jsx:13) |
| `isCompleted(r)` (inline) | Check override local puis `!r.unread` | [panel-recos.jsx:48-52](cockpit/panel-recos.jsx:48) |
| `toggleCompleted(r)` (inline) | Optimistic + PATCH + rollback | [panel-recos.jsx:54-73](cockpit/panel-recos.jsx:54) |
| Effet "prefill axis" (anonyme) | Consomme `localStorage.recos-prefill-axis` stashé par le radar CTA | [panel-recos.jsx:34-43](cockpit/panel-recos.jsx:34) |
| `T2.recos()` | `GET learning_recommendations?order=week_start.desc,target_axis&limit=30` | [data-loader.js:1223](cockpit/lib/data-loader.js:1223) |
| `transformRecos(rows, axes)` | Mappe ligne DB → shape panel (priorité déduite, duration fallback, XP calculé) | [data-loader.js:1362-1392](cockpit/lib/data-loader.js:1362) |
| `resolveAxisId(rawAxisId, axes)` | Résout un identifiant hérité du pipeline vers un axe actuel (alias) | [data-loader.js:1304](cockpit/lib/data-loader.js:1304) |
| `loadPanel("recos")` case | Partagé avec "radar" — recharge recos + rebuild radar | [data-loader.js:4217-4228](cockpit/lib/data-loader.js:4217) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `learning_recommendations` | **Read** : `id, target_axis/axis, title, why/description, why_short, resource_type/type, resource_url/url, resource_source/source, source, duration_min, difficulty/level, xp, tags, priority, completed, created_at, week_start`. **Write** : `completed, completed_at` (PATCH). | 30 lignes max (limit Tier 2), typiquement 10-15 générées/semaine |
| `skill_radar` | Lu par le panel pour afficher les scores par axe dans la sidebar + calcul priorité | 8 lignes |

## Back — pipelines qui alimentent
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — cron dimanche 22h UTC :
  - `generate_recommendations()` lit `skill_radar`, sélectionne les **3 axes les plus faibles** (score < 3 / 5 sinon les 3 premiers par score asc).
  - Récupère 30 articles récents de `articles` pour contexte.
  - Prompte Claude Haiku 4.5 avec profil complet (8 axes + forces/lacunes/objectifs).
  - Pour chaque reco générée : `POST learning_recommendations` avec `{target_axis, title, description, resource_type, resource_url, duration_min, difficulty, priority, week_start}`.
  - Coût logué dans `weekly_analysis.tokens_used`.
- **Daily pipeline** : aucune interaction.
- **Jarvis (local)** : aucune interaction.
- **Front** : seul writer pour `completed` / `completed_at` via `patchRecoCompleted`.

## Appels externes
- **Supabase REST (lecture)** : `T2.recos()` + `T2.radar` via Tier 1 partagé avec le panel radar.
- **Supabase REST (écriture)** : `patchRecoCompleted(id, completed)` sur chaque toggle.
- **localStorage** : `recos-prefill-axis` (single-use, stashé par le radar).
- **`window.open(url, "_blank")`** : ouverture de la ressource.
- **Telemetry** : `window.track("reco_completed_toggled", { id, completed })`.

## Dépendances
- **Onglets in** : `radar` (CTA "Voir recos" avec prefill axe), sidebar.
- **Onglets out** : aucune navigation interne — les cards ouvrent en tab externe.
- **Pipelines** : `weekly_analysis.yml` obligatoire (sinon `learning_recommendations` vide et la panel affiche "Aucune reco").
- **Variables d'env / secrets** : `ANTHROPIC_API_KEY` (pipeline backend), `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (pipeline).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant `T2.recos()`.
- **Empty `recos` (pipeline jamais exécuté)** : `APPRENTISSAGE_DATA.recos = []` → le bloc `.reco-empty` affiche "Aucune reco pour ces filtres — tente d'élargir le niveau ou la durée." (copy trompeur si c'est en réalité "aucune reco du tout").
- **Tous items filtrés out** : même message que ci-dessus — pas de distinction entre "corpus vide" et "filtres trop stricts".
- **Toggle pendant que `pendingIds[id]` est true** : second clic ignoré pour éviter double PATCH.
- **PATCH échoue** : rollback du `completedOverrides[id]` + `alert("Impossible de sauvegarder. Réessaie dans un instant.")`.
- **Reco sans `url`** : card rendue sans cursor pointer, bouton "Ouvrir" disabled, `openReco` no-op.
- **Reco sans `axis` ou axis inconnu** : `transformRecos` fallback sur `"prompting"`, puis `resolveAxisId` tente un alias. Si rien ne matche, l'axe reste textuel mais la sidebar ne highlight rien.
- **Prefill axe pour un axe inexistant** : `axisFilter` pointe sur un id jamais match → liste vide, user frustré. Pas de validation.
- **Sidebar axes manquants** : si `APPRENTISSAGE_DATA.radar.axes = []`, la colonne gauche n'affiche que "Tous les axes".
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer.

## Limitations connues / TODO
- [x] ~~Pas de distinction empty corpus vs filtres vides~~ → **fixé** : le bloc `.reco-empty` affiche 3 branches distinctes selon `totalRecos` et `anyFilterActive` :
  - Corpus vide : "Aucune reco générée cette semaine. Le pipeline hebdomadaire tourne chaque dimanche soir (22h UTC)."
  - Filtres trop stricts : "Aucune reco pour ces filtres — élargis le niveau, la durée ou l'axe."
  - Tout marqué fait : "Toutes les recos sont marquées faites. Beau boulot."
- [x] ~~Bouton "Ouvrir" ne marque pas lu~~ → **fixé** : clic sur card (ou sur bouton "Ouvrir") = `openAndMarkReco(r)` = `window.open(url)` + toggle `completed=true` si pas déjà fait. Le bouton "Marquer fait" reste pour toggle back en "à faire".
- [ ] **Priority déduite quand absente** : `transformRecos` calcule must/should/nice depuis `ax.score`, mais le pipeline devrait normalement la fournir. Pour les vieilles recos sans priorité, dépend donc du score courant — change dynamiquement si le score bouge.
- [ ] **Complétion optimiste ne persiste pas offline** : si le PATCH échoue (réseau coupé) et que l'utilisateur rafraîchit, l'override est perdu. Pas de queue de retry.
- [ ] **XP à l'affichage ≠ XP métier** : calculé par heuristique `duration * 3` côté loader. Le pipeline peut fournir un `xp` explicite qui override — mais rien ne garantit la cohérence avec les challenges.
- [ ] **Pas de persistance des filtres** : niveau/durée/axe reset à la navigation. Décision volontaire — éphémère OK.
- [ ] **Pas de tri custom** : l'ordre des cards dans chaque section est celui de `transformRecos` sans retri. Dominé par `target_axis` (group-by côté DB).
- [ ] **`axisFilter` prefill ne scrolle pas** : l'utilisateur arrive sur la page filtrée mais la sidebar axes reste en haut — pas de highlight "tu es ici" renforcé.
- [ ] **Lien inverse reco → challenge** : volontairement non-implémenté — le radar CTA "Défi cet axe" couvre déjà ce flux. Éviter la duplication.
- [ ] **`why_short` fallback HTML strip** : si le pipeline envoie un `why` avec HTML, le strip tronque à 120 chars — risque de couper au milieu d'un mot.
- [ ] **Section "Si tu as du temps" (nice)** en rows compactes = peu de visibilité pour le "Pourquoi". Perte d'info pour les recos de basse priorité.
- [ ] **Clic auto-mark-done** : si l'utilisateur clique pour "juste vérifier" sans lire, le fait est marqué. Il peut revert via le bouton "Marquer fait" mais c'est 2 clics pour corriger une action non voulue.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — 3 branches empty-state + clic card = open + mark done (local, non pushé)
