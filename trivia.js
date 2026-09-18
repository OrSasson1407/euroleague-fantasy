(function () {
  "use strict";

  var TOTAL_QUESTIONS = 25;
  var TIME_LIMIT = 10; // seconds per question, in timed mode
  var TIMEOUT_SENTINEL = "__TIMEOUT__";

  // A static general-knowledge question bank (champions, MVPs, club/player
  // trivia) - unlike the team/season quiz types, these aren't generated from
  // euroleague_data.js. Only the id and correct option letter live here;
  // the question text and all 4 options are resolved through
  // window.I18n.t("trivia.knowledge.<id>.<field>") so they stay fully
  // localized like everything else in the app. Options are shuffled at
  // render time, so their order in the source data doesn't matter.
  var KNOWLEDGE_QUESTIONS = [
    { id: "q1", correct: "B" }, { id: "q2", correct: "A" }, { id: "q3", correct: "A" }, { id: "q4", correct: "D" }, { id: "q5", correct: "B" },
    { id: "q6", correct: "A" }, { id: "q7", correct: "B" }, { id: "q8", correct: "A" }, { id: "q9", correct: "B" }, { id: "q10", correct: "A" },
    { id: "q11", correct: "A" }, { id: "q12", correct: "B" }, { id: "q13", correct: "A" }, { id: "q14", correct: "A" }, { id: "q15", correct: "B" },
    { id: "q16", correct: "A" }, { id: "q17", correct: "A" }, { id: "q18", correct: "B" }, { id: "q19", correct: "A" }, { id: "q20", correct: "B" },
    { id: "q21", correct: "B" }, { id: "q22", correct: "C" }, { id: "q23", correct: "A" }, { id: "q24", correct: "A" }, { id: "q25", correct: "A" },
    { id: "q26", correct: "B" }, { id: "q27", correct: "B" }, { id: "q28", correct: "A" }, { id: "q29", correct: "B" }, { id: "q30", correct: "A" },
    { id: "q31", correct: "C" }, { id: "q32", correct: "A" }, { id: "q33", correct: "C" }, { id: "q34", correct: "A" }, { id: "q35", correct: "B" },
    { id: "q36", correct: "B" }, { id: "q37", correct: "A" }, { id: "q38", correct: "B" }, { id: "q39", correct: "B" }, { id: "q40", correct: "A" },
    { id: "q41", correct: "B" }, { id: "q42", correct: "C" }, { id: "q43", correct: "A" }, { id: "q44", correct: "A" }, { id: "q45", correct: "B" },
    { id: "q46", correct: "A" }, { id: "q47", correct: "B" }, { id: "q48", correct: "A" }, { id: "q49", correct: "C" }, { id: "q50", correct: "B" },
    { id: "q51", correct: "B" }, { id: "q52", correct: "B" }, { id: "q53", correct: "A" }, { id: "q54", correct: "A" }, { id: "q55", correct: "A" },
    { id: "q56", correct: "A" }, { id: "q57", correct: "A" }, { id: "q58", correct: "B" }, { id: "q59", correct: "A" }, { id: "q60", correct: "A" },
    { id: "q61", correct: "A" }, { id: "q62", correct: "A" }, { id: "q63", correct: "A" }, { id: "q64", correct: "A" }, { id: "q65", correct: "A" },
    { id: "q66", correct: "A" }, { id: "q67", correct: "A" }, { id: "q68", correct: "A" }, { id: "q69", correct: "A" }, { id: "q70", correct: "A" },
    { id: "q71", correct: "A" }, { id: "q72", correct: "A" }, { id: "q73", correct: "A" }, { id: "q74", correct: "A" }, { id: "q75", correct: "A" },
    { id: "q76", correct: "A" }, { id: "q77", correct: "A" }, { id: "q78", correct: "A" }, { id: "q79", correct: "A" }, { id: "q80", correct: "A" },
    { id: "q81", correct: "A" }, { id: "q82", correct: "A" }, { id: "q83", correct: "A" }, { id: "q84", correct: "A" }, { id: "q85", correct: "A" },
    { id: "q86", correct: "A" }, { id: "q87", correct: "A" }, { id: "q88", correct: "A" }, { id: "q89", correct: "B" }, { id: "q90", correct: "B" },
    { id: "q91", correct: "C" }, { id: "q92", correct: "A" }, { id: "q93", correct: "C" }, { id: "q94", correct: "B" }, { id: "q95", correct: "B" },
    { id: "q96", correct: "A" }, { id: "q97", correct: "B" }, { id: "q98", correct: "B" }, { id: "q99", correct: "A" }, { id: "q100", correct: "A" },
  ];

  var state = {
    quizType: "team", // 'team' | 'season' | 'knowledge'
    round: 0,
    score: 0, // total points, including speed bonuses in timed mode
    correctCount: 0, // number of questions answered correctly, out of TOTAL_QUESTIONS
    answered: false,
    currentQuestion: null,
    timedMode: false,
    streak: 0,
    mistakes: [], // { titleText, subText, correctLabel, yourLabel }
    questionStartTime: 0,
    usedKnowledgeIds: new Set(), // avoids repeating a knowledge question within one round
  };

  var timerHandle = null;

  function getAllCombos() {
    return window.EUROLEAGUE_DATA || [];
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  function uniqueClubs() {
    var seen = {};
    var list = [];
    getAllCombos().forEach(function (c) {
      if (!seen[c.team]) {
        seen[c.team] = true;
        list.push(c.team);
      }
    });
    return list;
  }

  function combosForClub(club) {
    return getAllCombos().filter(function (c) {
      return c.team === club;
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildTeamQuestion() {
    var all = getAllCombos();
    var combo = pickRandom(all);
    var otherClubs = uniqueClubs().filter(function (c) {
      return c !== combo.team;
    });
    var decoyPool = otherClubs;
    if (state.streak >= 3) {
      // Higher streak: prefer decoy clubs that were also active in the same
      // season, since those are much easier to confuse with the real answer.
      var comboYear = parseInt(combo.season, 10);
      var contemporaries = otherClubs.filter(function (c) {
        return combosForClub(c).some(function (cc) {
          return parseInt(cc.season, 10) === comboYear;
        });
      });
      if (contemporaries.length >= 3) decoyPool = contemporaries;
    }
    var decoys = shuffle(decoyPool).slice(0, 3);
    var options = shuffle([combo.team].concat(decoys)).map(function (raw) { return { value: raw, label: raw }; });
    return {
      type: "team",
      combo: combo,
      correctAnswer: combo.team,
      options: options,
      titleText: window.I18n.t("trivia.questionTitleTeam"),
      subText: window.I18n.t("single.seasonLabel", { season: formatSeason(combo.season) }),
    };
  }

  function buildSeasonQuestion() {
    var eligibleClubs = uniqueClubs().filter(function (c) {
      return combosForClub(c).length >= 2;
    });
    if (eligibleClubs.length === 0) return buildTeamQuestion();
    var club = pickRandom(eligibleClubs);
    var combos = combosForClub(club);
    var combo = pickRandom(combos);
    var otherSeasons = combos
      .filter(function (c) {
        return c.season !== combo.season;
      })
      .map(function (c) {
        return c.season;
      });
    var decoyPool = otherSeasons;
    if (state.streak >= 3) {
      // Higher streak: prefer seasons close in time to the correct one -
      // much harder to tell apart than a season from a distant era.
      var correctYear = parseInt(combo.season, 10);
      var close = otherSeasons.filter(function (s) {
        return Math.abs(parseInt(s, 10) - correctYear) <= 3;
      });
      if (close.length >= 3) decoyPool = close;
    }
    var decoys = shuffle(decoyPool).slice(0, 3);
    var options = shuffle([combo.season].concat(decoys)).map(function (raw) { return { value: raw, label: formatSeason(raw) }; });
    return {
      type: "season",
      combo: combo,
      correctAnswer: combo.season,
      options: options,
      titleText: club,
      subText: window.I18n.t("trivia.questionSubSeason"),
    };
  }

  // Unlike the team/season types, correctness is keyed by option letter
  // (A-D) rather than by matching translated text - the source data (and
  // its answer key) stays identical across languages, only the displayed
  // text differs.
  function buildKnowledgeQuestion() {
    var pool = KNOWLEDGE_QUESTIONS.filter(function (q) { return !state.usedKnowledgeIds.has(q.id); });
    if (pool.length === 0) {
      state.usedKnowledgeIds = new Set();
      pool = KNOWLEDGE_QUESTIONS.slice();
    }
    var q = pickRandom(pool);
    state.usedKnowledgeIds.add(q.id);
    var base = "trivia.knowledge." + q.id + ".";
    var options = shuffle(["A", "B", "C", "D"]).map(function (letter) {
      return { value: letter, label: window.I18n.t(base + letter) };
    });
    return {
      type: "knowledge",
      combo: null,
      correctAnswer: q.correct,
      options: options,
      titleText: window.I18n.t(base + "text"),
      subText: window.I18n.t("trivia.questionSubKnowledge"),
    };
  }

  function renderProgress() {
    var bar = document.getElementById("trivia-progress-bar");
    bar.innerHTML = "";
    for (var i = 1; i <= TOTAL_QUESTIONS; i++) {
      var dot = document.createElement("div");
      dot.className = "progress-dot";
      if (i < state.round) dot.classList.add("filled");
      if (i === state.round) dot.classList.add("current");
      dot.textContent = i;
      bar.appendChild(dot);
    }
  }

  function clearTimer() {
    if (timerHandle) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }
  }

  function startTimer() {
    var bar = document.getElementById("trivia-timer-bar");
    var fill = document.getElementById("trivia-timer-fill");
    if (!state.timedMode) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    state.questionStartTime = Date.now();
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth; // force reflow so the transition below actually animates
    fill.style.transition = "width " + TIME_LIMIT + "s linear";
    fill.style.width = "0%";
    timerHandle = setTimeout(function () {
      if (!state.answered) handleAnswer(TIMEOUT_SENTINEL, null);
    }, TIME_LIMIT * 1000);
  }

  function renderQuestion() {
    clearTimer();
    state.round++;
    if (state.round > TOTAL_QUESTIONS) {
      finish();
      return;
    }
    state.answered = false;

    var question = state.quizType === "season" ? buildSeasonQuestion()
      : state.quizType === "knowledge" ? buildKnowledgeQuestion()
      : buildTeamQuestion();
    state.currentQuestion = question;

    renderProgress();
    document.getElementById("trivia-round-meta").textContent =
      window.I18n.t("trivia.roundMeta", { n: state.round, total: TOTAL_QUESTIONS, score: state.score }) +
      (state.streak >= 2 ? " · " + window.I18n.t("trivia.streakSuffix", { streak: state.streak }) : "");

    document.getElementById("trivia-question-title").textContent = question.titleText;
    document.getElementById("trivia-question-sub").textContent = question.subText;

    var rosterGrid = document.getElementById("trivia-roster-grid");
    rosterGrid.innerHTML = "";
    if (question.combo) {
      question.combo.players.forEach(function (player) {
        var chip = document.createElement("div");
        chip.className = "player-chip";
        chip.textContent = player.name + (player.position ? " (" + player.position + ")" : "");
        rosterGrid.appendChild(chip);
      });
    }

    var optionsContainer = document.getElementById("trivia-options");
    optionsContainer.innerHTML = "";
    question.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.className = "trivia-option-btn";
      if (question.type === "team") {
        btn.innerHTML = window.TeamBadge.html(opt.value, "badge-sm") + opt.label;
      } else {
        btn.textContent = opt.label;
      }
      btn.addEventListener("click", function () {
        handleAnswer(opt.value, btn);
      });
      optionsContainer.appendChild(btn);
    });

    var feedback = document.getElementById("trivia-feedback");
    feedback.textContent = "";
    feedback.className = "trivia-feedback";
    document.getElementById("btn-trivia-next").style.display = "none";

    window.AppNav.showScreen("triviaQuestion");
    startTimer();
  }

  function handleAnswer(selected, clickedBtn) {
    if (state.answered) return;
    state.answered = true;
    clearTimer();

    var question = state.currentQuestion;
    var isTimeout = selected === TIMEOUT_SENTINEL;
    var correct = !isTimeout && selected === question.correctAnswer;
    var correctOption = question.options.filter(function (o) { return o.value === question.correctAnswer; })[0];
    var correctLabel = correctOption ? correctOption.label : "";

    var speedBonus = 0;
    if (correct) {
      state.streak++;
      state.correctCount++;
      if (state.timedMode) {
        var elapsedSec = (Date.now() - state.questionStartTime) / 1000;
        var remainingFrac = Math.max(0, (TIME_LIMIT - elapsedSec) / TIME_LIMIT);
        // Graduated instead of a single all-or-nothing cliff at half the
        // clock: answering in the first quarter of the time is rewarded
        // more than just beating the halfway mark, which used to score
        // identically to an answer that came in at 5.01s vs 9.99s.
        if (remainingFrac >= 0.75) speedBonus = 2;
        else if (remainingFrac >= 0.5) speedBonus = 1;
      }
      state.score += 1 + speedBonus;
    } else {
      state.streak = 0;
      var selectedOption = question.options.filter(function (o) { return o.value === selected; })[0];
      var yourLabel = isTimeout
        ? window.I18n.t("trivia.timeoutAnswerLabel")
        : (selectedOption ? selectedOption.label : selected);
      state.mistakes.push({
        titleText: question.titleText,
        subText: question.subText,
        correctLabel: correctLabel,
        yourLabel: yourLabel,
      });
    }

    var buttons = document.querySelectorAll("#trivia-options .trivia-option-btn");
    buttons.forEach(function (btn) {
      btn.disabled = true;
      if (btn.textContent === correctLabel) {
        btn.classList.add("correct");
      }
    });
    if (!correct && clickedBtn) {
      clickedBtn.classList.add("wrong");
    }

    var feedback = document.getElementById("trivia-feedback");
    if (isTimeout) {
      feedback.textContent = "⏱ " + window.I18n.t("trivia.timeoutFeedback", { answer: correctLabel });
      feedback.className = "trivia-feedback wrong-text";
    } else if (correct) {
      feedback.textContent = "✔ " + window.I18n.t("trivia.correctFeedback") +
        (speedBonus > 0 ? " " + window.I18n.t("trivia.speedBonusSuffix", { points: 1 + speedBonus }) : " (+1)");
      feedback.className = "trivia-feedback correct-text";
    } else {
      feedback.textContent = "✘ " + window.I18n.t("trivia.wrongFeedback", { answer: correctLabel });
      feedback.className = "trivia-feedback wrong-text";
    }

    document.getElementById("trivia-round-meta").textContent =
      window.I18n.t("trivia.roundMeta", { n: state.round, total: TOTAL_QUESTIONS, score: state.score }) +
      (state.streak >= 2 ? " · " + window.I18n.t("trivia.streakSuffix", { streak: state.streak }) : "");

    document.getElementById("btn-trivia-next").style.display = "";
  }

  function renderMistakes() {
    var container = document.getElementById("trivia-mistakes");
    if (state.mistakes.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-dim);">' + window.I18n.t("trivia.noMistakes") + "</p>";
      return;
    }
    container.innerHTML = "<h3>" + window.I18n.t("trivia.mistakesHeader") + "</h3>" + state.mistakes.map(function (m) {
      return (
        '<div class="trivia-mistake-row">' +
        '<div class="q">' + m.titleText + " (" + m.subText + ")</div>" +
        '<div class="a">' + window.I18n.t("trivia.mistakeYourAnswer", { your: m.yourLabel, correct: m.correctLabel }) + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function finish() {
    clearTimer();
    var bonusPoints = state.score - state.correctCount;
    document.getElementById("trivia-final-title").textContent =
      window.I18n.t("trivia.finalScore", { correct: state.correctCount, total: TOTAL_QUESTIONS }) +
      (bonusPoints > 0 ? " " + window.I18n.t("trivia.finalScoreBonusSuffix", { score: state.score }) : "");

    var msg;
    if (state.correctCount >= 22) msg = window.I18n.t("trivia.msgExpert");
    else if (state.correctCount >= 17) msg = window.I18n.t("trivia.msgImpressive");
    else if (state.correctCount >= 10) msg = window.I18n.t("trivia.msgNotBad");
    else msg = window.I18n.t("trivia.msgMoreToLearn");
    document.getElementById("trivia-final-sub").textContent = msg;
    renderMistakes();

    var PERFECT_ACHIEVEMENT_BY_TYPE = { team: "trivia_perfect_team", season: "trivia_perfect_season", knowledge: "trivia_perfect_knowledge" };
    var BEST_KEY_BY_TYPE = { team: "trivia_best_team", season: "trivia_best_season", knowledge: "trivia_best_knowledge" };

    window.Achievements.markPlayed("trivia");
    if (state.correctCount === TOTAL_QUESTIONS) {
      window.Achievements.unlock(PERFECT_ACHIEVEMENT_BY_TYPE[state.quizType]);
    }
    window.Achievements.reportBest(BEST_KEY_BY_TYPE[state.quizType], state.correctCount);
    // Kept scoped to the original team/season tracks - a new knowledge track
    // shouldn't retroactively raise the bar on an achievement players may
    // have already earned under the old two-track definition.
    if (window.Achievements.getBest("trivia_best_team") >= 20 && window.Achievements.getBest("trivia_best_season") >= 20) {
      window.Achievements.unlock("trivia_expert");
    }

    window.AppNav.showScreen("triviaFinal");
  }

  function startTrivia(type) {
    state.quizType = type;
    state.round = 0;
    state.score = 0;
    state.correctCount = 0;
    state.streak = 0;
    state.mistakes = [];
    state.usedKnowledgeIds = new Set();
    renderQuestion();
  }

  document.getElementById("btn-trivia-team").addEventListener("click", function () {
    startTrivia("team");
  });
  document.getElementById("btn-trivia-season").addEventListener("click", function () {
    startTrivia("season");
  });
  document.getElementById("btn-trivia-knowledge").addEventListener("click", function () {
    startTrivia("knowledge");
  });
  document.getElementById("btn-trivia-restart").addEventListener("click", function () {
    window.AppNav.showScreen("triviaSelect");
  });
  document.getElementById("btn-trivia-next").addEventListener("click", renderQuestion);

  document.getElementById("btn-trivia-timed-toggle").addEventListener("click", function (e) {
    state.timedMode = !state.timedMode;
    e.target.textContent = window.I18n.t(state.timedMode ? "trivia.timedOn" : "trivia.timedOff");
    e.target.classList.toggle("selected", state.timedMode);
    e.target.setAttribute("aria-pressed", state.timedMode ? "true" : "false");
  });
})();
