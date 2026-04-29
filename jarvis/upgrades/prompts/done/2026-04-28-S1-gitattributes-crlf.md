# S1 — `.gitattributes` + renormalize CRLF/LF (tuer 72 modifs whitespace-only)

> Audit source : [2026-04-28-audit.md](../../2026-04-28-audit.md)
> Effort estimé : XS (~30 min)
> North Star : working tree arrête de saboter sa propre mémoire — git status redevient lisible et permet de commit les audits.

---

```
Contexte projet : working tree à 95 fichiers « modified » dont 72 sont des
diffs CRLF↔LF strictement (0 ligne de contenu modifié, vérifié par git diff -w).
Cause : pas de .gitattributes à la racine du repo. Conséquence : git status
illisible, audits jamais commités, INDEX.md dérive sans trace git. 2 fichiers
.bat tracked (jarvis/run_nightly_after_deps.bat, jarvis/start_jarvis.bat)
doivent garder leurs CRLF pour rester exécutables Windows.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

1. Vérifie l'absence de .gitattributes :
   - cat .gitattributes 2>/dev/null || echo "ABSENT"
   → doit afficher ABSENT.

2. Quantifie le bruit whitespace-only :
   - git status --short | wc -l → noter le total (cible ~95).
   - Boucle :
     ```
     count_ws=0
     for f in $(git status --short | awk '/^ M/ {print $2}'); do
       diff_w=$(git diff -w "$f" | wc -l)
       diff=$(git diff "$f" | wc -l)
       if [ "$diff_w" -lt "$diff" ] && [ "$diff_w" -le 4 ]; then
         count_ws=$((count_ws + 1))
       fi
     done
     echo "Whitespace-only: $count_ws"
     ```
   → noter (cible ~72).

3. Liste les fichiers Windows-spécifiques à exempter de la conversion en LF :
   - find . -name "*.bat" -o -name "*.cmd" -o -name "*.ps1" \
     | grep -v node_modules | grep -v ".claude/worktrees/"
   → doit lister AU MOINS jarvis/run_nightly_after_deps.bat
     et jarvis/start_jarvis.bat. Si d'autres .bat/.cmd/.ps1 apparaissent,
     ajoute-les à la liste d'exemptions de l'étape 4.

4. Vérifie qu'aucun fichier binaire n'est traité par accident :
   - find . -name "*.png" -o -name "*.jpg" -o -name "*.ico" -o -name "*.pdf" \
     -o -name "*.woff*" -o -name "*.ttf" 2>/dev/null \
     | grep -v node_modules | grep -v ".claude/" | head -20
   → si présents, ils seront couverts par `* text=auto` (auto-detect binary)
     mais on peut les marquer explicitement `binary` pour la sûreté.

5. Lis ce que `git config core.autocrlf` retourne sur cette machine :
   - git config --get core.autocrlf
   → si "true" ou "input", la convention LF est déjà partiellement appliquée.
     Si "false", ce SHIP est encore plus important.

Écris un rapport ~15 lignes :
- Total fichiers modifiés / dont whitespace-only (chiffres exacts).
- Liste des .bat/.cmd/.ps1 à exempter.
- core.autocrlf actuel.
- Diff prévu sur .gitattributes (contenu proposé ci-dessous).
- Risques identifiés (1 max).

ATTENDS validation explicite.

Objectif : Réduire `git status --short | wc -l` de ~95 à ≤25 sans toucher
aucun contenu logique, et bloquer la récidive via .gitattributes.

Fichiers concernés :
- .gitattributes (création — 1 fichier nouveau, 6-10 lignes).
- TOUS les fichiers normalisés par `git add --renormalize` (passage CRLF → LF
  sur le contenu blob — pas de modif applicative).

Étapes (après validation) :

1. Crée .gitattributes à la racine avec ce contenu EXACT :
   ```
   # Normalise les fins de ligne — LF par défaut, exceptions Windows-only ci-dessous.
   * text=auto eol=lf

   # Scripts Windows : garder CRLF pour rester exécutables par cmd.exe / Task Scheduler.
   *.bat text eol=crlf
   *.cmd text eol=crlf
   *.ps1 text eol=crlf

   # Binaires (sûreté — `text=auto` les détecte déjà mais on est explicite).
   *.png binary
   *.jpg binary
   *.jpeg binary
   *.ico binary
   *.pdf binary
   *.woff binary
   *.woff2 binary
   *.ttf binary
   *.otf binary
   ```

2. Lance `git add --renormalize .` puis `git status --short | wc -l`.
   → cible ≤25 (les 9 vraies modifs + quelques fichiers où la
   renormalisation produit un vrai diff). Si > 30, STOP et signale.

3. Vérifie que les .bat sont restés en CRLF :
   - file jarvis/start_jarvis.bat → doit contenir "CRLF".
   - file jarvis/run_nightly_after_deps.bat → doit contenir "CRLF".

4. Vérifie qu'un échantillon de fichiers texte est passé en LF :
   - file CLAUDE.md → "ASCII text" sans "CRLF".
   - file cockpit/home.jsx → idem.

5. Vérifie que les vraies modifs sont préservées :
   - git diff cockpit/styles.css | wc -l → doit toujours être > 50 (pas
     évaporé par la renormalisation).
   - git diff jarvis/upgrades/INDEX.md | wc -l → doit toujours être > 30.

Contraintes :
- Ne touche PAS au contenu applicatif d'un seul fichier (ni cockpit/, ni
  jarvis/, ni docs/). Seulement la fin de ligne du blob git.
- Ne lance PAS `git add` global avant `--renormalize` — c'est le
  --renormalize qui doit faire le travail.
- Ne commit PAS encore — laisse Jean inspecter le diff.
- Ne touche pas au `.gitignore`.
- Ne configure PAS `core.autocrlf` côté machine — `.gitattributes` est
  authoritative et plus portable.

Validation :
- cat .gitattributes → contenu exact ci-dessus.
- git status --short | wc -l → ≤ 25.
- file jarvis/start_jarvis.bat | grep -q CRLF → exit 0.
- file CLAUDE.md | grep -q CRLF → exit 1 (pas de CRLF).
- git diff cockpit/styles.css | head -5 → premières lignes du diff applicatif
  toujours présentes.
- python -m py_compile jarvis/scripts/extract_signals.py → exit 0 (les
  scripts Python n'ont pas changé fonctionnellement).

Ne fais PAS :
- Ne renormalise pas `node_modules/` ou `.claude/` (le `.gitignore` les
  protège déjà — ne pas les forcer).
- N'ajoute pas un linter pre-commit — hors scope.
- Ne touche pas `git config` côté machine.
- Ne push pas.

Quand c'est fait : montre-moi `git status --short` (devrait tenir en
1 page) + `git diff --stat` AVANT git add. git commit avec message
"chore(repo): .gitattributes — normalise fins de ligne LF (preserve CRLF
sur .bat/.cmd/.ps1)". PAS de push.
```
