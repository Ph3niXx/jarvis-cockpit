"""
Jarvis Cockpit — v2 Cockpit Edition
=====================================
Pipeline quotidien (lun-ven, 6h UTC via GitHub Actions) :
1. Ping Supabase (anti-pause)
2. Fetch RSS (45+ sources, 9 sections incluant energy)
3. Recherche web temps réel via Gemini grounding
4. Extraction de concepts IA → wiki_concepts
5. Tracking signaux faibles → signal_tracking
6. Génération du brief quotidien
7. Sauvegarde articles + brief en Supabase
8. Envoi email de notification

Stack : Gemini 2.5 Flash-Lite (gratuit) + Supabase + GitHub Actions + Gmail SMTP
"""

import os
import re
import json
import smtplib
import feedparser
import requests
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
from google import genai
from google.genai import types as genai_types

# ─── CONFIG ───────────────────────────────────────────────────────────────────

GEMINI_API_KEY   = os.environ["GEMINI_API_KEY"]
GMAIL_ADDRESS    = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PWD    = os.environ["GMAIL_APP_PASSWORD"]
RECIPIENT_EMAIL  = os.environ["RECIPIENT_EMAIL"]
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]

SITE_URL = "https://ph3nixx.github.io/jarvis-cockpit"

# ─── RSS FEEDS (source_name, url, section) ────────────────────────────────────

RSS_FEEDS = [
    # ── Nouveautés IA grand public ───────────────────────────────────────────
    ("Anthropic News",       "https://www.anthropic.com/rss.xml",                           "updates"),
    ("OpenAI Blog",          "https://openai.com/blog/rss.xml",                             "updates"),
    ("Google AI Blog",       "https://blog.google/technology/ai/rss/",                      "updates"),
    ("Mistral AI Blog",      "https://mistral.ai/news/feed.xml",                            "updates"),

    # ── LLMs & Modèles ──────────────────────────────────────────────────────
    ("Google DeepMind",      "https://deepmind.google/blog/rss.xml",                        "llm"),
    ("Meta AI Blog",         "https://ai.meta.com/blog/feed/",                              "llm"),
    ("HuggingFace Blog",     "https://huggingface.co/blog/feed.xml",                        "llm"),
    ("Ahead of AI",          "https://magazine.sebastianraschka.com/feed",                   "llm"),
    ("Import AI",            "https://importai.substack.com/feed",                           "llm"),
    ("The Batch",            "https://www.deeplearning.ai/the-batch/feed/",                  "llm"),

    # ── Agents & Automatisation ──────────────────────────────────────────────
    ("LangChain Blog",       "https://blog.langchain.dev/rss/",                             "agents"),
    ("LlamaIndex Blog",      "https://medium.com/feed/llamaindex",                          "agents"),
    ("Simon Willison",       "https://simonwillison.net/atom/everything/",                  "agents"),
    ("AutoGPT Releases",     "https://github.com/Significant-Gravitas/AutoGPT/releases.atom","agents"),

    # ── IA Finance & Assurance ───────────────────────────────────────────────
    ("Finextra AI",          "https://www.finextra.com/rss/channel.aspx?channel=ai",        "finserv"),
    ("Insurance Journal",    "https://www.insurancejournal.com/feed/",                       "finserv"),
    ("Towards Data Science", "https://towardsdatascience.com/feed",                          "papers"),

    # ── Outils Dev ───────────────────────────────────────────────────────────
    ("Langfuse Blog",        "https://langfuse.com/blog/feed.xml",                          "tools"),
    ("Qdrant Blog",          "https://qdrant.tech/blog/feed.xml",                           "tools"),
    ("Weaviate Blog",        "https://weaviate.io/blog/feed.xml",                           "tools"),
    ("MLflow Blog",          "https://mlflow.org/blog/feed.xml",                            "tools"),
    ("Weights & Biases",     "https://wandb.ai/site/feed.xml",                              "tools"),

    # ── Business & Funding ───────────────────────────────────────────────────
    ("VentureBeat AI",       "https://venturebeat.com/category/ai/feed/",                   "biz"),
    ("TechCrunch AI",        "https://techcrunch.com/category/artificial-intelligence/feed/","biz"),
    ("Stratechery",          "https://stratechery.com/feed/",                                "biz"),
    ("One Useful Thing",     "https://www.oneusefulthing.org/feed",                          "biz"),

    # ── Régulation & Éthique ─────────────────────────────────────────────────
    ("MIT Tech Review",      "https://www.technologyreview.com/feed/",                      "reg"),
    ("AI Snake Oil",         "https://www.aisnakeoil.com/feed",                             "reg"),
    ("Future of Life",       "https://futureoflife.org/feed/",                              "reg"),
    ("CNIL",                 "https://www.cnil.fr/fr/rss.xml",                              "reg"),

    # ── Arxiv ────────────────────────────────────────────────────────────────
    ("Arxiv CS.AI",          "https://rss.arxiv.org/rss/cs.AI",                             "papers"),
    ("Arxiv CS.LG",          "https://rss.arxiv.org/rss/cs.LG",                             "papers"),

    # ── IA x Énergie / Utilities (NOUVEAU) ───────────────────────────────────
    ("IEEE Smart Grid",      "https://smartgrid.ieee.org/resources/blog/rss",               "energy"),
    ("Energy Central AI",    "https://energycentral.com/c/iu/feed",                         "energy"),
    ("Utility Dive",         "https://www.utilitydive.com/feeds/news/",                     "energy"),
    ("GreenTech Media",      "https://www.greentechmedia.com/feed",                         "energy"),
    ("RTE France Actu",      "https://www.rte-france.com/actualites/rss.xml",               "energy"),
    ("ENTSO-E News",         "https://www.entsoe.eu/news/feed/",                            "energy"),
]

MAX_ARTICLES_PER_FEED = 4
LOOKBACK_HOURS = 36  # 36h pour couvrir le week-end

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates",
}

HEADERS_UPSERT = {
    **HEADERS,
    "Prefer": "resolution=merge-duplicates",
}


# ─── GEMINI USAGE LOGGING ────────────────────────────────────────────────────
# Google AI Studio doesn't expose usage via public API. We log each call
# here so the cockpit Stacks panel can show real usage (table gemini_api_calls).

import time as _time  # alias to avoid collision with potential `time` import in caller scope


def _gemini_usage(resp):
    """Extract input/output/total tokens from a Gemini response, best-effort."""
    try:
        meta = getattr(resp, "usage_metadata", None)
        if not meta:
            return None, None, None
        return (
            getattr(meta, "prompt_token_count", None),
            getattr(meta, "candidates_token_count", None),
            getattr(meta, "total_token_count", None),
        )
    except Exception:
        return None, None, None


def _log_gemini_call(pipeline, step, model_name, prompt, response=None, error=None, latency_ms=None):
    """Insert one row into gemini_api_calls. Never raises — logging must not break the pipeline."""
    try:
        status = "ok"
        err_msg = None
        err_str = str(error) if error else ""
        if error is not None:
            status = "rate_limit" if ("429" in err_str or "rate" in err_str.lower() or "quota" in err_str.lower()) else "error"
            err_msg = err_str[:500]
        input_tok = output_tok = total_tok = None
        response_chars = None
        if response is not None:
            input_tok, output_tok, total_tok = _gemini_usage(response)
            try:
                response_chars = len((response.text or "")) if hasattr(response, "text") else None
            except Exception:
                response_chars = None
        payload = {
            "pipeline": pipeline,
            "step": step,
            "model": model_name,
            "status": status,
            "prompt_chars": len(prompt) if prompt else None,
            "response_chars": response_chars,
            "input_tokens": input_tok,
            "output_tokens": output_tok,
            "total_tokens": total_tok,
            "latency_ms": latency_ms,
            "error_message": err_msg,
        }
        requests.post(
            f"{SUPABASE_URL}/rest/v1/gemini_api_calls",
            headers=HEADERS,
            json=payload,
            timeout=5,
        )
    except Exception as e:
        # Logging failures must never bubble up.
        print(f"   [WARN] gemini_api_calls log failed: {e}")


_genai_client = None


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _genai_client


def call_gemini(prompt, *, pipeline, step, model_name, use_grounding=False):
    """Appelle Gemini via le SDK google-genai et log chaque appel dans gemini_api_calls.

    use_grounding=True active l'outil Google Search (pour web search temps reel).
    Re-raise les exceptions — le logging est transparent.
    """
    client = _get_genai_client()
    config = None
    if use_grounding:
        config = genai_types.GenerateContentConfig(
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
        )

    t0 = _time.time()
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config,
        )
        latency_ms = int((_time.time() - t0) * 1000)
        _log_gemini_call(pipeline, step, model_name, prompt, response=response, latency_ms=latency_ms)
        return response
    except Exception as e:
        latency_ms = int((_time.time() - t0) * 1000)
        _log_gemini_call(pipeline, step, model_name, prompt, error=e, latency_ms=latency_ms)
        raise


# ─── UTILS ────────────────────────────────────────────────────────────────────

class MLStripper(HTMLParser):
    """Strip HTML tags from RSS summaries."""
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
    def handle_data(self, d):
        self.fed.append(d)
    def get_data(self):
        return " ".join(self.fed)

def strip_html(html):
    if not html:
        return ""
    s = MLStripper()
    try:
        s.feed(html)
        text = s.get_data()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^The post .+ appeared first on .+$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[\u2026\]|\.\.\.", "…", text)
    return text.strip()

def safe_json_parse(text):
    """Tente de parser du JSON depuis une réponse Gemini (enlève les backticks)."""
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# ─── STEP 1 : PING SUPABASE ──────────────────────────────────────────────────

def ping_supabase():
    try:
        requests.get(f"{SUPABASE_URL}/rest/v1/articles?limit=1", headers=HEADERS, timeout=10)
        print("   → Supabase pinged (anti-pause)")
    except Exception as e:
        print(f"   [WARN] Ping failed: {e}")


# ─── STEP 2 : FETCH RSS ──────────────────────────────────────────────────────

def fetch_recent_articles():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    articles = []
    for source_name, url, section in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            count = 0
            for entry in feed.entries:
                if count >= MAX_ARTICLES_PER_FEED:
                    break
                pub = None
                for attr in ("published_parsed", "updated_parsed"):
                    val = getattr(entry, attr, None)
                    if val:
                        pub = datetime(*val[:6], tzinfo=timezone.utc)
                        break
                # Arxiv n'a pas toujours de date fiable, on les prend tous
                if pub and pub < cutoff and "arxiv" not in url:
                    continue
                title = entry.get("title", "Sans titre").strip()
                link = entry.get("link", "#")
                raw_summary = entry.get("summary", entry.get("description", ""))
                summary = strip_html(raw_summary)[:800]
                articles.append({
                    "source":   source_name,
                    "title":    title,
                    "link":     link,
                    "summary":  summary,
                    "date":     pub.strftime("%d/%m %H:%M") if pub else "N/A",
                    "date_iso": pub.isoformat() if pub else None,
                    "section":  section,
                })
                count += 1
        except Exception as e:
            print(f"   [WARN] {source_name}: {e}")
    print(f"   → {len(articles)} articles RSS récupérés")
    return articles


# ─── STEP 3 : WEB SEARCH VIA GEMINI ──────────────────────────────────────────

def web_search_ai_news():
    """Recherche web temps réel via Gemini grounding (google_search tool)."""
    today = datetime.now().strftime("%d %B %Y")

    queries = [
        f"Claude Anthropic new features updates {today}",
        f"ChatGPT OpenAI new features announcements {today}",
        f"Gemini Google AI new capabilities {today}",
        f"AI startup funding announcements {today}",
        f"AI regulation Europe energy sector {today}",
    ]

    web_results = []
    for query in queries:
        try:
            prompt = (
                f"Recherche les dernières actualités sur : {query}. "
                f"Résume en 3-4 points factuels avec les URLs des sources. Sois très concis."
            )
            response = call_gemini(
                prompt,
                pipeline="main.py",
                step="web_search_grounded",
                model_name="gemini-2.5-flash-lite",
                use_grounding=True,
            )
            web_results.append({
                "query": query,
                "result": response.text if response.text else "Pas de résultats"
            })
        except Exception as e:
            web_results.append({"query": query, "result": f"Erreur: {str(e)[:100]}"})

    print(f"   → {len(web_results)} recherches web complétées (grounding=on)")
    return web_results


# ─── STEP 3b : RECHERCHE ARTICLES RTE ───────────────────────────────────────

# Requêtes RTE groupées par jour (rotation lun-ven)
RTE_SEARCH_QUERIES = {
    0: [  # Lundi
        ("Jira", "AI Jira automation agile project management 2025 2026"),
        ("Jira", "Jira AI assistant plugin sprint backlog management"),
    ],
    1: [  # Mardi
        ("Confluence", "AI Confluence documentation automation knowledge base"),
        ("Slack", "AI Slack bot workflow standup automation enterprise"),
    ],
    2: [  # Mercredi
        ("Excel", "AI Excel reporting automation agile metrics dashboard"),
        ("Excel", "AI spreadsheet automation PI planning velocity tracking"),
    ],
    3: [  # Jeudi
        ("SAFe", "AI SAFe Release Train Engineer tools best practices 2025"),
        ("SAFe", "AI program increment planning agile at scale automation"),
    ],
    4: [  # Vendredi
        ("Agile", "AI agile coaching retrospective analysis tools 2025"),
        ("Agile", "AI risk management agile portfolio dependency tracking"),
    ],
}


def search_rte_articles():
    """Recherche web d'articles RTE concrets via Gemini grounding (2 queries/jour, rotation)."""
    today = datetime.now()
    weekday = today.weekday()

    if weekday > 4:  # Pas le weekend
        print("   Weekend — skip RTE search")
        return 0

    queries = RTE_SEARCH_QUERIES.get(weekday, RTE_SEARCH_QUERIES[0])

    articles = []
    for tool_label, query in queries:
        try:
            prompt = (
                f"Find 3-5 recent articles about: {query}. "
                f"For each article, give the exact title, the full URL, and a 1-2 sentence summary. "
                f"Format each article as:\n"
                f"TITLE: ...\nURL: ...\nSUMMARY: ...\n\n"
                f"Only include real articles with real URLs. Be factual."
            )
            response = call_gemini(
                prompt,
                pipeline="main.py",
                step="rte_search_grounded",
                model_name="gemini-2.5-flash-lite",
                use_grounding=True,
            )
            text = response.text or ""

            # Parser les articles du texte Gemini
            parsed = _parse_rte_articles(text, tool_label, query)
            articles.extend(parsed)
        except Exception as e:
            print(f"   [WARN] RTE search '{tool_label}': {e}")

    if not articles:
        print("   Aucun article RTE trouvé")
        return 0

    # Purger les articles > 30 jours
    cutoff = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    requests.delete(
        f"{SUPABASE_URL}/rest/v1/rte_articles?fetch_date=lt.{cutoff}",
        headers=HEADERS,
    )

    # Sauvegarder les nouveaux articles (ignore duplicates sur url)
    rows = [{
        "topic": a["tool_label"],
        "tool_label": a["tool_label"],
        "title": a["title"],
        "url": a["url"],
        "snippet": a.get("snippet", ""),
        "source_name": a.get("source_name", ""),
        "fetch_date": today.strftime("%Y-%m-%d"),
        "search_query": a["query"],
    } for a in articles]

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rte_articles",
        headers=HEADERS,
        json=rows,
    )
    saved = len(rows) if resp.status_code in (200, 201) else 0
    if resp.status_code not in (200, 201):
        print(f"   [WARN] RTE articles save: {resp.status_code} {resp.text[:200]}")

    print(f"   → {saved} articles RTE sauvegardés ({', '.join(q[0] for q in queries)})")
    return saved


def _parse_rte_articles(text, tool_label, query):
    """Parse le texte Gemini pour extraire titre/URL/snippet."""
    articles = []
    # Regex pour extraire les URLs du texte
    url_pattern = re.compile(r'https?://[^\s\)\]\"\'<>]+')

    # Essayer le format structuré TITLE/URL/SUMMARY
    blocks = re.split(r'\n(?=TITLE:|(?:\d+[\.\)]?\s))', text)
    for block in blocks:
        title_m = re.search(r'TITLE:\s*(.+)', block)
        url_m = re.search(r'URL:\s*(https?://[^\s\)\]\"\'<>]+)', block)
        summary_m = re.search(r'SUMMARY:\s*(.+)', block, re.DOTALL)

        if title_m and url_m:
            title = title_m.group(1).strip().strip('*[]')
            url = url_m.group(1).strip().rstrip('.,;)')
            snippet = summary_m.group(1).strip()[:300] if summary_m else ""
            # Extraire le nom de domaine comme source
            domain_m = re.search(r'https?://(?:www\.)?([^/]+)', url)
            source = domain_m.group(1) if domain_m else ""
            articles.append({
                "tool_label": tool_label,
                "title": title[:200],
                "url": url,
                "snippet": snippet,
                "source_name": source,
                "query": query,
            })

    # Fallback : extraire les URLs brutes si le format structuré n'a rien donné
    if not articles:
        urls = url_pattern.findall(text)
        for url in urls[:5]:
            url = url.rstrip('.,;)')
            articles.append({
                "tool_label": tool_label,
                "title": f"Article: {tool_label} AI",
                "url": url,
                "snippet": "",
                "source_name": "",
                "query": query,
            })

    return articles


# ─── STEP 4 : EXTRACTION DE CONCEPTS POUR LE WIKI ────────────────────────────

# Concepts IA connus à détecter dans les articles
CONCEPT_KEYWORDS = {
    # Architecture & techniques
    "rag": "RAG (Retrieval-Augmented Generation)",
    "retrieval augmented generation": "RAG (Retrieval-Augmented Generation)",
    "fine-tuning": "Fine-tuning",
    "fine tuning": "Fine-tuning",
    "finetuning": "Fine-tuning",
    "lora": "LoRA (Low-Rank Adaptation)",
    "qlora": "QLoRA",
    "moe": "MoE (Mixture of Experts)",
    "mixture of experts": "MoE (Mixture of Experts)",
    "transformer": "Transformer",
    "attention mechanism": "Mécanisme d'attention",
    "self-attention": "Self-attention",
    "embeddings": "Embeddings",
    "vector database": "Base de données vectorielle",
    "vector db": "Base de données vectorielle",
    "vectordb": "Base de données vectorielle",
    "tokenization": "Tokenisation",
    "tokenizer": "Tokenisation",
    "context window": "Fenêtre de contexte",
    "prompt engineering": "Prompt engineering",
    "chain of thought": "Chain-of-thought",
    "cot": "Chain-of-thought",
    "few-shot": "Few-shot learning",
    "zero-shot": "Zero-shot learning",
    "in-context learning": "In-context learning",
    "distillation": "Distillation de modèle",

    # Agents & tools
    "function calling": "Function calling",
    "tool use": "Tool use",
    "mcp": "MCP (Model Context Protocol)",
    "model context protocol": "MCP (Model Context Protocol)",
    "agentic": "Agents IA",
    "ai agent": "Agents IA",
    "multi-agent": "Systèmes multi-agents",
    "orchestration": "Orchestration d'agents",
    "langchain": "LangChain",
    "llamaindex": "LlamaIndex",
    "langgraph": "LangGraph",
    "autogen": "AutoGen",
    "crewai": "CrewAI",

    # Deployment & ops
    "mlops": "MLOps",
    "llmops": "LLMOps",
    "inference": "Inférence",
    "quantization": "Quantisation",
    "pruning": "Élagage (Pruning)",
    "serving": "Model serving",
    "guardrails": "Guardrails",
    "red teaming": "Red teaming",
    "eval": "Évaluation de modèles",
    "benchmark": "Benchmarks",
    "hallucination": "Hallucinations",
    "grounding": "Grounding",

    # Business & stratégie
    "ai act": "AI Act (Règlement européen)",
    "frontier model": "Modèle frontier",
    "foundation model": "Modèle fondation",
    "open source model": "Modèle open source",
    "open weight": "Modèle open weights",
    "synthetic data": "Données synthétiques",
    "data flywheel": "Data flywheel",

    # Énergie & utilities (pour ta mission RTE)
    "predictive maintenance": "Maintenance prédictive",
    "maintenance prédictive": "Maintenance prédictive",
    "digital twin": "Jumeau numérique",
    "jumeau numérique": "Jumeau numérique",
    "smart grid": "Smart grid",
    "grid optimization": "Optimisation réseau",
    "load forecasting": "Prévision de charge",
    "demand response": "Demand response",
    "energy storage": "Stockage d'énergie",
    "flexibility": "Flexibilité électrique",

    # Coding & dev
    "vibe coding": "Vibe coding",
    "code generation": "Génération de code",
    "copilot": "Copilot (assistants code)",
    "claude code": "Claude Code",
    "cursor": "Cursor (IDE IA)",
}

def extract_concepts(articles):
    """Détecte les concepts IA dans les articles et retourne les mentions."""
    concept_mentions = {}  # slug -> {"name": ..., "count": 0, "sources": [...]}

    for article in articles:
        text = f"{article['title']} {article['summary']}".lower()
        for keyword, concept_name in CONCEPT_KEYWORDS.items():
            if keyword.lower() in text:
                slug = re.sub(r'[^a-z0-9]+', '-', concept_name.lower()).strip('-')
                if slug not in concept_mentions:
                    concept_mentions[slug] = {
                        "name": concept_name,
                        "count": 0,
                        "sources": []
                    }
                concept_mentions[slug]["count"] += 1
                if article["link"] not in concept_mentions[slug]["sources"]:
                    concept_mentions[slug]["sources"].append(article["link"])

    return concept_mentions


def save_concepts_to_wiki(concept_mentions):
    """Upsert des concepts dans wiki_concepts (sans écraser les descriptions existantes)."""
    if not concept_mentions:
        return 0

    today = datetime.now().strftime("%Y-%m-%d")
    saved = 0

    for slug, data in concept_mentions.items():
        # Vérifier si le concept existe déjà
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/wiki_concepts?slug=eq.{slug}&select=id,mention_count,sources",
            headers=HEADERS,
        )

        if resp.status_code == 200 and resp.json():
            # Concept existe → update mention_count et last_mentioned
            existing = resp.json()[0]
            new_count = existing["mention_count"] + data["count"]
            existing_sources = existing.get("sources") or []
            new_sources = list(set(existing_sources + data["sources"][:5]))[:20]  # garder max 20

            requests.patch(
                f"{SUPABASE_URL}/rest/v1/wiki_concepts?slug=eq.{slug}",
                headers=HEADERS,
                json={
                    "mention_count": new_count,
                    "last_mentioned": today,
                    "sources": new_sources,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        else:
            # Nouveau concept → insert
            # Déterminer la catégorie automatiquement
            category = "general"
            name_lower = data["name"].lower()
            if any(k in name_lower for k in ["rag", "transformer", "attention", "embedding", "moe", "lora", "context"]):
                category = "architecture"
            elif any(k in name_lower for k in ["fine-tuning", "distillation", "quantis", "pruning"]):
                category = "training"
            elif any(k in name_lower for k in ["agent", "function", "tool", "mcp", "langchain", "orchestr"]):
                category = "agents"
            elif any(k in name_lower for k in ["mlops", "serving", "inference", "deploy"]):
                category = "deployment"
            elif any(k in name_lower for k in ["act", "ethic", "guardrail", "red team", "hallucin"]):
                category = "ethics"
            elif any(k in name_lower for k in ["business", "model", "data flywheel", "synthetic"]):
                category = "business"
            elif any(k in name_lower for k in ["maintenance", "grid", "energy", "jumeau", "flexib", "charge"]):
                category = "energy"
            elif any(k in name_lower for k in ["code", "copilot", "cursor", "vibe"]):
                category = "coding"

            requests.post(
                f"{SUPABASE_URL}/rest/v1/wiki_concepts",
                headers=HEADERS,
                json={
                    "slug": slug,
                    "name": data["name"],
                    "category": category,
                    "mention_count": data["count"],
                    "first_seen": today,
                    "last_mentioned": today,
                    "sources": data["sources"][:10],
                },
            )
        saved += 1

    return saved


# ─── STEP 5 : TRACKING DES SIGNAUX FAIBLES ───────────────────────────────────

def track_signals(concept_mentions):
    """Enregistre les mentions de cette semaine pour détecter les tendances."""
    if not concept_mentions:
        return 0

    # Calculer le début de la semaine ISO courante (lundi)
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    saved = 0
    for slug, data in concept_mentions.items():
        term = data["name"]

        # Vérifier si on a déjà une entrée pour ce terme cette semaine
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/signal_tracking?term=eq.{term}&week_start=eq.{week_start}&select=id,mention_count,sources",
            headers=HEADERS,
        )

        if resp.status_code == 200 and resp.json():
            # Update : ajouter les mentions
            existing = resp.json()[0]
            new_count = existing["mention_count"] + data["count"]
            existing_sources = existing.get("sources") or []
            new_sources = list(set(existing_sources + data["sources"][:3]))[:10]

            requests.patch(
                f"{SUPABASE_URL}/rest/v1/signal_tracking?id=eq.{existing['id']}",
                headers=HEADERS,
                json={
                    "mention_count": new_count,
                    "sources": new_sources,
                },
            )
        else:
            # Insert nouvelle entrée
            requests.post(
                f"{SUPABASE_URL}/rest/v1/signal_tracking",
                headers=HEADERS,
                json={
                    "term": term,
                    "week_start": week_start,
                    "mention_count": data["count"],
                    "sources": data["sources"][:5],
                    "trend": "new",
                },
            )
        saved += 1

    return saved


def update_signal_trends():
    """Compare les signaux de cette semaine avec la semaine dernière pour déterminer les tendances."""
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    last_week_start = (today - timedelta(days=today.weekday() + 7)).strftime("%Y-%m-%d")

    # Récupérer les signaux de cette semaine
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/signal_tracking?week_start=eq.{week_start}&select=id,term,mention_count",
        headers=HEADERS,
    )
    if resp.status_code != 200:
        return
    this_week = {s["term"]: s for s in resp.json()}

    # Récupérer les signaux de la semaine dernière
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/signal_tracking?week_start=eq.{last_week_start}&select=term,mention_count",
        headers=HEADERS,
    )
    last_week = {s["term"]: s["mention_count"] for s in (resp.json() if resp.status_code == 200 else [])}

    # Comparer
    for term, signal in this_week.items():
        prev_count = last_week.get(term, 0)
        curr_count = signal["mention_count"]

        if prev_count == 0:
            trend = "new"
        elif curr_count > prev_count * 1.5:
            trend = "rising"
        elif curr_count < prev_count * 0.5:
            trend = "declining"
        else:
            trend = "stable"

        requests.patch(
            f"{SUPABASE_URL}/rest/v1/signal_tracking?id=eq.{signal['id']}",
            headers=HEADERS,
            json={"trend": trend},
        )


# ─── STEP 6 : SAVE ARTICLES TO SUPABASE ──────────────────────────────────────

def save_to_supabase(articles):
    rows = [{
        "source":         a["source"],
        "title":          a["title"],
        "url":            a["link"],
        "summary":        a["summary"],
        "date_published": a["date_iso"],
        "section":        a["section"],
        "tags":           [a["section"]],
        "fetch_date":     datetime.now().strftime("%Y-%m-%d"),
    } for a in articles]

    if not rows:
        return

    # Insérer par batch de 50 pour éviter les timeouts
    batch_size = 50
    total_saved = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/articles",
            headers=HEADERS,
            json=batch,
        )
        if resp.status_code in (200, 201):
            total_saved += len(batch)
        else:
            print(f"   [WARN] Supabase batch {i//batch_size + 1}: {resp.status_code} {resp.text[:200]}")

    print(f"   → {total_saved}/{len(rows)} articles sauvegardés en DB")


# ─── STEP 7 : GENERATE BRIEF ─────────────────────────────────────────────────

def generate_brief(articles, web_results):
    articles_text = "\n\n".join([
        f"[{a['source']} | {a['section']}] {a['title']} ({a['date']})\n{a['summary'][:300]}\nURL: {a['link']}"
        for a in articles[:80]  # Limiter pour rester dans le context
    ])

    web_text = "\n\n".join([
        f"[WEB SEARCH] {r['query']}\n{r['result'][:500]}"
        for r in web_results
    ])

    today = datetime.now().strftime("%A %d %B %Y")

    prompt = f"""Tu es un expert senior en intelligence artificielle. Tu génères le "Brief du jour" d'un cockpit IA personnel pour un manager en transformation digitale, utilisateur intensif d'IA générative, qui s'intéresse à tous les secteurs d'application de l'IA (tech, santé, énergie, industrie, finance, SaaS, services, etc.).

Date : {today} | {len(articles)} articles analysés + {len(web_results)} recherches web.

ARTICLES RSS :
{articles_text}

RECHERCHES WEB TEMPS RÉEL :
{web_text}

Génère UNIQUEMENT du HTML valide (pas de balises html/head/body, pas de markdown).

Structure exacte :

<div class="macro-block">
<p class="macro-text">ANALYSE MACRO 4-5 phrases : tendances de fond du jour, signal faible important, ce que ça dit du marché IA. Mentionne les secteurs d'application concrets quand pertinent (santé, énergie, industrie, finance, retail, etc.).</p>
</div>

<div class="user-block">
<div class="user-title">Ce qui change pour toi aujourd'hui</div>
<ul class="user-list">
<li>Item concret sur un nouveau modèle/outil/capability</li>
<li>Item sur productivité et workflow IA avancé</li>
<li>Item prompt engineering tip ou agent insight</li>
<li>Item sur ce qu'un manager en transformation digitale doit surveiller</li>
</ul>
</div>

<div class="top5-label">Top 5 incontournables du jour</div>

[Répète 5 fois ce bloc pour les 5 news les plus importantes :]
<div class="top-card">
<div class="top-meta"><span class="src-badge">SOURCE</span><span class="top-date">DATE</span></div>
<a href="URL_EXACTE" class="top-link" target="_blank">TITRE DE L'ARTICLE</a>
<p class="top-desc">Résumé analytique 2-3 phrases : quoi, pourquoi c'est important, impact concret.</p>
<span class="top-section">SECTION</span>
</div>

RÈGLES :
- Utilise UNIQUEMENT des URLs tirées des articles fournis (pas d'URLs inventées)
- Pour src-badge : utilise le nom exact de la source
- Pour top-section : utilise un des tags (updates, llm, agents, finserv, tools, biz, reg, papers, energy)
- Sois analytique et factuel, pas promotionnel
- Si tu détectes un signal faible (terme nouveau qui revient 3+ fois), mentionne-le explicitement
"""

    try:
        response = call_gemini(
            prompt,
            pipeline="main.py",
            step="brief_generation",
            model_name="gemini-2.5-flash-lite",
        )
        return response.text if response.text else "<p>Brief non généré.</p>"
    except Exception as e:
        print(f"   [ERROR] Brief generation: {e}")
        return f"<p>Erreur de génération : {str(e)[:200]}</p>"


def save_brief(brief_html, article_count):
    today_key = datetime.now().strftime("%Y-%m-%d")
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/daily_briefs",
        headers=HEADERS_UPSERT,
        json={
            "date": today_key,
            "brief_html": brief_html,
            "article_count": article_count,
        },
    )
    if resp.status_code not in (200, 201):
        print(f"   [WARN] Brief save: {resp.status_code} {resp.text[:200]}")
    else:
        print("   → Brief sauvegardé ✓")


# ─── STEP 8 : EMAIL NOTIFICATION ─────────────────────────────────────────────

def send_notification_email(article_count, concept_count, signal_count):
    today = datetime.now().strftime("%d/%m/%Y")
    subject = f"🧠 AI Cockpit — {article_count} articles | {today}"

    html = f"""<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:0 auto;padding:20px">
<div style="text-align:center;padding:32px 20px">
  <div style="font-size:32px;margin-bottom:12px">🧠</div>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 8px">AI Cockpit — {today}</h1>
  <p style="color:#666;font-size:14px;margin:0 0 24px">
    {article_count} articles · {concept_count} concepts détectés · {signal_count} signaux trackés
  </p>
  <a href="{SITE_URL}" target="_blank"
     style="display:inline-block;background:#7c6fea;color:white;text-decoration:none;
            padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
    Ouvrir le cockpit →
  </a>
</div>
</body></html>"""

    plain = f"AI Cockpit du {today} : {article_count} articles, {concept_count} concepts. {SITE_URL}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"AI Cockpit <{GMAIL_ADDRESS}>"
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PWD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())
    print("   → Email envoyé ✓")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🧠 AI COCKPIT — Daily Pipeline")
    print("=" * 60)

    print("\n🏓 Step 1/9 — Ping Supabase (anti-pause)...")
    ping_supabase()

    print("\n📡 Step 2/9 — Fetching RSS feeds...")
    articles = fetch_recent_articles()
    if not articles:
        print("[WARN] Aucun article RSS. Abandon.")
        return

    print("\n🌐 Step 3/9 — Recherches web temps réel...")
    web_results = web_search_ai_news()

    print("\n🚂 Step 4/9 — Recherche articles RTE...")
    rte_count = search_rte_articles()

    print("\n🔍 Step 5/9 — Extraction de concepts...")
    concept_mentions = extract_concepts(articles)
    concept_count = save_concepts_to_wiki(concept_mentions)
    print(f"   → {concept_count} concepts traités ({len(concept_mentions)} détectés)")

    print("\n📊 Step 6/9 — Tracking signaux faibles...")
    signal_count = track_signals(concept_mentions)
    update_signal_trends()
    print(f"   → {signal_count} signaux trackés")

    print("\n💾 Step 7/9 — Sauvegarde articles en base...")
    save_to_supabase(articles)

    print("\n🧠 Step 8/9 — Génération du brief...")
    brief_html = generate_brief(articles, web_results)
    save_brief(brief_html, len(articles))

    print("\n📧 Step 9/9 — Envoi email...")
    send_notification_email(len(articles), concept_count, signal_count)

    print("\n" + "=" * 60)
    print(f"✅ Pipeline terminé — {len(articles)} articles, {concept_count} concepts, {signal_count} signaux")
    print("=" * 60)


if __name__ == "__main__":
    main()
