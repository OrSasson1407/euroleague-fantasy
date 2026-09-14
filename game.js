(function () {
  "use strict";

  var TOTAL_ROUNDS = 10;
  var STARTERS_COUNT = 5;
  var MAX_REROLLS = 2;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: "מגן", Forward: "חלוץ", Center: "סנטר" };

  var state = {
    usedComboIndexes: [],
    pickedNames: new Set(), // normalized player name -> taken
    squad: [], // { player, position, rating, team, season, slot, slotLabel }
    round: 0,
    currentCombo: null,
    rerolls: MAX_REROLLS,
    needs: null, // { Guard: n, Forward: n, Center: n } for the CURRENT section (starters/bench)
    eraMin: 0,
    eraMax: 9999,
    selectedSystem: null,
  };

  function freshNeeds() {
    return { Guard: 2, Forward: 2, Center: 1 };
  }

  function showScreen(name) {
    window.AppNav.showScreen(name);
  }

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  function getAllCombos() {
    return window.EUROLEAGUE_DATA || [];
  }

  function comboHasEligiblePlayer(combo) {
    return combo.players.some(function (p) {
      if (state.pickedNames.has(normalizeName(p.name))) return false;
      if (!p.position || !state.needs[p.position]) return false;
      return state.needs[p.position] > 0;
    });
  }

  function comboInEra(combo) {
    var year = parseInt(combo.season, 10);
    return year >= state.eraMin && year <= state.eraMax;
  }

  function pickRandomCombo() {
    var all = getAllCombos();
    var candidates = [];
    for (var i = 0; i < all.length; i++) {
      if (state.usedComboIndexes.indexOf(i) !== -1) continue;
      if (!comboInEra(all[i])) continue;
      if (!comboHasEligiblePlayer(all[i])) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return null;
    var idx = candidates[Math.floor(Math.random() * candidates.length)];
    return { index: idx, combo: all[idx] };
  }

  function renderProgress() {
    var bar = document.getElementById("progress-bar");
    bar.innerHTML = "";
    for (var i = 1; i <= TOTAL_ROUNDS; i++) {
      var dot = document.createElement("div");
      dot.className = "progress-dot";
      if (i < state.round) dot.classList.add("filled");
      if (i === state.round) dot.classList.add("current");
      dot.textContent = i;
      bar.appendChild(dot);
    }
  }

  function buildSlotDisplay(picksForArm) {
    var byPos = { Guard: [], Forward: [], Center: [] };
    picksForArm.forEach(function (p) {
      if (byPos[p.position]) byPos[p.position].push(p);
    });
    var counters = { Guard: 0, Forward: 0, Center: 0 };
    return SLOT_TEMPLATE.map(function (posKey) {
      var idx = counters[posKey]++;
      return { posKey: posKey, label: POS_LABEL[posKey], pick: byPos[posKey][idx] || null };
    });
  }

  function renderSlotsPanel(containerId, slotArm) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    var picks = state.squad.filter(function (e) {
      return e.slot === slotArm;
    });
    buildSlotDisplay(picks).forEach(function (slot) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip" + (slot.pick ? " filled" : "");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + slot.label + "</span>" +
        (slot.pick ? '<span class="h2h-slot-player">' + slot.pick.player + "</span>" : "");
      container.appendChild(chip);
    });
  }

  function renderSlotsPanels() {
    renderSlotsPanel("round-starters-slots", "starter");
    renderSlotsPanel("round-bench-slots", "bench");
    var isStarterSlot = state.round <= STARTERS_COUNT;
    document.getElementById("round-starters-panel").classList.toggle("active-turn", isStarterSlot);
    document.getElementById("round-bench-panel").classList.toggle("active-turn", !isStarterSlot);
  }

  function needsSummaryText() {
    var parts = [];
    ["Guard", "Forward", "Center"].forEach(function (posKey) {
      if (state.needs[posKey] > 0) parts.push(state.needs[posKey] + " " + POS_LABEL[posKey]);
    });
    return parts.join(", ");
  }

  function renderRound() {
    var picked = pickRandomCombo();
    if (!picked) {
      // No more valid combos available; end game early with whatever we have.
      renderFinal();
      return;
    }
    state.usedComboIndexes.push(picked.index);
    state.currentCombo = picked.combo;

    renderProgress();
    renderSlotsPanels();

    var isStarterSlot = state.round <= STARTERS_COUNT;
    var meta = document.getElementById("round-meta");
    meta.innerHTML = "סיבוב " + state.round + " מתוך " + TOTAL_ROUNDS +
      ' &middot; <span class="slot-label ' + (isStarterSlot ? "starter" : "bench") + '">' +
      (isStarterSlot ? "חמישייה פותחת" : "ספסל") + " &middot; נדרשים עוד: " + needsSummaryText() + "</span>";

    document.getElementById("round-team").textContent = picked.combo.team;
    document.getElementById("round-season").textContent = "עונת " + formatSeason(picked.combo.season);

    var grid = document.getElementById("players-grid");
    grid.innerHTML = "";
    picked.combo.players.forEach(function (player) {
      var taken = state.pickedNames.has(normalizeName(player.name));
      var slotFull = !taken && (!player.position || !(state.needs[player.position] > 0));
      var disabled = taken || slotFull;
      var btn = document.createElement("button");
      btn.className = "player-btn";
      btn.disabled = disabled;
      btn.innerHTML = player.name +
        (player.position ? '<span class="pos-tag">' + player.position + "</span>" : "") +
        (typeof player.rating === "number" ? '<span class="rating-tag">' + player.rating + "</span>" : "") +
        (taken ? '<span class="taken-tag">כבר נבחר</span>' : (slotFull ? '<span class="taken-tag">המשבצת מלאה</span>' : ""));
      if (!disabled) {
        btn.addEventListener("click", function () {
          selectPlayer(player, picked.combo);
        });
      }
      grid.appendChild(btn);
    });

    var rerollBtn = document.getElementById("btn-reroll");
    document.getElementById("reroll-count").textContent = state.rerolls;
    rerollBtn.disabled = state.rerolls <= 0;

    showScreen("round");
  }

  function reroll() {
    if (state.rerolls <= 0) return;
    state.rerolls--;
    renderRound();
  }

  function selectPlayer(player, combo) {
    state.pickedNames.add(normalizeName(player.name));
    state.needs[player.position]--;
    state.squad.push({
      player: player.name,
      position: player.position,
      rating: player.rating,
      offRating: player.offRating,
      defRating: player.defRating,
      archetype: player.archetype,
      team: combo.team,
      season: combo.season,
      slot: state.round <= STARTERS_COUNT ? "starter" : "bench",
      slotLabel: POS_LABEL[player.position],
    });
    state.round++;
    if (state.round > TOTAL_ROUNDS) {
      renderFinal();
      return;
    }
    if (state.round === STARTERS_COUNT + 1) {
      state.needs = freshNeeds(); // entering the bench section
    }
    renderRound();
  }

  function playerRating(entry) {
    return typeof entry.rating === "number" ? entry.rating : 65;
  }

  function average(entries) {
    if (entries.length === 0) return 0;
    var total = 0;
    entries.forEach(function (e) {
      total += playerRating(e);
    });
    return total / entries.length;
  }

  var STARTER_WEIGHT = 0.65;
  var BENCH_WEIGHT = 0.35;

  function ratingTier(rating) {
    if (typeof rating !== "number") return "tier-solid";
    if (rating >= 90) return "tier-elite";
    if (rating >= 80) return "tier-great";
    if (rating >= 70) return "tier-good";
    return "tier-solid";
  }

  function renderFinal() {
    var startersGrid = document.getElementById("starters-grid");
    var benchGrid = document.getElementById("bench-grid");
    startersGrid.innerHTML = "";
    benchGrid.innerHTML = "";

    var system = state.selectedSystem;
    var starPlayer = system ? window.PlaySystemsAPI.findStarPlayer(state.squad) : null;

    state.squad.forEach(function (entry) {
      var card = document.createElement("div");
      card.className = "player-card-v2 " + ratingTier(entry.rating);
      var fitTag = "";
      if (system) {
        var fits = window.PlaySystemsAPI.fits(entry, system, starPlayer);
        fitTag = '<span class="archetype-tag ' + (fits ? "fit-good" : "fit-bad") + '">' +
          (fits ? "✔ מתאים לשיטה" : "✘ לא מתאים") + "</span>";
      }
      card.innerHTML =
        (typeof entry.rating === "number" ? '<div class="player-card-rating">' + entry.rating + "</div>" : "") +
        '<div class="player-card-pos">' + (entry.position || "") + "</div>" +
        '<div class="player-card-name">' + entry.player + "</div>" +
        '<div class="player-card-meta">' + entry.slotLabel + " &middot; " + entry.team + " " + formatSeason(entry.season) + "</div>" +
        '<div class="player-card-meta">' +
          (typeof entry.offRating === "number" ? '<span class="off-tag">התק׳ ' + entry.offRating + "</span>" : "") +
          (typeof entry.defRating === "number" ? '<span class="def-tag">הג׳ ' + entry.defRating + "</span>" : "") +
          (entry.archetype ? '<span class="archetype-tag">' + entry.archetype.label + "</span>" : "") +
          fitTag +
        "</div>";
      (entry.slot === "starter" ? startersGrid : benchGrid).appendChild(card);
    });

    var starters = state.squad.filter(function (e) { return e.slot === "starter"; });
    var bench = state.squad.filter(function (e) { return e.slot === "bench"; });
    var summaryEl = document.getElementById("squad-rating-summary");
    var weighted = average(starters) * STARTER_WEIGHT + average(bench) * BENCH_WEIGHT;
    var chemistry = chemistryBonus(state.squad);
    var systemFit = system ? systemFitScore(starters, bench, system, starPlayer) : 0;
    if (summaryEl) {
      var html = "דירוג משוקלל של ההרכב (65% חמישייה פותחת, 35% ספסל): <strong>" + weighted.toFixed(1) + "</strong>";
      if (system) {
        html += "<br>שיטת המשחק: <strong>" + system.label + "</strong>" +
          "<br>התאמה לשיטה: <strong>" + (systemFit >= 0 ? "+" : "") + systemFit.toFixed(1) + "</strong>";
      }
      if (chemistry > 0) {
        html += "<br>בונוס כימיה (שחקנים מאותה קבוצה): <strong>+" + chemistry + "</strong>";
      }
      var finalTotal = weighted + chemistry + systemFit;
      if (chemistry > 0 || system) {
        html += "<br>דירוג סופי כולל הכל: <strong>" + finalTotal.toFixed(1) + "</strong>";
      }
      summaryEl.innerHTML = html;
    }

    window.Achievements.markPlayed("single");
    window.Achievements.unlock("single_first");
    if (weighted >= 85) window.Achievements.unlock("single_elite");
    if (state.squad.some(function (e) { return typeof e.rating === "number" && e.rating >= 95; })) {
      window.Achievements.unlock("single_legend");
    }

    showScreen("final");
  }

  function startGame() {
    state.usedComboIndexes = [];
    state.pickedNames = new Set();
    state.squad = [];
    state.round = 1;
    state.rerolls = MAX_REROLLS;
    state.needs = freshNeeds();
    renderRound();
  }

  function chemistryBonus(squad) {
    var counts = {};
    squad.forEach(function (e) {
      counts[e.team] = (counts[e.team] || 0) + 1;
    });
    var bonus = 0;
    Object.keys(counts).forEach(function (team) {
      var c = counts[team];
      if (c >= 2) bonus += (c - 1) * 3;
    });
    return bonus;
  }

  // Display-only: single mode has no opponent to simulate against, so this
  // just shows how well the drafted squad matches the chosen system, weighted
  // 65/35 like the rest of the squad rating (no offense/defense split here).
  function systemFitScore(starters, bench, system, starPlayer) {
    function avgFit(group) {
      if (group.length === 0) return 0;
      var total = 0;
      group.forEach(function (e) {
        var fit = window.PlaySystemsAPI.fitBonus(e, system, starPlayer);
        total += (fit.off + fit.def) / 2;
      });
      return total / group.length;
    }
    if (bench.length === 0) return avgFit(starters);
    if (starters.length === 0) return avgFit(bench);
    return avgFit(starters) * STARTER_WEIGHT + avgFit(bench) * BENCH_WEIGHT;
  }

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-restart").addEventListener("click", startGame);
  document.getElementById("btn-reroll").addEventListener("click", reroll);

  document.querySelectorAll("#era-filter-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#era-filter-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      state.eraMin = parseInt(btn.dataset.min, 10);
      state.eraMax = parseInt(btn.dataset.max, 10);
    });
  });

  function renderSystemGrid() {
    var grid = document.getElementById("single-system-grid");
    grid.innerHTML = "";
    var noneCard = document.createElement("button");
    noneCard.className = "system-card" + (!state.selectedSystem ? " selected" : "");
    noneCard.innerHTML = '<div class="system-name">ללא שיטה</div><div class="system-desc">בלי בונוס/קנס התאמה</div>';
    noneCard.addEventListener("click", function () {
      state.selectedSystem = null;
      renderSystemGrid();
    });
    grid.appendChild(noneCard);

    window.PlaySystems.forEach(function (sys) {
      var card = document.createElement("button");
      card.className = "system-card" + (state.selectedSystem === sys ? " selected" : "");
      card.innerHTML = '<div class="system-name">' + sys.label + '</div><div class="system-desc">' + sys.desc + "</div>";
      card.addEventListener("click", function () {
        state.selectedSystem = sys;
        renderSystemGrid();
      });
      grid.appendChild(card);
    });
  }

  renderSystemGrid();
})();
