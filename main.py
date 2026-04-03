import os
import smtplib
import feedparser
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import google.generativeai as genai

# ─── CONFIG ───────────────────────────────────────────────────────────────────

GEMINI_API_KEY   = os.environ["GEMINI_API_KEY"]
GMAIL_ADDRESS    = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PWD    = os.environ["GMAIL_APP_PASSWORD"]
RECIPIENT_EMAIL  = os.environ["RECIPIENT_EMAIL"]

RSS_FEEDS = [
    # ── LLMs & Modèles ──────────────────────────────────────────────────────
    ("Anthropic News",           "https://www.anthropic.com/rss.xml"),
    ("OpenAI Blog",              "https://openai.com/blog/rss.xml"),
    ("Google DeepMind Blog",     "https://deepmind.google/blog/rss.xml"),
    ("Google AI Blog",           "https://blog.google/technology/ai/rss/"),
    ("Meta AI Blog",             "https://ai.meta.com/blog/feed/"),
    ("Mistral AI Blog",          "https://mistral.ai/news/feed.xml"),
    ("HuggingFace Blog",         "https://huggingface.co/blog/feed.xml"),

    # ── Agents & Automatisation ──────────────────────────────────────────────
    ("LangChain Blog",           "https://blog.langchain.dev/rss/"),
    ("LlamaIndex Blog",          "https://medium.com/feed/llamaindex"),

    # ── IA Finance & Assurance ───────────────────────────────────────────────
    ("Finextra AI",              "https://www.finextra.com/rss/channel.aspx?channel=ai"),
    ("The Financial Brand",      "https://thefinancialbrand.com/feed/"),
    ("Insurance Thought Leadership", "https://www.insurancethoughtleadership.com/feed"),

    # ── Outils Dev (RAG, VectorDB, MLOps) ───────────────────────────────────
    ("Towards Data Science",     "https://towardsdatascience.com/feed"),
    ("The Gradient",             "https://thegradient.pub/rss/"),
    ("Weaviate Blog",            "https://weaviate.io/blog/feed.xml"),

    # ── Business & Funding ───────────────────────────────────────────────────
    ("VentureBeat AI",           "https://venturebeat.com/category/ai/feed/"),
    ("TechCrunch AI",            "https://techcrunch.com/category/artificial-intelligence/feed/"),

    # ── Régulation & Éthique ─────────────────────────────────────────────────
    ("MIT Technology Review AI", "https://www.technologyreview.com/feed/"),
    ("AI Snake Oil",             "https://www.aisnakeoil.com/feed"),
    ("Future of Life Institute", "https://futureoflife.org/feed/"),

    # ── Recherche ────────────────────────────────────────────────────────────
    ("The Batch (Andrew Ng)",    "https://www.deeplearning.ai/the-batch/feed/"),
    ("Arxiv CS.AI",              "https://rss.arxiv.org/rss/cs.AI"),
    ("Arxiv CS.LG",              "https://rss.arxiv.org/rss/cs.LG"),
]

MAX_ARTICLES_PER_FEED = 4
LOOKBACK_HOURS = 24

# ─── FETCH RSS ────────────────────────────────────────────────────────────────

def fetch_recent_articles():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    articles = []

    for source_name, url in RSS_FEEDS:
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
                link    = entry.get("link", "")
                summary = entry.get("summary", entry.get("description", ""))[:600]
                articles.append({
                    "source":  source_name,
                    "title":   title,
                    "link":    link,
                    "summary": summary,
                    "date":    pub.strftime("%d/%m %H:%M") if pub else "N/A",
                })
                count += 1
        except Exception as e:
            print(f"[WARN] Erreur sur {source_name}: {e}")

    print(f"   → {len(articles)} articles récupérés")
    return articles

# ─── GEMINI SYNTHESIS ─────────────────────────────────────────────────────────

def generate_digest(articles):
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    articles_text = "\n\n".join([
        f"[{a['source']}] {a['title']} ({a['date']})\n{a['summary']}\nURL: {a['link']}"
        for a in articles
    ])

    today = datetime.now().strftime("%A %d %B %Y")

    prompt = f"""Tu es un expert senior en intelligence artificielle. Tu rédiges une newsletter quotidienne exhaustive en français pour Jean, Manager en transformation digitale dans les services financiers (banque/assurance), avec une forte appétence technique et produit.

Date : {today} | Articles analysés : {len(articles)}

ARTICLES :
{articles_text}

---

Génère le contenu HTML de la newsletter. Réponds UNIQUEMENT avec du HTML (pas de balises html/head/body, pas de markdown). Utilise exactement cette structure de blocs :

<div class="section">
<h2>🔥 Top 5 — Les incontournables du jour</h2>
<p class="intro">Les news les plus importantes avec analyse d'impact.</p>
[Pour chaque news top :]
<div class="news-card top">
  <div class="news-meta"><span class="source">SOURCE</span><span class="date">DATE</span></div>
  <h3><a href="URL">TITRE</a></h3>
  <p>Résumé analytique de 3-4 phrases avec impact pour un manager FS.</p>
  <div class="tag">CATÉGORIE</div>
</div>
</div>

<div class="section"><h2>🤖 LLMs & Modèles</h2>[news-cards]</div>
<div class="section"><h2>⚙️ Agents & Automatisation</h2>[news-cards]</div>
<div class="section"><h2>🏦 IA dans les Services Financiers & Assurance</h2>[news-cards]</div>
<div class="section"><h2>🛠️ Outils Dev (RAG, VectorDB, MLOps)</h2>[news-cards]</div>
<div class="section"><h2>💰 Business & Funding</h2>[news-cards]</div>
<div class="section"><h2>⚖️ Régulation & Éthique</h2>[news-cards]</div>

<div class="section insight">
<h2>💡 Insight du jour</h2>
<p>Analyse de fond en 5-6 phrases sur la tendance macro visible dans ces news. Perspective stratégique pour un manager FS.</p>
</div>

<div class="section"><h2>📚 Papers Arxiv notables</h2>[news-cards pour 3-5 papers]</div>

Règles strictes :
- Tous les titres = liens cliquables <a href="URL">
- Sois exhaustif : inclus TOUS les articles pertinents dans leur section
- Chaque résumé doit avoir une vraie valeur analytique
- Omets les sections sans articles
- Tags possibles : LLM | Agent | RAG | FinTech | InsurTech | MLOps | Régulation | Recherche | Funding | Open Source
"""

    response = model.generate_content(prompt)
    return response.text

# ─── HTML EMAIL TEMPLATE ──────────────────────────────────────────────────────

def build_html_email(digest_html):
    today = datetime.now().strftime("%A %d %B %Y").capitalize()
    now   = datetime.now().strftime("%H:%M")

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0f0f1a; color:#e0e0f0; line-height:1.6; }}
  .wrapper {{ max-width:720px; margin:0 auto; background:#0f0f1a; }}
  .header {{ background:linear-gradient(135deg,#1a1a3e 0%,#0d0d2b 50%,#1a0a2e 100%); padding:40px 32px; text-align:center; border-bottom:2px solid #4f46e5; }}
  .header-badge {{ display:inline-block; background:#4f46e5; color:white; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 12px; border-radius:20px; margin-bottom:16px; }}
  .header h1 {{ font-size:28px; font-weight:800; color:white; margin-bottom:6px; }}
  .header h1 span {{ color:#818cf8; }}
  .header-meta {{ font-size:13px; color:#6b7280; margin-top:8px; }}
  .stats-bar {{ background:#1a1a2e; padding:14px 32px; display:flex; gap:24px; border-bottom:1px solid #2d2d4e; flex-wrap:wrap; }}
  .stat {{ font-size:12px; color:#6b7280; }}
  .stat strong {{ color:#818cf8; font-weight:700; }}
  .section {{ padding:28px 32px; border-bottom:1px solid #1e1e3a; }}
  .section h2 {{ font-size:16px; font-weight:700; color:#c4b5fd; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid #2d2d4e; }}
  .intro {{ font-size:13px; color:#6b7280; margin-bottom:16px; font-style:italic; }}
  .news-card {{ background:#1a1a2e; border:1px solid #2d2d4e; border-radius:10px; padding:16px; margin-bottom:12px; }}
  .news-card.top {{ border-left:3px solid #4f46e5; background:#1a1a38; }}
  .news-meta {{ display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; gap:8px; }}
  .source {{ font-size:11px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:1px; background:#2d2d4e; padding:2px 8px; border-radius:4px; }}
  .date {{ font-size:11px; color:#4b5563; white-space:nowrap; }}
  .news-card h3 {{ font-size:14px; font-weight:600; margin-bottom:8px; line-height:1.4; }}
  .news-card h3 a {{ color:#e0e0f0; text-decoration:none; }}
  .news-card h3 a:hover {{ color:#818cf8; }}
  .news-card p {{ font-size:13px; color:#9ca3af; line-height:1.6; margin-bottom:10px; }}
  .tag {{ display:inline-block; font-size:10px; font-weight:700; letter-spacing:1px; padding:2px 8px; border-radius:4px; background:#2d2d4e; color:#6b7280; text-transform:uppercase; }}
  .insight {{ background:linear-gradient(135deg,#1a1a3e,#1a0a2e); }}
  .insight h2 {{ color:#f59e0b; border-bottom-color:#78350f; }}
  .insight p {{ font-size:14px; color:#d1d5db; line-height:1.8; font-style:italic; }}
  .footer {{ background:#0a0a15; padding:24px 32px; text-align:center; }}
  .footer p {{ font-size:11px; color:#374151; }}
  .footer strong {{ color:#4f46e5; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="header-badge">🤖 AI Daily Digest</div>
    <h1>Intelligence <span>Artificielle</span></h1>
    <div class="header-meta">📅 {today} &nbsp;·&nbsp; ⏰ {now}</div>
  </div>
  <div class="stats-bar">
    <div class="stat">📡 <strong>24 sources</strong> surveillées</div>
    <div class="stat">🎯 Focus <strong>LLM · Agents · FinServ · Régulation</strong></div>
    <div class="stat">⚡ Powered by <strong>Gemini 2.5</strong></div>
  </div>
  {digest_html}
  <div class="footer">
    <p>Généré automatiquement · Sources RSS publiques · LLM : <strong>Gemini 2.5 Flash Lite</strong></p>
  </div>
</div>
</body>
</html>"""

# ─── SEND EMAIL ───────────────────────────────────────────────────────────────

def send_email(digest_html):
    today   = datetime.now().strftime("%d/%m/%Y")
    weekday = datetime.now().strftime("%A")
    subject = f"🤖 AI Digest {weekday} {today} — LLMs · Agents · FinServ · Régulation"

    html_body = build_html_email(digest_html)
    plain = "Ouvre ce mail dans un client HTML pour une meilleure expérience."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AI Daily Digest <{GMAIL_ADDRESS}>"
    msg["To"]      = RECIPIENT_EMAIL

    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PWD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())

    print(f"[OK] Email envoyé à {RECIPIENT_EMAIL}")

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("📡 Fetching RSS feeds...")
    articles = fetch_recent_articles()

    if not articles:
        print("[WARN] Aucun article trouvé. Abandon.")
        return

    print("🧠 Génération du digest avec Gemini...")
    digest_html = generate_digest(articles)
    print("   → Digest généré ✓")

    print("📧 Envoi de l'email...")
    send_email(digest_html)
    print("✅ Done!")

if __name__ == "__main__":
    main()
