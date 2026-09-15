(function () {
  "use strict";

  var TOTAL_TURNS = 10;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: "מגן", Forward: "חלוץ", Center: "סנטר" };
  var MAX_REROLLS = 2;
  var HOME_BONUS = 3; // score bonus for the "home" side in a given game
  var selectedGamesToWin = 2; // set by the Bo3/Bo5 toggle on the setup screen

  function freshNeeds() {
    return { Guard: 2, Forward: 2, Center: 1 };
  }

  var state = {
    mode: null, // 'friend' | 'computer'
    usedComboIndexes: [],
    pickedNames: new Set(),
    turn: 0, // 0..9
    gamesToWin: 2, // 2 = best-of-3, 3 = best-of-5
    sides: [
      { label: "שחקן 1", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
      { label: "שחקן 2", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
    ],
  };

  var seriesGames = []; // revealed games so far: {score1, score2, winnerIndex, quarters1, quarters2, homeIndex}
  var seriesWins = [0, 0];
  var pendingGameIndex = 0;
  var awaitingReveal = true; // true = next click reveals a result; false = next click advances/finishes

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  function getAllCombos() {
    return window.EUROLEAGUE_DATA || [];
  }

  function comboHasEligiblePlayer(combo, needs) {
    return combo.players.some(function (p) {
      if (state.pickedNames.has(normalizeName(p.name))) return false;
      if (!p.position || !needs[p.position]) return false;
      return needs[p.position] > 0;
    });
  }

  function pickRandomCombo(needs) {
    var all = getAllCombos();
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      if (state.usedComboIndexes.indexOf(i) !== -1) continue;
      if (!comboHasEligiblePlayer(all[i], needs)) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return null;
    var idx = candidates[Math.floor(Math.random() * candidates.length)];
    return { index: idx, combo: all[idx] };
  }

  function currentSideIndex() {
    return state.turn % 2;
  }

  function needsSummaryText(needs) {
    var parts = [];
    ["Guard", "Forward", "Center"].forEach(function (posKey) {
      if (needs[posKey] > 0) parts.push(needs[posKey] + " " + POS_LABEL[posKey]);
    });
    return parts.join(", ");
  }

  function buildSlotDisplay(picks) {
    var byPos = { Guard: [], Forward: [], Center: [] };
    picks.forEach(function (p) {
      if (byPos[p.position]) byPos[p.position].push(p);
    });
    var counters = { Guard: 0, Forward: 0, Center: 0 };
    return SLOT_TEMPLATE.map(function (posKey) {
      var idx = counters[posKey]++;
      return { posKey: posKey, label: POS_LABEL[posKey], pick: byPos[posKey][idx] || null };
    });
  }

  function renderSlots(sideIndex) {
    var container = document.getElementById("h2h-slots-" + (sideIndex + 1));
    container.innerHTML = "";
    buildSlotDisplay(state.sides[sideIndex].picks).forEach(function (slot) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip" + (slot.pick ? " filled" : "");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + slot.label + "</span>" +
        (slot.pick ? '<span class="h2h-slot-player">' + slot.pick.player +
          (typeof slot.pick.rating === "number" ? '<span class="rating-tag">' + slot.pick.rating + "</span>" : "") +
          "</span>" : "");
      container.appendChild(chip);
    });
  }

  function renderPanels() {
    document.getElementById("h2h-player1-label").textContent = state.sides[0].label;
    document.getElementById("h2h-player2-label").textContent = state.sides[1].label;
    renderSlots(0);
    renderSlots(1);
    document.getElementById("h2h-panel-1").classList.toggle("active-turn", currentSideIndex() === 0);
    document.getElementById("h2h-panel-2").classList.toggle("active-turn", currentSideIndex() === 1);
  }

  function renderTurn() {
    if (state.turn >= TOTAL_TURNS) {
      startSystemSelection();
      return;
    }
    var sideIndex = currentSideIndex();
    var side = state.sides[sideIndex];
    var picked = pickRandomCombo(side.needs);
    if (!picked) {
      startSystemSelection();
      return;
    }
    state.usedComboIndexes.push(picked.index);

    renderPanels();

    document.getElementById("h2h-turn-indicator").innerHTML =
      "תור " + (state.turn + 1) + " מתוך " + TOTAL_TURNS + "<br>" +
      "<strong>" + side.label + "</strong> - נדרשים עוד: " + needsSummaryText(side.needs);

    document.getElementById("h2h-round-team").innerHTML = window.TeamBadge.html(picked.combo.team) + picked.combo.team;
    document.getElementById("h2h-round-season").textContent = "עונת " + formatSeason(picked.combo.season);

    var grid = document.getElementById("h2h-players-grid");
    grid.innerHTML = "";
    var eligiblePlayers = [];
    var sortedPlayers = picked.combo.players.slice().sort(function (a, b) {
      return (b.rating || 0) - (a.rating || 0);
    });
    sortedPlayers.forEach(function (player) {
      var taken = state.pickedNames.has(normalizeName(player.name));
      var slotFull = !taken && (!player.position || !(side.needs[player.position] > 0));
      var disabled = taken || slotFull;
      if (!disabled) eligiblePlayers.push(player);
      var btn = document.createElement("button");
      btn.className = "player-btn";
      btn.disabled = disabled;
      btn.innerHTML = player.name +
        (player.position ? '<span class="pos-tag">' + player.position + "</span>" : "") +
        (typeof player.rating === "number" ? '<span class="rating-tag">' + player.rating + "</span>" : "") +
        (taken ? '<span class="taken-tag">כבר נבחר</span>' : (slotFull ? '<span class="taken-tag">המשבצת מלאה</span>' : ""));
      if (!disabled) {
        btn.addEventListener("click", function () {
          makePick(player, picked.combo, sideIndex);
        });
      }
      grid.appendChild(btn);
    });

    var isComputerTurn = state.mode === "computer" && sideIndex === 1;
    var rerollBtn = document.getElementById("btn-h2h-reroll");
    rerollBtn.style.display = isComputerTurn ? "none" : "";
    document.getElementById("h2h-reroll-count").textContent = side.rerolls;
    rerollBtn.disabled = side.rerolls <= 0;

    window.AppNav.showScreen("h2hDraft");

    if (isComputerTurn) {
      var thisTurn = state.turn;
      setTimeout(function () {
        if (state.turn !== thisTurn) return; // safety: turn already advanced
        var choice = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
        makePick(choice, picked.combo, sideIndex);
      }, 700);
    }
  }

  function reroll() {
    var sideIndex = currentSideIndex();
    if (state.mode === "computer" && sideIndex === 1) return;
    var side = state.sides[sideIndex];
    if (side.rerolls <= 0) return;
    side.rerolls--;
    renderTurn();
  }

  function makePick(player, combo, sideIndex) {
    var side = state.sides[sideIndex];
    state.pickedNames.add(normalizeName(player.name));
    side.needs[player.position]--;
    side.picks.push({
      player: player.name,
      position: player.position,
      rating: player.rating,
      offRating: player.offRating,
      defRating: player.defRating,
      archetype: player.archetype,
      team: combo.team,
      season: combo.season,
      slotLabel: POS_LABEL[player.position],
    });
    state.turn++;
    renderTurn();
  }

  function bellRandom(totalSpread) {
    // Sum of three smaller random draws approximates a bell curve: most
    // results land near the middle, big swings still happen but rarely -
    // feels much more like real game-score variance than one flat roll.
    var part = totalSpread / 3;
    return (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part;
  }

  function chemistryBonus(picks) {
    var counts = {};
    picks.forEach(function (p) {
      counts[p.team] = (counts[p.team] || 0) + 1;
    });
    var bonus = 0;
    Object.keys(counts).forEach(function (team) {
      var c = counts[team];
      if (c >= 2) bonus += (c - 1) * 3;
    });
    return bonus;
  }

  function playerOffense(p) {
    var base = typeof p.offRating === "number" ? p.offRating : (typeof p.rating === "number" ? p.rating : 65);
    return base + (p.archetype ? p.archetype.offBonus : 0);
  }

  function playerDefense(p) {
    var base = typeof p.defRating === "number" ? p.defRating : (typeof p.rating === "number" ? p.rating : 65);
    return base + (p.archetype ? p.archetype.defBonus : 0);
  }

  // No starters/bench split in 1 on 1 (a single 5-man side), so the system's
  // fit bonus/penalty just averages flat across all 5 picks.
  function averageOffense(picks, system) {
    var starPlayer = system ? window.PlaySystemsAPI.findStarPlayer(picks) : null;
    var total = 0;
    picks.forEach(function (p) {
      var val = playerOffense(p);
      if (system) val += window.PlaySystemsAPI.fitBonus(p, system, starPlayer).off;
      total += val;
    });
    return picks.length > 0 ? total / picks.length : 0;
  }

  function averageDefense(picks, system) {
    var starPlayer = system ? window.PlaySystemsAPI.findStarPlayer(picks) : null;
    var total = 0;
    picks.forEach(function (p) {
      var val = playerDefense(p);
      if (system) val += window.PlaySystemsAPI.fitBonus(p, system, starPlayer).def;
      total += val;
    });
    return picks.length > 0 ? total / picks.length : 0;
  }

  // Score is driven by this side's offense against the opponent's defense,
  // so the same roster can score very differently depending on who it faces.
  function simulateTeamScore(offense, opponentDefense, extraBonus, chemistry, varianceMultiplier) {
    var score = 60 + (offense - opponentDefense) * 0.6;
    score += chemistry;
    score += extraBonus || 0;
    score += bellRandom(14 * (varianceMultiplier || 1));
    return Math.round(score);
  }

  function averageRating(picks) {
    var total = 0;
    picks.forEach(function (p) {
      total += typeof p.rating === "number" ? p.rating : 65;
    });
    return picks.length > 0 ? total / picks.length : 0;
  }

  // Elo-style win probability from a rating gap: a 15-point gap gives ~76%.
  function winProbability(ratingA, ratingB) {
    var diff = ratingA - ratingB;
    return 1 / (1 + Math.pow(10, -diff / 15));
  }

  function splitIntoQuarters(total) {
    var weights = [Math.random() + 0.6, Math.random() + 0.6, Math.random() + 0.6, Math.random() + 0.6];
    var sum = weights[0] + weights[1] + weights[2] + weights[3];
    var running = 0;
    var quarters = [];
    for (var i = 0; i < 4; i++) {
      var isLast = i === 3;
      var q = isLast ? total - running : Math.round((total * weights[i]) / sum);
      quarters.push(q);
      running += q;
    }
    return quarters;
  }

  function cumulativeLine(quarters) {
    var running = 0;
    return quarters.map(function (q) {
      running += q;
      return running;
    });
  }

  function playOneGame(gameIndex) {
    var homeIndex = gameIndex % 2;
    var bonus1 = homeIndex === 0 ? HOME_BONUS : 0;
    var bonus2 = homeIndex === 1 ? HOME_BONUS : 0;
    var sys1 = state.sides[0].system;
    var sys2 = state.sides[1].system;
    var offense1 = averageOffense(state.sides[0].picks, sys1);
    var defense1 = averageDefense(state.sides[0].picks, sys1);
    var offense2 = averageOffense(state.sides[1].picks, sys2);
    var defense2 = averageDefense(state.sides[1].picks, sys2);
    var mult1 = sys1 ? sys1.varianceMultiplier : 1;
    var mult2 = sys2 ? sys2.varianceMultiplier : 1;
    var score1 = simulateTeamScore(offense1, defense2, bonus1, chemistryBonus(state.sides[0].picks), mult1);
    var score2 = simulateTeamScore(offense2, defense1, bonus2, chemistryBonus(state.sides[1].picks), mult2);
    if (score1 === score2) {
      if (Math.random() < 0.5) score1++;
      else score2++;
    }
    return {
      score1: score1,
      score2: score2,
      winnerIndex: score1 > score2 ? 0 : 1,
      homeIndex: homeIndex,
      quarters1: splitIntoQuarters(score1),
      quarters2: splitIntoQuarters(score2),
    };
  }

  function gameRowHtml(g, i) {
    var cum1 = cumulativeLine(g.quarters1);
    var cum2 = cumulativeLine(g.quarters2);
    var quartersText = cum1.map(function (v, qi) {
      return v + "-" + cum2[qi];
    }).join(" · ");
    return (
      '<div class="h2h-game-row">' +
      '<div class="h2h-game-row-main"><span>משחק ' + (i + 1) + (g.homeIndex === 0 ? " (בית: " + state.sides[0].label + ")" : " (בית: " + state.sides[1].label + ")") + "</span>" +
      "<span>" + g.score1 + " - " + g.score2 + "</span></div>" +
      '<div class="h2h-game-row-quarters">לפי רבעים: ' + quartersText + "</div>" +
      "</div>"
    );
  }

  function renderSeriesLog(containerId) {
    document.getElementById(containerId).innerHTML = seriesGames.map(gameRowHtml).join("");
  }

  function renderGamePreview() {
    awaitingReveal = true;
    document.getElementById("h2h-game-status").textContent =
      "משחק " + (pendingGameIndex + 1) + " · סדרה: " + seriesWins[0] + "-" + seriesWins[1];
    renderSeriesLog("h2h-series-log-live");

    var ratingA = averageRating(state.sides[0].picks);
    var ratingB = averageRating(state.sides[1].picks);
    var prob = winProbability(ratingA, ratingB);
    var pct1 = Math.round(prob * 100);
    var pct2 = 100 - pct1;
    var homeIndex = pendingGameIndex % 2;
    var homeLabel = state.sides[homeIndex].label;

    var preview = document.getElementById("h2h-game-preview");
    preview.innerHTML =
      "<div>סיכויי ניצחון למשחק הזה, לפי הדירוג הממוצע:</div>" +
      '<div class="prob-row"><span>' + state.sides[0].label + " " + pct1 + "%</span>" +
      "<span>" + pct2 + "% " + state.sides[1].label + "</span></div>" +
      '<div class="prob-bar"><div class="prob-bar-fill-1" style="width:' + pct1 + '%"></div>' +
      '<div class="prob-bar-fill-2" style="width:' + pct2 + '%"></div></div>' +
      '<div class="home-tag">🏠 יתרון בית הפעם: ' + homeLabel + "</div>" +
      '<div class="home-tag">שיטות: ' + state.sides[0].system.label + " נגד " + state.sides[1].system.label + "</div>";

    document.getElementById("btn-h2h-game-next").textContent = "הצג תוצאה »";
    window.AppNav.showScreen("h2hGame");
  }

  function revealGame() {
    awaitingReveal = false;
    var g = playOneGame(pendingGameIndex);
    seriesGames.push(g);
    seriesWins[g.winnerIndex]++;
    pendingGameIndex++;

    renderSeriesLog("h2h-series-log-live");
    document.getElementById("h2h-game-status").textContent =
      "תוצאת משחק " + pendingGameIndex + " · סדרה: " + seriesWins[0] + "-" + seriesWins[1];

    var winnerLabel = state.sides[g.winnerIndex].label;
    var preview = document.getElementById("h2h-game-preview");
    preview.innerHTML =
      '<div class="final-score">' + g.score1 + " - " + g.score2 + "</div>" +
      "<div>" + winnerLabel + " ניצח/ה במשחק זה</div>";

    var seriesDecided = seriesWins[0] >= state.gamesToWin || seriesWins[1] >= state.gamesToWin;
    document.getElementById("btn-h2h-game-next").textContent = seriesDecided ? "לתוצאה הסופית »" : "המשחק הבא »";
  }

  function renderFinalTeamGrid(gridId, side) {
    var grid = document.getElementById(gridId);
    grid.innerHTML = "";
    side.picks.forEach(function (pick) {
      var card = document.createElement("div");
      card.className = "squad-player-card";
      card.innerHTML =
        '<div class="name">' + pick.player +
          (pick.position ? '<span class="pos-tag">' + pick.position + "</span>" : "") +
          (typeof pick.rating === "number" ? '<span class="rating-tag">' + pick.rating + "</span>" : "") + "</div>" +
        '<div class="meta">' + pick.slotLabel + " &middot; " + pick.team + " " + formatSeason(pick.season) + "</div>" +
        '<div class="meta">' +
          (typeof pick.offRating === "number" ? '<span class="off-tag">התק׳ ' + pick.offRating + "</span>" : "") +
          (typeof pick.defRating === "number" ? '<span class="def-tag">הג׳ ' + pick.defRating + "</span>" : "") +
          (pick.archetype ? '<span class="archetype-tag">' + pick.archetype.label + "</span>" : "") +
        "</div>";
      grid.appendChild(card);
    });
  }

  function finishSeries() {
    var seriesWinnerIndex = seriesWins[0] > seriesWins[1] ? 0 : 1;
    var loserIndex = seriesWinnerIndex === 0 ? 1 : 0;

    renderSeriesLog("h2h-series-log");

    document.getElementById("h2h-score-board").innerHTML =
      '<div class="h2h-score-row">' +
        '<span class="h2h-score-name">' + state.sides[0].label + "</span>" +
        '<span class="h2h-score-value">' + seriesWins[0] + "</span>" +
      "</div>" +
      '<div class="h2h-score-vs">-</div>' +
      '<div class="h2h-score-row">' +
        '<span class="h2h-score-value">' + seriesWins[1] + "</span>" +
        '<span class="h2h-score-name">' + state.sides[1].label + "</span>" +
      "</div>";

    var winnerLabel = state.sides[seriesWinnerIndex].label;
    document.getElementById("h2h-result-title").textContent =
      winnerLabel + " ניצח/ה בסדרה " + seriesWins[seriesWinnerIndex] + "-" + seriesWins[loserIndex] + "!";

    document.getElementById("h2h-final-team1-name").textContent =
      state.sides[0].label + " (דירוג ממוצע: " + averageRating(state.sides[0].picks).toFixed(1) + ")";
    document.getElementById("h2h-final-team2-name").textContent =
      state.sides[1].label + " (דירוג ממוצע: " + averageRating(state.sides[1].picks).toFixed(1) + ")";
    renderFinalTeamGrid("h2h-final-team1-grid", state.sides[0]);
    renderFinalTeamGrid("h2h-final-team2-grid", state.sides[1]);

    window.Effects.confetti();

    window.Achievements.markPlayed("h2h");
    var seriesPlayed = window.Achievements.incrementCounter("h2h_series_played");
    if (seriesPlayed >= 5) window.Achievements.unlock("h2h_veteran");
    if (seriesWinnerIndex === 0) {
      window.Achievements.unlock("h2h_first_win");
      if (seriesWins[0] === state.gamesToWin && seriesWins[1] === 0) window.Achievements.unlock("h2h_sweep");
      if (averageRating(state.sides[0].picks) < averageRating(state.sides[1].picks)) {
        window.Achievements.unlock("h2h_upset");
      }
    }

    window.AppNav.showScreen("h2hResult");
  }

  function onGameNext() {
    if (awaitingReveal) {
      revealGame();
      return;
    }
    var seriesDecided = seriesWins[0] >= state.gamesToWin || seriesWins[1] >= state.gamesToWin;
    if (seriesDecided) {
      finishSeries();
    } else {
      renderGamePreview();
    }
  }

  function renderSystemPickerFor(sideIndex) {
    document.getElementById("h2h-system-title").textContent = state.sides[sideIndex].label + " - בחרו שיטת משחק";
    var grid = document.getElementById("h2h-system-grid");
    grid.innerHTML = "";
    window.PlaySystems.forEach(function (sys) {
      var card = document.createElement("button");
      card.className = "system-card";
      card.innerHTML =
        '<div class="system-name">' + sys.label + "</div>" +
        '<div class="system-desc">' + sys.desc + "</div>";
      card.addEventListener("click", function () {
        state.sides[sideIndex].system = sys;
        renderSystemSelection();
      });
      grid.appendChild(card);
    });
    window.AppNav.showScreen("h2hSystem");
  }

  // Side 0 is always human and always picks. Side 1 picks too in "friend" mode;
  // in "computer" mode it gets a random system with no prompt, for a fair fight.
  function renderSystemSelection() {
    if (!state.sides[0].system) {
      renderSystemPickerFor(0);
    } else if (state.mode === "friend" && !state.sides[1].system) {
      renderSystemPickerFor(1);
    } else {
      startSeries();
    }
  }

  function startSystemSelection() {
    state.sides[0].system = null;
    state.sides[1].system = state.mode === "computer"
      ? window.PlaySystems[Math.floor(Math.random() * window.PlaySystems.length)]
      : null;
    renderSystemSelection();
  }

  function startSeries() {
    seriesGames = [];
    seriesWins = [0, 0];
    pendingGameIndex = 0;
    renderGamePreview();
  }

  function startH2H(mode) {
    state.mode = mode;
    state.gamesToWin = selectedGamesToWin;
    state.usedComboIndexes = [];
    state.pickedNames = new Set();
    state.turn = 0;
    state.sides = [
      { label: "שחקן 1", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
      { label: mode === "computer" ? "המחשב" : "שחקן 2", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
    ];
    renderTurn();
  }

  document.getElementById("btn-h2h-vs-friend").addEventListener("click", function () {
    startH2H("friend");
  });
  document.getElementById("btn-h2h-vs-computer").addEventListener("click", function () {
    startH2H("computer");
  });
  document.getElementById("btn-h2h-restart").addEventListener("click", function () {
    window.AppNav.showScreen("h2hSetup");
  });
  document.getElementById("btn-h2h-rematch").addEventListener("click", function () {
    startSeries();
  });
  document.getElementById("btn-h2h-reroll").addEventListener("click", reroll);
  document.getElementById("btn-h2h-game-next").addEventListener("click", onGameNext);

  document.querySelectorAll("#h2h-format-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#h2h-format-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      selectedGamesToWin = parseInt(btn.dataset.gamesToWin, 10);
    });
  });
})();
