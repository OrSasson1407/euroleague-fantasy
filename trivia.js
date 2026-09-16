(function () {
  "use strict";

  var TOTAL_QUESTIONS = 25;
  var TIME_LIMIT = 10; // seconds per question, in timed mode
  var TIMEOUT_SENTINEL = "__TIMEOUT__";

  var state = {
    quizType: "team", // 'team' | 'season'
    round: 0,
    score: 0, // total points, including speed bonuses in timed mode
    correctCount: 0, // number of questions answered correctly, out of TOTAL_QUESTIONS
    answered: false,
    currentQuestion: null,
    timedMode: false,
    streak: 0,
    mistakes: [], // { titleText, subText, correctLabel, yourLabel }
    questionStartTime: 0,
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
    var options = shuffle([combo.team].concat(decoys));
    return {
      type: "team",
      combo: combo,
      correctAnswer: combo.team,
      options: options,
      titleText: "איזו קבוצה שיחקה עם הסגל הזה?",
      subText: "עונת " + formatSeason(combo.season),
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
    var options = shuffle([combo.season].concat(decoys));
    return {
      type: "season",
      combo: combo,
      correctAnswer: combo.season,
      options: options,
      titleText: club,
      subText: "באיזו עונה שיחק סגל זה?",
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

    var question = state.quizType === "season" ? buildSeasonQuestion() : buildTeamQuestion();
    state.currentQuestion = question;

    renderProgress();
    document.getElementById("trivia-round-meta").textContent =
      "שאלה " + state.round + " מתוך " + TOTAL_QUESTIONS + " · ניקוד: " + state.score +
      (state.streak >= 2 ? " · 🔥 רצף: " + state.streak : "");

    document.getElementById("trivia-question-title").textContent = question.titleText;
    document.getElementById("trivia-question-sub").textContent = question.subText;

    var rosterGrid = document.getElementById("trivia-roster-grid");
    rosterGrid.innerHTML = "";
    question.combo.players.forEach(function (player) {
      var chip = document.createElement("div");
      chip.className = "player-chip";
      chip.textContent = player.name + (player.position ? " (" + player.position + ")" : "");
      rosterGrid.appendChild(chip);
    });

    var optionsContainer = document.getElementById("trivia-options");
    optionsContainer.innerHTML = "";
    question.options.forEach(function (raw) {
      var label = question.type === "season" ? formatSeason(raw) : raw;
      var btn = document.createElement("button");
      btn.className = "trivia-option-btn";
      if (question.type === "team") {
        btn.innerHTML = window.TeamBadge.html(raw, "badge-sm") + label;
      } else {
        btn.textContent = label;
      }
      btn.addEventListener("click", function () {
        handleAnswer(raw, btn);
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
    var correctLabel = question.type === "season" ? formatSeason(question.correctAnswer) : question.correctAnswer;

    var speedBonus = 0;
    if (correct) {
      state.streak++;
      state.correctCount++;
      if (state.timedMode) {
        var elapsedSec = (Date.now() - state.questionStartTime) / 1000;
        if (elapsedSec <= TIME_LIMIT / 2) speedBonus = 1;
      }
      state.score += 1 + speedBonus;
    } else {
      state.streak = 0;
      var yourLabel = isTimeout
        ? "לא ענית בזמן"
        : (question.type === "season" ? formatSeason(selected) : selected);
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
      feedback.textContent = "⏱ הזמן נגמר! התשובה הנכונה: " + correctLabel;
      feedback.className = "trivia-feedback wrong-text";
    } else if (correct) {
      feedback.textContent = "✔ נכון!" + (speedBonus ? " (+2, בונוס מהירות)" : " (+1)");
      feedback.className = "trivia-feedback correct-text";
    } else {
      feedback.textContent = "✘ טעות - התשובה הנכונה: " + correctLabel;
      feedback.className = "trivia-feedback wrong-text";
    }

    document.getElementById("trivia-round-meta").textContent =
      "שאלה " + state.round + " מתוך " + TOTAL_QUESTIONS + " · ניקוד: " + state.score +
      (state.streak >= 2 ? " · 🔥 רצף: " + state.streak : "");

    document.getElementById("btn-trivia-next").style.display = "";
  }

  function renderMistakes() {
    var container = document.getElementById("trivia-mistakes");
    if (state.mistakes.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-dim);">ענית נכון על הכל! 🎉</p>';
      return;
    }
    container.innerHTML = "<h3>שאלות שכדאי לחזור עליהן:</h3>" + state.mistakes.map(function (m) {
      return (
        '<div class="trivia-mistake-row">' +
        '<div class="q">' + m.titleText + " (" + m.subText + ")</div>" +
        '<div class="a">תשובתך: ' + m.yourLabel + " · התשובה הנכונה: <strong>" + m.correctLabel + "</strong></div>" +
        "</div>"
      );
    }).join("");
  }

  function finish() {
    clearTimer();
    var bonusPoints = state.score - state.correctCount;
    document.getElementById("trivia-final-title").textContent =
      "הציון שלכם: " + state.correctCount + " מתוך " + TOTAL_QUESTIONS +
      (bonusPoints > 0 ? " (" + state.score + " נקודות כולל בונוס מהירות)" : "");

    var msg;
    if (state.correctCount >= 22) msg = "מומחה יורוליג אמיתי! 🏆";
    else if (state.correctCount >= 17) msg = "ידע מרשים!";
    else if (state.correctCount >= 10) msg = "לא רע בכלל!";
    else msg = "יש עוד ללמוד על ההיסטוריה של היורוליג...";
    document.getElementById("trivia-final-sub").textContent = msg;
    renderMistakes();

    window.Achievements.markPlayed("trivia");
    if (state.correctCount === TOTAL_QUESTIONS) {
      window.Achievements.unlock(state.quizType === "season" ? "trivia_perfect_season" : "trivia_perfect_team");
    }
    var bestKey = state.quizType === "season" ? "trivia_best_season" : "trivia_best_team";
    window.Achievements.reportBest(bestKey, state.correctCount);
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
    renderQuestion();
  }

  document.getElementById("btn-trivia-team").addEventListener("click", function () {
    startTrivia("team");
  });
  document.getElementById("btn-trivia-season").addEventListener("click", function () {
    startTrivia("season");
  });
  document.getElementById("btn-trivia-restart").addEventListener("click", function () {
    window.AppNav.showScreen("triviaSelect");
  });
  document.getElementById("btn-trivia-next").addEventListener("click", renderQuestion);

  document.getElementById("btn-trivia-timed-toggle").addEventListener("click", function (e) {
    state.timedMode = !state.timedMode;
    e.target.textContent = "⏱ מצב מתוזמן: " + (state.timedMode ? "פועל" : "כבוי");
    e.target.classList.toggle("selected", state.timedMode);
    e.target.setAttribute("aria-pressed", state.timedMode ? "true" : "false");
  });
})();
