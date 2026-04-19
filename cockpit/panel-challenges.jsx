// Panel Challenges — Salle d'examen Jarvis
// Deux modes : Théorie (quiz à choix) et Pratique (exercices évalués)
// États : hub (liste) → quiz/exercise (passage) → résultat
const { useState: useStateChal, useMemo: useMemoChal, useEffect: useEffectChal } = React;

function PanelChallenges({ data, onNavigate }) {
  const c = window.CHALLENGES_DATA;
  const [mode, setMode] = useStateChal("theory"); // "theory" | "practice"
  const [filter, setFilter] = useStateChal("open"); // "open" | "recommended" | "all" | "done"
  const [active, setActive] = useStateChal(null); // challenge in progress
  const [completed, setCompleted] = useStateChal(null); // challenge just completed

  const list = mode === "theory" ? c.theory : c.practice;
  const filtered = useMemoChal(() => {
    if (filter === "all") return list;
    if (filter === "recommended") return list.filter(x => x.status === "recommended" || x.status === "open");
    return list.filter(x => x.status === filter);
  }, [list, filter]);

  const recommended = list.filter(x => x.status === "recommended");
  const openCount = list.filter(x => x.status === "open" || x.status === "recommended").length;
  const doneCount = list.filter(x => x.status === "done").length;

  // ─── Flow states ───────────────────
  if (active && mode === "theory") {
    return <TheoryQuiz challenge={active} onBack={() => setActive(null)} onComplete={(r) => { setActive(null); setCompleted(r); }} />;
  }
  if (active && mode === "practice") {
    return <PracticeExercise challenge={active} onBack={() => setActive(null)} onComplete={(r) => { setActive(null); setCompleted(r); }} />;
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
    // Simule l'évaluation Jarvis (2.5s)
    await new Promise(r => setTimeout(r, 2500));
    // Pseudo-score basé sur la longueur et présence de mots-clés
    const wordCount = answer.trim().split(/\s+/).length;
    const hasStructure = /\n\n|\n-|\n\d\./.test(answer);
    const baseScore = Math.min(95, 50 + Math.floor(wordCount / 4) + (hasStructure ? 15 : 0));
    const scores = {
      axis1: Math.min(100, baseScore + Math.floor(Math.random() * 10 - 5)),
      axis2: Math.min(100, baseScore + Math.floor(Math.random() * 12 - 6)),
      axis3: Math.min(100, baseScore + Math.floor(Math.random() * 10 - 5)),
      axis4: Math.min(100, baseScore + Math.floor(Math.random() * 12 - 6)),
    };
    const avg = Math.round((scores.axis1 + scores.axis2 + scores.axis3 + scores.axis4) / 4);
    setEvaluation({ score: avg, scores, wordCount });
    setEvaluating(false);
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
