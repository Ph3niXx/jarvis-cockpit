# Jarvis — Assistant IA local

Assistant personnel local tournant sur LLM via LM Studio, avec RAG sur Supabase et apprentissage continu.

## Prérequis

1. **LM Studio** installé avec Developer Mode activé
2. **Modèles** chargés dans LM Studio :
   - Qwen3.5 9B (Q4_K_M) — LLM principal
   - Qwen3-Embedding-0.6B (Q8_0) — embeddings (1024-dim)
3. **Serveur LM Studio** démarré (port 1234 par défaut)
4. **Python 3.10+** avec dépendances : `pip install openai fastapi uvicorn`
5. **Migration SQL** exécutée dans Supabase (voir Phase 2)
6. **Variables d'environnement** : `SUPABASE_URL` et `SUPABASE_KEY` (ou utiliser `start_jarvis.bat` qui les set automatiquement)

## Démarrage rapide

Double-clic sur `jarvis/start_jarvis.bat` puis ouvrir le cockpit (index.html local ou GitHub Pages).

Le script fait tout automatiquement :
1. Vérifie que LM Studio tourne
2. Compare l'index avec les données source — indexe si nécessaire
3. Lance un tunnel Cloudflare (HTTPS, accessible depuis partout)
4. Sauvegarde l'URL du tunnel dans Supabase
5. Lance le serveur Jarvis sur http://localhost:8765

Le cockpit découvre l'URL automatiquement (localhost ou tunnel).

### Prérequis tunnel (optionnel, pour accès distant/mobile)

```bash
winget install cloudflare.cloudflared
```

Sans cloudflared, Jarvis fonctionne uniquement en local.

## Phase 1 — Test LLM local

```bash
python jarvis/test_jarvis.py
```

## Phase 2 — RAG Supabase

### Setup (une seule fois)

1. Exécuter la migration SQL dans Supabase Dashboard > SQL Editor :
   - Coller le contenu de `jarvis/migrations/001_enable_pgvector.sql`
   - Cliquer Run

2. Indexer les tables :
```bash
python jarvis/indexer.py              # indexation complète
python jarvis/indexer.py --table=articles  # une seule table
python jarvis/indexer.py --incremental    # nouvelles lignes uniquement
python jarvis/indexer.py --dry-run        # preview sans écriture
```

3. Tester le RAG :
```bash
python jarvis/test_rag.py
```

## Phase 2.5 — Intégration cockpit web

### Architecture

```
Navigateur (index.html)
  ↓ POST /chat (fetch)
jarvis/server.py (FastAPI sur localhost:8765)
  ↓ retriever.search() + appel LLM
LM Studio (localhost:1234) + Supabase
  ↓
Réponse JSON → affichée dans le chat
```

### Endpoints du serveur

**GET /health** — Statut du système
```bash
curl http://localhost:8765/health
# {"status":"ok","lm_studio":true,"supabase":true,"vectors_count":183}
```

**POST /chat** — Chat RAG avec Jarvis
```bash
curl -X POST http://localhost:8765/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Quels concepts IA connais-tu ?"}'
# {"answer":"...","sources":[...],"tokens_used":1234,"latency_ms":5400}
```

**POST /search** — Recherche sémantique brute (debug)
```bash
curl -X POST http://localhost:8765/search \
  -H "Content-Type: application/json" \
  -d '{"query": "RAG", "k": 3, "threshold": 0.3}'
```

### Vérifier l'état d'indexation

```bash
python jarvis/check_index_freshness.py
```

Compare le COUNT des lignes source vs les chunks indexés. Exit code 0 = indexation nécessaire, 1 = tout à jour, 2 = erreur.

### Troubleshooting

| Problème | Solution |
|----------|----------|
| CORS error dans le navigateur | Vérifier que `server.py` tourne sur le port 8765 |
| Connection refused | `server.py` n'est pas lancé — relancer `start_jarvis.bat` |
| 503 Service Unavailable | LM Studio n'est pas lancé ou modèle pas chargé |
| Réponses lentes (5-15s) | Normal pour Qwen3.5 9B en local — le mode thinking peut encore s'activer malgré `/no_think` |
| Port 8765 occupé | Arrêter le processus existant ou changer le port dans `server.py` |
| Tunnel non détecté | Vérifier `jarvis_data/cloudflared.log` — cloudflared installé ? |
| Jarvis offline sur mobile | Relancer `start_jarvis.bat` (l'URL tunnel change à chaque restart) |

### Forcer une réindexation

```bash
python jarvis/indexer.py --full
```

## Phasage

| Phase | Description | Statut |
|-------|-------------|--------|
| 1 | LM Studio + premier appel Python | Done |
| 2 | RAG Supabase (pgvector + indexation) | Done |
| 2.5 | Intégration cockpit web (server + onglet Jarvis) | Done |
| 3 | Mémoire structurée (profile_facts, entities) | Planifié |
| 4 | Orchestrateur (routeur LLM local/cloud) | Planifié |
| 5 | Boucle nocturne d'apprentissage | Planifié |
| 6 | Capteurs d'observation (fichiers, Teams, Outlook) | Planifié |
