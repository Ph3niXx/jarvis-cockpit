-- Jobs Radar — données mock pour tester le panel sans lancer le scan Cowork.
-- Idempotent via ON CONFLICT (linkedin_job_id) DO NOTHING.
-- Usage : psql … -f jarvis/seed/jobs_radar_mock.sql
--         ou via MCP Supabase / dashboard SQL editor.

insert into public.jobs (
  linkedin_job_id, first_seen_date, last_seen_date, title, company, url, posted_date,
  role_category, company_stage, pitch, compensation,
  score_seniority, score_sector, score_impact, score_bonus, score_total,
  rubric_justif, cv_recommended, cv_reason, intel, intel_depth, status, user_notes
) values
  -- Hot lead — deep intel
  ('mock-alan-hop',  current_date, current_date,
   'Head of Product — Plateforme data', 'Alan',
   'https://linkedin.com/jobs/view/alan-head-product', current_date - 1,
   'produit', 'scale',
   'Piloter la plateforme data qui sous-tend l''expérience adhérent. Équipe de 8 PM, rattachement CPO, fort scope tech.',
   '110-140k€ + BSPCE',
   3, 3, 3.2, 1, 9.2,
   '{"seniority":"Head of avec 8 PM sous la main — scope exact que tu vises depuis 6 mois.","sector":"Assurtech scale-up rentable, exactement la maturité qui t''intéresse.","impact":"Plateforme data transverse — levier produit énorme, CPO accessible."}'::jsonb,
   'pdf', 'Boîte design-forward, le PDF mis en forme passe mieux que le docx ATS.',
   '{"signaux_boite":["Levée série E 183M$ en mars 2026","Recrutement accéléré produit : 3 postes PM ouverts","Pivot récent vers les TPE (<10 salariés)"],"lead_identifie":{"name":"Marion Dufresne","title":"CPO","background":"Ex-Doctolib (2019-2023), passée par Back Market. Active sur LinkedIn."},"reseau_warm":[{"degree":"1","name":"Sophie Bénézit","current_title":"Sr PM chez Alan","context":"Ancienne collègue BNP"},{"degree":"2","name":"Thomas Rey","current_title":"Data team","context":"Via Sophie"}],"angle_approche":"Mentionne la pivot TPE et ta lecture du dernier post LinkedIn de Marion. Demande à Sophie un warm intro plutôt qu''une candidature spontanée."}'::jsonb,
   'deep', 'new', ''),

  -- Hot lead — deep intel
  ('mock-qonto-rte', current_date, current_date,
   'Release Train Engineer — Core Banking', 'Qonto',
   'https://linkedin.com/jobs/view/qonto-rte', current_date - 2,
   'rte', 'scale',
   'Piloter un ART de 60 personnes sur les flux de paiement. SAFe 6.0 déployé depuis 18 mois, train mature.',
   '95-115k€',
   3, 2.6, 3, 0, 8.6,
   '{"seniority":"RTE sur un ART mature — tu as déjà fait ça à la BNP, scope comparable.","sector":"Fintech B2B, proche de ton domaine actuel.","impact":"60 personnes, flux paiement — cœur métier, forte visibilité COMEX."}'::jsonb,
   'pdf', 'Recrutement tech-first — PDF avec focus SAFe et métriques.',
   '{"signaux_boite":["Levée 552M€ en 2022 — profitabilité visée 2026","Restructuration produit mars 2026 : 3 ARTs devenus 5","RTE sortant a rejoint Swile"],"lead_identifie":{"name":"Julien Aubert","title":"VP Engineering","background":"Ex-Criteo, sur le sujet SAFe depuis 4 ans."},"maturite_safe":"Mature (SAFe 6.0, 18 mois de train)","reseau_warm":[{"degree":"2","name":"Paul Marchand","current_title":"Engineering Manager chez Qonto","context":"Via LinkedIn"}],"angle_approche":"Référence la restructuration 3→5 ARTs comme hook : ''je vois que vous scalez le modèle''."}'::jsonb,
   'deep', 'new', ''),

  -- Hot lead — light intel (pour tester le bouton Enrichir l'Intel disabled)
  ('mock-mistral-spm', current_date, current_date,
   'Senior Product Manager — AI Agents', 'Mistral AI',
   'https://linkedin.com/jobs/view/mistral-spm-agents', current_date - 1,
   'produit', 'C',
   'Définir la product vision sur le volet agents de la plateforme Le Chat Enterprise.',
   '100-130k€ + equity',
   2.6, 3, 3.2, 1, 7.8,
   '{"seniority":"Senior PM, pas Head of — un cran en-dessous.","sector":"IA générative, scale-up française leader.","impact":"Agents = LE sujet 2026, post-IPO possible 2027."}'::jsonb,
   'pdf', 'Profil tech-product — PDF qui met en avant tes projets IA.',
   '{"signaux_boite":["Série C 600M€ bouclée décembre 2025","Bureau tech à Station F (40 postes)"],"lead_identifie":{"name":"Clara Vinson","title":"VP Product"}}'::jsonb,
   'light', 'new', ''),

  -- Mid — to_apply avec notes
  ('mock-doctolib-pgm', current_date - 2, current_date,
   'Program Manager — Plateforme IA', 'Doctolib',
   'https://linkedin.com/jobs/view/doctolib-pgm-ia', current_date - 4,
   'pgm', 'scale',
   'Piloter le programme IA santé (4 squads). Rattachement VP Engineering.',
   '100-120k€',
   2.6, 2.4, 1.8, 0, 6.8,
   '{"seniority":"PgM avec 4 squads — dans ta zone de séniorité.","sector":"HealthTech scale-up française — intéressant.","impact":"Programme naissant, beaucoup à structurer — levier fort mais risque politique."}'::jsonb,
   'pdf', 'Doctolib est design-sensible, PDF valorise mieux.',
   null, 'none', 'to_apply',
   'Entretien jeudi 14h — Sophie me prépare un brief sur la politique interne.'),

  -- Applied (relance auto-suggérée)
  ('mock-aircall-lpm', current_date - 14, current_date,
   'Lead Product Manager — Fintech B2B', 'Aircall',
   'https://linkedin.com/jobs/view/aircall-lpm-b2b', current_date - 14,
   'produit', 'C',
   'Lead PM sur le produit entreprise (>500 seats). Équipe de 3 PM.',
   '85-110k€',
   2.4, 2, 1.8, 0, 6.2,
   '{"seniority":"Lead PM — un peu sous ta cible.","sector":"SaaS télécom B2B.","impact":"Segment entreprise = marge forte, cycle lent."}'::jsonb,
   'docx', 'Process ATS standard.',
   null, 'none', 'applied',
   'Postulé le 08/04 — pas de retour. À relancer.'),

  -- Low score
  ('mock-carrefour-pm', current_date, current_date,
   'Product Manager', 'Carrefour',
   'https://linkedin.com/jobs/view/carrefour-pm', current_date - 1,
   'produit', 'grand_groupe',
   'PM sur le volet fidélité mobile.',
   '60-75k€',
   1.2, 1, 1.2, 0, 3.4,
   '{"seniority":"PM mid-level — très sous ta cible.","sector":"Retail grand groupe — out of scope.","impact":"Scope fidélité mobile, impact limité."}'::jsonb,
   'docx', 'SIRH interne.',
   null, 'none', 'new', ''),

  -- Archived (pour tester l''état greyed)
  ('mock-bnp-rte', current_date - 5, current_date,
   'Release Train Engineer', 'BNP Paribas',
   'https://linkedin.com/jobs/view/bnp-rte-bddf', current_date - 2,
   'rte', 'grand_groupe',
   'Piloter un ART de 80 personnes sur la banque de détail France.',
   '85-105k€',
   2.8, 1.8, 1.6, 0, 6.2,
   '{"seniority":"Scope RTE mature — tu connais.","sector":"Ton employeur actuel — pas un vrai move.","impact":"ART périmètre BDDF — cadre rigide."}'::jsonb,
   'docx', 'Process groupe, DOCX requis.',
   null, 'none', 'archived', '')
on conflict (linkedin_job_id) do nothing;

-- Un scan du jour
insert into public.job_scans (scan_date, raw_count, dedup_strict_count, processed_count, hot_leads_count, tendances, signal_cv, actions)
values (
  current_date, 142, 64, 28, 3,
  '{"volume_today":28,"volume_avg_7d":22,"hot_leads_today":3,"hot_leads_avg_7d":2,"ratio_produit_vs_delivery":{"produit":42,"rte_pgm_pjm":52},"boites_actives_7d":[{"company":"Alan","offres_count":3},{"company":"Qonto","offres_count":2}]}'::jsonb,
  '{"pdf_pct":64,"docx_pct":36,"window_days":30,"insight":"Les 10 dernières hot leads ont toutes recommandé le PDF — garde la version design à jour."}'::jsonb,
  '[{"id":"a1","kind":"apply","label":"Relancer Aircall — candidaté il y a 12 jours, pas de réponse","cta":"Relancer"},{"id":"a2","kind":"prep","label":"Préparer l''entretien Doctolib — jeudi 14h","cta":"Ouvrir le dossier"}]'::jsonb
)
on conflict (scan_date) do nothing;
