(function () {
  "use strict";

  var TOTAL_ROUNDS = 10;
  var MAX_REROLLS = 2;
  var TRADES_ALLOWED = 2;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: "מגן", Forward: "חלוץ", Center: "סנטר" };

  var state = {
    usedComboIndexes: [],
    pickedNames: new Set(), // normalized player name -> taken
    squad: [], // { player, position, rating, team, season, slot, slotLabel }
    currentCombo: null,
    rerolls: MAX_REROLLS,
    tradesRemaining: TRADES_ALLOWED,
    lastTradeMessage: "",
    needsByHalf: null, // { starter: {Guard,Forward,Center}, bench: {...} } - remaining open slots per half
    eraMin: 0,
    eraMax: 9999,
    selectedSystem: null,
    budgetTotal: 0, // 0 = no budget cap
    budgetRemaining: 0,
  };

  var TOP_SQUADS_KEY = "single_top_squads_v1";
  var MAX_TOP_SQUADS = 5;
  var lineupSelection = null; // the squad entry currently picked for a starter/bench swap, or null

  function freshNeeds() {
    return { Guard: 2, Forward: 2, Center: 1 };
  }

  function freshNeedsByHalf() {
    return { starter: freshNeeds(), bench: freshNeeds() };
  }

  function positionHasRoom(pos) {
    return state.needsByHalf.starter[pos] > 0 || state.needsByHalf.bench[pos] > 0;
  }

  function showScreen(name) {
    window.AppNav.showScreen(name);
  }

  function loadTopSquads() {
    try {
      var raw = localStorage.getItem(TOP_SQUADS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveTopSquads(list) {
    try {
      localStorage.setItem(TOP_SQUADS_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore storage failures
    }
  }

  // Adds the just-finished squad to the top-5 leaderboard if it qualifies.
  // Returns the new 1-based rank, or null if it didn't make the cut.
  function maybeAddToLeaderboard(finalTotal) {
    if (window.Auth && !window.Auth.canSave()) return null; // guest mode - nothing persists
    var list = loadTopSquads();
    var rounded = Math.round(finalTotal * 10) / 10;
    var qualifies = list.length < MAX_TOP_SQUADS || rounded > list[list.length - 1].rating;
    if (!qualifies) return null;

    var entry = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      rating: rounded,
      date: new Date().toISOString(),
      budgetMode: state.budgetTotal > 0,
      systemLabel: state.selectedSystem ? state.selectedSystem.label : null,
      squad: state.squad.map(function (e) {
        return {
          player: e.player, position: e.position, rating: e.rating,
          offRating: e.offRating, defRating: e.defRating, archetype: e.archetype,
          team: e.team, season: e.season, slot: e.slot, slotLabel: e.slotLabel,
        };
      }),
    };
    list.push(entry);
    list.sort(function (a, b) { return b.rating - a.rating; });
    list = list.slice(0, MAX_TOP_SQUADS);
    saveTopSquads(list);

    var rank = null;
    list.forEach(function (e, i) {
      if (e.id === entry.id) rank = i + 1;
    });
    return rank;
  }

  function renderBestDisplay() {
    var el = document.getElementById("single-best-display");
    var list = loadTopSquads();
    if (list.length > 0) {
      el.hidden = false;
      el.textContent = "שיא אישי: " + list[0].rating.toFixed(1);
    } else {
      el.hidden = true;
    }
  }

  function renderLeaderboardScreen() {
    var container = document.getElementById("single-leaderboard-list");
    container.innerHTML = "";
    var list = loadTopSquads();
    if (list.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;color:var(--text-dim);">עדיין אין הרכבים שמורים בטבלת השיאים. השלימו בנייה כדי להתחיל!</p>';
      return;
    }
    list.forEach(function (entry, i) {
      var row = document.createElement("div");
      row.className = "leaderboard-row";
      var dateStr = new Date(entry.date).toLocaleDateString("he-IL");

      var header = document.createElement("button");
      header.className = "leaderboard-row-header";
      header.innerHTML =
        '<span class="leaderboard-rank">#' + (i + 1) + "</span>" +
        '<span class="leaderboard-rating">' + entry.rating.toFixed(1) + "</span>" +
        '<span class="leaderboard-meta">' + dateStr +
          (entry.budgetMode ? " &middot; מצב תקציב" : "") +
          (entry.systemLabel ? " &middot; " + entry.systemLabel : "") +
        "</span>";
      row.appendChild(header);

      var body = document.createElement("div");
      body.className = "leaderboard-row-body";
      body.hidden = true;
      row.appendChild(body);

      header.addEventListener("click", function () {
        var willShow = body.hidden;
        container.querySelectorAll(".leaderboard-row-body").forEach(function (b) { b.hidden = true; });
        if (!willShow) return;
        body.innerHTML = "";
        var grid = document.createElement("div");
        grid.className = "squad-grid";
        entry.squad.forEach(function (e) {
          var card = document.createElement("div");
          card.className = "squad-player-card";
          card.innerHTML =
            '<div class="name">' + e.player +
              (typeof e.rating === "number" ? '<span class="rating-tag">' + e.rating + "</span>" : "") + "</div>" +
            '<div class="meta">' + e.slotLabel + " &middot; " + e.team + " " + formatSeason(e.season) + "</div>";
          grid.appendChild(card);
        });
        body.appendChild(grid);
        body.hidden = false;
      });

      container.appendChild(row);
    });
  }

  function showLeaderboardScreen() {
    renderLeaderboardScreen();
    showScreen("singleLeaderboard");
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

  function playerCost(player) {
    return typeof player.rating === "number" ? player.rating : 65;
  }

  function canAfford(player) {
    return state.budgetTotal <= 0 || playerCost(player) <= state.budgetRemaining;
  }

  function comboHasEligiblePlayer(combo) {
    return combo.players.some(function (p) {
      if (state.pickedNames.has(normalizeName(p.name))) return false;
      if (!p.position) return false;
      if (!canAfford(p)) return false;
      return positionHasRoom(p.position);
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

  function renderProgress(pickNumber) {
    var bar = document.getElementById("progress-bar");
    bar.innerHTML = "";
    for (var i = 1; i <= TOTAL_ROUNDS; i++) {
      var dot = document.createElement("div");
      dot.className = "progress-dot";
      if (i < pickNumber) dot.classList.add("filled");
      if (i === pickNumber) dot.classList.add("current");
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
  }

  function renderRound() {
    var picked = pickRandomCombo();
    if (!picked) {
      // No more valid combos available; move on to the lineup screen with whatever we have.
      showLineupScreen();
      return;
    }
    state.usedComboIndexes.push(picked.index);
    state.currentCombo = picked.combo;

    var pickNumber = state.squad.length + 1;
    renderProgress(pickNumber);
    renderSlotsPanels();

    var meta = document.getElementById("round-meta");
    meta.innerHTML = "סיבוב " + pickNumber + " מתוך " + TOTAL_ROUNDS +
      (state.budgetTotal > 0 ? ' &middot; <span class="cost-tag">תקציב נותר: ' + state.budgetRemaining + "</span>" : "");

    document.getElementById("round-team").innerHTML = window.TeamBadge.html(picked.combo.team) + picked.combo.team;
    document.getElementById("round-season").textContent = "עונת " + formatSeason(picked.combo.season);

    var grid = document.getElementById("players-grid");
    grid.innerHTML = "";
    var sortedPlayers = picked.combo.players.slice().sort(function (a, b) {
      return (b.rating || 0) - (a.rating || 0);
    });
    sortedPlayers.forEach(function (player) {
      var taken = state.pickedNames.has(normalizeName(player.name));
      var tooExpensive = !taken && !canAfford(player);
      var room1 = !taken && !tooExpensive && player.position && state.needsByHalf.starter[player.position] > 0;
      var room2 = !taken && !tooExpensive && player.position && state.needsByHalf.bench[player.position] > 0;
      var noRoomAtAll = !taken && !tooExpensive && player.position && !room1 && !room2;

      var card = document.createElement("div");
      card.className = "player-dual-card";
      var info = document.createElement("div");
      info.className = "player-dual-info";
      info.innerHTML = player.name +
        (player.position ? '<span class="pos-tag">' + player.position + "</span>" : "") +
        (typeof player.rating === "number" ? '<span class="rating-tag">' + player.rating + "</span>" : "") +
        (state.budgetTotal > 0 ? '<span class="cost-tag">עלות: ' + playerCost(player) + "</span>" : "") +
        (taken ? '<span class="taken-tag">כבר נבחר</span>' :
          (tooExpensive ? '<span class="taken-tag">יקר מדי</span>' :
            (noRoomAtAll ? '<span class="taken-tag">המשבצת מלאה</span>' : "")));
      card.appendChild(info);

      if (!taken && !tooExpensive && !noRoomAtAll && player.position) {
        var actions = document.createElement("div");
        actions.className = "player-dual-actions";
        [{ half: "starter", label: "לחמישייה הפותחת", room: room1 }, { half: "bench", label: "לספסל", room: room2 }].forEach(function (opt) {
          var btn = document.createElement("button");
          btn.className = "player-dual-btn";
          btn.textContent = opt.label;
          btn.disabled = !opt.room;
          if (opt.room) {
            btn.addEventListener("click", function () {
              selectPlayer(player, picked.combo, opt.half);
            });
          }
          actions.appendChild(btn);
        });
        card.appendChild(actions);
      }

      grid.appendChild(card);
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

  function selectPlayer(player, combo, half) {
    window.Effects.playClick();
    if (typeof player.rating === "number" && player.rating >= 90) {
      window.Effects.wowPick(player.name, player.rating);
    }
    state.pickedNames.add(normalizeName(player.name));
    state.needsByHalf[half][player.position]--;
    if (state.budgetTotal > 0) state.budgetRemaining -= playerCost(player);
    state.squad.push({
      player: player.name,
      position: player.position,
      rating: player.rating,
      offRating: player.offRating,
      defRating: player.defRating,
      archetype: player.archetype,
      team: combo.team,
      season: combo.season,
      slot: half,
      slotLabel: POS_LABEL[player.position],
    });
    if (state.squad.length >= TOTAL_ROUNDS) {
      showLineupScreen();
      return;
    }
    renderRound();
  }

  function renderLineupSlotsPanel(containerId, slotArm) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    var picks = state.squad.filter(function (e) { return e.slot === slotArm; });
    buildSlotDisplay(picks).forEach(function (slot) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip" + (slot.pick ? " filled swappable" : "");
      if (slot.pick && slot.pick === lineupSelection) chip.classList.add("selected-swap");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + slot.label + "</span>" +
        (slot.pick ? '<span class="h2h-slot-player">' + slot.pick.player +
          (typeof slot.pick.rating === "number" ? '<span class="rating-tag">' + slot.pick.rating + "</span>" : "") +
          "</span>" : "");
      if (slot.pick) {
        chip.addEventListener("click", function () {
          onLineupChipClick(slot.pick);
        });
      }
      container.appendChild(chip);
    });
  }

  function onLineupChipClick(entry) {
    if (!lineupSelection) {
      lineupSelection = entry;
    } else if (lineupSelection === entry) {
      lineupSelection = null;
    } else if (lineupSelection.position === entry.position) {
      // Same position on both sides, so swapping keeps the required
      // 2 guards / 2 forwards / 1 center balance in each half.
      var tmp = lineupSelection.slot;
      lineupSelection.slot = entry.slot;
      entry.slot = tmp;
      lineupSelection = null;
    } else {
      lineupSelection = entry;
    }
    renderLineupScreen();
  }

  function renderLineupScreen() {
    renderLineupSlotsPanel("single-lineup-starters", "starter");
    renderLineupSlotsPanel("single-lineup-bench", "bench");
  }

  function showLineupScreen() {
    window.Effects.playBuzzer();
    lineupSelection = null;
    renderLineupScreen();
    showScreen("singleLineup");
  }

  var TRADE_OFFER_COUNT = 3;
  var pendingTradeOffer = null; // { idx, offers: [{player, combo}, ...] } or null

  function renderTradeScreen() {
    document.getElementById("single-trade-count").textContent =
      "נשארו לכם " + state.tradesRemaining + " הזדמנויות מסחר";
    document.getElementById("single-trade-note").textContent = state.lastTradeMessage || "";
    document.getElementById("single-trade-offer-actions").hidden = !pendingTradeOffer;
    document.getElementById("btn-single-trade-continue").disabled = !!pendingTradeOffer;

    var grid = document.getElementById("single-trade-grid");
    grid.innerHTML = "";

    if (pendingTradeOffer) {
      renderTradeOffer(grid);
      return;
    }

    state.squad.forEach(function (entry, idx) {
      var card = document.createElement("div");
      card.className = "squad-player-card";
      card.innerHTML =
        '<div class="name">' + entry.player +
          (typeof entry.rating === "number" ? '<span class="rating-tag">' + entry.rating + "</span>" : "") + "</div>" +
        '<div class="meta">' + entry.slotLabel + " &middot; " + POS_LABEL[entry.position] + " &middot; " +
          entry.team + " " + formatSeason(entry.season) + "</div>";

      var btn = document.createElement("button");
      btn.className = "player-dual-btn";
      btn.textContent = "🔄 נסה החלפה";
      btn.disabled = state.tradesRemaining <= 0;
      btn.addEventListener("click", function () {
        openTradeOffer(idx);
      });
      card.appendChild(btn);

      grid.appendChild(card);
    });
  }

  function renderTradeOffer(grid) {
    var entry = state.squad[pendingTradeOffer.idx];

    var current = document.createElement("div");
    current.className = "squad-player-card trade-current-card";
    current.innerHTML =
      '<div class="meta">השחקן הנוכחי שלכם</div>' +
      '<div class="name">' + entry.player +
        (typeof entry.rating === "number" ? '<span class="rating-tag">' + entry.rating + "</span>" : "") + "</div>" +
      '<div class="meta">' + entry.slotLabel + " &middot; " + POS_LABEL[entry.position] + " &middot; " +
        entry.team + " " + formatSeason(entry.season) + "</div>";
    grid.appendChild(current);

    pendingTradeOffer.offers.forEach(function (offer) {
      var card = document.createElement("div");
      card.className = "squad-player-card trade-offer-card";
      card.innerHTML =
        '<div class="meta">הצעה להחלפה</div>' +
        '<div class="name">' + offer.player.name +
          (typeof offer.player.rating === "number" ? '<span class="rating-tag">' + offer.player.rating + "</span>" : "") + "</div>" +
        '<div class="meta">' + offer.combo.team + " " + formatSeason(offer.combo.season) + "</div>";

      var btn = document.createElement("button");
      btn.className = "player-dual-btn";
      btn.textContent = "✅ בצע החלפה";
      btn.addEventListener("click", function () {
        confirmTrade(offer);
      });
      card.appendChild(btn);

      grid.appendChild(card);
    });
  }

  function openTradeOffer(idx) {
    if (state.tradesRemaining <= 0) return;
    var entry = state.squad[idx];
    var pos = entry.position;
    var allowedBudget = state.budgetTotal > 0 ? state.budgetRemaining + playerCost(entry) : Infinity;

    var seenNames = {};
    var candidates = [];
    getAllCombos().forEach(function (combo) {
      if (!comboInEra(combo)) return;
      combo.players.forEach(function (p) {
        if (p.position !== pos) return;
        var norm = normalizeName(p.name);
        if (state.pickedNames.has(norm) || seenNames[norm]) return;
        if (state.budgetTotal > 0 && playerCost(p) > allowedBudget) return;
        seenNames[norm] = true;
        candidates.push({ player: p, combo: combo });
      });
    });

    if (candidates.length === 0) {
      state.lastTradeMessage = "לא נמצא שחקן זמין להחלפה בעמדה הזו כרגע.";
      renderTradeScreen();
      return;
    }

    var shuffled = candidates.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    pendingTradeOffer = { idx: idx, offers: shuffled.slice(0, TRADE_OFFER_COUNT) };
    state.lastTradeMessage = "";
    renderTradeScreen();
  }

  function confirmTrade(offer) {
    var entry = state.squad[pendingTradeOffer.idx];
    var allowedBudget = state.budgetTotal > 0 ? state.budgetRemaining + playerCost(entry) : Infinity;
    var oldName = entry.player;
    var oldRating = entry.rating;

    state.pickedNames.delete(normalizeName(entry.player));
    state.pickedNames.add(normalizeName(offer.player.name));
    if (state.budgetTotal > 0) {
      state.budgetRemaining = allowedBudget - playerCost(offer.player);
    }

    entry.player = offer.player.name;
    entry.rating = offer.player.rating;
    entry.offRating = offer.player.offRating;
    entry.defRating = offer.player.defRating;
    entry.archetype = offer.player.archetype;
    entry.team = offer.combo.team;
    entry.season = offer.combo.season;

    state.tradesRemaining--;
    state.lastTradeMessage = "הוחלף: " + oldName + " (" + (typeof oldRating === "number" ? oldRating : "-") +
      ") ⬅ " + entry.player + " (" + (typeof entry.rating === "number" ? entry.rating : "-") + ")";
    pendingTradeOffer = null;
    renderTradeScreen();
  }

  function cancelTradeOffer() {
    pendingTradeOffer = null;
    state.lastTradeMessage = "";
    renderTradeScreen();
  }

  function showTradeScreen() {
    pendingTradeOffer = null;
    state.lastTradeMessage = "";
    renderTradeScreen();
    showScreen("singleTrade");
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
      var finalTotal = weighted + chemistry + systemFit;

      var detailHtml = "דירוג משוקלל (65% חמישייה פותחת, 35% ספסל): <strong>" + weighted.toFixed(1) + "</strong>";
      if (system) {
        detailHtml += "<br>שיטת המשחק: <strong>" + system.label + "</strong>" +
          "<br>התאמה לשיטה: <strong>" + (systemFit >= 0 ? "+" : "") + systemFit.toFixed(1) + "</strong>";
      }
      if (chemistry > 0) {
        detailHtml += "<br>בונוס כימיה (שחקנים מאותה קבוצה): <strong>+" + chemistry + "</strong>";
      }

      var afterHtml = "";
      var beforeList = loadTopSquads();
      if (window.Auth && window.Auth.isGuest()) {
        afterHtml = "🕶️ מצב אורח - ההרכב הזה לא יישמר בטבלת השיאים. הירשמו כדי לשמור שיאים אישיים!";
      } else {
        var rank = maybeAddToLeaderboard(finalTotal);
        renderBestDisplay();
        if (rank) {
          afterHtml = "🏆 נכנסתם לטבלת השיאים! מקום <strong>" + rank + "</strong> מתוך " + MAX_TOP_SQUADS;
          if (rank === 1) {
            afterHtml += " &nbsp;🎉 השיא האישי החדש שלכם!";
            window.Effects.confetti();
          }
        } else if (beforeList.length > 0) {
          afterHtml = "שיא אישי נוכחי: <strong>" + beforeList[0].rating.toFixed(1) + "</strong>";
        }
      }

      summaryEl.innerHTML =
        '<div class="final-rating-hero"><div class="value" id="squad-final-rating-value">0.0</div>' +
        '<div class="label">דירוג סופי של ההרכב</div></div>' +
        "<div>" + detailHtml + "</div>" +
        (afterHtml ? '<div style="margin-top:8px;">' + afterHtml + "</div>" : "");

      window.Effects.playBuzzer();
      window.Effects.countUp(document.getElementById("squad-final-rating-value"), finalTotal, { decimals: 1 });
      state.lastFinalTotal = finalTotal;
    }

    window.Achievements.markPlayed("single");
    window.Achievements.unlock("single_first");
    if (weighted >= 85) window.Achievements.unlock("single_elite");
    if (state.squad.some(function (e) { return typeof e.rating === "number" && e.rating >= 95; })) {
      window.Achievements.unlock("single_legend");
    }

    showScreen("final");
  }

  function renderShareCard() {
    var starters = state.squad.filter(function (e) { return e.slot === "starter"; });
    var bench = state.squad.filter(function (e) { return e.slot === "bench"; });

    function playerRowHtml(e) {
      return (
        '<div class="share-player-row"><span class="name">' + e.player + " (" + (e.position || "") + ")</span>" +
        '<span class="rating">' + (typeof e.rating === "number" ? e.rating : "-") + "</span></div>"
      );
    }

    var card = document.getElementById("single-share-card");
    card.innerHTML =
      "<h2>ההרכב שלי</h2>" +
      '<div class="share-tagline">הרכב כל הזמנים - יורוליג</div>' +
      '<div class="share-rating">' + (state.lastFinalTotal || 0).toFixed(1) + "</div>" +
      '<div class="share-rating-label">דירוג סופי</div>' +
      '<div class="share-player-list"><h4>חמישייה פותחת</h4>' + starters.map(playerRowHtml).join("") + "</div>" +
      '<div class="share-player-list"><h4>ספסל</h4>' + bench.map(playerRowHtml).join("") + "</div>" +
      '<div class="share-footer">נוצר במחולל הרכב כל הזמנים - יורוליג</div>';

    showScreen("singleShare");
  }

  function bellRandomExh(totalSpread) {
    var part = totalSpread / 3;
    return (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part;
  }

  function splitIntoQuartersExh(total) {
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

  function cumulativeLineExh(quarters) {
    var running = 0;
    return quarters.map(function (q) {
      running += q;
      return running;
    });
  }

  function playerOffenseForExh(e) {
    var base = typeof e.offRating === "number" ? e.offRating : playerRating(e);
    base += e.archetype ? e.archetype.offBonus : 0;
    if (state.selectedSystem) base += window.PlaySystemsAPI.fitBonus(e, state.selectedSystem, null).off;
    return base;
  }

  function playerDefenseForExh(e) {
    var base = typeof e.defRating === "number" ? e.defRating : playerRating(e);
    base += e.archetype ? e.archetype.defBonus : 0;
    if (state.selectedSystem) base += window.PlaySystemsAPI.fitBonus(e, state.selectedSystem, null).def;
    return base;
  }

  function weightedValue(starters, bench, valueFn) {
    function avg(group) {
      if (group.length === 0) return 0;
      var total = 0;
      group.forEach(function (e) { total += valueFn(e); });
      return total / group.length;
    }
    if (bench.length === 0) return avg(starters);
    if (starters.length === 0) return avg(bench);
    return avg(starters) * STARTER_WEIGHT + avg(bench) * BENCH_WEIGHT;
  }

  function ratingForHistoricalCombo(players, valueFn) {
    var sorted = players.slice().sort(function (a, b) { return playerRating(b) - playerRating(a); });
    return weightedValue(sorted.slice(0, 5), sorted.slice(5), valueFn);
  }

  function playExhibitionGame() {
    var starters = state.squad.filter(function (e) { return e.slot === "starter"; });
    var bench = state.squad.filter(function (e) { return e.slot === "bench"; });
    var myOffense = weightedValue(starters, bench, playerOffenseForExh);
    var myDefense = weightedValue(starters, bench, playerDefenseForExh);

    var all = getAllCombos();
    var challenger = all[Math.floor(Math.random() * all.length)];
    var oppOffense = ratingForHistoricalCombo(challenger.players, playerOffenseForExh);
    var oppDefense = ratingForHistoricalCombo(challenger.players, playerDefenseForExh);

    var myScore = Math.round(60 + (myOffense - oppDefense) * 0.6 + bellRandomExh(20));
    var oppScore = Math.round(60 + (oppOffense - myDefense) * 0.6 + bellRandomExh(20));
    if (myScore === oppScore) {
      if (Math.random() < 0.5) myScore++;
      else oppScore++;
    }
    var won = myScore > oppScore;

    var myQuarters = cumulativeLineExh(splitIntoQuartersExh(myScore));
    var oppQuarters = cumulativeLineExh(splitIntoQuartersExh(oppScore));
    var quartersText = myQuarters.map(function (v, i) { return v + "-" + oppQuarters[i]; }).join(" &middot; ");

    var content = document.getElementById("single-exhibition-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>ההרכב שלכם נגד " + window.TeamBadge.html(challenger.team) + challenger.team + " " + formatSeason(challenger.season) + "</p>" +
      '<div class="share-rating">' + myScore + " - " + oppScore + "</div>" +
      "<p>לפי רבעים: " + quartersText + "</p>" +
      "<p>" + (won ? "🏆 ניצחתם!" : "😔 הפסדתם הפעם") + "</p>" +
      "</div>";

    if (won) {
      window.Achievements.unlock("single_exhibition_win");
      window.Effects.confetti();
    }

    showScreen("singleExhibition");
  }

  function startGame() {
    state.usedComboIndexes = [];
    state.pickedNames = new Set();
    state.squad = [];
    state.rerolls = MAX_REROLLS;
    state.tradesRemaining = TRADES_ALLOWED;
    state.lastTradeMessage = "";
    pendingTradeOffer = null;
    state.needsByHalf = freshNeedsByHalf();
    state.budgetRemaining = state.budgetTotal;
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
  document.getElementById("btn-single-share").addEventListener("click", renderShareCard);
  document.getElementById("btn-single-share-back").addEventListener("click", function () {
    showScreen("final");
  });
  document.getElementById("btn-single-exhibition").addEventListener("click", playExhibitionGame);
  document.getElementById("btn-single-exhibition-back").addEventListener("click", function () {
    showScreen("final");
  });
  document.getElementById("btn-single-lineup-continue").addEventListener("click", showTradeScreen);
  document.getElementById("btn-single-trade-continue").addEventListener("click", renderFinal);
  document.getElementById("btn-single-trade-cancel").addEventListener("click", cancelTradeOffer);
  document.getElementById("btn-single-leaderboard").addEventListener("click", showLeaderboardScreen);

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

  document.querySelectorAll("#budget-mode-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#budget-mode-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      state.budgetTotal = parseInt(btn.dataset.budget, 10);
      state.budgetRemaining = state.budgetTotal;
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
  renderBestDisplay();
})();
