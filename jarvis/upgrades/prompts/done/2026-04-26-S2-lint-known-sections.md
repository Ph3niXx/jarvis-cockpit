# S2 — Lint CI bloquant : `KNOWN_SECTIONS` doit refléter `cockpit/app.jsx`

> Audit source : [2026-04-26-audit.md](../../2026-04-26-audit.md)
> Effort estimé : XS (~30 min)
> North Star : La dérive de `KNOWN_SECTIONS` doit être bloquée à la merge plutôt que rattrapée à l'audit suivant.

---

```
Contexte projet : KNOWN_SECTIONS dans jarvis/scripts/extract_signals.py est 
maintenu manuellement. v13-S1 a fait une resync le 25/04 15:25, et 3h plus 
tard (18:45) le panel "veille-outils" a été ajouté à cockpit/app.jsx — la 
liste a dérivé immédiatement. Le projet a déjà 4 lints CI Phase 7 qui forcent 
la cohérence specs ↔ code. Étendre cette grammaire à KNOWN_SECTIONS = 
fermer la boucle de drift définitivement.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

1. Vérifie l'état actuel :
   - grep -oE 'activePanel\s*===\s*"[a-z_-]+"' cockpit/app.jsx | sed -E 's/.*"([^"]+)".*/\1/' | sort -u
     → tu dois voir 28 entrées (anime, brief, challenges, claude, gaming, 
     gaming_news, history, ideas, jarvis, jarvis-lab, jobs, music, news, 
     opps, perf, profile, radar, recos, review, search, signals, sport, 
     stacks, top, updates, **veille-outils**, week, wiki).
   - grep -A8 "^KNOWN_SECTIONS" jarvis/scripts/extract_signals.py
     → tu dois voir 27 entrées (les 28 ci-dessus MOINS "veille-outils").
2. Lis scripts/lint_specs_produit.py (~50 premières lignes). C'est ton 
   template de style : Python pur, pas de dépendances, exit 1 + message 
   clair, executable localement.
3. Lis .github/workflows/lint-specs.yml. C'est ton template de workflow : 
   triggers `push` + `pull_request` sur paths spécifiques, runs-on ubuntu, 
   setup-python 3.11, run script.
4. Identifie 1 décision de design :
   - Faut-il une "allowlist" de panels admis dans KNOWN_SECTIONS mais absents 
     d'app.jsx (par ex. sections logiques jamais exposées comme "tft" ou 
     "rte" historiques) ? Recommandé : non — toute entrée KNOWN_SECTIONS qui 
     n'a pas de match `activePanel === "X"` dans app.jsx est un mort-vivant 
     à supprimer. Si Jean a besoin d'une exception future, il l'ajoutera 
     comme constante explicite dans le lint avec commentaire.

Écris un rapport ~15 lignes :
- Diff prévu sur KNOWN_SECTIONS (1 ligne ajoutée : "veille-outils").
- Liste des 28 sections que le lint contrôle.
- Décision design + justification.
- Plan en 4 fichiers : scripts/lint_known_sections.py (créé), 
  jarvis/scripts/extract_signals.py (modifié — ajout veille-outils + bump 
  date commentaire), .github/workflows/lint-known-sections.yml (créé), 
  rien d'autre.

ATTENDS validation explicite.

Objectif : Toute future PR qui ajoute un `activePanel === "X"` dans 
cockpit/app.jsx doit aussi mettre à jour KNOWN_SECTIONS, sinon merge bloqué.

Fichiers concernés :
- scripts/lint_known_sections.py (création — ~50 lignes Python pur)
- jarvis/scripts/extract_signals.py (modification — ajouter "veille-outils" 
  à KNOWN_SECTIONS, bumper le commentaire)
- .github/workflows/lint-known-sections.yml (création — ~25 lignes)

Étapes (après validation) :

1. Créer scripts/lint_known_sections.py :
   ```python
   #!/usr/bin/env python3
   """
   Lint bloquant : KNOWN_SECTIONS dans jarvis/scripts/extract_signals.py
   doit refléter exactement les `activePanel === "X"` de cockpit/app.jsx.
   
   Source de vérité : cockpit/app.jsx (chaîne else-if du router).
   Régression cible : audit hebdo qui flagge des "Section inconnue" parce 
   qu'on a oublié de resync KNOWN_SECTIONS après ajout d'un panel.
   """
   from __future__ import annotations
   import re, sys
   from pathlib import Path
   
   ROOT = Path(__file__).resolve().parent.parent
   APP_JSX = ROOT / "cockpit" / "app.jsx"
   EXTRACT = ROOT / "jarvis" / "scripts" / "extract_signals.py"
   
   def discover_panels() -> set[str]:
       text = APP_JSX.read_text(encoding="utf-8")
       return set(re.findall(r'activePanel\s*===\s*"([a-z_-]+)"', text))
   
   def parse_known_sections() -> set[str]:
       text = EXTRACT.read_text(encoding="utf-8")
       m = re.search(r'KNOWN_SECTIONS\s*=\s*\{([^}]+)\}', text, re.DOTALL)
       if not m:
           print("[FAIL] KNOWN_SECTIONS introuvable dans extract_signals.py", 
                 file=sys.stderr)
           sys.exit(1)
       return set(re.findall(r'"([a-z_-]+)"', m.group(1)))
   
   def main() -> int:
       panels = discover_panels()
       known = parse_known_sections()
       if not panels:
           print("[FAIL] Aucun activePanel trouvé dans app.jsx — pattern cassé ?", 
                 file=sys.stderr)
           return 1
       missing = panels - known
       extra = known - panels
       if not missing and not extra:
           print(f"[OK] KNOWN_SECTIONS synchronisé ({len(panels)} panels).")
           return 0
       if missing:
           print(f"[FAIL] Panels présents dans app.jsx mais absents de KNOWN_SECTIONS :", 
                 file=sys.stderr)
           for p in sorted(missing): print(f"  + {p}", file=sys.stderr)
       if extra:
           print(f"[FAIL] Sections dans KNOWN_SECTIONS mais sans activePanel correspondant :", 
                 file=sys.stderr)
           for p in sorted(extra): print(f"  - {p}", file=sys.stderr)
       print("\nFix : éditer jarvis/scripts/extract_signals.py et resync.", 
             file=sys.stderr)
       return 1
   
   if __name__ == "__main__":
       sys.exit(main())
   ```

2. Mettre à jour jarvis/scripts/extract_signals.py :
   - Ajouter "veille-outils" à KNOWN_SECTIONS (ordre alphabétique, fin de la 
     ligne contenant "stacks, top, updates,")
   - Bumper le commentaire :
     # Source de vérité : cockpit/app.jsx, chaîne `else if (activePanel === "...")`.
     # Synchronisation forcée par scripts/lint_known_sections.py + CI 
     # .github/workflows/lint-known-sections.yml (bloquant).
     # Dernière MAJ : 2026-04-26 (ajout veille-outils + lint CI).

3. Créer .github/workflows/lint-known-sections.yml :
   ```yaml
   name: Lint KNOWN_SECTIONS sync
   
   on:
     push:
       paths:
         - 'cockpit/app.jsx'
         - 'jarvis/scripts/extract_signals.py'
         - 'scripts/lint_known_sections.py'
         - '.github/workflows/lint-known-sections.yml'
     pull_request:
       paths:
         - 'cockpit/app.jsx'
         - 'jarvis/scripts/extract_signals.py'
         - 'scripts/lint_known_sections.py'
         - '.github/workflows/lint-known-sections.yml'
   
   jobs:
     lint:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.11'
         - name: Vérifier sync KNOWN_SECTIONS ↔ app.jsx (bloquant)
           run: python scripts/lint_known_sections.py
   ```

Contraintes :
- Le lint doit être Python pur (no deps), conforme au pattern de 
  scripts/lint_specs_produit.py.
- Le workflow doit reuser actions/checkout@v4 + setup-python@v5 (cohérence 
  avec lint-specs.yml).
- Ne refactore pas extract_signals.py au-delà de KNOWN_SECTIONS + commentaire.
- Ne touche pas aux 8 règles d'anomalies.
- N'ajoute pas une "allowlist" sans justification — KISS.

Validation :
- python scripts/lint_known_sections.py → exit 0 + message "[OK] 
  KNOWN_SECTIONS synchronisé (28 panels)."
- (Test négatif) Renomme temporairement "wiki" → "wiki2" dans extract_signals.py 
  → python scripts/lint_known_sections.py → exit 1 + erreurs claires. 
  Restaure ensuite.
- yamllint .github/workflows/lint-known-sections.yml (si dispo localement) 
  OR : python -c "import yaml; yaml.safe_load(open('.github/workflows/lint-known-sections.yml'))"
  → pas d'exception.

Ne fais PAS :
- N'utilise pas un parser AST jsx — la regex sur 1 pattern stable suffit.
- Ne fais PAS de runtime parsing dans extract_signals.py — c'est un lint 
  CI, pas une feature du script.
- N'ajoute pas une "allowlist" de sections autorisées — le lint doit 
  refléter la stricte égalité.
- Ne push pas.
- Ne touche pas à scripts/lint_specs_produit.py ni à lint-specs.yml.

Quand c'est fait : montre-moi le diff complet AVANT git add. 
git commit avec message "ci(audit): lint bloquant KNOWN_SECTIONS sync vs 
cockpit/app.jsx + ajout veille-outils".
PAS de push.
```
