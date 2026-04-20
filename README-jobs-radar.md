# Jobs Radar — guide d'intégration

Panel cockpit qui affiche les offres LinkedIn scorées par fit (pipeline Cowork externe).

## Fichiers

- `cockpit/panel-jobs-radar.jsx` — composant React (`window.PanelJobsRadar`)
- `cockpit/styles-jobs-radar.css` — styles scopés `jr-*`
- `cockpit/data-jobs.js` — mock `window.JOBS_DATA` (fallback quand la table Supabase est vide)
- `jarvis/migrations/008_jobs_radar.sql` — DDL tables + RLS
- `jarvis/seed/jobs_radar_mock.sql` — 7 offres + 1 scan pour tester en local

## Vues du panel

Le panel est une seule vue unifiée (cinq zones verticales) :

1. **Header** — kicker "Jobs Radar · {date}", stats inline (nouvelles / hot leads / total), H1 descriptif du scan
2. **Scan banner** — 4 blocs : volumes 7j (sparkbars), répartition par catégorie, signal CV (PDF vs DOCX 30j), actions du jour
3. **Hot leads** — cards larges pour les offres avec `score_total ≥ 7`, intel déplié, angle d'approche
4. **Filtres** — barre horizontale : recherche texte + 3 filter groups (score, rôle, statut) + tri (score / récence)
5. **Liste dense** — une offre = une ligne, score compact + titre + rubric condensée + CV badge + kebab menu

Pas de sous-vues / onglets séparés. Tout tient sur une même page.

## Requêtes Supabase

Déclenchées via `loadPanel("jobs")` dans `cockpit/lib/data-loader.js` :

```js
// Toutes les offres (triées par score)
q("jobs", "select=*&order=score_total.desc.nullslast&limit=300")

// Scan du jour (0 ou 1 ligne)
q("job_scans", `scan_date=eq.${today}&select=*`)

// 7 derniers scans (pour la sparkline)
q("job_scans", `scan_date=gte.${sevenDaysAgo}&select=*&order=scan_date.desc&limit=14`)
```

Le résultat est transformé en shape `JOBS_DATA` via `transformJobRow()` / `transformJobScan()`. Si la table est vide, le fallback mock de `data-jobs.js` reste visible.

**Realtime** : le panel s'abonne aux channels `postgres_changes` sur `jobs` et `job_scans`. Un nouveau scan Cowork pendant que le cockpit est ouvert déclenche un reload transparent.

## Colonnes user-modifiables vs Cowork-only

Le scan Cowork est **source de vérité** sur toutes les colonnes sauf deux :

| Colonne | Modifiée par | Via |
|---|---|---|
| `status` | frontend | bouton Postuler (→ `applied`), menu Snoozer (→ `snoozed`), Archiver (→ `archived`) |
| `user_notes` | frontend | menu « Éditer les notes » → textarea inline |
| tout le reste (title, company, url, scores, intel, rubric_justif, …) | Cowork | service_role key |

La fonction `patchJobSupabase(id, patch)` dans le panel filtre volontairement pour ne jamais envoyer autre chose que `status` ou `user_notes`, même si le caller tente de passer d'autres clés. C'est un garde-fou côté client — le vrai contrat est dans la policy RLS `jobs_user_update` (actuellement `using (true) with check (true)`, à durcir plus tard si besoin).

## Tester sans Cowork

```bash
# 1. Appliquer la migration (tables déjà en prod en pratique)
psql "$SUPABASE_URL" -f jarvis/migrations/008_jobs_radar.sql

# 2. Seed 7 offres + 1 scan
psql "$SUPABASE_URL" -f jarvis/seed/jobs_radar_mock.sql

# 3. Ouvrir le cockpit → Business → Jobs Radar
```

Le seed produit :
- 2 hot leads avec intel `deep` (Alan, Qonto) → cards complètes avec intel + angle + warm network
- 1 hot lead avec intel `light` (Mistral) → carte hot mais bouton « Enrichir l'Intel → » apparaît (disabled, V2)
- 1 offre `to_apply` avec notes (Doctolib)
- 1 offre `applied` (Aircall) → génère automatiquement une action « Relancer » dans le banner
- 1 offre `new` low-score (Carrefour)
- 1 offre `archived` (BNP) → opacity réduite, cachée du filtre Actives

## Bugs connus / améliorations V2

- Le bouton « Enrichir l'Intel → » dans le menu kebab est visible mais disabled — brancher sur Jarvis quand la feature arrive
- Les `tendances.ratios_category` affichés dans le banner sont calculés depuis les offres actives (pas depuis le jsonb du scan) — le scan Cowork peut les pré-calculer plus finement
- Pas de pagination : limit 300 offres dans le feed. Si ça grossit, ajouter un offset + « Charger plus »
