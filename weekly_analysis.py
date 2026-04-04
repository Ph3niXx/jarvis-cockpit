"""
AI Cockpit — Weekly Intelligence Pipeline
==========================================
Tourne le dimanche soir (22h UTC) via GitHub Actions.
Utilise Claude Haiku 4.5 (~0.45$/run) pour :
1. Enrichir le wiki IA (descriptions 3 niveaux)
2. Analyser les tendances (signaux faibles)
3. Générer des recommandations d'apprentissage
4. Créer un challenge hebdo
5. Mettre à jour les use cases RTE avec des sources
6. Logger les coûts dans weekly_analysis

Garde-fou : le script s'arrête si le coût estimé dépasse MAX_COST_PER_RUN.
"""

import os
import json
import requests
from datetime import datetime, timedelta, timezone

# ─── CONFIG ───────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_KEY"]

CLAUDE_MODEL = "claude-haiku-4-5-20251001"
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Pricing Claude Haiku 4.5 ($/M tokens)
PRICE_INPUT  = 1.0   # $/M input tokens
PRICE_OUTPUT = 5.0   # $/M output tokens

# Garde-fous
MAX_COST_PER_RUN = 1.00   # $ — stoppe le script si dépassé
MAX_OUTPUT_TOKENS = 4096  # par appel

HEADERS_SUPABASE = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# ─── COST TRACKER ─────────────────────────────────────────────────────────────

class CostTracker:
    """Suit les tokens et coûts en temps réel pendant le run."""
    def __init__(self, max_cost):
        self.max_cost = max_cost
        self.total_input = 0
        self.total_output = 0
        self.calls = 0

    def add(self, input_tokens, output_tokens):
        self.total_input += input_tokens
        self.total_output += output_tokens
        self.calls += 1

    @property
    def cost(self):
        return (self.total_input / 1_000_000 * PRICE_INPUT) + \
               (self.total_output / 1_000_000 * PRICE_OUTPUT)

    @property
    def can_continue(self):
        return self.cost < self.max_cost

    def summary(self):
        return {
            "input_tokens": self.total_input,
            "output_tokens": self.total_output,
            "total_tokens": self.total_input + self.total_output,
            "cost_usd": round(self.cost, 4),
            "calls": self.calls,
        }

tracker = CostTracker(MAX_COST_PER_RUN)


# ─── CLAUDE API ───────────────────────────────────────────────────────────────

def call_claude(system_prompt, user_prompt, max_tokens=MAX_OUTPUT_TOKENS):
    """Appelle Claude Haiku et retourne le texte + met à jour le tracker."""
    if not tracker.can_continue:
        print(f"   [STOP] Budget dépassé ({tracker.cost:.4f}$ / {tracker.max_cost}$)")
        return None

    response = requests.post(
        CLAUDE_API_URL,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=120,
    )

    if response.status_code != 200:
        print(f"   [ERROR] Claude API: {response.status_code} {response.text[:200]}")
        return None

    data = response.json()
    usage = data.get("usage", {})
    input_t = usage.get("input_tokens", 0)
    output_t = usage.get("output_tokens", 0)
    tracker.add(input_t, output_t)

    cost_this_call = (input_t / 1_000_000 * PRICE_INPUT) + (output_t / 1_000_000 * PRICE_OUTPUT)
    print(f"   → {input_t} in / {output_t} out = {cost_this_call:.4f}$ (cumul: {tracker.cost:.4f}$)")

    text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")
    return text


def parse_json_response(text):
    """Parse JSON depuis une réponse Claude (gère les backticks)."""
    if not text:
        return None
    import re
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"   [WARN] JSON parse failed: {e}")
        return None


# ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

def sb_get(table, params=""):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers=HEADERS_SUPABASE)
    return r.json() if r.status_code == 200 else []

def sb_post(table, data):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS_SUPABASE, json=data)
    return r.status_code in (200, 201)

def sb_patch(table, filters, data):
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}?{filters}", headers=HEADERS_SUPABASE, json=data)
    return r.status_code in (200, 204)


# ─── STEP 1 : ENRICHIR LE WIKI ───────────────────────────────────────────────

def enrich_wiki():
    """Génère les descriptions 3 niveaux pour les concepts sans contenu."""
    concepts = sb_get("wiki_concepts", "summary_beginner=is.null&order=mention_count.desc&limit=10")
    if not concepts:
        print("   Aucun concept à enrichir")
        return []

    names = [c["name"] for c in concepts]
    print(f"   {len(concepts)} concepts à enrichir : {', '.join(names[:5])}...")

    system = """Tu es un expert en IA qui écrit des fiches pédagogiques. 
Pour chaque concept, tu génères 3 niveaux d'explication.
Réponds UNIQUEMENT en JSON valide, sans backticks ni commentaires."""

    prompt = f"""Génère des fiches pour ces concepts IA : {json.dumps(names)}

Format JSON attendu :
[
  {{
    "name": "nom exact du concept",
    "summary_beginner": "Explication en 2-3 phrases simples, comme si tu expliquais à quelqu'un qui découvre l'IA. Pas de jargon.",
    "summary_intermediate": "Explication en 3-4 phrases avec vocabulaire technique. Comment ça marche concrètement, quand l'utiliser.",
    "summary_advanced": "Explication technique approfondie en 4-5 phrases. Architecture, trade-offs, état de l'art, comparaison avec alternatives.",
    "related_concepts": ["slug-concept-1", "slug-concept-2"]
  }}
]

Sois concis et factuel. Chaque niveau doit apporter de la valeur par rapport au précédent."""

    result = call_claude(system, prompt)
    parsed = parse_json_response(result)
    if not parsed:
        return []

    enriched = []
    for item in parsed:
        # Trouver le concept correspondant
        matching = [c for c in concepts if c["name"] == item.get("name")]
        if not matching:
            continue
        concept = matching[0]
        sb_patch("wiki_concepts", f"slug=eq.{concept['slug']}", {
            "summary_beginner": item.get("summary_beginner"),
            "summary_intermediate": item.get("summary_intermediate"),
            "summary_advanced": item.get("summary_advanced"),
            "related_concepts": item.get("related_concepts", []),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        enriched.append(concept["name"])

    return enriched


# ─── STEP 2 : ANALYSE DES SIGNAUX ────────────────────────────────────────────

def analyze_signals():
    """Analyse les signaux de la semaine et génère un résumé."""
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    signals = sb_get("signal_tracking", f"week_start=eq.{week_start}&order=mention_count.desc&limit=20")
    if not signals:
        print("   Aucun signal cette semaine")
        return ""

    rising = [s for s in signals if s["trend"] in ("rising", "new")]
    signal_text = "\n".join([f"- {s['term']}: {s['mention_count']} mentions, trend={s['trend']}" for s in signals])

    system = "Tu es un analyste IA. Tu identifies les tendances émergentes à partir de signaux faibles. Sois concis et actionnable."
    prompt = f"""Voici les termes IA les plus mentionnés cette semaine dans mon flux de veille :

{signal_text}

Génère une analyse en 4-5 phrases :
1. Quels termes montrent une vraie tendance de fond vs du bruit ?
2. Y a-t-il un signal faible important que la plupart des gens ignorent encore ?
3. Quelles implications pour quelqu'un qui veut se positionner comme expert IA ou lancer un business ?

Sois direct et factuel."""

    return call_claude(system, prompt) or ""


# ─── STEP 3 : RECOMMANDATIONS D'APPRENTISSAGE ────────────────────────────────

def generate_recommendations():
    """Génère des recommandations ciblées basées sur le radar."""
    radar = sb_get("skill_radar", "order=score.asc&limit=3")  # 3 axes les plus faibles
    if not radar:
        print("   Radar non initialisé")
        return 0

    # Récupérer quelques articles récents
    articles = sb_get("articles", "order=date_fetched.desc&limit=30&select=title,url,section,source")

    axes_info = "\n".join([f"- {a['axis_label']}: {a['score']}/5" for a in radar])
    articles_info = "\n".join([f"- [{a['source']}] {a['title']} ({a['url']})" for a in articles[:20]])

    system = """Tu es un coach IA personnalisé. Tu recommandes du contenu ciblé pour combler les lacunes.
Réponds UNIQUEMENT en JSON valide."""

    prompt = f"""Voici les 3 axes de compétence IA les plus faibles de l'utilisateur :
{axes_info}

Voici des articles récents de sa veille :
{articles_info}

Génère 3-5 recommandations ciblées. Format JSON :
[
  {{
    "target_axis": "slug_de_l_axe (ex: rag_data, mlops, agents)",
    "title": "Titre de la recommandation",
    "description": "Pourquoi cette recommandation est pertinente (1-2 phrases)",
    "resource_url": "URL exacte d'un article ci-dessus, ou URL externe connue",
    "resource_type": "article|tutorial|video|paper|course",
    "difficulty": "beginner|intermediate|advanced"
  }}
]

Priorise les articles du flux de veille quand ils sont pertinents. Sinon, recommande des ressources externes connues (docs officielles, cours réputés)."""

    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    result = call_claude(system, prompt)
    parsed = parse_json_response(result)
    if not parsed:
        return 0

    count = 0
    for reco in parsed:
        reco["week_start"] = week_start
        if sb_post("learning_recommendations", reco):
            count += 1
    return count


# ─── STEP 4 : CHALLENGE HEBDO ────────────────────────────────────────────────

def generate_challenge():
    """Génère un mini-challenge calibré sur l'axe le plus faible."""
    radar = sb_get("skill_radar", "order=score.asc&limit=1")
    if not radar:
        return None

    weakest = radar[0]
    system = """Tu es un formateur IA. Tu crées des mini-défis pratiques et réalisables en 30 min max.
Réponds UNIQUEMENT en JSON valide."""

    prompt = f"""L'utilisateur est le plus faible sur l'axe : {weakest['axis_label']} (score: {weakest['score']}/5).

Génère UN challenge pratique. Format JSON :
{{
  "title": "Titre court et motivant",
  "description": "Consigne claire en 2-3 phrases. Le challenge doit être réalisable en 30 min, concret, et mesurable.",
  "target_axis": "{weakest['axis']}",
  "difficulty": "beginner|intermediate|advanced",
  "score_reward": 0.5
}}

Adapte la difficulté au score actuel. Score 0-1 = beginner, 1-3 = intermediate, 3-5 = advanced."""

    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    result = call_claude(system, prompt)
    parsed = parse_json_response(result)
    if not parsed:
        return None

    parsed["week_start"] = week_start
    parsed["status"] = "pending"
    sb_post("weekly_challenges", parsed)
    return parsed.get("title")


# ─── STEP 5 : ENRICHIR RTE USECASES ──────────────────────────────────────────

def enrich_rte():
    """Ajoute des sources et how-to aux use cases RTE sans contenu."""
    usecases = sb_get("rte_usecases", "how_to=is.null&limit=4")
    if not usecases:
        print("   Tous les use cases RTE ont déjà un how-to")
        return 0

    uc_text = "\n".join([f"- [{u['tool_label']}] {u['usecase']}: {u['description']}" for u in usecases])

    system = """Tu es un consultant en transformation digitale spécialisé SAFe et IA. 
Tu connais Jira, Confluence, Slack, Excel et les outils agile.
Réponds UNIQUEMENT en JSON valide."""

    prompt = f"""Voici des use cases IA pour un Release Train Engineer chez Malakoff Humanis (train Vente : CRM, outils d'aide à la vente, portail d'accès) :

{uc_text}

Pour chaque use case, génère un guide d'implémentation pratique. Format JSON :
[
  {{
    "usecase": "nom exact du use case",
    "tool": "nom exact de l'outil",
    "how_to": "Guide étape par étape en 4-5 points. Concret, avec les APIs/plugins/scripts à utiliser. Max 300 mots.",
    "sources": ["url1", "url2"]
  }}
]

Sois très concret : mentionne les plugins Jira, les API endpoints, les scripts Python possibles, les automatisations Slack."""

    result = call_claude(system, prompt)
    parsed = parse_json_response(result)
    if not parsed:
        return 0

    count = 0
    for item in parsed:
        matching = [u for u in usecases if u["usecase"] == item.get("usecase")]
        if matching:
            sb_patch("rte_usecases", f"id=eq.{matching[0]['id']}", {
                "how_to": item.get("how_to"),
                "sources": item.get("sources", []),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            count += 1
    return count


# ─── STEP 6 : LOGGER LES RÉSULTATS ───────────────────────────────────────────

def save_weekly_analysis(signals_summary, concepts_enriched, concepts_updated, 
                         recommendations_count, challenge_title, rte_count):
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    sb_post("weekly_analysis", {
        "week_start": week_start,
        "signals_summary": signals_summary,
        "concepts_added": concepts_enriched,
        "concepts_updated": concepts_updated or [],
        "recommendations_generated": recommendations_count,
        "challenge_generated": challenge_title,
        "tokens_used": json.dumps(tracker.summary()),
        "raw_analysis": f"Enriched {len(concepts_enriched)} wiki concepts, {recommendations_count} recos, RTE: {rte_count}",
    })


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🧠 AI COCKPIT — Weekly Intelligence Pipeline")
    print(f"   Budget max: {MAX_COST_PER_RUN}$ | Model: {CLAUDE_MODEL}")
    print("=" * 60)

    # Step 1: Enrichir le wiki
    print("\n📖 Step 1/5 — Enrichissement wiki...")
    concepts_enriched = enrich_wiki() if tracker.can_continue else []
    print(f"   → {len(concepts_enriched)} concepts enrichis")

    # Step 2: Analyser les signaux
    print("\n📡 Step 2/5 — Analyse des signaux...")
    signals_summary = analyze_signals() if tracker.can_continue else ""
    print(f"   → Analyse {'générée' if signals_summary else 'skippée'}")

    # Step 3: Recommandations
    print("\n🎯 Step 3/5 — Recommandations d'apprentissage...")
    reco_count = generate_recommendations() if tracker.can_continue else 0
    print(f"   → {reco_count} recommandations générées")

    # Step 4: Challenge
    print("\n🏆 Step 4/5 — Challenge hebdo...")
    challenge_title = generate_challenge() if tracker.can_continue else None
    print(f"   → Challenge: {challenge_title or 'skippé'}")

    # Step 5: Enrichir RTE
    print("\n🚂 Step 5/5 — Enrichissement RTE...")
    rte_count = enrich_rte() if tracker.can_continue else 0
    print(f"   → {rte_count} use cases RTE enrichis")

    # Save results
    print("\n💾 Sauvegarde des résultats...")
    save_weekly_analysis(signals_summary, concepts_enriched, [], reco_count, challenge_title, rte_count)

    # Final report
    summary = tracker.summary()
    print("\n" + "=" * 60)
    print(f"✅ Pipeline hebdo terminé")
    print(f"   Appels Claude : {summary['calls']}")
    print(f"   Tokens : {summary['input_tokens']} in / {summary['output_tokens']} out")
    print(f"   Coût total : {summary['cost_usd']}$")
    print(f"   Budget restant : {MAX_COST_PER_RUN - summary['cost_usd']:.4f}$")
    print("=" * 60)


if __name__ == "__main__":
    main()
