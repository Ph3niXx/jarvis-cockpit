# S1 — Resync `KNOWN_SECTIONS` dans `extract_signals.py` sur le vrai cockpit React

> Audit source : [2026-04-25-audit.md](../../2026-04-25-audit.md)
> Effort estimé : XS (~30 min)
> North Star : Le diagnostic hebdo de Jarvis doit redevenir fiable — `extract_signals.py` doit refléter le vrai cockpit.

---

```
Contexte projet : extract_signals.py compare les events `section_opened` à une liste 
hardcodée KNOWN_SECTIONS qui date du 12/04 — antérieure à la migration React + l'ajout 
des panels top/review/jarvis-lab/jobs/week/stacks/perf/music/gaming/anime/news/sport. 
Conséquence : chaque audit hebdo flagge 15 fausses "Section inconnue" et 4 fausses 
"Sections jamais ouvertes" (myweek/llm/agents/energy/finserv/tools/biz/reg/papers/jarvis-project/tft/costs/rte 
n'existent plus dans le cockpit). La liste de référence pointe vers l'envers du miroir.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, compile ce bilan en ~30 lignes :

1. Lis cockpit/app.jsx L425-475 (la chaîne de `else if (activePanel === "...")` est la 
   source de vérité des panels visibles).
2. grep -oE 'activePanel\s*===\s*"[a-z_-]+"' cockpit/app.jsx | sort -u 
   (extrait la liste effective).
3. Vérifie aussi cockpit/sidebar.jsx (s'il existe) pour les data-panel ou navigate 
   appelés.
4. Lis jarvis/scripts/extract_signals.py L28-50 (commentaire actuel + KNOWN_SECTIONS).
5. cat jarvis/intel/2026-04-23-signals.md → relève la liste exacte des "Section inconnue" 
   pour cross-check : tu dois les retrouver toutes dans le cockpit React, sinon ce 
   sont des navigate orphelins à investiguer (pas à ajouter aveuglément).
6. Identifie 4 cas particuliers à arbitrer EXPLICITEMENT (et pose-les à Jean si doute) :
   - "claude" est-il un panel ou une route fallback Tier 2 ? (vu en app.jsx:451)
   - "gaming_news" vs "gaming-news" : underscore ou tiret ? Choix : ce que track() 
     envoie réellement, pas ce qui te paraît joli.
   - "veille" : c'est un alias mort (corpus VEILLE_DATA) ou une vraie nav ?
   - "perf-history" / "music-overview" / "gaming-overview" : sous-vues internes 
     d'un panel composite ou vraie navigation ? Si interne, NE PAS les ajouter à 
     KNOWN_SECTIONS — elles ne devraient pas remonter dans `section_opened`.

Écris un rapport ~25 lignes listant :
- La liste finale proposée (alphabétique, ~25-27 entrées)
- Les sections retirées de l'ancienne liste (avec raison : "supprimée du cockpit" / 
  "renommée en X")
- Les arbitrages des 4 cas particuliers
- La note de maintenance proposée pour le commentaire au-dessus

ATTENDS validation explicite. Ne touche pas au fichier.

Objectif : Faire remonter le bruit "Section inconnue" à 0 dans le prochain run audit, 
et faire remonter "Sections jamais ouvertes" à des sections réellement existantes mais 
peu utilisées.

Fichiers concernés :
- jarvis/scripts/extract_signals.py (modification — UNIQUEMENT le bloc KNOWN_SECTIONS 
  L31-37 + le commentaire au-dessus)

Étapes (après validation) :

1. Remplacer KNOWN_SECTIONS par la liste validée en Phase 0.
2. Mettre à jour le commentaire :
   "# Source de vérité : cockpit/app.jsx, chaîne `else if (activePanel === "...")`.
    # A re-synchroniser quand un panel est ajouté ou retiré.
    # Derniere mise a jour : 2026-04-25 (post-migration React + jarvis-lab)."
3. Lancer `python jarvis/scripts/extract_signals.py` localement et OBSERVER le rapport 
   généré dans jarvis/intel/2026-04-25-signals.md.
4. Vérifier que la section "Anomalies detectees" ne contient plus de ligne 
   "❓ Section inconnue" et que "Sections jamais ouvertes" affiche ≤ 2 sections.

Contraintes :
- Ne touche RIEN d'autre dans extract_signals.py (pas de refactor, pas de seuils changés)
- Respecte l'ordre alphabétique et le format set Python existant
- Ne génère PAS automatiquement la liste depuis app.jsx — la liste manuelle avec note 
  de maintenance est un compromis acceptable
- Ne touche pas à index.html / cockpit/ — ce SHIP est purement extraction-side
- Pas de secret nouveau

Validation :
- python jarvis/scripts/extract_signals.py → exit 0
- grep -c "❓ Section inconnue" jarvis/intel/2026-04-25-signals.md → 0
- grep "Sections jamais ouvertes" jarvis/intel/2026-04-25-signals.md → 
  pourcentage < 15% ET liste sans agents/energy/papers/tools/myweek/llm/finserv/biz/reg

Ne fais PAS :
- Ne génère pas KNOWN_SECTIONS depuis un parsing AST de app.jsx — over-engineering
- N'ajoute pas de subprocess à app.jsx au runtime — couplage inutile
- Ne refactore pas extract_signals.py au-delà du bloc KNOWN_SECTIONS
- Ne touche pas aux 8 règles d'anomalies (Phase 1 du Weekly Pipeline est explicite : 
  ajuster les seuils est un autre sujet)
- Ne push pas

Quand c'est fait : montre-moi le diff complet AVANT git add + le contenu de la section 
Anomalies de signals.md du jour. 
git commit avec message "fix(audit): resync KNOWN_SECTIONS on real React cockpit panels".
PAS de push.
```
