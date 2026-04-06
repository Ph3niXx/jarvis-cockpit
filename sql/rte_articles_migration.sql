-- RTE Articles: articles concrets trouvés via recherche web pour la RTE Toolbox
-- Alimenté quotidiennement par main.py via Gemini grounding

CREATE TABLE IF NOT EXISTS rte_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    topic TEXT NOT NULL,
    tool_label TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    snippet TEXT,
    source_name TEXT,
    fetch_date DATE DEFAULT CURRENT_DATE,
    search_query TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(url)
);

-- RLS: lecture publique, insertion publique (via publishable key)
ALTER TABLE rte_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rte_articles_select" ON rte_articles FOR SELECT USING (true);
CREATE POLICY "rte_articles_insert" ON rte_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "rte_articles_delete" ON rte_articles FOR DELETE USING (true);
