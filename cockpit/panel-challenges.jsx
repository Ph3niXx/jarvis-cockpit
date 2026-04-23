// Panel Challenges — Salle d'examen Jarvis
// Deux modes : Théorie (quiz à choix) et Pratique (exercices évalués)
// États : hub (liste) → quiz/exercise (passage) → résultat
const { useState: useStateChal, useMemo: useMemoChal, useEffect: useEffectChal } = React;

// ─────────────────────────────────────────────────────────
// Jarvis client (évaluation pratique)
// ─────────────────────────────────────────────────────────
function jarvisGatewayCandidatesChal(){
  const list = [];
  const isHTTPS = typeof location !== "undefined" && location.protocol === "https:";
  let tunnel = null;
  try { tunnel = window.PROFILE_DATA?._values?.jarvis_tunnel_url || null; } catch {}
  if (!isHTTPS) list.push("http://localhost:8765");
  if (tunnel)   list.push(String(tunnel).replace(/\/+$/, ""));
  if (isHTTPS)  list.push("http://localhost:8765"); // visible mixed-content failure
  return list;
}

async function callJarvisEvaluate(ch, answer){
  const body = {
    challenge_id: /^[0-9a-f-]{36}$/i.test(ch.id || "") ? ch.id : null,
    title: ch.title || "",
    brief: ch.brief || "",
    constraints: Array.isArray(ch.constraints) ? ch.constraints : [],
    eval_criteria: ch.eval_criteria || "",
    answer,
  };
  const candidates = jarvisGatewayCandidatesChal();
  let lastErr = null;
  for (const base of candidates) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 120000);
      const r = await fetch(base + "/evaluate-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok) { lastErr = new Error("HTTP " + r.status); continue; }
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Jarvis injoignable");
}

async function persistChallengeAttempt(ch, result){
  if (!window.sb || !window.SUPABASE_URL) return null;
  const payload = {
    challenge_ref: ch.id,
    challenge_source: ch.id && /^[0-9a-f-]{36}$/i.test(ch.id) ? "db" : "fake",
    mode: result.mode,
    axis: ch.axis || null,
    title: ch.title || null,
    difficulty: ch.difficulty || null,
    score_percent: Math.max(0, Math.min(100, Math.round(Number(result.score || 0)))),
    xp_earned: result.score >= 70 ? Math.round(Number(ch.xp || 0) * (result.score / 100)) : 0,
    answers: result.mode === "theory"
      ? { answers: result.answers, correct: result.correctCount, total: result.total }
      : { answer: result.answer, evaluation: result.evaluation },
  };
  const url = `${window.SUPABASE_URL}/rest/v1/challenge_attempts`;
  try {
    const rows = await window.sb.postJSON(url, payload);
    try { window.track && window.track("challenge_completed", { ref: ch.id, mode: result.mode, score: payload.score_percent }); } catch {}
    return Array.isArray(rows) && rows[0] ? rows[0] : { ...payload, completed_at: new Date().toISOString() };
  } catch (e) {
    console.error("[challenges] persist failed", e);
    return null;
  }
}

// Bump skill_radar.score on the targeted axis si c'est la 1ère fois que
// l'utilisateur passe ce challenge à ≥70%. Retries après succès = pas de double bump.
async function bumpSkillRadar(ch, score, priorAttempts){
  if (!ch || !ch.axis || !window.sb || !window.SUPABASE_URL) return null;
  if (Number(score) < 70) return null;
  const alreadyPassed = (priorAttempts || []).some(a =>
    a.challenge_ref === ch.id && Number(a.score_percent || 0) >= 70
  );
  if (alreadyPassed) return null;

  const base = `${window.SUPABASE_URL}/rest/v1/skill_radar`;
  try {
    // Read current row (score + history)
    const rows = await window.sb.fetchJSON(`${base}?axis=eq.${encodeURIComponent(ch.axis)}&select=id,score,history&limit=1`);
    if (!rows || !rows[0]) return null;
    const row = rows[0];
    const reward = Number(ch.score_reward || 0.5);
    const newScore = Math.min(5, Number(row.score || 0) + reward);
    let history = row.history;
    if (typeof history === "string") { try { history = JSON.parse(history); } catch { history = []; } }
    if (!Array.isArray(history)) history = [];
    history = [...history, {
      date: new Date().toISOString().slice(0, 10),
      score: newScore,
      reason: `challenge "${ch.title || ch.id}" (+${reward})`,
    }];

    const r = await window.sb.patchJSON(`${base}?id=eq.${row.id}`, {
      score: newScore,
      history,
      last_assessed: new Date().toISOString().slice(0, 10),
    });
    if (!r.ok) throw new Error("patch " + r.status);
    try { window.track && window.track("skill_radar_bumped", { axis: ch.axis, reward, new_score: newScore }); } catch {}

    // Mise à jour optimiste du radar côté front pour re-render immédiat
    const appr = window.APPRENTISSAGE_DATA;
    if (appr && appr.radar && Array.isArray(appr.radar.axes)) {
      const ax = appr.radar.axes.find(a => (a.axis || a.id) === ch.axis);
      if (ax) {
        const displayScore = Math.round(newScore * 20); // 0-5 → 0-100
        ax.score = displayScore;
        ax.gap = displayScore < 50;
      }
    }
    return { newScore, reward };
  } catch (e) {
    console.error("[challenges] skill_radar bump failed", e);
    return null;
  }
}

function PanelChallenges({ data, onNavigate }) {
  const c = window.CHALLENGES_DATA;
  const [mode, setMode] = useStateChal("theory"); // "theory" | "practice"
  const [filter, setFilter] = useStateChal("open"); // "open" | "recommended" | "all" | "done"
  const [active, setActive] = useStateChal(null); // challenge in progress
  const [completed, setCompleted] = useStateChal(null); // challenge just completed
  const [axisFilter, setAxisFilter] = useStateChal(null); // axis id prefilled from radar
  // Bump to force re-render after applyAttemptsToChallenges mutates CHALLENGES_DATA.
  const [revision, setRevision] = useStateChal(0);

  // Consume axis prefill stashed by panel-radar's "Défi cet axe" CTA.
  // The prefill is single-use — cleared after consumption.
  useEffectChal(() => {
    try {
      const axis = localStorage.getItem("challenges-prefill-axis");
      if (axis) {
        localStorage.removeItem("challenges-prefill-axis");
        setAxisFilter(axis);
      }
    } catch {}
  }, []);

  const recordAttempt = async (result) => {
    const priorAttempts = c._attempts || [];
    const saved = await persistChallengeAttempt(result.challenge, result);
    const attempt = saved || {
      challenge_ref: result.challenge.id,
      score_percent: Math.round(result.score || 0),
      xp_earned: result.score >= 70 ? Math.round(Number(result.challenge.xp || 0) * (result.score / 100)) : 0,
      completed_at: new Date().toISOString(),
      mode: result.mode,
      axis: result.challenge.axis,
    };
    const dl = window.cockpitDataLoader;
    if (dl && dl.applyAttemptsToChallenges) {
      c._attempts = [attempt, ...priorAttempts];
      dl.applyAttemptsToChallenges(c, c._attempts);
      setRevision(r => r + 1);
    }
    // Bump du radar sur 1er succès ≥70% (best-effort, non-bloquant)
    bumpSkillRadar(result.challenge, result.score, priorAttempts).then(bump => {
      if (bump) setRevision(r => r + 1);
    });
    setCompleted(result);
  };

  const list = mode === "theory" ? c.theory : c.practice;
  const filtered = useMemoChal(() => {
    let l = list;
    if (axisFilter) l = l.filter(x => x.axis === axisFilter);
    if (filter === "all") return l;
    if (filter === "recommended") return l.filter(x => x.status === "recommended" || x.status === "open");
    return l.filter(x => x.status === filter);
  }, [list, filter, axisFilter]);

  const recommended = list.filter(x => x.status === "recommended");
  const openCount = list.filter(x => x.status === "open" || x.status === "recommended").length;
  const doneCount = list.filter(x => x.status === "done").length;

  // ─── Flow states ───────────────────
  if (active && mode === "theory") {
    return <TheoryQuiz challenge={active} onBack={() => setActive(null)} onComplete={(r) => { setActive(null); recordAttempt(r); }} />;
  }
  if (active && mode === "practice") {
    return <PracticeExercise challenge={active} onBack={() => setActive(null)} onComplete={(r) => { setActive(null); recordAttempt(r); }} />;
  }
  if (completed) {
    return <ResultScreen result={completed} onBack={() => setCompleted(null)} onRetry={() => { setActive(completed.challenge); setCompleted(null); }} />;
  }

  // ─── HUB ───────────────────────────
  return (
    <div className="panel-page" data-screen-label="Challenges">
      {/* Hero */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Apprentissage · Challenges · Salle d'examen</div>
        <h1 className="panel-hero-title">
          Ce que tu <em className="serif-italic">sais vraiment</em>,<br/>
          Jarvis va te le demander.
        </h1>
        <p className="panel-hero-sub">
          Pas de case à cocher, pas de tâche à confirmer. Tu te lances, tu réponds, Jarvis juge. Deux modes : <strong>théorie</strong> pour tester tes connaissances, <strong>pratique</strong> pour construire quelque chose et le faire évaluer.
        </p>
      </div>

      {/* Stats bar */}
      <div className="chal-stats">
        <div className="chal-stat">
          <div className="chal-stat-val">{c.stats.total_taken}</div>
          <div className="chal-stat-lbl">Challenges passés</div>
        </div>
        <div className="chal-stat">
          <div className="chal-stat-val">{c.stats.avg_score}<span className="chal-stat-unit">%</span></div>
          <div className="chal-stat-lbl">Score moyen</div>
        </div>
        <div className="chal-stat">
          <div className="chal-stat-val">{c.stats.total_xp}</div>
          <div className="chal-stat-lbl">XP accumulés</div>
        </div>
        <div className="chal-stat chal-stat--streak">
          <div className="chal-stat-val">{c.streak.current}<span className="chal-stat-unit">j</span></div>
          <div className="chal-stat-lbl">Streak · record {c.streak.best}j</div>
        </div>
        <div className="chal-stat chal-stat--weak">
          <div className="chal-stat-lbl chal-stat-lbl--top">Axe à travailler</div>
          <div className="chal-stat-axis">Fine-tuning</div>
          <div className="chal-stat-axis-sub">38/100 · challenges ciblés dispo</div>
        </div>
      </div>

      {/* Mode switcher — big tabs */}
      <div className="chal-modes">
        <button className={`chal-mode ${mode === "theory" ? "is-active" : ""}`} onClick={() => { setMode("theory"); setFilter("open"); }}>
          <div className="chal-mode-icon"><Icon name="book" size={20} stroke={1.5} /></div>
          <div className="chal-mode-body">
            <div className="chal-mode-kicker">Mode théorie</div>
            <h3 className="chal-mode-title">Quiz à choix multiples</h3>
            <p className="chal-mode-desc">Questions pointues sur un concept. 3 à 7 minutes. Tu réponds, Jarvis explique tes erreurs.</p>
            <div className="chal-mode-meta">{c.theory.length} challenges · {c.theory.filter(x => x.status !== "done").length} à faire</div>
          </div>
        </button>
        <button className={`chal-mode ${mode === "practice" ? "is-active" : ""}`} onClick={() => { setMode("practice"); setFilter("open"); }}>
          <div className="chal-mode-icon"><Icon name="target" size={20} stroke={1.5} /></div>
          <div className="chal-mode-body">
            <div className="chal-mode-kicker">Mode pratique</div>
            <h3 className="chal-mode-title">Exercices concrets, évalués</h3>
            <p className="chal-mode-desc">Tu construis quelque chose — un prompt, une archi, un dataset. Jarvis évalue la sortie sur des critères précis.</p>
            <div className="chal-mode-meta">{c.practice.length} challenges · {c.practice.filter(x => x.status !== "done").length} à faire</div>
          </div>
        </button>
      </div>

      {/* Recommended banner */}
      {recommended.length > 0 && (
        <div className="chal-reco-banner">
          <div className="chal-reco-banner-kicker">Recommandé cette semaine</div>
          <h3 className="chal-reco-banner-title">
            <em className="serif-italic">Jarvis te suggère</em> {recommended.length} challenge{recommended.length > 1 ? "s" : ""} pour bouger ton radar
          </h3>
          <div className="chal-reco-banner-items">
            {recommended.slice(0, 2).map(r => (
              <button key={r.id} className="chal-reco-banner-item" onClick={() => setActive(r)}>
                <div className="chal-reco-banner-item-axis">{r.axis_label}</div>
                <div className="chal-reco-banner-item-title">{r.title}</div>
                <div className="chal-reco-banner-item-meta">
                  {r.duration_min} min · {r.xp} XP · <strong>{r.impact_axis}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="panel-toolbar">
        <span className="panel-toolbar-label">Statut</span>
        <div className="panel-toolbar-group">
          <button className={`pill ${filter === "open" ? "is-active" : ""}`} onClick={() => setFilter("open")}>
            Ouverts ({openCount})
          </button>
          <button className={`pill ${filter === "recommended" ? "is-active" : ""}`} onClick={() => setFilter("recommended")}>
            Recommandés ({recommended.length})
          </button>
          <button className={`pill ${filter === "done" ? "is-active" : ""}`} onClick={() => setFilter("done")}>
            Réussis ({doneCount})
          </button>
          <button className={`pill ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>
            Tout ({list.length})
          </button>
        </div>
      </div>

      {/* Cards list */}
      <div className="chal-cards">
        {filtered.map(ch => (
          <ChallengeCard key={ch.id} challenge={ch} mode={mode} onStart={() => setActive(ch)} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Challenge Card
// ─────────────────────────────────────────────────────────
function ChallengeCard({ challenge: ch, mode, onStart }) {
  const diffClass = ch.difficulty === "Expert" ? "is-expert" : ch.difficulty === "Moyen" ? "is-med" : "is-easy";
  const isDone = ch.status === "done";
  const isReco = ch.status === "recommended";

  return (
    <article className={`chal-card ${isDone ? "is-done" : ""} ${isReco ? "is-reco" : ""}`}>
      <header className="chal-card-head">
        <div className="chal-card-axis">{ch.axis_label}</div>
        {isReco && <span className="chal-card-badge chal-card-badge--reco">Recommandé</span>}
        {isDone && <span className="chal-card-badge chal-card-badge--done">Réussi · {ch.score}%</span>}
      </header>

      <h3 className="chal-card-title">{ch.title}</h3>
      <p className="chal-card-teaser">{ch.teaser || ch.brief}</p>

      <div className="chal-card-meta">
        <span className={`chal-diff ${diffClass}`}>
          <span className="chal-diff-dots">
            <span className={`chal-diff-dot ${ch.difficulty !== "Facile" ? "is-filled" : ""}`} />
            <span className={`chal-diff-dot ${ch.difficulty === "Moyen" || ch.difficulty === "Expert" ? "is-filled" : ""}`} />
            <span className={`chal-diff-dot ${ch.difficulty === "Expert" ? "is-filled" : ""}`} />
          </span>
          {ch.difficulty}
        </span>
        <span className="chal-meta-sep">·</span>
        <span className="chal-meta-item">
          <Icon name="clock" size={12} stroke={1.75} /> {ch.duration_min} min
        </span>
        <span className="chal-meta-sep">·</span>
        <span className="chal-meta-item chal-meta-xp">+{ch.xp} XP</span>
      </div>

      <footer className="chal-card-foot">
        <span className="chal-card-impact">
          <span className="chal-card-impact-lbl">Impact radar</span>
          <span className="chal-card-impact-val">{ch.impact_axis}</span>
        </span>
        {isDone ? (
          <button className="btn btn--ghost btn--sm" onClick={onStart}>Revoir</button>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={onStart}>
            {mode === "theory" ? "Commencer" : "Se lancer"} <Icon name="arrow_right" size={12} stroke={2} />
          </button>
        )}
      </footer>
    </article>
  );
}

// ─────────────────────────────────────────────────────────
// Theory Quiz — flow de passage
// ─────────────────────────────────────────────────────────
function TheoryQuiz({ challenge: ch, onBack, onComplete }) {
  const questions = ch.questions || [];
  const [idx, setIdx] = useStateChal(0);
  const [answers, setAnswers] = useStateChal([]); // [{chosen, correct}]
  const [chosen, setChosen] = useStateChal(null);
  const [submitted, setSubmitted] = useStateChal(false);

  // Fallback si pas de questions dans les données
  if (questions.length === 0) {
    return (
      <div className="panel-page" data-screen-label="Challenge — non dispo">
        <div className="chal-empty">
          <div className="section-kicker">Challenge</div>
          <h2 className="chal-empty-title">Ce challenge est en cours d'écriture</h2>
          <p className="chal-empty-body">Jarvis prépare les questions. Reviens bientôt.</p>
          <button className="btn btn--ghost" onClick={onBack}>← Retour aux challenges</button>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const q = questions[idx];

  const handleSubmit = () => {
    if (chosen === null) return;
    setSubmitted(true);
  };

  const handleNext = () => {
    const newAnswers = [...answers, { chosen, correct: chosen === q.correct }];
    setAnswers(newAnswers);
    setChosen(null);
    setSubmitted(false);
    if (idx + 1 >= total) {
      const correctCount = newAnswers.filter(a => a.correct).length;
      const score = Math.round((correctCount / total) * 100);
      onComplete({ challenge: ch, score, correctCount, total, mode: "theory", answers: newAnswers });
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="panel-page panel-page--quiz" data-screen-label="Quiz théorie">
      {/* Top bar */}
      <div className="quiz-topbar">
        <button className="quiz-topbar-back" onClick={onBack}>
          <Icon name="arrow_left" size={14} stroke={2} /> Quitter
        </button>
        <div className="quiz-topbar-title">
          <span className="quiz-topbar-axis">{ch.axis_label}</span>
          <span className="quiz-topbar-sep">·</span>
          <span className="quiz-topbar-name">{ch.title}</span>
        </div>
        <div className="quiz-topbar-progress">
          Question {idx + 1} / {total}
        </div>
      </div>

      {/* Progress dots */}
      <div className="quiz-dots">
        {questions.map((_, i) => (
          <span key={i} className={`quiz-dot ${i < idx ? "is-past" : ""} ${i === idx ? "is-current" : ""} ${i < answers.length && answers[i].correct ? "is-correct" : ""} ${i < answers.length && !answers[i].correct ? "is-wrong" : ""}`} />
        ))}
      </div>

      {/* Question */}
      <div className="quiz-question">
        <div className="section-kicker">Question {idx + 1}</div>
        <h2 className="quiz-question-text">{q.q}</h2>

        <div className="quiz-options">
          {q.options.map((opt, i) => {
            const isChosen = chosen === i;
            const isCorrect = submitted && i === q.correct;
            const isWrong = submitted && isChosen && i !== q.correct;
            return (
              <button
                key={i}
                className={`quiz-opt ${isChosen ? "is-chosen" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${submitted ? "is-locked" : ""}`}
                onClick={() => !submitted && setChosen(i)}
                disabled={submitted}
              >
                <span className="quiz-opt-letter">{String.fromCharCode(65 + i)}</span>
                <span className="quiz-opt-text">{opt}</span>
                {submitted && isCorrect && <Icon name="check" size={16} stroke={2} />}
                {submitted && isWrong && <span className="quiz-opt-cross">×</span>}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {submitted && (
          <div className={`quiz-feedback ${chosen === q.correct ? "is-correct" : "is-wrong"}`}>
            <div className="quiz-feedback-head">
              {chosen === q.correct ? "Correct" : "Pas tout à fait"}
            </div>
            <p className="quiz-feedback-body">{q.explain}</p>
          </div>
        )}

        {/* CTA */}
        <div className="quiz-cta">
          {!submitted ? (
            <button className="btn btn--primary btn--lg" onClick={handleSubmit} disabled={chosen === null}>
              Valider ma réponse
            </button>
          ) : (
            <button className="btn btn--primary btn--lg" onClick={handleNext}>
              {idx + 1 >= total ? "Voir le résultat" : "Question suivante"} <Icon name="arrow_right" size={14} stroke={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Practice Exercise — flow
// ─────────────────────────────────────────────────────────
function PracticeExercise({ challenge: ch, onBack, onComplete }) {
  const [answer, setAnswer] = useStateChal("");
  const [submitted, setSubmitted] = useStateChal(false);
  const [evaluating, setEvaluating] = useStateChal(false);
  const [evaluation, setEvaluation] = useStateChal(null);

  const handleSubmit = async () => {
    if (answer.trim().length < 20) return;
    setSubmitted(true);
    setEvaluating(true);
    const wordCount = answer.trim().split(/\s+/).length;
    try {
      const r = await callJarvisEvaluate(ch, answer);
      // r.scores = {clarte, specificite, rigueur, completude}
      const s = r.scores || {};
      setEvaluation({
        score: r.avg ?? 0,
        scores: {
          axis1: s.clarte ?? 0,
          axis2: s.specificite ?? 0,
          axis3: s.rigueur ?? 0,
          axis4: s.completude ?? 0,
        },
        wordCount,
        feedback: r.feedback || "",
        strengths: r.strengths || [],
        improvements: r.improvements || [],
        source: "jarvis",
      });
    } catch (err) {
      console.warn("[challenges] Jarvis eval failed, fallback heuristique", err);
      // Fallback heuristique si Jarvis injoignable (LM Studio off, tunnel down, etc.)
      const hasStructure = /\n\n|\n-|\n\d\./.test(answer);
      const baseScore = Math.min(80, 45 + Math.floor(wordCount / 5) + (hasStructure ? 10 : 0));
      setEvaluation({
        score: baseScore,
        scores: { axis1: baseScore, axis2: baseScore, axis3: baseScore, axis4: baseScore },
        wordCount,
        feedback: "Jarvis est hors ligne — score heuristique basé sur longueur et structure. Relance start_jarvis.bat pour une vraie évaluation.",
        strengths: [],
        improvements: [],
        source: "heuristic",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleDone = () => {
    onComplete({ challenge: ch, score: evaluation.score, mode: "practice", answer, evaluation });
  };

  return (
    <div className="panel-page panel-page--quiz" data-screen-label="Exercice pratique">
      <div className="quiz-topbar">
        <button className="quiz-topbar-back" onClick={onBack}>
          <Icon name="arrow_left" size={14} stroke={2} /> Quitter
        </button>
        <div className="quiz-topbar-title">
          <span className="quiz-topbar-axis">{ch.axis_label}</span>
          <span className="quiz-topbar-sep">·</span>
          <span className="quiz-topbar-name">{ch.title}</span>
        </div>
        <div className="quiz-topbar-progress">
          Mode pratique · {ch.duration_min} min estimées
        </div>
      </div>

      <div className="prac-wrap">
        {/* Left : brief */}
        <aside className="prac-brief">
          <div className="section-kicker">Le brief</div>
          <h2 className="prac-brief-title">{ch.title}</h2>
          <p className="prac-brief-body">{ch.brief}</p>

          <div className="prac-section">
            <h4 className="prac-section-title">Contraintes</h4>
            <ul className="prac-constraints">
              {ch.constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          <div className="prac-section">
            <h4 className="prac-section-title">Comment Jarvis évalue</h4>
            <p className="prac-eval-desc">{ch.eval_criteria}</p>
          </div>

          <div className="prac-reward">
            <div className="prac-reward-xp">+{ch.xp} XP</div>
            <div className="prac-reward-impact">{ch.impact_axis}</div>
          </div>
        </aside>

        {/* Right : editor + submit */}
        <section className="prac-editor">
          {!submitted ? (
            <>
              <div className="prac-editor-head">
                <h3 className="prac-editor-title">Ta réponse</h3>
                <span className="prac-editor-count">{answer.trim().split(/\s+/).filter(Boolean).length} mots</span>
              </div>
              <textarea
                className="prac-textarea"
                placeholder="Écris ta réponse ici. Prends ton temps — tu peux structurer avec des sauts de ligne, des puces, du code."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={18}
              />
              <div className="prac-submit-row">
                <span className="prac-submit-hint">
                  {answer.trim().length < 20 ? "Écris au moins quelques lignes avant de soumettre." : "Prêt à soumettre à Jarvis ?"}
                </span>
                <button className="btn btn--primary btn--lg" onClick={handleSubmit} disabled={answer.trim().length < 20}>
                  Soumettre à Jarvis <Icon name="arrow_right" size={14} stroke={2} />
                </button>
              </div>
            </>
          ) : evaluating ? (
            <div className="prac-evaluating">
              <div className="prac-evaluating-pulse" />
              <div className="section-kicker">Jarvis évalue</div>
              <h3 className="prac-evaluating-title">
                <em className="serif-italic">Analyse</em> en cours
              </h3>
              <ul className="prac-evaluating-steps">
                <li className="is-active">Lecture de ta proposition</li>
                <li className="is-active">Vérification des contraintes</li>
                <li className="is-active">Évaluation sur les 4 axes</li>
                <li>Rédaction du feedback</li>
              </ul>
            </div>
          ) : (
            <div className="prac-result-inline">
              <div className="section-kicker">Évaluation</div>
              <h3 className="prac-result-score">
                <span className="prac-result-score-val">{evaluation.score}</span><span className="prac-result-score-unit">/100</span>
              </h3>
              <div className="prac-result-scores">
                <ScoreBar label="Clarté" value={evaluation.scores.axis1} />
                <ScoreBar label="Spécificité" value={evaluation.scores.axis2} />
                <ScoreBar label="Rigueur" value={evaluation.scores.axis3} />
                <ScoreBar label="Complétude" value={evaluation.scores.axis4} />
              </div>
              <p className="prac-result-note">
                Jarvis a lu tes {evaluation.wordCount} mots. La note détaillée arrive sur l'écran suivant.
              </p>
              <button className="btn btn--primary btn--lg" onClick={handleDone}>
                Voir le feedback complet <Icon name="arrow_right" size={14} stroke={2} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div className="score-bar">
      <div className="score-bar-head">
        <span className="score-bar-lbl">{label}</span>
        <span className="score-bar-val">{value}</span>
      </div>
      <div className="score-bar-track"><span className="score-bar-fill" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Result Screen — après passage
// ─────────────────────────────────────────────────────────
function ResultScreen({ result, onBack, onRetry }) {
  const { challenge: ch, score, mode } = result;
  const passed = score >= 70;
  const excellent = score >= 85;

  return (
    <div className="panel-page panel-page--result" data-screen-label="Résultat challenge">
      <div className="quiz-topbar">
        <button className="quiz-topbar-back" onClick={onBack}>
          <Icon name="arrow_left" size={14} stroke={2} /> Retour aux challenges
        </button>
      </div>

      <div className="result-hero">
        <div className="section-kicker">
          {excellent ? "Très solide" : passed ? "Validé" : "Il reste du travail"}
        </div>
        <h1 className="result-hero-title">
          {excellent && <><em className="serif-italic">Excellent</em> — tu maîtrises.</>}
          {passed && !excellent && <>Challenge <em className="serif-italic">validé</em>.</>}
          {!passed && <>Pas encore <em className="serif-italic">au niveau</em>.</>}
        </h1>
        <div className="result-score">
          <span className="result-score-val">{score}</span>
          <span className="result-score-unit">%</span>
        </div>
        <p className="result-hero-body">
          {excellent && `Tu as ${mode === "theory" ? "répondu correctement à " + result.correctCount + "/" + result.total : "livré une réponse solide sur les 4 axes d'évaluation"}. Jarvis ajoute ce challenge à ta zone maîtrisée.`}
          {passed && !excellent && `Bien — ${mode === "theory" ? result.correctCount + "/" + result.total + " bonnes réponses" : "une réponse correcte sur la majorité des axes"}. Revois les points faibles ci-dessous pour consolider.`}
          {!passed && `${mode === "theory" ? "Moins de 7 bonnes réponses sur " + result.total : "Ta réponse manque de précision sur plusieurs axes"}. Pas grave — Jarvis te propose 2 lectures avant de retenter.`}
        </p>
      </div>

      {/* Feedback Jarvis (pratique uniquement) */}
      {mode === "practice" && result.evaluation && (result.evaluation.feedback || (result.evaluation.strengths || []).length || (result.evaluation.improvements || []).length) && (
        <section className="result-feedback">
          <div className="section-kicker">
            Feedback {result.evaluation.source === "heuristic" ? "heuristique (Jarvis hors ligne)" : "Jarvis"}
          </div>
          {result.evaluation.feedback && (
            <p className="result-feedback-body">{result.evaluation.feedback}</p>
          )}
          <div className="result-feedback-cols">
            {(result.evaluation.strengths || []).length > 0 && (
              <div>
                <h4 className="result-feedback-title">Points forts</h4>
                <ul className="result-feedback-list">
                  {result.evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {(result.evaluation.improvements || []).length > 0 && (
              <div>
                <h4 className="result-feedback-title">À améliorer</h4>
                <ul className="result-feedback-list">
                  {result.evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Breakdown */}
      <div className="result-grid">
        <section className="result-card">
          <div className="section-kicker">Impact radar</div>
          <h3 className="result-card-title">{ch.axis_label} · {ch.impact_axis}</h3>
          <p className="result-card-body">
            Ton axe <strong>{ch.axis_label}</strong> bouge en fonction du score. Tu peux voir le détail sur la page radar.
          </p>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            Voir mon radar <Icon name="arrow_right" size={12} stroke={2} />
          </button>
        </section>

        <section className="result-card">
          <div className="section-kicker">XP gagnés</div>
          <h3 className="result-card-title">+{Math.round(ch.xp * (score / 100))} XP</h3>
          <p className="result-card-body">
            {passed ? `${Math.round(ch.xp * (score / 100))} XP ajoutés à ton compteur (${ch.xp} max pour ce challenge).` : `Score trop bas pour valider les XP. Retente pour débloquer +${ch.xp}.`}
          </p>
        </section>

        <section className="result-card">
          <div className="section-kicker">Prochaines étapes</div>
          <h3 className="result-card-title">
            {passed ? "Jarvis recommande" : "Pour retenter"}
          </h3>
          <ul className="result-next">
            {passed ? (
              <>
                <li>Un challenge pratique lié : <strong>{mode === "theory" ? "Prépare un dataset LoRA" : "Quiz avancé sur le même axe"}</strong></li>
                <li>2 lectures pour pousser le niveau</li>
                <li>Un challenge sur l'axe voisin (éval)</li>
              </>
            ) : (
              <>
                <li>Lecture prioritaire : <strong>LoRA efficace en 90 min — HuggingFace</strong></li>
                <li>Mini quiz de révision (5 min)</li>
                <li>Retenter ce challenge dans 24h</li>
              </>
            )}
          </ul>
        </section>
      </div>

      {/* CTA bar */}
      <div className="result-cta">
        <button className="btn btn--ghost btn--lg" onClick={onBack}>Retour aux challenges</button>
        <button className="btn btn--primary btn--lg" onClick={onRetry}>Retenter ce challenge</button>
      </div>
    </div>
  );
}

window.PanelChallenges = PanelChallenges;
