-- Migration 012 — Catalogue écosystème Claude
--
-- Catalogue stable et évolutif des outils qui se pluggent à Claude (inbound)
-- ou auquel Claude se plugge (outbound). Distinct de claude_veille (qui est
-- la veille hebdomadaire éphémère) : ici on garde un répertoire pérenne, on
-- bump last_seen quand la routine catalogue revoit l'item, et on archive
-- doucement quand l'item disparaît des sources sur 2 runs consécutifs.
--
-- Sécurité :
--   - INSERT, UPDATE, DELETE pour authenticated (le user peut ajouter une
--     intégration manuellement et éditer ses notes/status)
--   - SELECT pour authenticated
--   - La routine Cowork écrit via service_role (UPSERT massif)
--
-- Le slug est l'identifiant stable de dédup. Convention : kebab-case,
-- préfixé par type ou vendor (mcp-supabase, anthropic-sdk-python,
-- evals-skills-hamel, langchain-claude, etc.). Le UNIQUE INDEX permet
-- ON CONFLICT (slug) DO UPDATE côté routine, garanti pas de doublon.

CREATE TABLE IF NOT EXISTS public.claude_ecosystem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL
    CHECK (direction IN ('inbound', 'outbound', 'both')),
  type TEXT NOT NULL
    CHECK (type IN (
      'mcp_server',
      'skill',
      'cowork_plugin',
      'ide_integration',
      'framework',
      'connector',
      'sdk',
      'agent_runtime',
      'other'
    )),
  vendor TEXT,
  source_url TEXT,
  description TEXT NOT NULL,
  applicability TEXT,
  install_hint TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  added_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_seen DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dismissed', 'archived')),
  user_priority TEXT
    CHECK (user_priority IN ('high', 'medium', 'low')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  user_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_direction ON public.claude_ecosystem(direction);
CREATE INDEX IF NOT EXISTS idx_ce_type ON public.claude_ecosystem(type);
CREATE INDEX IF NOT EXISTS idx_ce_status ON public.claude_ecosystem(status);
CREATE INDEX IF NOT EXISTS idx_ce_pinned ON public.claude_ecosystem(is_pinned) WHERE is_pinned = TRUE;

-- Trigger : updated_at auto-bump
CREATE OR REPLACE FUNCTION public.claude_ecosystem_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claude_ecosystem_updated_at ON public.claude_ecosystem;
CREATE TRIGGER trg_claude_ecosystem_updated_at
  BEFORE UPDATE ON public.claude_ecosystem
  FOR EACH ROW EXECUTE FUNCTION public.claude_ecosystem_touch_updated_at();

-- RLS
ALTER TABLE public.claude_ecosystem ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.claude_ecosystem'::regclass AND polname = 'ce_select_authenticated'
  ) THEN
    CREATE POLICY ce_select_authenticated ON public.claude_ecosystem
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.claude_ecosystem'::regclass AND polname = 'ce_insert_authenticated'
  ) THEN
    CREATE POLICY ce_insert_authenticated ON public.claude_ecosystem
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.claude_ecosystem'::regclass AND polname = 'ce_update_authenticated'
  ) THEN
    CREATE POLICY ce_update_authenticated ON public.claude_ecosystem
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- SEED — ~12 entrées de référence (les plus stables, hautement vérifiables)
-- ON CONFLICT (slug) DO NOTHING : idempotent à la ré-exécution.
-- La routine catalogue Cowork bumpera last_seen et enrichira par la suite.
-- ════════════════════════════════════════════════════════════════════════

-- INBOUND — ce qui se plugge dans Claude (MCP servers, skills) ───────────
INSERT INTO public.claude_ecosystem (slug, name, direction, type, vendor, source_url, description, applicability, install_hint, tags, last_seen)
VALUES
  ('mcp-supabase', 'MCP Supabase', 'inbound', 'mcp_server', 'Supabase',
   'https://github.com/supabase-community/supabase-mcp',
   'Serveur MCP officiel Supabase : expose les opérations de base (list_tables, execute_sql, apply_migration, get_logs) à Claude. Utilisé en direct dans le projet Jarvis Cockpit pour les migrations Supabase.',
   'Déjà branché dans cette session Cowork — sert pour toutes les modifs schéma claude_veille / claude_ecosystem.',
   'Add via Cowork connectors (Supabase). Token PAT requis.',
   ARRAY['database','supabase','migration','sql'],
   CURRENT_DATE),

  ('mcp-github', 'MCP GitHub', 'inbound', 'mcp_server', 'GitHub / Anthropic',
   'https://github.com/github/github-mcp-server',
   'Serveur MCP officiel GitHub : issues, PRs, repos, code search, gh actions. Permet à Claude d''agir sur tes repos sans CLI gh manuelle.',
   'Utile pour automatiser le workflow PR du projet Jarvis Cockpit (PR auto, review).',
   'Add via Cowork connectors (GitHub). Auth GitHub OAuth.',
   ARRAY['github','vcs','pr','issues'],
   CURRENT_DATE),

  ('mcp-filesystem', 'MCP Filesystem (reference)', 'inbound', 'mcp_server', 'Anthropic',
   'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
   'Serveur MCP de référence : accès lecture/écriture filesystem. Souvent inclus par défaut, sert de modèle pour écrire ses propres MCP.',
   'Référence pédagogique pour comprendre la structure MCP avant d''écrire un serveur custom Jarvis.',
   'npm exec @modelcontextprotocol/server-filesystem /chemin/cible',
   ARRAY['mcp','reference','filesystem'],
   CURRENT_DATE),

  ('mcp-postgres', 'MCP Postgres', 'inbound', 'mcp_server', 'Anthropic',
   'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
   'Serveur MCP officiel Postgres : connexion read-only à une base Postgres, expose schéma + execute_query. Alternative générique au MCP Supabase pour des bases Postgres hors Supabase.',
   'Pas directement utile au projet (on a déjà le MCP Supabase) mais bon repère si tu attaques un Postgres externe en mission RTE.',
   'npm exec @modelcontextprotocol/server-postgres "postgresql://..."',
   ARRAY['database','postgres','sql'],
   CURRENT_DATE),

  ('skill-pdf', 'Skill PDF (Anthropic)', 'inbound', 'skill', 'Anthropic',
   'https://github.com/anthropics/skills',
   'Skill officiel Anthropic pour lire, extraire, fusionner, splitter, OCR, et créer des PDF. Déclenché automatiquement quand Claude voit un .pdf ou doit en produire un.',
   'Disponible dans cette session Cowork, utilisable dès que tu manipules un PDF (ex : extraction d''un appel d''offres).',
   'Inclus dans le pack anthropic-skills (déjà chargé).',
   ARRAY['document','pdf','ocr'],
   CURRENT_DATE),

  ('skill-office', 'Skills Office (DOCX, XLSX, PPTX)', 'inbound', 'skill', 'Anthropic',
   'https://github.com/anthropics/skills',
   'Trois skills Anthropic regroupés : DOCX (Word), XLSX (Excel/CSV), PPTX (PowerPoint). Création, lecture, édition, find-and-replace, manipulation de templates et tracked changes.',
   'Très pertinent pour la mission RTE : générer des memos, slides MH, analyses Excel à partir de Jira/Confluence.',
   'Inclus dans le pack anthropic-skills.',
   ARRAY['document','office','word','excel','powerpoint'],
   CURRENT_DATE),

  ('evals-skills-hamel', 'evals-skills (Hamel Husain)', 'inbound', 'skill', 'Hamel Husain',
   'https://github.com/hamelsmu/evals-skills',
   'Plugin Claude Code open source : 6 skills d''évaluation LLM (error-analysis, generate-synthetic-data, write-judge-prompt, run-evals, etc.). Pratique pour structurer les évaluations de Jarvis local vs Claude cloud.',
   'À tester pour benchmarker objectivement la qualité du LLM local Qwen3.5 9B vs Claude Haiku/Sonnet sur les tâches Jarvis.',
   'Clone le repo + install via Claude Code plugin command.',
   ARRAY['eval','testing','quality','benchmark'],
   CURRENT_DATE)
ON CONFLICT (slug) DO NOTHING;

-- OUTBOUND — ce qui utilise Claude (SDK, IDE, frameworks) ────────────────
INSERT INTO public.claude_ecosystem (slug, name, direction, type, vendor, source_url, description, applicability, install_hint, tags, last_seen)
VALUES
  ('anthropic-sdk-python', 'Anthropic SDK Python', 'outbound', 'sdk', 'Anthropic',
   'https://github.com/anthropics/anthropic-sdk-python',
   'SDK officiel Python pour appeler l''API Claude. Support prompt caching, batch, streaming, tool use, vision, citations, files, extended thinking.',
   'Utilisé indirectement par weekly_analysis.py via le client REST. À adopter si on passe Jarvis cloud à un vrai client SDK plutôt que requests directs.',
   'pip install anthropic',
   ARRAY['sdk','python','api'],
   CURRENT_DATE),

  ('anthropic-sdk-typescript', 'Anthropic SDK TypeScript', 'outbound', 'sdk', 'Anthropic',
   'https://github.com/anthropics/anthropic-sdk-typescript',
   'SDK officiel TS/JS pour l''API Claude. Mêmes features que le Python (caching, batch, streaming, tools, vision).',
   'À considérer si on déploie un microservice front Node qui appelle Claude (peu probable côté cockpit, plus pertinent pour une éventuelle app mobile).',
   'npm install @anthropic-ai/sdk',
   ARRAY['sdk','typescript','javascript','api'],
   CURRENT_DATE),

  ('claude-agent-sdk-python', 'Claude Agent SDK (Python)', 'outbound', 'agent_runtime', 'Anthropic',
   'https://github.com/anthropics/claude-agent-sdk-python',
   'SDK pour construire des agents Claude custom : orchestration tool use, file access, code execution. Au-dessus du SDK standard, focalisé agentic.',
   'À évaluer pour réécrire jarvis/server.py en mode agent SDK : orchestration plus propre, support natif des hooks et tool use.',
   'pip install claude-agent-sdk',
   ARRAY['agent','sdk','python','orchestration'],
   CURRENT_DATE),

  ('claude-code-vscode', 'Claude Code (VS Code)', 'outbound', 'ide_integration', 'Anthropic',
   'https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code',
   'Extension VS Code officielle pour Claude Code : chat dans l''éditeur, edits inline, file watch, permission modes, hooks.',
   'Pratique pour itérer sur le cockpit JSX directement depuis VS Code sans switcher vers le terminal.',
   'Install depuis le Marketplace VS Code.',
   ARRAY['ide','vscode','editor'],
   CURRENT_DATE),

  ('langchain-claude', 'LangChain × Claude', 'outbound', 'framework', 'LangChain',
   'https://python.langchain.com/docs/integrations/chat/anthropic/',
   'Intégration officielle Claude dans LangChain : ChatAnthropic, support tool use, structured output, streaming. Utile si on construit un agent multi-LLM avec routage.',
   'Pas d''usage direct dans le projet aujourd''hui, mais à connaître si on multiplie les backends LLM (déjà le cas avec LM Studio + Claude cloud).',
   'pip install langchain-anthropic',
   ARRAY['framework','langchain','agent','rag'],
   CURRENT_DATE),

  ('aider-cli', 'Aider (CLI agent)', 'outbound', 'agent_runtime', 'Aider',
   'https://aider.chat',
   'CLI open source qui édite ton repo en autonomie via Claude (ou autre LLM). Diff propre, commit auto, repo map intelligent. Concurrent direct de Claude Code mais plus minimaliste et BYOK.',
   'À tester comme alternative légère à Claude Code pour des sessions courtes ou des automatisations CI.',
   'pip install aider-chat ; aider --model sonnet ./repo',
   ARRAY['cli','agent','vcs','automation'],
   CURRENT_DATE)
ON CONFLICT (slug) DO NOTHING;
