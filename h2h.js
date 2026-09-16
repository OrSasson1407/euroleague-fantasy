(function () {
  "use strict";

  var TOTAL_TURNS = 10;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: "מגן", Forward: "חלוץ", Center: "סנטר" };
  var MAX_REROLLS = 2;
  var HOME_BONUS = 3; // score bonus for the "home" side in a given game
  var selectedGamesToWin = 2; // set by the Bo3/Bo5 toggle on the setup screen
  var selectedDraftMode = "turns"; // 'turns' | 'auction', set by the setup screen toggle
  var selectedAuctionBudget = 25; // set by the setup screen's budget toggle
  var auction = null; // set up by startAuctionDraft(), used only in auction mode
  var auctionEraMin = 0;
  var auctionEraMax = 9999;
  var auctionTeamFilter = null; // null = all clubs, or a specific club name

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

  function uniqueClubs() {
    var seen = {};
    var list = [];
    getAllCombos().forEach(function (c) {
      if (!seen[c.team]) {
        seen[c.team] = true;
        list.push(c.team);
      }
    });
    list.sort();
    return list;
  }

  // Used only by the auction draft mode's era/team filters.
  function comboMatchesAuctionFilters(combo) {
    var year = parseInt(combo.season, 10);
    if (year < auctionEraMin || year > auctionEraMax) return false;
    if (auctionTeamFilter && combo.team !== auctionTeamFilter) return false;
    return true;
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
          window.RatingTag.html(slot.pick.rating) +
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
        window.RatingTag.html(player.rating) +
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
    window.Effects.playClick();
    if (typeof player.rating === "number" && player.rating >= 90) {
      window.Effects.wowPick(player.name, player.rating);
    }
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
      '<div class="vs-banner">' +
        '<div class="vs-side vs-side-1">' + state.sides[0].label + "</div>" +
        '<div class="vs-mark">VS</div>' +
        '<div class="vs-side vs-side-2">' + state.sides[1].label + "</div>" +
      "</div>" +
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
          window.RatingTag.html(pick.rating) + "</div>" +
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
    if (seriesWinnerIndex === 0) {
      window.Effects.playWin();
    } else {
      window.Effects.playLose();
    }

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

    document.getElementById("h2h-final-team1-name").innerHTML =
      state.sides[0].label + ' (דירוג ממוצע: <span id="h2h-final-rating-1">0.0</span>)';
    document.getElementById("h2h-final-team2-name").innerHTML =
      state.sides[1].label + ' (דירוג ממוצע: <span id="h2h-final-rating-2">0.0</span>)';
    window.Effects.countUp(document.getElementById("h2h-final-rating-1"), averageRating(state.sides[0].picks), { decimals: 1 });
    window.Effects.countUp(document.getElementById("h2h-final-rating-2"), averageRating(state.sides[1].picks), { decimals: 1 });
    renderFinalTeamGrid("h2h-final-team1-grid", state.sides[0]);
    renderFinalTeamGrid("h2h-final-team2-grid", state.sides[1]);

    if (seriesWinnerIndex === 0) window.Effects.confetti();

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
    window.Effects.playBuzzer();
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
    state.gamesToWin = selectedGamesToWin;

    if (selectedDraftMode === "auction") {
      startAuctionDraft(mode);
      return;
    }

    state.mode = mode;
    state.usedComboIndexes = [];
    state.pickedNames = new Set();
    state.turn = 0;
    state.sides = [
      { label: "שחקן 1", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
      { label: mode === "computer" ? "המחשב" : "שחקן 2", picks: [], rerolls: MAX_REROLLS, needs: freshNeeds(), system: null },
    ];
    renderTurn();
  }

  // ---------- Auction draft mode ----------
  // An alternate way to fill the same 5-man roster (2 Guard / 2 Forward /
  // 1 Center): each side has a $25 budget, and players go up for auction
  // one at a time. Whoever's turn it is to start this round is asked first
  // whether they want the shown player; agreeing raises the price by $1 and
  // passes the question to the other side, and so on, until one side
  // declines - the player then goes to whoever last agreed, at the price
  // they agreed to. If the very first side asked declines and the other
  // side declines too (at the still-unraised price), nobody gets the
  // player and the draft moves on. A side that already filled a position,
  // or that hasn't been asked yet at all, is skipped automatically without
  // spending a real turn. Once both rosters are full, the picks feed into
  // the exact same system-selection / series-simulation flow the
  // turn-based mode uses.

  function freshAuctionSide(label) {
    return { label: label, budget: selectedAuctionBudget, needs: freshNeeds(), picks: [] };
  }

  // A simple willingness-to-pay heuristic for the computer opponent: scales
  // roughly $3-$18 across the real rating range, so it competes harder for
  // stars without ever being a perfect, unbeatable bidder.
  function computerWantsBid(player, price) {
    var rating = typeof player.rating === "number" ? player.rating : 65;
    var value = 3 + ((rating - 60) / (99 - 60)) * 15;
    return price <= value;
  }

  function pickAuctionCandidate() {
    var wanted = [];
    ["Guard", "Forward", "Center"].forEach(function (pos) {
      if (auction.sides[0].needs[pos] > 0 || auction.sides[1].needs[pos] > 0) wanted.push(pos);
    });
    if (wanted.length === 0) return null;

    var seen = {};
    var candidates = [];
    getAllCombos().forEach(function (combo) {
      if (!comboMatchesAuctionFilters(combo)) return;
      combo.players.forEach(function (p) {
        if (!p.position || wanted.indexOf(p.position) === -1) return;
        var norm = normalizeName(p.name);
        if (state.pickedNames.has(norm) || seen[norm]) return;
        seen[norm] = true;
        candidates.push({ player: p, combo: combo });
      });
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function renderAuctionSlots(sideIndex) {
    var container = document.getElementById("h2h-auction-slots-" + (sideIndex + 1));
    container.innerHTML = "";
    buildSlotDisplay(auction.sides[sideIndex].picks).forEach(function (slot) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip" + (slot.pick ? " filled" : "");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + slot.label + "</span>" +
        (slot.pick ? '<span class="h2h-slot-player">' + slot.pick.player +
          window.RatingTag.html(slot.pick.rating) +
          '<span class="cost-tag">$' + slot.pick.price + "</span>" +
          "</span>" : "");
      container.appendChild(chip);
    });
  }

  function renderAuctionScreen() {
    document.getElementById("h2h-auction-label-1").textContent = auction.sides[0].label;
    document.getElementById("h2h-auction-label-2").textContent = auction.sides[1].label;
    document.getElementById("h2h-auction-budget-1").textContent = "תקציב: $" + auction.sides[0].budget;
    document.getElementById("h2h-auction-budget-2").textContent = "תקציב: $" + auction.sides[1].budget;
    renderAuctionSlots(0);
    renderAuctionSlots(1);
    document.getElementById("h2h-auction-panel-1").classList.toggle("active-turn", auction.askSide === 0);
    document.getElementById("h2h-auction-panel-2").classList.toggle("active-turn", auction.askSide === 1);

    var cp = auction.currentPlayer;
    if (cp) {
      document.getElementById("h2h-auction-player-name").innerHTML =
        cp.player.name +
        (cp.player.position ? '<span class="pos-tag">' + cp.player.position + "</span>" : "") +
        window.RatingTag.html(cp.player.rating);
      document.getElementById("h2h-auction-player-meta").textContent =
        cp.combo.team + " &middot; עונת " + formatSeason(cp.combo.season);
    }

    var askLabel = auction.askSide != null ? auction.sides[auction.askSide].label : "";
    document.getElementById("h2h-auction-status").innerHTML =
      "מחיר להצעה: <strong>$" + auction.nextBid + "</strong><br>תורו של <strong>" + askLabel + "</strong>";

    var isComputerAsk = auction.mode === "computer" && auction.askSide === 1;
    document.getElementById("h2h-auction-actions").style.display = isComputerAsk ? "none" : "";
    document.getElementById("btn-h2h-auction-agree").textContent = "✅ מוכן לשלם $" + auction.nextBid;

    window.AppNav.showScreen("h2hAuction");
  }

  function startAuctionDraft(mode) {
    auction = {
      mode: mode,
      sides: [
        freshAuctionSide("שחקן 1"),
        freshAuctionSide(mode === "computer" ? "המחשב" : "שחקן 2"),
      ],
      roundStarter: 0,
      currentPlayer: null,
      nextBid: 1,
      winner: null,
      askSide: null,
      askedCount: 0,
      brokeWanters: [],
    };
    state.mode = mode;
    state.pickedNames = new Set();
    advanceAuction();
  }

  function finishAuctionDraft() {
    // Hand off to the exact same system-selection / series flow the
    // turn-based mode uses, by populating state.sides in the same shape.
    state.sides = [
      { label: auction.sides[0].label, picks: auction.sides[0].picks, rerolls: 0, needs: freshNeeds(), system: null },
      { label: auction.sides[1].label, picks: auction.sides[1].picks, rerolls: 0, needs: freshNeeds(), system: null },
    ];
    renderAuctionSummary();
  }

  function renderAuctionSummaryGrid(gridId, picks) {
    var grid = document.getElementById(gridId);
    grid.innerHTML = "";
    picks.forEach(function (pick) {
      var card = document.createElement("div");
      card.className = "squad-player-card";
      card.innerHTML =
        '<div class="name">' + pick.player +
          window.RatingTag.html(pick.rating) +
          '<span class="cost-tag">$' + pick.price + "</span></div>" +
        '<div class="meta">' + pick.slotLabel + " &middot; " + pick.team + " " + formatSeason(pick.season) + "</div>";
      grid.appendChild(card);
    });
  }

  function renderAuctionSummary() {
    [0, 1].forEach(function (i) {
      var side = state.sides[i];
      var spent = side.picks.reduce(function (sum, p) { return sum + (p.price || 0); }, 0);
      document.getElementById("h2h-auction-summary-team" + (i + 1) + "-name").textContent =
        side.label + " (הוציאו $" + spent + " מתוך $" + selectedAuctionBudget + ")";
      renderAuctionSummaryGrid("h2h-auction-summary-team" + (i + 1) + "-grid", side.picks);
    });
    window.AppNav.showScreen("h2hAuctionSummary");
  }

  function advanceAuction() {
    var candidate = pickAuctionCandidate();
    if (!candidate) {
      finishAuctionDraft();
      return;
    }
    auction.currentPlayer = candidate;
    auction.nextBid = 1;
    auction.winner = null;
    auction.askedCount = 0;
    auction.brokeWanters = []; // sides that wanted this player but couldn't afford the current bid

    askSide(auction.roundStarter);
  }

  // Asks one side whether they want the current player at auction.nextBid.
  // A side that doesn't need the position, or can't afford the price, is
  // auto-declined without a real choice - but a forced decline due to
  // budget (not need) is tracked in brokeWanters, so the player can still
  // end up with them for free if nobody else ends up bidding either. This
  // guarantees every side's roster always finishes, even once broke.
  function askSide(sideIndex) {
    auction.askSide = sideIndex;
    var cp = auction.currentPlayer;
    var side = auction.sides[sideIndex];
    var needsPosition = side.needs[cp.player.position] > 0;

    renderAuctionScreen();

    if (!needsPosition) {
      handleDecline(sideIndex, false);
      return;
    }

    var canAfford = side.budget >= auction.nextBid;
    if (!canAfford) {
      handleDecline(sideIndex, true);
      return;
    }

    if (auction.mode === "computer" && sideIndex === 1) {
      var cpSnapshot = cp;
      var bidSnapshot = auction.nextBid;
      setTimeout(function () {
        if (!auction || auction.currentPlayer !== cpSnapshot || auction.askSide !== sideIndex) return;
        handleChoice(computerWantsBid(cpSnapshot.player, bidSnapshot));
      }, 650);
    }
    // Otherwise: wait for the human's click on the agree/refuse buttons.
  }

  function handleChoice(agreed) {
    var sideIndex = auction.askSide;
    if (agreed) {
      auction.winner = sideIndex;
      auction.nextBid++;
      askSide(1 - sideIndex);
      return;
    }
    handleDecline(sideIndex, false);
  }

  function handleDecline(sideIndex, broke) {
    if (auction.winner !== null) {
      // Someone already agreed to a lower price - they win at that price.
      finalizeSale(auction.winner, auction.nextBid - 1);
      return;
    }
    if (broke) auction.brokeWanters.push(sideIndex);
    auction.askedCount++;
    if (auction.askedCount < 2) {
      askSide(1 - sideIndex);
      return;
    }
    // Both sides have now been asked at the base price with no winner.
    if (auction.brokeWanters.length > 0) {
      finalizeSale(auction.brokeWanters[0], 0);
    } else {
      auction.roundStarter = 1 - auction.roundStarter;
      advanceAuction();
    }
  }

  function finalizeSale(sideIndex, price) {
    var cp = auction.currentPlayer;
    var side = auction.sides[sideIndex];
    window.Effects.playClick();
    if (typeof cp.player.rating === "number" && cp.player.rating >= 90) {
      window.Effects.wowPick(cp.player.name, cp.player.rating);
    }
    side.budget -= price;
    side.needs[cp.player.position]--;
    side.picks.push({
      player: cp.player.name,
      position: cp.player.position,
      rating: cp.player.rating,
      offRating: cp.player.offRating,
      defRating: cp.player.defRating,
      archetype: cp.player.archetype,
      team: cp.combo.team,
      season: cp.combo.season,
      slotLabel: POS_LABEL[cp.player.position],
      price: price,
    });
    state.pickedNames.add(normalizeName(cp.player.name));
    auction.roundStarter = 1 - auction.roundStarter;
    advanceAuction();
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
      window.UiSelect.sync(document.getElementById("h2h-format-buttons"));
      selectedGamesToWin = parseInt(btn.dataset.gamesToWin, 10);
    });
  });

  document.querySelectorAll("#h2h-draftmode-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#h2h-draftmode-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("h2h-draftmode-buttons"));
      selectedDraftMode = btn.dataset.draftMode;
      document.getElementById("h2h-auction-filters").hidden = selectedDraftMode !== "auction";
    });
  });

  document.querySelectorAll("#h2h-auction-era-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#h2h-auction-era-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("h2h-auction-era-buttons"));
      auctionEraMin = parseInt(btn.dataset.min, 10);
      auctionEraMax = parseInt(btn.dataset.max, 10);
    });
  });

  function renderAuctionTeamGrid() {
    var grid = document.getElementById("h2h-auction-team-grid");
    grid.innerHTML = "";
    uniqueClubs().forEach(function (club) {
      var btn = document.createElement("button");
      btn.className = "team-select-btn" + (auctionTeamFilter === club ? " selected" : "");
      btn.innerHTML = window.TeamBadge.html(club) + "<span>" + club + "</span>";
      btn.addEventListener("click", function () {
        auctionTeamFilter = club;
        grid.querySelectorAll(".team-select-btn").forEach(function (b) {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        window.UiSelect.sync(grid);
      });
      grid.appendChild(btn);
    });
    window.UiSelect.sync(grid);
  }

  document.querySelectorAll("#h2h-auction-budget-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#h2h-auction-budget-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("h2h-auction-budget-buttons"));
      selectedAuctionBudget = parseInt(btn.dataset.budget, 10);
    });
  });

  document.querySelectorAll("#h2h-auction-pool-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#h2h-auction-pool-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("h2h-auction-pool-buttons"));
      var wantsTeam = btn.dataset.pool === "team";
      var grid = document.getElementById("h2h-auction-team-grid");
      if (wantsTeam) {
        if (!grid.childElementCount) renderAuctionTeamGrid();
        if (!auctionTeamFilter) auctionTeamFilter = uniqueClubs()[0];
        renderAuctionTeamGrid();
        grid.hidden = false;
      } else {
        auctionTeamFilter = null;
        grid.hidden = true;
      }
    });
  });

  document.getElementById("btn-h2h-auction-agree").addEventListener("click", function () {
    if (!auction || auction.askSide === null) return;
    if (auction.mode === "computer" && auction.askSide === 1) return;
    handleChoice(true);
  });
  document.getElementById("btn-h2h-auction-refuse").addEventListener("click", function () {
    if (!auction || auction.askSide === null) return;
    if (auction.mode === "computer" && auction.askSide === 1) return;
    handleChoice(false);
  });
  document.getElementById("btn-h2h-auction-summary-continue").addEventListener("click", function () {
    startSystemSelection();
  });
})();
