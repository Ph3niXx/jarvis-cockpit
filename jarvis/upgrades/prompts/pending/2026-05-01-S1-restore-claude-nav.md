# S1 — Restaurer `{ id: "claude" }` dans `cockpit/nav.js::Veille`

> Audit source : [2026-05-01-audit.md](../../2026-05-01-audit.md)
> Effort estimé : XS (~5 min)
> North Star : filets de sécurité livrés cet automne (migration jobs trigger appliquée + claude panel restauré dans la nav) avant le prochain sprint UX.

---

```
Contexte projet : panel "Claude" (route updates/sport/.../claude) techniquement
en place mais perdu de la sidebar dans le refactor `004f55a` (NAV en source
unique) — 3 extractions signals.md consécutives marquent "section claude jamais
ouverte" alors que le route, le panel-veille corpus, le data-loader et
docs/specs/tab-claude.md sont prêts. Le spec dit explicitement "Clic sidebar
« Claude » dans le groupe Veille" — la régression est silencieuse.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~15 lignes après ces
vérifications :

1. Lis `cockpit/nav.js` lignes 20-50 EN ENTIER. Confirme que le groupe Veille
   contient EXACTEMENT 6 entrées dans cet ordre : updates, veille-outils, sport,
   gaming_news, anime, news. Aucune mention de "claude".

2. Lis `cockpit/app.jsx` lignes 494-510. Confirme la route :
   `else if (activePanel === "claude") content = <PanelVeille corpus="CLAUDE_DATA" ...`

3. Lis `cockpit/lib/data-loader.js` ligne 1230. Confirme le loader :
   `async claude(){ return once("claude_articles", () => q("articles", ...))`

4. Confirme la présence de `cockpit/data-claude.js` (corpus stub `CLAUDE_DATA`)
   et son chargement dans `index.html` :
   `grep -n "data-claude.js" index.html`

5. Lis `docs/specs/tab-claude.md` (les 30 premières lignes). Confirme que le
   parcours utilisateur commence par "Clic sidebar « Claude » dans le groupe
   Veille".

6. Vérifie l'icône utilisée historiquement avant `004f55a` :
   `git log --all -p -S '"claude"' -- cockpit/data.js | grep -A1 "id.*claude" | head -5`
   → l'historique doit révéler l'icône précédente (probablement "bot" ou
   "sparkles"). Si "bot" n'existe pas dans le système d'icônes courant
   (`cockpit/icons.jsx`), tomber sur l'icône utilisée pour `updates`/Veille IA
   ("sparkles") ou pour le panel Jarvis ("assistant") selon ce qui matche le
   mieux le contenu (Anthropic releases/SDK).

Écris un rapport et ATTENDS ma validation explicite. Le rapport doit indiquer
quel id d'icône valide tu vas utiliser et où exactement l'entrée s'insère
(entre `updates` et `veille-outils`, position 2 du groupe).

Objectif : restaurer la navigation vers le panel Claude, sans toucher au reste.

Fichiers concernés :
- cockpit/nav.js (modification, 1 ligne)

Étapes (après validation Phase 0) :
1. Insérer dans le groupe "Veille" (après `updates`, avant `veille-outils`) :
   `    { id: "claude", label: "Claude", icon: "<icon validé en Phase 0>" },`
2. Aucune autre modification.

Contraintes :
- 1 seule ligne ajoutée. Pas de refacto, pas de réordonnancement, pas de
  changement d'icône sur les autres entrées.
- Pas de modification de `app.jsx`, `data-loader.js`, `data-claude.js`,
  `panel-veille.jsx`, `index.html`, ou des specs.
- Le sw.js doit être resync via `node scripts/sync-sw.mjs` OU laissé à la
  GH Action `sw-sync` (préférence : laisser CI le faire pour valider le pipeline
  auto-sync v21).

Validation (lance ces commandes après modification) :
- `grep -A2 "Veille" cockpit/nav.js | grep "claude"` → doit retourner la ligne.
- `grep -c "id: \"claude\"" cockpit/nav.js` → doit retourner 1.
- Demander à Jean : ouvrir le cockpit en local OU sur GH Pages, vérifier la
  sidebar groupe Veille → entrée "Claude" présente, clic ouvre le panel et
  émet `section_opened claude`.

Ne fais PAS :
- Ne touche pas à `cockpit/data.js` (legacy mort, consultatif seulement).
- N'ajoute pas de count, unread, ou badge sur l'entrée — pas de signal pour ça.
- Ne change pas l'ordre des autres entrées Veille.
- Ne push pas après commit.

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(cockpit): restaure entrée "Claude" dans sidebar Veille (régression 004f55a)`.
PAS de push.
```
