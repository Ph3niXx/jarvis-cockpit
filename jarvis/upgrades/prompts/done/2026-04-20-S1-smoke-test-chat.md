# S1 — Smoke-test de l'intégration panel-jarvis.jsx ↔ serveur local post-migration React

> Audit source : [2026-04-20-audit.md](../../2026-04-20-audit.md)
> Effort estimé : S (1-2h)
> North Star : Jarvis doit revivre — relancer la boucle d'apprentissage + prouver que la migration React n'a pas cassé `/chat`.

---

```
Contexte projet : Migration React terminée le 19/04 (commit 806876a). Le composer 
Jarvis est câblé à localhost:8765 via panel-jarvis.jsx:298-311 mais aucun smoke 
test n'a été fait en conditions réelles (serveur offline depuis 6 jours). Objectif : 
vérifier sans casser que les contrats HTTP entre front React et server.py FastAPI 
sont cohérents AVANT que Jean relance Jarvis et tape sur un bug silencieux.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)
Avant de créer quoi que ce soit :
- Lis cockpit/panel-jarvis.jsx L275-325 (fonction jarvisGateway + handleSend)
- Lis jarvis/server.py entièrement (cherche @app.post("/chat") et @app.get("/health"))
- grep -n "source_table\|chunk_text" jarvis/retriever.py jarvis/server.py
  (pour capter la shape réelle renvoyée par le RAG dans /chat)
- grep -n "PROFILE_DATA" cockpit/lib/data-loader.js cockpit/lib/bootstrap.js
  (pour savoir si PROFILE_DATA expose _values ou values ou plat)
- grep -rn "localhost:8765\|jarvis_tunnel_url" cockpit/ --include="*.jsx" --include="*.js"
- Liste les 4 contrats à vérifier :
  (1) clé body POST /chat attendue par server.py vs envoyée par front
  (2) clé de réponse (response/answer/message) dans /chat
  (3) shape des éléments data.sources (champs présents, types)
  (4) shape GET /health (clés top-level)

Écris un rapport de reconnaissance en ~40 lignes listant :
- Les 4 contrats observés côté serveur (fichier:ligne)
- Les 4 attentes côté front (fichier:ligne)  
- Les éventuels mismatches repérés
- La proposition d'emplacement pour le smoke test (jarvis/scripts/smoke_test_chat.py 
  ou jarvis/test_chat_contract.py — choix à justifier)
ATTENDS ma validation avant de créer quoi que ce soit.

Objectif : Créer un smoke test Python qui exerce /chat et /health sans LLM chargé, 
et qui échoue avec un message clair si un contrat est rompu.

Fichiers concernés :
- jarvis/scripts/smoke_test_chat.py (création)
- Éventuellement cockpit/panel-jarvis.jsx (SI et seulement SI un mismatch évident 
  se règle en 3 lignes côté front — sinon on rapporte et on arrête)

Étapes (après validation de la Phase 0) :

1. Créer jarvis/scripts/smoke_test_chat.py qui :
   - Prend une URL en argument (--base-url, défaut http://localhost:8765)
   - Test 1 : POST /chat avec {"message": "ping", "mode": "rapide", "session_id": "smoke"}
     Accepte HTTP 200 (LLM chargé) OU HTTP 503 "llm_unavailable" (LLM déchargé).
     Refuse 400, 404, 422, 500.
   - Test 2 : Si 200, valide que data.response existe ET que data.sources est une 
     liste (éventuellement vide). Log le nom de clé trouvée (response / answer / 
     message) et échoue si plusieurs coexistent.
   - Test 3 : Pour chaque source, valide la présence des clés attendues par le 
     front (source_table ou chunk_text ou url ou name — au moins une). Log les 
     clés réelles observées.
   - Test 4 : GET /health — doit renvoyer 200 et contenir au moins status, 
     nightly (avec last_result), chunks (int).
   - Renvoyer exit 0 si tout OK, exit 1 avec rapport détaillé sinon.

2. Ajouter en tête du fichier un bloc docstring expliquant :
   "Smoke test post-migration React 19/04. À lancer après chaque démarrage de 
   Jarvis ou après un changement de contrat dans server.py / panel-jarvis.jsx. 
   Ne charge PAS de LLM, ne consomme aucun token."

3. Si Phase 0 a révélé un mismatch TRIVIAL (ex: front envoie "message" mais 
   serveur attend "query"), proposer le patch en commentaire dans le rapport 
   final — mais NE PAS le committer ensemble avec le smoke test. Deux commits 
   séparés ou un seul commit qui mentionne explicitement le fix dans son message.

Contraintes :
- Python 3.10+, urllib standard ou requests (requests acceptable, déjà dans requirements)
- Pas de dépendance nouvelle
- Pas de mock complexe — on attend un serveur vivant sur localhost:8765
- Imprime des messages humains (pas uniquement assertions)
- Pas de pytest (on veut un script autonome, exécutable à la main)
- Ne touche PAS à server.py (c'est un observateur, pas un refacteur)

Validation :
- ls jarvis/scripts/smoke_test_chat.py → fichier présent
- python jarvis/scripts/smoke_test_chat.py --help → aide lisible
- (optionnel, si Jarvis tourne) python jarvis/scripts/smoke_test_chat.py → exit 0 ou rapport détaillé

Ne fais PAS :
- Ne refactore pas panel-jarvis.jsx au-delà d'un fix 3-lignes documenté
- N'ajoute pas de CI GitHub Actions pour ce smoke test (hors scope)
- Ne crée pas de mock-server — on attend un vrai server.py
- Ne teste pas le mode Cloud (Claude Haiku) — le contrat devrait être identique mais ça brûle des tokens
- Ne crée pas de tests unitaires pour retriever.py — smoke test uniquement

Quand c'est fait : montre-moi le diff complet AVANT git add. 
git commit avec message "test(jarvis): add smoke_test_chat.py for post-React contract validation". 
PAS de push (je le ferai après revue).
```
