// ═══════════════════════════════════════════════════════════════
// FORME_DATA — Withings (poids, composition) + Strava (run + muscu)
// ─────────────────────────────────────────────
// Séries journalières sur 180 jours (30 oct. 2025 → 27 avril 2026)
// générées par une drift physiquement crédible.
// ═══════════════════════════════════════════════════════════════

(function () {
  const TODAY = new Date("2026-04-27");
  const DAYS = 180;

  // ── Withings : poids, masse grasse %, masse musculaire kg ──────
  // Phase 1 (nov → janv) : prise de masse → 78.4 → 81.2 kg, fat 17.8 → 19.1%
  // Phase 2 (fév → avril) : recomp, retour 79.8 kg, fat 16.9%, muscle stable
  function withingsSeries() {
    const rows = [];
    // lbw (masse maigre) approx stable autour de 64 kg ; poids varie
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      const t = i / (DAYS - 1); // 0 → 1

      // poids : bulk puis cut
      let weight;
      if (t < 0.42) {
        // bulk : 78.4 → 81.2
        weight = 78.4 + (81.2 - 78.4) * (t / 0.42);
      } else if (t < 0.55) {
        // plateau court
        weight = 81.2 - 0.3 * ((t - 0.42) / 0.13);
      } else {
        // cut : 80.9 → 79.8
        weight = 80.9 - (80.9 - 79.8) * ((t - 0.55) / 0.45);
      }
      // bruit journalier ±0.4kg
      const noise = Math.sin(i * 1.31) * 0.35 + (Math.random() - 0.5) * 0.3;
      weight += noise;

      // masse grasse % : 17.8 → 19.1 puis → 16.9
      let fatPct;
      if (t < 0.42) fatPct = 17.8 + (19.1 - 17.8) * (t / 0.42);
      else fatPct = 19.1 - (19.1 - 16.9) * ((t - 0.42) / 0.58);
      fatPct += Math.sin(i * 0.87) * 0.2 + (Math.random() - 0.5) * 0.15;

      // masse musculaire kg : ~64 → 67 (bulk puis stable, léger gain)
      let muscle;
      if (t < 0.42) muscle = 64.2 + (66.7 - 64.2) * (t / 0.42);
      else if (t < 0.55) muscle = 66.7;
      else muscle = 66.7 + (67.1 - 66.7) * ((t - 0.55) / 0.45);
      muscle += Math.sin(i * 1.05) * 0.15 + (Math.random() - 0.5) * 0.12;

      // eau % ~55-58
      const water = 57.2 + Math.sin(i * 0.6) * 0.8 + (Math.random() - 0.5) * 0.5;

      rows.push({
        date: d.toISOString().slice(0, 10),
        weight: +weight.toFixed(2),
        fat_pct: +fatPct.toFixed(2),
        muscle_kg: +muscle.toFixed(2),
        water_pct: +water.toFixed(2),
      });
    }
    return rows;
  }

  // ── Strava : séances (course + muscu) ──────────────────────────
  // Pattern : 3-4 runs / sem, 2-3 muscu / sem, 1-2 jours off
  function stravaSeries() {
    const sessions = [];
    const runNames = [
      "Sortie longue fond de vallée",
      "Fractionné 6×800m piste Charléty",
      "Footing récup bois de Vincennes",
      "Tempo 30' seuil",
      "Run matin quais de Seine",
      "Sortie club dimanche",
      "Côtes Ménilmontant",
      "Long run 15k canal de l'Ourcq",
      "Progressif négatif split",
      "Easy run récup",
      "Interval 10×400m",
      "Sortie allure marathon",
    ];
    const muscuNames = [
      "Push · pecs/épaules/triceps",
      "Pull · dos/biceps",
      "Jambes · squat focus",
      "Full body court 45'",
      "Push · force basse reps",
      "Pull · tirages volume",
      "Jambes · deadlift heavy",
      "Épaules + abdos",
      "Upper volume",
      "Lower hypertrophie",
    ];

    for (let i = 0; i < DAYS; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      const dow = d.getDay(); // 0 dim
      const t = i / (DAYS - 1);

      // Fréquence : plus de volume course mars-avril (prépa 10k mai)
      const prepaBoost = t > 0.7 ? 1.2 : 1.0;

      // Plan type hebdo : Lun muscu, Mar run court, Mer muscu, Jeu run tempo,
      // Ven muscu ou off, Sam run long, Dim off ou easy
      let doRun = false, doMuscu = false;
      if (dow === 2 || dow === 4 || dow === 6) doRun = true;
      if (dow === 1 || dow === 3) doMuscu = true;
      if (dow === 5 && Math.random() < 0.45) doMuscu = true;
      if (dow === 0 && Math.random() < 0.3 * prepaBoost) doRun = true;

      // Semaine coupure mi-janv (mal au genou) : enlever runs 2 semaines
      if (i >= 55 && i <= 68) doRun = false;
      // Grippe fin févr : 5 jours off
      if (i >= 108 && i <= 112) { doRun = false; doMuscu = false; }

      if (doRun) {
        let distance, pace, duration;
        if (dow === 6) {
          // long
          distance = 12 + Math.random() * 6 + (prepaBoost > 1 ? 3 : 0);
          pace = 5.15 + Math.random() * 0.3;
        } else if (dow === 4) {
          // tempo / fractionné
          distance = 7 + Math.random() * 3;
          pace = 4.35 + Math.random() * 0.4;
        } else {
          // easy
          distance = 5 + Math.random() * 3;
          pace = 5.25 + Math.random() * 0.35;
        }
        duration = distance * pace; // minutes
        const hr = Math.round(148 + Math.random() * 18 - (dow === 2 ? 8 : 0));
        const elev = Math.round(distance * (15 + Math.random() * 25));
        const name = runNames[Math.floor(Math.random() * runNames.length)];
        sessions.push({
          date: d.toISOString().slice(0, 10),
          type: "run",
          sport_type: "Run",
          name,
          distance_km: +distance.toFixed(2),
          pace_min_km: +pace.toFixed(2),
          duration_min: +duration.toFixed(1),
          hr_avg: hr,
          elev_m: elev,
          calories: Math.round(distance * 65),
          effort: dow === 4 ? "tempo" : dow === 6 ? "long" : "easy",
        });
      }
      if (doMuscu) {
        const sets = 15 + Math.floor(Math.random() * 8);
        const tonnage = Math.round(3800 + Math.random() * 2400 + (t > 0.5 ? 600 : 0));
        const dur = 55 + Math.floor(Math.random() * 30);
        const name = muscuNames[Math.floor(Math.random() * muscuNames.length)];
        sessions.push({
          date: d.toISOString().slice(0, 10),
          type: "workout",
          sport_type: "WeightTraining",
          name,
          sets,
          tonnage_kg: tonnage,
          duration_min: dur,
          distance_km: 0,
          pace_min_km: 0,
          elev_m: 0,
          hr_avg: 110 + Math.floor(Math.random() * 20),
          calories: Math.round(dur * 5.5),
          effort: dur > 75 ? "long" : dur > 45 ? "moyen" : "court",
        });
      }
    }
    return sessions;
  }

  const weight_series = withingsSeries();
  const sessions = stravaSeries();

  // ── KPIs dérivés ───────────────────────────────────────────────
  const today = weight_series[weight_series.length - 1];
  const weekAgo = weight_series[weight_series.length - 8];
  const monthAgo = weight_series[weight_series.length - 31];
  const threeMonthsAgo = weight_series[weight_series.length - 91];

  // Course semaine en cours
  const last7 = sessions.filter((s) => {
    const d = new Date(s.date);
    return (TODAY - d) / 86400000 < 7 && s.type === "run";
  });
  const last7workout = sessions.filter((s) => {
    const d = new Date(s.date);
    return (TODAY - d) / 86400000 < 7 && s.type === "workout";
  });
  const last30run = sessions.filter((s) => {
    const d = new Date(s.date);
    return (TODAY - d) / 86400000 < 30 && s.type === "run";
  });
  const last30workout = sessions.filter((s) => {
    const d = new Date(s.date);
    return (TODAY - d) / 86400000 < 30 && s.type === "workout";
  });

  // Périodes précédentes (30-60j)
  const prev30 = sessions.filter((s) => {
    const d = new Date(s.date);
    const days = (TODAY - d) / 86400000;
    return days >= 30 && days < 60;
  });
  const prev30run = prev30.filter((s) => s.type === "run");
  const prev30workout = prev30.filter((s) => s.type === "workout");
  const km_prev = +prev30run.reduce((a, s) => a + s.distance_km, 0).toFixed(1);
  const km_month = +last30run.reduce((a, s) => a + s.distance_km, 0).toFixed(1);
  const km_week = +last7.reduce((a, s) => a + s.distance_km, 0).toFixed(1);
  const pace_avg_month = +(
    last30run.reduce((a, s) => a + s.pace_min_km, 0) / Math.max(last30run.length, 1)
  ).toFixed(2);
  const workoutMin30 = Math.round(last30workout.reduce((a, s) => a + s.duration_min, 0));
  const workoutMin30Prev = Math.round(prev30workout.reduce((a, s) => a + s.duration_min, 0));
  const workoutMin7 = Math.round(last7workout.reduce((a, s) => a + s.duration_min, 0));
  const workoutCal30 = Math.round(last30workout.reduce((a, s) => a + (s.calories || 0), 0));
  const workoutDaysActive7 = new Set(last7workout.map(s => s.date)).size;
  const sessions_month_count = last30run.length + last30workout.length;

  // Records
  const records = [
    { label: "5 km · meilleur temps", value: "22'48\"", pace: "4:34/km", date: "2026-03-22", ago: "36j" },
    { label: "10 km · meilleur temps", value: "47'12\"", pace: "4:43/km", date: "2026-04-11", ago: "16j" },
    { label: "Plus longue sortie", value: "21.4 km", pace: "5:02/km", date: "2026-04-18", ago: "9j" },
    { label: "Volume hebdo max", value: "58.3 km", date: "2026-04-20", ago: "7j" },
    { label: "Squat · 1RM estimé", value: "140 kg", date: "2026-04-15", ago: "12j" },
    { label: "Deadlift · 1RM estimé", value: "175 kg", date: "2026-03-28", ago: "30j" },
    { label: "Bench · 1RM estimé", value: "102.5 kg", date: "2026-04-09", ago: "18j" },
    { label: "Tonnage séance record", value: "7 240 kg", date: "2026-04-15", ago: "12j" },
  ];

  window.FORME_DATA = {
    today: {
      date: "2026-04-27",
      weight: today.weight,
      weight_delta_week: +(today.weight - weekAgo.weight).toFixed(2),
      weight_delta_month: +(today.weight - monthAgo.weight).toFixed(2),
      weight_delta_3m: +(today.weight - threeMonthsAgo.weight).toFixed(2),
      fat_pct: today.fat_pct,
      fat_delta_month: +(today.fat_pct - monthAgo.fat_pct).toFixed(2),
      muscle_kg: today.muscle_kg,
      muscle_delta_month: +(today.muscle_kg - monthAgo.muscle_kg).toFixed(2),
      water_pct: today.water_pct,
    },
    week: {
      km: km_week,
      runs: last7.length,
      workouts: last7workout.length,
      workout_minutes: workoutMin7,
      sessions: last7.length + last7workout.length,
      days_active: new Set(
        sessions
          .filter((s) => {
            const d = new Date(s.date);
            return (TODAY - d) / 86400000 < 7;
          })
          .map((s) => s.date),
      ).size,
      streak: 38,
      goal_km: 50,
    },
    month: {
      km: km_month,
      runs: last30run.length,
      workouts: last30workout.length,
      sessions: sessions_month_count,
      pace_avg: pace_avg_month,
      workout_minutes: workoutMin30,
      workout_minutes_prev: workoutMin30Prev,
      workout_calories: workoutCal30,
      workout_top_type: "WeightTraining",
      workout_days_active_7: workoutDaysActive7,
      km_prev,
    },
    year: {
      km: Math.round(sessions.filter(s => s.type === "run" && (TODAY - new Date(s.date)) / 86400000 < 365).reduce((a, s) => a + (s.distance_km || 0), 0)),
      runs: sessions.filter(s => s.type === "run" && (TODAY - new Date(s.date)) / 86400000 < 365).length,
    },
    weight_series,
    sessions: sessions.slice().reverse(), // récentes en premier
    run_sessions: sessions.filter(s => s.type === "run").slice().reverse().slice(0, 20),
    workout_sessions: sessions.filter(s => s.type === "workout").slice().reverse().slice(0, 20),
    records,

    // objectifs
    goals: [
      { label: "10 km sous 45'00", target: "45:00", current: "47:12", progress: 0.71, deadline: "juin 2026" },
      { label: "Poids de forme", target: "78.5 kg", current: today.weight.toFixed(1) + " kg", progress: 0.62, deadline: "juin 2026" },
      { label: "Masse grasse sous 16%", target: "16.0%", current: today.fat_pct.toFixed(1) + "%", progress: 0.78, deadline: "été 2026" },
    ],
    _has_weight: true,
    _has_runs: true,
    _has_workouts: true,
  };
})();
