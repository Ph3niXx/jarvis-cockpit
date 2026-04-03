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
    # Research & Papers
    ("Google DeepMind Blog",    "https://deepmind.google/blog/rss.xml"),
    ("Google AI Blog",          "https://blog.google/technology/ai/rss/"),
    ("HuggingFace Blog",        "https://huggingface.co/blog/feed.xml"),
    ("Anthropic News",          "https://www.anthropic.com/rss.xml"),
    ("OpenAI Blog",             "https://openai.com/blog/rss.xml"),
    # Industry & Actu
    ("MIT Technology Review AI","https://www.technologyreview.com/feed/"),
    ("VentureBeat AI",          "https://venturebeat.com/category/ai/feed/"),
    ("The Batch (Andrew Ng)",   "https://www.deeplearning.ai/the-batch/feed/"),
    # Recherche
    ("Arxiv CS.AI",             "https://rss.arxiv.org/rss/cs.AI"),
    ("Arxiv CS.LG",             "https://rss.arxiv.org/rss/cs.LG"),
]

MAX_ARTICLES_PER_FEED = 5
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

                # Parse date
                pub = None
                for attr in ("published_parsed", "updated_parsed"):
                    val = getattr(entry, attr, None)
                    if val:
                        pub = datetime(*val[:6], tzinfo=timezone.utc)
                        break

                # Skip if too old (skip filter for Arxiv which often misdates)
                if pub and pub < cutoff and "arxiv" not in url:
                    continue

                title   = entry.get("title", "Sans titre").strip()
                link    = entry.get("link", "")
                summary = entry.get("summary", entry.get("description", ""))[:500]

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

    return articles

# ─── GEMINI SYNTHESIS ─────────────────────────────────────────────────────────

def generate_digest(articles: list[dict]) -> str:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")

    articles_text = "\n\n".join([
        f"[{a['source']}] {a['title']} ({a['date']})\n{a['summary']}\nURL: {a['link']}"
        for a in articles
    ])

    today = datetime.now().strftime("%A %d %B %Y")

    prompt = f"""Tu es un expert en intelligence artificielle et tu rédiges une newsletter quotidienne en français pour un manager tech senior.

Date d'aujourd'hui : {today}
Nombre d'articles analysés : {len(articles)}

Voici les articles à synthétiser :

{articles_text}

---

Génère une newsletter structurée ainsi :

## 🤖 AI Daily Digest — {today}

### 🔥 Les 3 points clés du jour
(Les 3 infos les plus importantes, en 2-3 phrases chacune, avec le nom de la source)

### 📚 Par thématique

#### Modèles & Recherche
(Nouveaux modèles, papers notables, benchmarks)

#### Produits & Annonces
(Lancements, mises à jour, partenariats)

#### Business & Industrie
(Financement, acquisitions, régulation)

### 💡 L'insight du jour
(Une réflexion synthétique de 3-4 phrases sur la tendance de fond visible dans ces news)

### 🔗 Liens à ne pas rater
(Liste des 5 articles les plus importants avec leur URL)

---
Sois concis, factuel et pertinent. Évite le sensationnalisme. Inclus toujours la source entre parenthèses.
"""

    response = model.generate_content(prompt)
    return response.text

# ─── SEND EMAIL ───────────────────────────────────────────────────────────────

def send_email(digest: str):
    today = datetime.now().strftime("%d/%m/%Y")
    subject = f"🤖 AI Daily Digest — {today}"

    # Convert markdown-ish text to simple HTML
    html_body = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1a1a2e; line-height: 1.6;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🤖 AI Daily Digest</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">{today}</p>
    </div>
    <div style="background: #f8f9ff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0f0;">
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px;">{digest}</pre>
    </div>
    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        Généré automatiquement avec Gemini Flash • Sources: RSS feeds publics
    </p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = GMAIL_ADDRESS
    msg["To"]      = RECIPIENT_EMAIL

    msg.attach(MIMEText(digest, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PWD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())

    print(f"[OK] Email envoyé à {RECIPIENT_EMAIL}")

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("📡 Fetching RSS feeds...")
    articles = fetch_recent_articles()
    print(f"   → {len(articles)} articles récupérés")

    if not articles:
        print("[WARN] Aucun article trouvé. Abandon.")
        return

    print("🧠 Génération du digest avec Gemini...")
    digest = generate_digest(articles)
    print("   → Digest généré ✓")

    print("📧 Envoi de l'email...")
    send_email(digest)
    print("✅ Done!")

if __name__ == "__main__":
    main()
