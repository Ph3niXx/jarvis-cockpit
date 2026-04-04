import os
import smtplib
import feedparser
import requests
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import google.generativeai as genai

GEMINI_API_KEY  = os.environ["GEMINI_API_KEY"]
GMAIL_ADDRESS   = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PWD   = os.environ["GMAIL_APP_PASSWORD"]
RECIPIENT_EMAIL = os.environ["RECIPIENT_EMAIL"]
SUPABASE_URL    = os.environ["SUPABASE_URL"]
SUPABASE_KEY    = os.environ["SUPABASE_KEY"]

SITE_URL = "https://ph3nixx.github.io/-ai-daily-digest"

RSS_FEEDS = [
    # ── LLMs & Modèles ──────────────────────────────────────────────────────
    ("Anthropic",            "https://www.anthropic.com/rss.xml",                          "llm"),
    ("OpenAI",               "https://openai.com/blog/rss.xml",                            "llm"),
    ("Google DeepMind",      "https://deepmind.google/blog/rss.xml",                       "llm"),
    ("Google AI",            "https://blog.google/technology/ai/rss/",                     "llm"),
    ("Meta AI",              "https://ai.meta.com/blog/feed/",                             "llm"),
    ("Mistral AI",           "https://mistral.ai/news/feed.xml",                           "llm"),
    ("HuggingFace",          "https://huggingface.co/blog/feed.xml",                       "llm"),
    ("Cohere",               "https://cohere.com/blog/feed",                               "llm"),
    ("Together AI",          "https://www.together.ai/blog/rss.xml",                       "llm"),
    ("The Batch",            "https://www.deeplearning.ai/the-batch/feed/",                "llm"),
    ("Ahead of AI",          "https://magazine.sebastianraschka.com/feed",                 "llm"),
    ("Import AI",            "https://importai.substack.com/feed",                         "llm"),

    # ── Nouveautés IA Grand Public ───────────────────────────────────────────
    ("The Algorithmic Bridge","https://thealgorithmicbridge.substack.com/feed",            "updates"),
    ("One Useful Thing",     "https://www.oneusefulthing.org/feed",                        "updates"),
    ("Simon Willison",       "https://simonwillison.net/atom/everything/",                 "updates"),
    ("Stratechery",          "https://stratechery.com/feed/",                              "updates"),

    # ── Agents & Automatisation ──────────────────────────────────────────────
    ("LangChain",            "https://blog.langchain.dev/rss/",                            "agents"),
    ("LlamaIndex",           "https://medium.com/feed/llamaindex",                         "agents"),
    ("Langfuse",             "https://langfuse.com/blog/rss",                              "agents"),
    ("Zapier AI",            "https://zapier.com/blog/ai/feed/",                           "agents"),

    # ── IA Finance & Assurance ───────────────────────────────────────────────
    ("Finextra AI",          "https://www.finextra.com/rss/channel.aspx?channel=ai",       "finserv"),
    ("The Financial Brand",  "https://thefinancialbrand.com/feed/",                        "finserv"),
    ("Insurance TL",         "https://www.insurancethoughtleadership.com/feed",            "finserv"),
    ("McKinsey QuantumBlack","https://www.mckinsey.com/capabilities/quantumblack/our-insights/rss","finserv"),

    # ── Outils Dev ───────────────────────────────────────────────────────────
    ("Towards Data Science", "https://towardsdatascience.com/feed",                        "tools"),
    ("The Gradient",         "https://thegradient.pub/rss/",                               "tools"),
    ("Weaviate",             "https://weaviate.io/blog/feed.xml",                          "tools"),
    ("Qdrant",               "https://qdrant.tech/blog/rss.xml",                           "tools"),
    ("MLflow",               "https://mlflow.org/blog/feed.xml",                           "tools"),

    # ── Business & Funding ───────────────────────────────────────────────────
    ("VentureBeat AI",       "https://venturebeat.com/category/ai/feed/",                  "biz"),
    ("TechCrunch AI",        "https://techcrunch.com/category/artificial-intelligence/feed/","biz"),

    # ── Régulation & Éthique ─────────────────────────────────────────────────
    ("MIT Tech Review",      "https://www.technologyreview.com/feed/",                     "reg"),
    ("AI Snake Oil",         "https://www.aisnakeoil.com/feed",                            "reg"),
    ("Future of Life",       "https://futureoflife.org/feed/",                             "reg"),
    ("CNIL",                 "https://www.cnil.fr/fr/rss.xml",                             "reg"),

    # ── Arxiv ────────────────────────────────────────────────────────────────
    ("Arxiv CS.AI",          "https://rss.arxiv.org/rss/cs.AI",                            "papers"),
    ("Arxiv CS.LG",          "https://rss.arxiv.org/rss/cs.LG",                            "papers"),
]

MAX_ARTICLES_PER_FEED = 4
LOOKBACK_HOURS = 24

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal,resolution=ignore-duplicates",
}

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
                if pub and pub < cutoff and "arxiv" not in url:
                    continue
                title   = entry.get("title", "Sans titre").strip()
                link    = entry.get("link", "#")
                summary = entry.get("summary", entry.get("description", ""))[:800]
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
            print(f"[WARN] {source_name}: {e}")
    print(f"   → {len(articles)} articles RSS récupérés")
    return articles

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
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/articles",
        headers=HEADERS,
        json=rows,
    )
    if resp.status_code in (200, 201):
        print(f"   → {len(rows)} articles sauvegardés en DB")
    else:
        print(f"   [WARN] Supabase insert: {resp.status_code} {resp.text[:200]}")
        
def ping_supabase():
    try:
        requests.get(f"{SUPABASE_URL}/rest/v1/articles?limit=1", headers=HEADERS, timeout=10)
        print("   → Supabase pinged (anti-pause)")
    except Exception as e:
        print(f"   [WARN] Ping failed: {e}")

def web_search_ai_news():
    """Recherche web en temps réel via Gemini grounding pour compléter les RSS."""
    print("🌐 Recherche web en temps réel...")
    genai.configure(api_key=GEMINI_API_KEY)

    # Gemini avec Google Search grounding — syntaxe correcte v0.8+
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-lite",
        tools="google_search_retrieval",
    )

    today = datetime.now().strftime("%d %B %Y")
    queries = [
        f"Claude Anthropic nouvelles fonctionnalités mise à jour {today}",
        f"ChatGPT OpenAI nouvelles features annonces {today}",
        f"Gemini Google AI nouvelles capacités {today}",
        f"IA funding levée de fonds startups AI {today}",
        f"AI regulation Europe ACPR BCE intelligence artificielle {today}",
    ]

    web_results = []
    for query in queries:
        try:
            response = model.generate_content(
                f"Recherche les dernières actualités sur : {query}. "
                f"Résume en 3-4 points factuels avec les URLs des sources. "
                f"Sois très concis. Format: bullet points avec [SOURCE] URL"
            )
            if response.text:
                web_results.append({
                    "query": query,
                    "result": response.text[:1000],
                })
                print(f"   → Web search OK: {query[:50]}...")
        except Exception as e:
            # Fallback sans grounding
            try:
                fallback = genai.GenerativeModel("gemini-2.5-flash-lite")
                response = fallback.generate_content(
                    f"Donne les dernières infos que tu connais sur : {query}. "
                    f"3-4 points max, très concis."
                )
                if response.text:
                    web_results.append({
                        "query": query,
                        "result": response.text[:800],
                    })
                    print(f"   → Fallback OK: {query[:50]}...")
            except Exception as e2:
                print(f"   [WARN] Web search failed for '{query[:40]}': {e2}")

    return web_results

def generate_brief(articles, web_results):
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    articles_text = "\n\n".join([
        f"[{a['source']}] [{a['section']}] {a['title']} ({a['date']})\n{a['summary']}\nURL: {a['link']}"
        for a in articles
    ])

    web_text = "\n\n".join([
        f"=== Recherche web: {r['query']} ===\n{r['result']}"
        for r in web_results
    ]) if web_results else "Aucune donnée web disponible."

    today = datetime.now().strftime("%A %d %B %Y")

    prompt = f"""Tu es un expert senior en intelligence artificielle. Tu génères le "Brief du jour" pour Jean, Manager transformation digitale en services financiers, utilisateur intensif quotidien de Claude, ChatGPT et Gemini.

Date : {today}
Articles RSS analysés : {len(articles)}

--- ARTICLES RSS ---
{articles_text}

--- RECHERCHES WEB TEMPS RÉEL ---
{web_text}

---
Génère UNIQUEMENT du HTML valide (pas de html/head/body, pas de markdown, pas de backticks).

Structure exacte :

<div class="macro-block">
<p class="macro-text">ANALYSE MACRO 4-5 phrases : tendances de fond du jour, signal faible important, ce que ça dit du marché IA globalement. Synthétise RSS + recherches web.</p>
</div>

<div class="user-block">
<div class="user-title">Nouveautés IA grand public — Ce qui change pour toi</div>
<ul class="user-list">
<li><strong>Claude / Anthropic :</strong> [nouveauté concrète du jour, cite la source]</li>
<li><strong>ChatGPT / OpenAI :</strong> [nouveauté concrète du jour, cite la source]</li>
<li><strong>Gemini / Google :</strong> [nouveauté concrète du jour, cite la source]</li>
<li><strong>Autres modèles :</strong> [Mistral, Meta, etc. si pertinent]</li>
<li><strong>Workflow & productivité :</strong> tip ou outil concret qui améliore ton usage IA aujourd'hui</li>
<li><strong>À surveiller :</strong> signal important pour un manager FS cette semaine</li>
</ul>
</div>

<div class="top5-label">Top 5 incontournables du jour</div>

<div class="top-card">
<div class="top-meta"><span class="src-badge">SOURCE</span><span class="top-date">DATE</span></div>
<a href="URL_EXACTE" class="top-link" target="_blank">TITRE</a>
<p class="top-desc">Résumé analytique 3-4 phrases avec impact pour un manager FS.</p>
<span class="tag">TAG</span>
</div>
[Répète 4 fois de plus pour 5 cards au total]

Règles :
- Liens = URLs exactes des articles
- Omets les bullets sans info concrète du jour
- Intègre les infos des recherches web dans les bullets et le top 5
- Tags : LLM | Agent | RAG | FinTech | InsurTech | MLOps | Régulation | Funding | Productivité | ChatGPT | Claude | Gemini
"""
    response = model.generate_content(prompt)
    return response.text

def send_notification_email(article_count):
    today   = datetime.now().strftime("%d/%m/%Y")
    weekday = datetime.now().strftime("%A")
    subject = f"🤖 AI Digest {weekday} {today} — {article_count} articles"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#0f0f1a;color:#e0e0f0;margin:0;padding:40px 20px">
<div style="max-width:520px;margin:0 auto">
  <div style="background:#1a1a2e;border:1px solid #2d2d4e;border-radius:12px;padding:32px;text-align:center">
    <div style="font-size:40px;margin-bottom:16px">🤖</div>
    <h1 style="font-size:22px;font-weight:700;color:#a89ff5;margin:0 0 8px">AI Digest du {today}</h1>
    <p style="color:#8888aa;font-size:14px;margin:0 0 6px">{article_count} articles · {len(RSS_FEEDS)} sources RSS · recherche web temps réel</p>
    <p style="color:#555577;font-size:12px;margin:0 0 24px">LLMs · Agents · Nouveautés grand public · FinServ · Régulation</p>
    <a href="{SITE_URL}" target="_blank"
       style="display:inline-block;background:#7c6fea;color:white;text-decoration:none;
              padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
      Lire le digest →
    </a>
  </div>
</div>
</body></html>"""

    plain = f"Ton AI Digest du {today} est prêt : {SITE_URL}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AI Daily Digest <{GMAIL_ADDRESS}>"
    msg["To"]      = RECIPIENT_EMAIL
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PWD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())
    print(f"[OK] Email envoyé")

def main():
    print("🏓 Ping Supabase (anti-pause)...")
    ping_supabase()

    print("📡 Fetching RSS feeds...")
    articles = fetch_recent_articles()
    if not articles:
        print("[WARN] Aucun article RSS. Abandon.")
        return

    print("💾 Sauvegarde en base Supabase...")
    save_to_supabase(articles)

    print("🌐 Recherches web temps réel...")
    web_results = web_search_ai_news()
    print(f"   → {len(web_results)} recherches web complétées")

    print("🧠 Génération du brief avec Gemini...")
    brief_html = generate_brief(articles, web_results)
    print("   → Brief généré ✓")

    today_key = datetime.now().strftime("%Y-%m-%d")
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/daily_briefs",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json={"date": today_key, "brief_html": brief_html, "article_count": len(articles)},
    )
    if resp.status_code not in (200, 201):
        print(f"   [WARN] Brief save: {resp.status_code}")

    print("📧 Envoi email...")
    send_notification_email(len(articles))
    print("✅ Done!")

if __name__ == "__main__":
    main()
