# S2 — Coupler la génération de `signals.md` au démarrage Jarvis (`run_nightly_after_deps.bat`)

> Audit source : [2026-04-27-audit.md](../../2026-04-27-audit.md)
> Effort estimé : XS (~30-45 min)
> North Star : (a) plus aucun timeout LM Studio à 3 attempts × 1114s, (b) signals.md généré chaque matin sans dépendre d'une tâche planifiée Windows fragile

---

```
Contexte projet : signals.md du 25/04, 26/04, 27/04 manquent (3 jours
consécutifs). Aucun .bat ni .yml dans le repo ne lance jarvis/scripts/
extract_signals.py. CLAUDE.md mentionne « tâche planifiée Windows à 05h30 UTC »
mais elle est invisible dans le repo donc soit jamais configurée soit cassée.
La cible : coupler la génération de signals.md à start_jarvis.bat (action
quotidienne fiable de Jean) plutôt que dépendre de Task Scheduler.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

1. Lis jarvis/run_nightly_after_deps.bat EN ENTIER (~20 lignes).
2. Lis jarvis/start_jarvis.bat L40-95 (la chaîne d'orchestration : indexer →
   status → nightly → tunnel → server).
3. Lis jarvis/scripts/extract_signals.py L1-80 (vérifie : entrée standalone
   `if __name__ == "__main__"`, sortie dans `jarvis/intel/YYYY-MM-DD-signals.md`,
   pas d'env var critique au-delà de SUPABASE_URL / SUPABASE_KEY déjà
   exportées par start_jarvis.bat, pas de dépendance pgvector côté écriture).
4. ls jarvis/intel/ | grep signals | tail -5 → confirme : derniers signals
   datés 23/04 et 25/04.
5. grep -rn "extract_signals" .github/workflows/ jarvis/ | head — vérifier
   qu'aucune autre orchestration ne le lance déjà (sinon double-run à éviter).
6. Identifie 1 décision design :
   - Lancer extract_signals AVANT ou APRÈS nightly_learner ?
     → Recommandé : APRÈS, car nightly_learner peut produire des `usage_events`
       indirects via les traces (limite : peu probable). Plus simple : le
       lancer en parallèle de daily_brief en fin de chain (run_nightly_after_deps).

Écris un rapport ~15 lignes :
- Diff prévu sur run_nightly_after_deps.bat (ajout de 3 lignes : echo + run +
  echo).
- Liste les 8 sections existantes que extract_signals.py va lire dans
  Supabase (articles, ...) — confirme via le code qu'elles sont déjà accessibles
  avec les env vars actuelles.
- Décision design + justification (avant/après nightly).
- Note CLAUDE.md à mettre à jour (section « Calendrier » du Weekly Pipeline) —
  passer de « 05h30 / Étape 1 / Python / tâche planifiée » à « au démarrage
  start_jarvis.bat / via run_nightly_after_deps.bat ».

ATTENDS validation explicite.

Objectif : Garantir qu'à chaque démarrage de Jarvis, signals.md du jour est
généré (ou re-généré si déjà là).

Fichiers concernés :
- jarvis/run_nightly_after_deps.bat (modification — ajout d'un bloc).
- CLAUDE.md (section « Calendrier » du Weekly Pipeline + section « Lancement
  manuel » — alignement doc/code).
- jarvis_data/.gitignore ou jarvis_data/README.md si nécessaire pour
  documenter `last_extract_signals.log` (probablement déjà couvert par le
  gitignore global de jarvis_data/).

Étapes (après validation) :

1. Modifier jarvis/run_nightly_after_deps.bat pour ajouter, après le bloc
   activity_brief :
   ```bat
   echo [%date% %time%] Extraction signaux internes demarre...
   python jarvis\scripts\extract_signals.py > jarvis_data\last_extract_signals.log 2>&1
   echo [%date% %time%] Extraction signaux terminee (code=%errorlevel%)
   ```

2. Mettre à jour CLAUDE.md :
   - Section « Weekly Pipeline / Calendrier » : remplacer la ligne
     « 05h30 / 1 / Python / ... / signals.md » par
     « Au démarrage Jarvis / 1 / Python via run_nightly_after_deps.bat / ... /
       signals.md ».
   - Section « Lancement manuel » : compléter avec
     `python jarvis/scripts/extract_signals.py` (déjà mentionné OK,
     vérifier que c'est cohérent).
   - Section « Marges et fail-safe » : la marge 30 min entre étape 1 et 2
     n'a plus de sens (on quitte le mode séquentiel par cron) — soit la
     supprimer, soit la reformuler pour la pipeline Cowork (étapes 2+3
     restent sur Task Scheduler).
   - Note de transition : préciser qu'étapes 2 et 3 (Cowork audit + veille)
     restent sur Task Scheduler / Cowork interne ET dépendent de la
     fraîcheur de signals.md du jour (donc de start_jarvis.bat ayant tourné).

Contraintes :
- Ne crée PAS de nouveau .bat séparé — réutilise run_nightly_after_deps.bat
  pour ne pas multiplier les points d'ancrage.
- Ne lance PAS extract_signals.py dans la boucle wait_loop — c'est un appel
  ponctuel après nightly + brief.
- Ne touche PAS à start_jarvis.bat (le wrapper fait déjà
  start /B "" jarvis\run_nightly_after_deps.bat — la modif est invisible
  côté start).
- Ne configure PAS de Task Scheduler depuis le code Claude — Jean l'a déjà
  ou pas, ce SHIP rend l'orchestration Task Scheduler optionnelle.
- N'utilise PAS d'argument CLI à extract_signals.py — il consomme TODAY
  via datetime.now(), c'est volontaire.

Validation :
- python -m py_compile jarvis/scripts/extract_signals.py → exit 0 (sanity).
- python jarvis/scripts/extract_signals.py — run direct local Windows
  (cd C:\Users\johnb\jarvis-cockpit, env vars exportées) → produit
  jarvis/intel/2026-04-27-signals.md en < 10s.
- ls -la jarvis/intel/2026-04-27-signals.md → fichier existe + taille > 0.
- Au prochain start_jarvis.bat : tail -5 jarvis_data/last_extract_signals.log
  → message « Extraction signaux terminee (code=0) ».
- Au prochain start_jarvis.bat : ls jarvis/intel/ | grep $(date +%Y-%m-%d)
  → fichier signals du jour présent.

Ne fais PAS :
- N'ajoute pas de timeout explicite au run extract_signals.py — il finit en 3s
  d'habitude.
- N'ajoute pas de retry automatique en cas d'échec — un échec doit être visible
  dans last_extract_signals.log pour diagnostic ultérieur.
- Ne lance pas extract_signals au PREMIER plan (sans `start /B`) — sinon
  Jean attend pour rien.
- Ne push pas.

Quand c'est fait : montre-moi le diff complet de run_nightly_after_deps.bat +
le diff CLAUDE.md AVANT git add. Lance manuellement extract_signals.py une fois
(commande indiquée ci-dessus) + montre le contenu du signals.md généré (head -30).
git commit avec message "feat(jarvis): coupler signals.md au démarrage Jarvis
(supprime dépendance Task Scheduler fragile)".
PAS de push.
```
