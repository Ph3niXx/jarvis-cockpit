import os
import smtplib
import feedparser
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import google.generativeai as genai

GEMINI_API_KEY  = os.environ["GEMINI_API_KEY"]
GMAIL_ADDRESS   = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PWD   = os.environ["GMAIL_APP_PASSWORD"]
RECIPIENT_EMAIL = os.environ["RECIPIENT_EMAIL"]

RSS_FEEDS = [
    ("Anthropic",              "https://www.anthropic.com/rss.xml"),
    ("OpenAI",                 "https://openai.com/blog/rss.xml"),
    ("Google DeepMind",        "https://deepmind.google/blog/rss.xml"),
    ("Google AI",              "https://blog.google/technology/ai/rss/"),
    ("Meta AI",                "https://ai.meta.com/blog/feed/"),
    ("Mistral AI",             "https://mistral.ai/news/feed.xml"),
    ("HuggingFace",            "https://huggingface.co/blog/feed.xml"),
    ("LangChain",              "https://blog.langchain.dev/rss/"),
    ("LlamaIndex",             "https://medium.com/feed/llamaindex"),
    ("Finextra AI",            "https://www.finextra.com/rss/channel.aspx?channel=ai"),
    ("The Financial Brand",    "https://thefinancialbrand.com/feed/"),
    ("Insurance TL",           "https://www.insurancethoughtleadership.com/feed"),
    ("Towards Data Science",   "https://towardsdatascience.com/feed"),
    ("The Gradient",           "https://thegradient.pub/rss/"),
    ("Weaviate",               "https://weaviate.io/blog/feed.xml"),
    ("VentureBeat AI",         "https://venturebeat.com/category/ai/feed/"),
    ("TechCrunch AI",          "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("MIT Tech Review",        "https://www.technologyreview.com/feed/"),
    ("AI Snake Oil",           "https://www.aisnakeoil.com/feed"),
    ("Future of Life",         "https://futureoflife.org/feed/"),
    ("The Batch",              "https://www.deeplearning.ai/the-batch/feed/"),
    ("Arxiv CS.AI",            "https://rss.arxiv.org/rss/cs.AI"),
    ("Arxiv CS.LG",            "https://rss.arxiv.org/rss/cs.LG"),
]

MAX_ARTICLES_PER_FEED = 4
LOOKBACK_HOURS = 24

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
                link    = entry.get("link", "#")
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
            print(f"[WARN] {source_name}: {e}")
    print(f"   → {len(articles)} articles récupérés")
    return articles

def generate_digest(articles):
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    articles_text = "\n\n".join([
        f"[{a['source']}] {a['title']} ({a['date']})\n{a['summary']}\nURL: {a['link']}"
        for a in articles
    ])
    today = datetime.now().strftime("%A %d %B %Y")

    prompt = f"""Tu es un expert senior en intelligence artificielle. Tu génères une newsletter quotidienne exhaustive pour Jean, Manager transformation digitale dans les services financiers (banque/assurance), utilisateur quotidien intensif d'IA générative (raisonnement, création, productivité).

Date : {today} | {len(articles)} articles analysés.

ARTICLES SOURCE :
{articles_text}

---
INSTRUCTIONS STRICTES :
- Réponds UNIQUEMENT avec du HTML valide (pas de balises html/head/body, pas de markdown, pas de backticks)
- TOUS les titres d'articles doivent être des liens <a href="URL_EXACTE_DE_L_ARTICLE"> cliquables
- Sois exhaustif : classe TOUS les articles dans leur section
- Chaque résumé = valeur analytique réelle, impact concret pour un manager FS
- Si une section est vide, omets-la entièrement

STRUCTURE HTML À PRODUIRE (respecte exactement ces IDs et classes) :

<!-- SECTION BRIEF -->
<section id="s-brief">
<div class="macro-block">
<p class="macro-text">ANALYSE MACRO EN 4-5 PHRASES : tendances de fond du jour, signal faible important, ce que ça dit du marché IA globalement.</p>
</div>
<div class="user-block">
<div class="user-title">Ce qui change pour toi aujourd'hui</div>
<ul class="user-list">
<li>ITEM concret sur un nouveau modèle/outil/capability qui impacte ton usage quotidien d'IA générative</li>
<li>ITEM sur productivité/raisonnement/création avec l'IA</li>
<li>ITEM sur un prompt engineering tip ou workflow IA avancé issu des news</li>
<li>ITEM sur ce qu'un manager FS doit surveiller cette semaine</li>
</ul>
</div>
<div class="top5-title">Top 5 incontournables</div>
[5 fois ce bloc :]
<div class="top-card">
<div class="top-meta"><span class="src-badge">SOURCE</span><span class="top-date">DATE</span></div>
<a href="URL" class="top-link">TITRE DE L'ARTICLE</a>
<p class="top-desc">RÉSUMÉ ANALYTIQUE 3-4 phrases avec impact FS.</p>
<span class="tag">TAG</span>
</div>
</section>

<!-- SECTIONS THÉMATIQUES -->
<section id="s-llm">
[Pour chaque article LLM :]
<div class="news-card">
<div class="card-meta"><span class="src-badge">SOURCE</span><span class="card-date">DATE</span></div>
<a href="URL" class="card-title">TITRE</a>
<p class="card-desc">RÉSUMÉ 2-3 phrases.</p>
<span class="tag">TAG</span>
</div>
</section>

<section id="s-agents">[même structure]</section>
<section id="s-finserv">[même structure]</section>
<section id="s-tools">[même structure]</section>
<section id="s-biz">[même structure]</section>
<section id="s-reg">[même structure]</section>
<section id="s-papers">[même structure, titres = liens arxiv]</section>

Tags possibles : LLM | Agent | RAG | FinTech | InsurTech | MLOps | Régulation | Recherche | Funding | Open Source | Productivité
"""

    response = model.generate_content(prompt)
    return response.text

def build_full_page(digest_html, article_count):
    today_str  = datetime.now().strftime("%A %d %B %Y").capitalize()
    today_short = datetime.now().strftime("%d/%m/%Y")
    now = datetime.now().strftime("%H:%M")

    nav_items = [
        ("s-brief",   "⚡", "Brief du jour"),
        ("s-llm",     "🤖", "LLMs &amp; Modèles"),
        ("s-agents",  "⚙️", "Agents"),
        ("s-finserv", "🏦", "FinServ"),
        ("s-tools",   "🛠️", "Outils Dev"),
        ("s-biz",     "💰", "Business"),
        ("s-reg",     "⚖️", "Régulation"),
        ("s-papers",  "📚", "Arxiv"),
    ]
    nav_html = "\n".join([
        f'<a href="#{sid}" class="nav-link" onclick="activate(this,\'{sid}\')">'
        f'<span class="nav-icon">{icon}</span><span class="nav-label">{label}</span></a>'
        for sid, icon, label in nav_items
    ])

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Digest · {today_short}</title>
<style>
:root {{
  --bg: #0f0f1a;
  --bg2: #1a1a2e;
  --bg3: #22223a;
  --border: #2d2d4e;
  --text: #e0e0f0;
  --muted: #8888aa;
  --accent: #7c6fea;
  --accent-light: #a89ff5;
  --gold: #f0b429;
  --teal: #2dd4a8;
  --sidebar-w: 210px;
  --header-h: 56px;
}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6}}

/* ── LAYOUT ── */
.app{{display:flex;flex-direction:column;height:100vh}}
.header{{height:var(--header-h);background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:16px;flex-shrink:0;position:sticky;top:0;z-index:100}}
.header-logo{{font-size:18px;font-weight:700;color:var(--accent-light);letter-spacing:-0.5px}}
.header-date{{font-size:12px;color:var(--muted);margin-left:auto}}
.header-time{{font-size:11px;color:var(--border);background:var(--bg3);padding:2px 8px;border-radius:20px}}
.body{{display:flex;flex:1;overflow:hidden}}

/* ── SIDEBAR ── */
.sidebar{{width:var(--sidebar-w);flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column}}
.sidebar-stats{{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px}}
.stat{{text-align:center;flex:1}}
.stat-n{{font-size:18px;font-weight:700;color:var(--accent-light)}}
.stat-l{{font-size:10px;color:var(--muted);margin-top:1px}}
.nav{{flex:1;padding:8px 0}}
.nav-link{{display:flex;align-items:center;gap:10px;padding:9px 16px;color:var(--muted);text-decoration:none;font-size:13px;border-left:2px solid transparent;transition:all .15s}}
.nav-link:hover{{background:var(--bg3);color:var(--text)}}
.nav-link.active{{background:var(--bg3);color:var(--accent-light);border-left-color:var(--accent)}}
.nav-icon{{font-size:14px;width:18px;text-align:center;flex-shrink:0}}
.nav-label{{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.sidebar-footer{{padding:12px 16px;border-top:1px solid var(--border);font-size:10px;color:var(--border)}}

/* ── MAIN CONTENT ── */
.main{{flex:1;overflow-y:auto;padding:24px}}
section{{display:none;max-width:760px;margin:0 auto}}
section.active{{display:block}}

/* ── BRIEF ── */
.macro-block{{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:10px;padding:18px 20px;margin-bottom:16px}}
.macro-text{{font-size:13px;color:#ccc;line-height:1.8}}
.user-block{{background:#1a1a35;border:1px solid #3a3a6e;border-radius:10px;padding:18px 20px;margin-bottom:20px}}
.user-title{{font-size:11px;font-weight:600;color:var(--accent-light);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}}
.user-list{{list-style:none;display:flex;flex-direction:column;gap:8px}}
.user-list li{{font-size:13px;color:#c5c5e8;padding:8px 12px;background:rgba(124,111,234,.08);border-radius:6px;border-left:2px solid var(--accent);line-height:1.5}}
.top5-title{{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}}
.top-card{{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px}}
.top-meta{{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}}
.top-link{{display:block;font-size:14px;font-weight:600;color:var(--text);text-decoration:none;margin-bottom:8px;line-height:1.4}}
.top-link:hover{{color:var(--accent-light)}}
.top-desc{{font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:10px}}
.top-date,.card-date{{font-size:11px;color:#555577;margin-left:auto}}

/* ── SECTION HEADER ── */
.section-head{{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}}

/* ── NEWS CARDS ── */
.news-card{{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px}}
.card-meta{{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}}
.card-title{{display:block;font-size:13px;font-weight:600;color:var(--accent-light);text-decoration:none;margin-bottom:6px;line-height:1.4}}
.card-title:hover{{color:#fff;text-decoration:underline}}
.card-desc{{font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:8px}}

/* ── BADGES ── */
.src-badge{{font-size:10px;font-weight:700;color:var(--accent);background:rgba(124,111,234,.15);padding:2px 8px;border-radius:4px;letter-spacing:.5px;text-transform:uppercase}}
.tag{{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:var(--bg3);color:#666688;text-transform:uppercase;letter-spacing:.5px}}

/* ── MOBILE ── */
@media(max-width:640px){{
  :root{{--sidebar-w:100%;--header-h:50px}}
  .body{{flex-direction:column}}
  .sidebar{{width:100%;border-right:none;border-bottom:1px solid var(--border);flex-shrink:0;overflow:hidden}}
  .nav{{display:flex;flex-direction:row;overflow-x:auto;padding:0;-webkit-overflow-scrolling:touch}}
  .nav::-webkit-scrollbar{{display:none}}
  .nav-link{{flex-direction:column;gap:4px;padding:10px 14px;font-size:11px;border-left:none;border-bottom:2px solid transparent;min-width:64px;justify-content:center;align-items:center;text-align:center}}
  .nav-link.active{{border-bottom-color:var(--accent);border-left-color:transparent}}
  .nav-icon{{font-size:16px;width:auto}}
  .sidebar-stats{{display:none}}
  .sidebar-footer{{display:none}}
  .main{{padding:16px}}
  .top-card,.news-card,.macro-block,.user-block{{padding:12px}}
}}
</style>
</head>
<body>
<div class="app">

  <header class="header">
    <div class="header-logo">🤖 AI Digest</div>
    <span style="font-size:13px;color:var(--muted)">{today_str}</span>
    <div class="header-date">
      <span class="header-time">⏰ {now}</span>
    </div>
  </header>

  <div class="body">
    <nav class="sidebar">
      <div class="sidebar-stats">
        <div class="stat"><div class="stat-n">{article_count}</div><div class="stat-l">articles</div></div>
        <div class="stat"><div class="stat-n">23</div><div class="stat-l">sources</div></div>
        <div class="stat"><div class="stat-n">8</div><div class="stat-l">sections</div></div>
      </div>
      <div class="nav">
        {nav_html}
      </div>
      <div class="sidebar-footer">Gemini 2.5 Flash Lite · RSS publics</div>
    </nav>

    <main class="main">

      <section id="s-brief" class="active">
        <div class="section-head">Brief du jour</div>
        {digest_html}
      </section>

      <section id="s-llm"><div class="section-head">LLMs &amp; Modèles</div></section>
      <section id="s-agents"><div class="section-head">Agents &amp; Automatisation</div></section>
      <section id="s-finserv"><div class="section-head">IA dans les Services Financiers &amp; Assurance</div></section>
      <section id="s-tools"><div class="section-head">Outils Dev — RAG · VectorDB · MLOps</div></section>
      <section id="s-biz"><div class="section-head">Business &amp; Funding</div></section>
      <section id="s-reg"><div class="section-head">Régulation &amp; Éthique</div></section>
      <section id="s-papers"><div class="section-head">Papers Arxiv notables</div></section>

    </main>
  </div>
</div>

<script>
// Inject Gemini sections into correct section tags
const raw = document.getElementById('s-brief');
const html = raw.innerHTML;

// Extract each section from Gemini output and move to correct <section>
const sectionMap = {{
  's-llm': /<section id="s-llm">([\s\S]*?)<\/section>/,
  's-agents': /<section id="s-agents">([\s\S]*?)<\/section>/,
  's-finserv': /<section id="s-finserv">([\s\S]*?)<\/section>/,
  's-tools': /<section id="s-tools">([\s\S]*?)<\/section>/,
  's-biz': /<section id="s-biz">([\s\S]*?)<\/section>/,
  's-reg': /<section id="s-reg">([\s\S]*?)<\/section>/,
  's-papers': /<section id="s-papers">([\s\S]*?)<\/section>/,
}};

// Get full digest from brief section and distribute
const briefSection = document.getElementById('s-brief');
const fullHTML = briefSection.innerHTML;

Object.entries(sectionMap).forEach(([id, regex]) => {{
  const match = fullHTML.match(regex);
  if (match) {{
    const target = document.getElementById(id);
    const header = target.querySelector('.section-head');
    target.innerHTML = (header ? header.outerHTML : '') + match[1];
  }}
}});

// Clean brief section — remove thematic sections from it
const briefContent = fullHTML.replace(/<section id="s-[^"]*">[\s\S]*?<\/section>/g, '');
briefSection.innerHTML = '<div class="section-head">Brief du jour</div>' + briefContent;

// Navigation
function activate(el, sectionId) {{
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
}}

// Set first nav link active
document.querySelector('.nav-link').classList.add('active');
</script>

</body>
</html>"""

def send_email(full_html, article_count):
    today   = datetime.now().strftime("%d/%m/%Y")
    weekday = datetime.now().strftime("%A")
    subject = f"🤖 AI Digest {weekday} {today}"

    plain = "Ouvre ce mail dans un navigateur pour accéder au digest interactif complet."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AI Daily Digest <{GMAIL_ADDRESS}>"
    msg["To"]      = RECIPIENT_EMAIL
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(full_html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PWD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())
    print(f"[OK] Email envoyé à {RECIPIENT_EMAIL}")

def main():
    print("📡 Fetching RSS feeds...")
    articles = fetch_recent_articles()
    if not articles:
        print("[WARN] Aucun article. Abandon.")
        return

    print("🧠 Génération du digest avec Gemini...")
    digest_html = generate_digest(articles)
    print("   → Digest généré ✓")

    print("🏗️  Construction de la page HTML...")
    full_page = build_full_page(digest_html, len(articles))

    print("📧 Envoi de l'email...")
    send_email(full_page, len(articles))
    print("✅ Done!")

if __name__ == "__main__":
    main()
