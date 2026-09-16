(function () {
  "use strict";

  var TOTAL_PICKS = 10;
  var MAX_REROLLS = 2;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: window.I18n.t("common.posGuard"), Forward: window.I18n.t("common.posForward"), Center: window.I18n.t("common.posCenter") };

  var state = {
    myTeamClub: null,
    leagueSize: 20, // 20 = full season, 8 = mini-league (set on the team-select screen)
    usedComboIndexes: [],
    pickedNames: new Set(),
    myRoster: [], // { player, position, team, season, slotLabel, half }
    rerolls: MAX_REROLLS,
    needsByHalf: null, // { 1: {Guard,Forward,Center}, 2: {Guard,Forward,Center} } - remaining open slots per half
    playSystem: null, // the coaching system chosen for this season, or null
    freeAgentUsed: false, // shop unlock: once per league season (reset in chooseClub)
  };
  var freeAgentTargetEntry = null; // the search result currently picked, awaiting a roster slot to replace

  function playoffSizeFor(leagueSize) {
    return leagueSize <= 8 ? 4 : 8;
  }

  // Same ~47%/~74%-through-the-schedule ratios as the original fixed [9, 14]
  // out of 19 games, scaled to however many games this season actually has -
  // too short a mini-league (under 4 games) skips mid-season trades entirely.
  function tradeCheckpointsFor(totalGames) {
    if (totalGames < 4) return [];
    return [Math.round((totalGames * 9) / 19), Math.round((totalGames * 14) / 19)];
  }

  function freshNeeds() {
    return { Guard: 2, Forward: 2, Center: 1 };
  }

  function freshNeedsByHalf() {
    return { 1: freshNeeds(), 2: freshNeeds() };
  }

  function positionHasRoom(pos) {
    return state.needsByHalf[1][pos] > 0 || state.needsByHalf[2][pos] > 0;
  }

  var lastStandings = null; // set once the regular-season table is computed
  var lastTeams = null; // the 20 team objects for the season in progress, mutated as games are played
  var myOpponents = null; // lastTeams[1..], in the fixed order my team plays them
  var lastMyGames = null; // my team's individual game results, in play order
  var liveIndex = 0; // how many of myOpponents have been played/revealed in the "game by game" viewer
  var tradeCheckpoints = []; // offer a trade window right before these game indexes (0-based); computed per season by tradeCheckpointsFor()
  var resolvedTradeCheckpoints = {}; // which checkpoints have already been resolved (traded or skipped) this season
  var tradeSelection = null; // the roster entry currently picked to be traded away, or null
  var pendingTradeCheckpoint = null; // which tradeCheckpoints entry is currently being resolved
  var lastKnownRank = null; // my provisional standings rank as of the last revealed game, for the movement arrow
  var lineupSelection = null; // the roster entry currently picked for a swap, or null

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  function seasonLabel(season) {
    return window.I18n.t("single.seasonLabel", { season: formatSeason(season) });
  }

  // Hebrew's "מקום ה-3" construct needs no suffix, but English needs
  // "3rd" - only English gets the ordinal suffix appended here.
  function rankDisplay(n) {
    if (window.I18n.getLang() !== "en") return n;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + "th";
    switch (n % 10) {
      case 1: return n + "st";
      case 2: return n + "nd";
      case 3: return n + "rd";
      default: return n + "th";
    }
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

  function showTeamSelect() {
    window.TeamBadge.clearAccent();
    var grid = document.getElementById("league-team-grid");
    grid.innerHTML = "";
    uniqueClubs().forEach(function (club) {
      var btn = document.createElement("button");
      btn.className = "team-select-btn";
      btn.innerHTML = window.TeamBadge.html(club) + "<span>" + club + "</span>";
      btn.addEventListener("click", function () {
        chooseClub(club);
      });
      grid.appendChild(btn);
    });
    window.AppNav.showScreen("leagueTeamSelect");
  }

  function chooseClub(club) {
    window.TeamBadge.setAccent(club);
    state.myTeamClub = club;
    state.usedComboIndexes = [];
    state.pickedNames = new Set();
    state.myRoster = [];
    state.rerolls = MAX_REROLLS;
    state.needsByHalf = freshNeedsByHalf();
    state.playSystem = null;
    state.freeAgentUsed = false;
    renderDraftRound();
  }

  function reroll() {
    if (state.rerolls <= 0) return;
    state.rerolls--;
    renderDraftRound();
  }

  function pickRandomComboForMyClub() {
    var all = getAllCombos();
    var freshCandidates = [];
    var reusableCandidates = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].team !== state.myTeamClub) continue;
      var hasAvailable = all[i].players.some(function (p) {
        if (state.pickedNames.has(normalizeName(p.name))) return false;
        if (!p.position) return false;
        return positionHasRoom(p.position);
      });
      if (!hasAvailable) continue;
      if (state.usedComboIndexes.indexOf(i) === -1) {
        freshCandidates.push(i);
      } else {
        reusableCandidates.push(i);
      }
    }
    // Prefer a season we haven't shown yet; only recycle an already-seen
    // season (still picking a different, undrafted player from it) once
    // the club has run out of fresh seasons - e.g. clubs with <10 seasons
    // of EuroLeague history need this to reach a full 10-player squad.
    var candidates = freshCandidates.length > 0 ? freshCandidates : reusableCandidates;
    if (candidates.length === 0) return null;
    var idx = candidates[Math.floor(Math.random() * candidates.length)];
    return { index: idx, combo: all[idx] };
  }

  function renderDraftProgress(pickNumber) {
    var bar = document.getElementById("league-progress-bar");
    bar.innerHTML = "";
    for (var i = 1; i <= TOTAL_PICKS; i++) {
      var dot = document.createElement("div");
      dot.className = "progress-dot";
      if (i < pickNumber) dot.classList.add("filled");
      if (i === pickNumber) dot.classList.add("current");
      dot.textContent = i;
      bar.appendChild(dot);
    }
  }

  function buildSlotDisplay(picksForHalf) {
    var byPos = { Guard: [], Forward: [], Center: [] };
    picksForHalf.forEach(function (p) {
      if (byPos[p.position]) byPos[p.position].push(p);
    });
    var counters = { Guard: 0, Forward: 0, Center: 0 };
    return SLOT_TEMPLATE.map(function (posKey) {
      var idx = counters[posKey]++;
      return { posKey: posKey, label: POS_LABEL[posKey], pick: byPos[posKey][idx] || null };
    });
  }

  function renderSlotsPanel(containerId, half) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    var picks = state.myRoster.filter(function (e) {
      return e.half === half;
    });
    buildSlotDisplay(picks).forEach(function (slot) {
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

  function renderSlotsPanels() {
    renderSlotsPanel("league-squad-slots-1", 1);
    renderSlotsPanel("league-squad-slots-2", 2);
  }

  function renderDraftRound() {
    var picked = pickRandomComboForMyClub();
    if (!picked) {
      showLineupScreen();
      return;
    }
    if (state.usedComboIndexes.indexOf(picked.index) === -1) {
      state.usedComboIndexes.push(picked.index);
    }

    var pickNumber = state.myRoster.length + 1;
    renderDraftProgress(pickNumber);
    renderSlotsPanels();
    document.getElementById("league-round-meta").textContent =
      window.I18n.t("league.pickOf", { n: pickNumber, total: TOTAL_PICKS, club: state.myTeamClub });

    document.getElementById("league-round-team").innerHTML = window.TeamBadge.html(picked.combo.team) + picked.combo.team;
    document.getElementById("league-round-season").textContent = seasonLabel(picked.combo.season);

    var grid = document.getElementById("league-players-grid");
    grid.innerHTML = "";
    var sortedPlayers = picked.combo.players.slice().sort(function (a, b) {
      return (b.rating || 0) - (a.rating || 0);
    });
    sortedPlayers.forEach(function (player) {
      var taken = state.pickedNames.has(normalizeName(player.name));
      var room1 = !taken && player.position && state.needsByHalf[1][player.position] > 0;
      var room2 = !taken && player.position && state.needsByHalf[2][player.position] > 0;
      var noRoomAtAll = !taken && player.position && !room1 && !room2;

      var card = document.createElement("div");
      card.className = "player-dual-card";
      var info = document.createElement("div");
      info.className = "player-dual-info";
      info.innerHTML = player.name +
        (player.position ? '<span class="pos-tag">' + player.position + "</span>" : "") +
        window.RatingTag.html(player.rating) +
        (typeof player.offRating === "number" ? '<span class="off-tag">' + window.I18n.t("common.offAbbr") + " " + player.offRating + "</span>" : "") +
        (typeof player.defRating === "number" ? '<span class="def-tag">' + window.I18n.t("common.defAbbr") + " " + player.defRating + "</span>" : "") +
        (player.archetype ? '<span class="archetype-tag">' + player.archetype.label + "</span>" : "") +
        (taken ? '<span class="taken-tag">' + window.I18n.t("common.takenTag") + "</span>" : (noRoomAtAll ? '<span class="taken-tag">' + window.I18n.t("common.slotFullTag") + "</span>" : ""));
      card.appendChild(info);

      if (!taken && !noRoomAtAll && player.position) {
        var actions = document.createElement("div");
        actions.className = "player-dual-actions";
        [1, 2].forEach(function (half) {
          var hasRoom = half === 1 ? room1 : room2;
          var btn = document.createElement("button");
          btn.className = "player-dual-btn";
          btn.textContent = half === 1 ? window.I18n.t("common.toStarters") : window.I18n.t("common.toBench");
          btn.disabled = !hasRoom;
          if (hasRoom) {
            btn.addEventListener("click", function () {
              selectMyPlayer(player, picked.combo, half);
            });
          }
          actions.appendChild(btn);
        });
        card.appendChild(actions);
      }

      grid.appendChild(card);
    });

    var rerollBtn = document.getElementById("btn-league-reroll");
    document.getElementById("league-reroll-count").textContent = state.rerolls;
    rerollBtn.disabled = state.rerolls <= 0;

    window.AppNav.showScreen("leagueDraft");
  }

  function selectMyPlayer(player, combo, half) {
    window.Effects.playClick();
    if (typeof player.rating === "number" && player.rating >= 90) {
      window.Effects.wowPick(player.name, player.rating);
    }
    state.pickedNames.add(normalizeName(player.name));
    state.needsByHalf[half][player.position]--;
    state.myRoster.push({
      player: player.name,
      position: player.position,
      rating: player.rating,
      offRating: player.offRating,
      defRating: player.defRating,
      archetype: player.archetype,
      team: combo.team,
      season: combo.season,
      slotLabel: POS_LABEL[player.position],
      half: half,
    });
    if (state.myRoster.length >= TOTAL_PICKS) {
      showLineupScreen();
      return;
    }
    renderDraftRound();
  }

  function renderLineupSlotsPanel(containerId, half) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    var picks = state.myRoster.filter(function (e) {
      return e.half === half;
    });
    buildSlotDisplay(picks).forEach(function (slot) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip" + (slot.pick ? " filled swappable" : "");
      if (slot.pick && slot.pick === lineupSelection) chip.classList.add("selected-swap");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + slot.label + "</span>" +
        (slot.pick ? '<span class="h2h-slot-player">' + slot.pick.player +
          window.RatingTag.html(slot.pick.rating) +
          "</span>" : "");
      if (slot.pick) {
        chip._entry = slot.pick;
      }
      container.appendChild(chip);
    });
  }

  // Same-position swap: keeps the required 2 guards / 2 forwards / 1 center
  // balance in each half, whether triggered by tap-then-tap or by a drag.
  function swapLineupEntries(a, b) {
    var tmp = a.half;
    a.half = b.half;
    b.half = tmp;
  }

  function onLineupChipClick(entry) {
    if (!lineupSelection) {
      lineupSelection = entry;
    } else if (lineupSelection === entry) {
      lineupSelection = null;
    } else if (lineupSelection.position === entry.position) {
      swapLineupEntries(lineupSelection, entry);
      lineupSelection = null;
    } else {
      lineupSelection = entry;
    }
    renderLineupScreen();
  }

  function renderLineupScreen() {
    renderLineupSlotsPanel("league-lineup-starters", 1);
    renderLineupSlotsPanel("league-lineup-bench", 2);
    var chips = document.querySelectorAll("#league-lineup-starters .filled, #league-lineup-bench .filled");
    window.ChipDrag.wireGroup(chips, {
      getEntry: function (chipEl) { return chipEl._entry; },
      isValidTarget: function (dragged, other) { return dragged !== other && dragged.position === other.position; },
      onDrop: function (dragged, other) {
        swapLineupEntries(dragged, other);
        lineupSelection = null;
        renderLineupScreen();
      },
      onTap: onLineupChipClick,
    });

    var freeAgentBtn = document.getElementById("btn-league-freeagent-open");
    freeAgentBtn.hidden = !(window.Shop && window.Shop.isOwned("freeAgentSigning")) || state.freeAgentUsed;
  }

  function showLineupScreen() {
    window.Effects.playBuzzer();
    lineupSelection = null;
    renderLineupScreen();
    window.AppNav.showScreen("leagueLineup");
  }

  function playerRating(p) {
    return typeof p.rating === "number" ? p.rating : 65; // fallback for the rare unrated record
  }

  function playerOffense(p) {
    var base = typeof p.offRating === "number" ? p.offRating : playerRating(p);
    return base + (p.archetype ? p.archetype.offBonus : 0);
  }

  function playerDefense(p) {
    var base = typeof p.defRating === "number" ? p.defRating : playerRating(p);
    return base + (p.archetype ? p.archetype.defBonus : 0);
  }

  function average(players, valueFn) {
    if (players.length === 0) return 0;
    var fn = valueFn || playerRating;
    var total = 0;
    players.forEach(function (p) {
      total += fn(p);
    });
    return total / players.length;
  }

  var STARTER_WEIGHT = 0.65;
  var BENCH_WEIGHT = 0.35;

  // Starters carry more weight than bench, since they play more minutes.
  function weightedTeamValue(starters, bench, valueFn) {
    if (bench.length === 0) return average(starters, valueFn);
    if (starters.length === 0) return average(bench, valueFn);
    return average(starters, valueFn) * STARTER_WEIGHT + average(bench, valueFn) * BENCH_WEIGHT;
  }

  function weightedTeamRating(starters, bench) {
    return weightedTeamValue(starters, bench, playerRating);
  }

  function weightedOffense(starters, bench) {
    return weightedTeamValue(starters, bench, playerOffense);
  }

  function weightedDefense(starters, bench) {
    return weightedTeamValue(starters, bench, playerDefense);
  }

  // My own roster: use the real starter/bench slots I actually assigned.
  function ratingForMyRoster(roster) {
    var starters = roster.filter(function (p) { return p.half === 1; });
    var bench = roster.filter(function (p) { return p.half === 2; });
    return weightedTeamRating(starters, bench);
  }

  // A real historical roster has no starter/bench data, so the 5 highest-rated
  // players stand in as the "starters" and the rest as bench.
  function ratingForHistoricalRoster(players) {
    var sorted = players.slice().sort(function (a, b) { return playerRating(b) - playerRating(a); });
    var starters = sorted.slice(0, 5);
    var bench = sorted.slice(5);
    return weightedTeamRating(starters, bench);
  }

  // Splits a roster into starters/bench (half-based for my own roster, top-5 by
  // rating for a historical roster with no half data) for offense/defense use.
  function splitStartersBench(players, hasHalfData) {
    if (hasHalfData) {
      return {
        starters: players.filter(function (p) { return p.half === 1; }),
        bench: players.filter(function (p) { return p.half === 2; }),
      };
    }
    var sorted = players.slice().sort(function (a, b) { return playerRating(b) - playerRating(a); });
    return { starters: sorted.slice(0, 5), bench: sorted.slice(5) };
  }

  function offenseForRoster(players, hasHalfData) {
    var split = splitStartersBench(players, hasHalfData);
    return weightedOffense(split.starters, split.bench);
  }

  function defenseForRoster(players, hasHalfData) {
    var split = splitStartersBench(players, hasHalfData);
    return weightedDefense(split.starters, split.bench);
  }

  // Only my own roster is "coached" with a chosen system - opponents just use
  // their plain offense/defense. The system's fit bonus/penalty is folded into
  // each player's value before the same 65/35 starter/bench weighting applies.
  function offenseForMyRoster(roster, system) {
    var starPlayer = window.PlaySystemsAPI.findStarPlayer(roster);
    var split = splitStartersBench(roster, true);
    return weightedTeamValue(split.starters, split.bench, function (p) {
      return playerOffense(p) + window.PlaySystemsAPI.fitBonus(p, system, starPlayer).off;
    });
  }

  function defenseForMyRoster(roster, system) {
    var starPlayer = window.PlaySystemsAPI.findStarPlayer(roster);
    var split = splitStartersBench(roster, true);
    return weightedTeamValue(split.starters, split.bench, function (p) {
      return playerDefense(p) + window.PlaySystemsAPI.fitBonus(p, system, starPlayer).def;
    });
  }

  function bellRandom(totalSpread) {
    // Sum of three smaller random draws approximates a bell curve: most
    // results land near the middle, big swings still happen but rarely -
    // feels much more like real game-score variance than one flat roll.
    var part = totalSpread / 3;
    return (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part;
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // The historical dataset skews toward notable (mostly strong) seasons, so
  // a flat random draw per opponent club risks a league field where one
  // club's random season is an all-time great roster and another's is a
  // scrub, purely by luck - not a spread of strength around where my own
  // roster actually sits. Bias each club's season toward a target strength
  // near mine (same bellRandom-around-a-target idea career.js already uses
  // for its own opponents) by picking whichever of that club's seasons
  // lands closest to the target, rather than excluding any as a hard filter
  // (clubs with few seasons on record could otherwise come up empty).
  function pickBalancedCombo(combos, myRating) {
    var target = clamp(myRating + bellRandom(16), 45, 99);
    var best = combos[0];
    var bestDiff = Infinity;
    combos.forEach(function (c) {
      var diff = Math.abs(ratingForHistoricalRoster(c.players) - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    });
    return best;
  }

  function finishDraftAndBuildLeague(mode) {
    var otherClubs = uniqueClubs().filter(function (c) {
      return c !== state.myTeamClub;
    });
    for (var i = otherClubs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = otherClubs[i];
      otherClubs[i] = otherClubs[j];
      otherClubs[j] = tmp;
    }
    var opponentClubs = otherClubs.slice(0, state.leagueSize - 1);
    var myRating = ratingForMyRoster(state.myRoster);

    var teams = [];
    teams.push({
      label: window.I18n.t("league.myTeamLabel", { club: state.myTeamClub }),
      isMine: true,
      rating: myRating,
      offense: offenseForMyRoster(state.myRoster, state.playSystem),
      defense: defenseForMyRoster(state.myRoster, state.playSystem),
      varianceMultiplier: state.playSystem ? state.playSystem.varianceMultiplier : 1,
      wins: 0,
      losses: 0,
      pf: 0,
      pa: 0,
    });

    opponentClubs.forEach(function (club) {
      var combos = combosForClub(club);
      var combo = pickBalancedCombo(combos, myRating);
      teams.push({
        label: club + " " + formatSeason(combo.season),
        isMine: false,
        rating: ratingForHistoricalRoster(combo.players),
        offense: offenseForRoster(combo.players, false),
        defense: defenseForRoster(combo.players, false),
        varianceMultiplier: 1,
        wins: 0,
        losses: 0,
        pf: 0,
        pa: 0,
      });
    });

    lastTeams = teams;
    myOpponents = teams.slice(1);
    tradeCheckpoints = tradeCheckpointsFor(myOpponents.length);
    lastMyGames = [];
    liveIndex = 0;
    resolvedTradeCheckpoints = {};
    tradeSelection = null;
    lastKnownRank = null;

    simulateOtherPairs(teams);

    if (mode === "live") {
      renderLiveLog();
      window.AppNav.showScreen("leagueLive");
    } else {
      myOpponents.forEach(function (opponent) {
        lastMyGames.push(simulateMyGame(teams[0], opponent));
      });
      finalizeStandings(teams);
      renderLeagueTable(lastStandings);
    }
  }

  // A team's score is driven by its own offense against the opponent's
  // defense, so the same team can score very differently depending on matchup.
  // varianceMultiplier lets a chosen play system make results steadier or wilder.
  function simulateMatchScore(offense, opponentDefense, varianceMultiplier) {
    var base = 60 + (offense - opponentDefense) * 0.6;
    var variance = bellRandom(20 * (varianceMultiplier || 1));
    return Math.round(base + variance);
  }

  // Games between two opponent (non-mine) teams are independent of my roster,
  // so they can all be resolved immediately regardless of sim mode.
  function simulateOtherPairs(teams) {
    for (var i = 1; i < teams.length; i++) {
      for (var j = i + 1; j < teams.length; j++) {
        var a = teams[i];
        var b = teams[j];
        var scoreA = simulateMatchScore(a.offense, b.defense, a.varianceMultiplier);
        var scoreB = simulateMatchScore(b.offense, a.defense, b.varianceMultiplier);
        if (scoreA === scoreB) {
          if (Math.random() < 0.5) scoreA++;
          else scoreB++;
        }
        a.pf += scoreA;
        a.pa += scoreB;
        b.pf += scoreB;
        b.pa += scoreA;
        if (scoreA > scoreB) {
          a.wins++;
          b.losses++;
        } else {
          b.wins++;
          a.losses++;
        }
      }
    }
  }

  // My games are resolved one at a time (immediately in "all" mode, or as each
  // is revealed in "live" mode) so a mid-season trade can affect later results.
  function simulateMyGame(myTeam, opponent) {
    var scoreA = simulateMatchScore(myTeam.offense, opponent.defense, myTeam.varianceMultiplier);
    var scoreB = simulateMatchScore(opponent.offense, myTeam.defense, opponent.varianceMultiplier);
    if (scoreA === scoreB) {
      if (Math.random() < 0.5) scoreA++;
      else scoreB++;
    }
    myTeam.pf += scoreA;
    myTeam.pa += scoreB;
    opponent.pf += scoreB;
    opponent.pa += scoreA;
    var won = scoreA > scoreB;
    if (won) {
      myTeam.wins++;
      opponent.losses++;
    } else {
      opponent.wins++;
      myTeam.losses++;
    }
    if (won && Math.abs(scoreA - scoreB) === 1) {
      window.Achievements.unlock("league_close_win");
    }
    return {
      opponent: opponent,
      myScore: scoreA,
      oppScore: scoreB,
      won: won,
      myQuarters: splitIntoQuarters(scoreA),
      oppQuarters: splitIntoQuarters(scoreB),
    };
  }

  function finalizeStandings(teams) {
    teams.sort(function (x, y) {
      if (y.wins !== x.wins) return y.wins - x.wins;
      return (y.pf - y.pa) - (x.pf - x.pa);
    });
    lastStandings = teams;
  }

  function currentProvisionalRank() {
    var snapshot = lastTeams.slice();
    snapshot.sort(function (x, y) {
      if (y.wins !== x.wins) return y.wins - x.wins;
      return (y.pf - y.pa) - (x.pf - x.pa);
    });
    var rank = -1;
    snapshot.forEach(function (t, i) {
      if (t.isMine) rank = i + 1;
    });
    return rank;
  }

  function renderLiveLog() {
    var log = document.getElementById("league-live-log");
    log.innerHTML = "";
    var wins = 0, losses = 0;
    lastMyGames.forEach(function (g) {
      if (g.won) wins++; else losses++;
      var row = document.createElement("div");
      row.className = "live-game-row " + (g.won ? "win" : "loss");
      row.innerHTML =
        "<span>" + window.I18n.t("league.vsOpponent", { opponent: g.opponent.label }) + "</span>" +
        "<span>" + g.myScore + " - " + g.oppScore + "</span>" +
        "<span>" + (g.won ? window.I18n.t("league.winLabel") : window.I18n.t("league.lossLabel")) + "</span>";
      log.appendChild(row);
    });

    var momentumEl = document.getElementById("league-live-momentum");
    var lastGame = lastMyGames[lastMyGames.length - 1];
    if (lastGame) {
      momentumEl.hidden = false;
      momentumEl.innerHTML =
        "<div>" + window.I18n.t("league.lastGameVs", { opponent: lastGame.opponent.label }) + "</div>" +
        '<div class="final-score">' + lastGame.myScore + " - " + lastGame.oppScore + "</div>" +
        window.MomentumGraph.html(cumulativeLine(lastGame.myQuarters), cumulativeLine(lastGame.oppQuarters), 4);
    } else {
      momentumEl.hidden = true;
    }

    document.getElementById("league-live-record").textContent = window.I18n.t("league.recordSoFar", { wins: wins, losses: losses });

    var rankEl = document.getElementById("league-live-rank");
    if (lastMyGames.length === 0) {
      rankEl.textContent = "";
    } else {
      var rank = currentProvisionalRank();
      var arrow = "–";
      if (lastKnownRank !== null) {
        if (rank < lastKnownRank) arrow = "⬆";
        else if (rank > lastKnownRank) arrow = "⬇";
      }
      rankEl.textContent = window.I18n.t("league.provisionalRank", { rank: rank }) + " " + arrow;
      lastKnownRank = rank;
    }

    var btn = document.getElementById("btn-league-live-next");
    var statusEl = document.getElementById("league-live-status");
    if (liveIndex >= myOpponents.length) {
      statusEl.textContent = window.I18n.t("league.allGamesFinished", { count: myOpponents.length });
      btn.textContent = window.I18n.t("league.viewFullTableBtn");
      window.Achievements.unlock("live_watch_full");
    } else {
      statusEl.textContent = window.I18n.t("league.gameOfTotal", { n: liveIndex + 1, total: myOpponents.length });
      btn.textContent = window.I18n.t("h2h.nextGameBtn");
    }
  }

  function liveNext() {
    if (liveIndex >= myOpponents.length) {
      finalizeStandings(lastTeams);
      renderLeagueTable(lastStandings);
      return;
    }
    if (tradeCheckpoints.indexOf(liveIndex) !== -1 && !resolvedTradeCheckpoints[liveIndex]) {
      showTradeScreen(liveIndex);
      return;
    }
    var opponent = myOpponents[liveIndex];
    lastMyGames.push(simulateMyGame(lastTeams[0], opponent));
    liveIndex++;
    renderLiveLog();
  }

  function tradeCandidatePool(position) {
    var currentNames = {};
    state.myRoster.forEach(function (e) {
      currentNames[normalizeName(e.player)] = true;
    });
    var seen = {};
    var pool = [];
    combosForClub(state.myTeamClub).forEach(function (combo) {
      combo.players.forEach(function (p) {
        if (p.position !== position) return;
        var key = normalizeName(p.name);
        if (currentNames[key] || seen[key]) return;
        seen[key] = true;
        pool.push({ player: p, combo: combo });
      });
    });
    return pool;
  }

  function renderTradeCurrent() {
    var container = document.getElementById("league-trade-current");
    container.innerHTML = "";
    state.myRoster.forEach(function (entry) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip filled swappable" + (entry === tradeSelection ? " selected-swap" : "");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + (entry.half === 1 ? window.I18n.t("league.startersShort") : window.I18n.t("common.bench")) + " · " + POS_LABEL[entry.position] + "</span>" +
        '<span class="h2h-slot-player">' + entry.player +
          window.RatingTag.html(entry.rating) +
          "</span>";
      chip.addEventListener("click", function () {
        tradeSelection = entry;
        renderTradeCurrent();
        renderTradeCandidates();
      });
      container.appendChild(chip);
    });
  }

  function renderTradeCandidates() {
    var card = document.getElementById("league-trade-candidates-card");
    var grid = document.getElementById("league-trade-candidates");
    grid.innerHTML = "";
    if (!tradeSelection) {
      card.style.display = "none";
      return;
    }
    var pool = tradeCandidatePool(tradeSelection.position);
    var candidates = shuffle(pool).slice(0, 3);
    card.style.display = "";
    if (candidates.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-dim);">' + window.I18n.t("league.noTradeCandidates") + "</p>";
      return;
    }
    candidates.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.className = "player-btn";
      btn.innerHTML = entry.player.name +
        '<span class="pos-tag">' + entry.player.position + "</span>" +
        window.RatingTag.html(entry.player.rating) +
        '<span class="taken-tag">' + entry.combo.team + " " + formatSeason(entry.combo.season) + "</span>";
      btn.addEventListener("click", function () {
        completeTrade(entry.player, entry.combo);
      });
      grid.appendChild(btn);
    });
  }

  function completeTrade(newPlayer, combo) {
    var idx = state.myRoster.indexOf(tradeSelection);
    if (idx === -1) return;
    state.myRoster[idx] = {
      player: newPlayer.name,
      position: newPlayer.position,
      rating: newPlayer.rating,
      offRating: newPlayer.offRating,
      defRating: newPlayer.defRating,
      archetype: newPlayer.archetype,
      team: combo.team,
      season: combo.season,
      slotLabel: POS_LABEL[newPlayer.position],
      half: tradeSelection.half,
    };
    lastTeams[0].rating = ratingForMyRoster(state.myRoster);
    lastTeams[0].offense = offenseForMyRoster(state.myRoster, state.playSystem);
    lastTeams[0].defense = defenseForMyRoster(state.myRoster, state.playSystem);
    window.Achievements.unlock("league_trade");
    tradeSelection = null;
    proceedAfterTradeDecision();
  }

  // ---------- Free agent signing (shop unlock, once per league season) ----------
  // Unlike the regular trade window, the candidate pool is the whole
  // historical dataset (via window.PlayerSearch) rather than just your own
  // club's history.

  function renderFreeAgentResults(query) {
    var resultsEl = document.getElementById("league-freeagent-results");
    document.getElementById("league-freeagent-slots-wrap").hidden = true;
    freeAgentTargetEntry = null;
    resultsEl.innerHTML = "";

    var trimmed = (query || "").trim();
    if (trimmed.length < 2) return;

    var currentNames = {};
    state.myRoster.forEach(function (e) { currentNames[normalizeName(e.player)] = true; });

    var matches = window.PlayerSearch.search(trimmed).filter(function (entry) {
      return !currentNames[normalizeName(entry.name)];
    });
    if (matches.length === 0) {
      resultsEl.innerHTML = '<p class="player-search-hint">' + window.I18n.t("league.noFreeAgentsFound") + "</p>";
      return;
    }
    matches.slice(0, 10).forEach(function (entry) {
      var btn = document.createElement("button");
      btn.className = "player-search-result";
      btn.innerHTML =
        '<span class="name">' + entry.name + "</span>" +
        '<span class="meta">' + entry.bestAppearance.team + " " + formatSeason(entry.bestAppearance.season) + "</span>" +
        window.RatingTag.html(entry.bestAppearance.rating);
      btn.addEventListener("click", function () {
        freeAgentTargetEntry = entry;
        renderFreeAgentSlotPicker();
      });
      resultsEl.appendChild(btn);
    });
  }

  function renderFreeAgentSlotPicker() {
    var wrap = document.getElementById("league-freeagent-slots-wrap");
    var slotsEl = document.getElementById("league-freeagent-slots");
    slotsEl.innerHTML = "";
    var position = freeAgentTargetEntry.bestAppearance.position;
    var matchingSlots = state.myRoster.filter(function (e) { return e.position === position; });
    if (matchingSlots.length === 0) {
      slotsEl.innerHTML = '<p style="color:var(--text-dim);">' + window.I18n.t("league.noSlotForPosition", { position: POS_LABEL[position] || position }) + "</p>";
    } else {
      matchingSlots.forEach(function (entry) {
        var chip = document.createElement("div");
        chip.className = "h2h-slot-chip filled swappable";
        chip.innerHTML =
          '<span class="h2h-slot-type">' + (entry.half === 1 ? window.I18n.t("league.startersShort") : window.I18n.t("common.bench")) + " · " + POS_LABEL[entry.position] + "</span>" +
          '<span class="h2h-slot-player">' + entry.player + window.RatingTag.html(entry.rating) + "</span>";
        chip.addEventListener("click", function () {
          signFreeAgent(entry);
        });
        slotsEl.appendChild(chip);
      });
    }
    wrap.hidden = false;
  }

  function signFreeAgent(rosterEntry) {
    var idx = state.myRoster.indexOf(rosterEntry);
    if (idx === -1 || !freeAgentTargetEntry) return;
    var b = freeAgentTargetEntry.bestAppearance;
    state.myRoster[idx] = {
      player: freeAgentTargetEntry.name,
      position: b.position,
      rating: b.rating,
      offRating: b.offRating,
      defRating: b.defRating,
      archetype: b.archetype,
      team: b.team,
      season: b.season,
      slotLabel: POS_LABEL[b.position],
      half: rosterEntry.half,
    };
    if (lastTeams) {
      lastTeams[0].rating = ratingForMyRoster(state.myRoster);
      lastTeams[0].offense = offenseForMyRoster(state.myRoster, state.playSystem);
      lastTeams[0].defense = defenseForMyRoster(state.myRoster, state.playSystem);
    }
    state.freeAgentUsed = true;
    freeAgentTargetEntry = null;
    window.Effects.confetti();
    window.AppNav.showScreen("leagueLineup");
    renderLineupScreen();
  }

  function showTradeScreen(checkpoint) {
    pendingTradeCheckpoint = checkpoint;
    tradeSelection = null;
    renderTradeCurrent();
    document.getElementById("league-trade-candidates-card").style.display = "none";
    var isFirst = checkpoint === tradeCheckpoints[0];
    document.getElementById("league-trade-title").textContent =
      isFirst ? window.I18n.t("league.tradeWindowFirst") : window.I18n.t("league.tradeWindowSecond");
    window.AppNav.showScreen("leagueTrade");
  }

  function proceedAfterTradeDecision() {
    if (pendingTradeCheckpoint !== null) {
      resolvedTradeCheckpoints[pendingTradeCheckpoint] = true;
      pendingTradeCheckpoint = null;
    }
    window.AppNav.showScreen("leagueLive");
    liveNext();
  }

  function seasonMvp(roster) {
    var sorted = roster.slice().sort(function (a, b) {
      // Starters get a small edge so a slightly-lower-rated starter can still
      // outrank a higher-rated bench player who played fewer minutes.
      var scoreA = playerRating(a) + (a.half === 1 ? 3 : 0);
      var scoreB = playerRating(b) + (b.half === 1 ? 3 : 0);
      return scoreB - scoreA;
    });
    return sorted[0];
  }

  function renderLeagueTable(teams) {
    window.Effects.playBuzzer();
    var myRank = -1;
    var mine = null;
    teams.forEach(function (t, i) {
      if (t.isMine) {
        myRank = i + 1;
        mine = t;
      }
    });

    var titleEl = document.getElementById("league-result-title");
    if (myRank === 1) {
      titleEl.textContent = window.I18n.t("league.championTitle");
    } else {
      titleEl.textContent = window.I18n.t("league.finishedRankTitle", { rank: rankDisplay(myRank), total: teams.length });
    }

    var mvp = seasonMvp(state.myRoster);
    var systemLine = state.playSystem
      ? "<br>" + window.I18n.t("league.playSystemLine", { system: window.PlaySystemsAPI.label(state.playSystem) })
      : "";
    document.getElementById("league-mvp").innerHTML =
      window.I18n.t("league.mvpLine", { name: mvp.player, position: POS_LABEL[mvp.position], rating: mvp.rating }) + systemLine;

    window.Achievements.markPlayed("league");
    window.Achievements.unlock("league_first");
    if (myRank === 1) {
      window.Achievements.unlock("league_champion");
      window.Effects.confetti();
    }
    if (mine && mine.losses === 0) window.Achievements.unlock("league_undefeated");
    var seasonsCompleted = window.Achievements.incrementCounter("league_seasons_completed");
    if (seasonsCompleted >= 3) window.Achievements.unlock("league_veteran");

    window.GameHistory.record({
      mode: "league",
      icon: "🏆",
      title: state.myTeamClub,
      detail: window.I18n.t("league.historyDetail", { rank: myRank, total: teams.length, wins: mine.wins, losses: mine.losses }),
      outcome: myRank === 1 ? "win" : (myRank <= playoffSizeFor(state.leagueSize) ? "neutral" : "loss"),
    });

    var tbody = document.getElementById("league-table-body");
    tbody.innerHTML = "";
    teams.forEach(function (t, i) {
      var tr = document.createElement("tr");
      if (t.isMine) tr.className = "my-team-row";
      var diff = t.pf - t.pa;
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td>" + window.TeamBadge.html(t.label, "badge-sm") + t.label + "</td>" +
        "<td>" + t.rating.toFixed(1) + "</td>" +
        "<td>" + t.wins + "</td>" +
        "<td>" + t.losses + "</td>" +
        "<td>" + (diff >= 0 ? "+" : "") + diff + "</td>";
      tbody.appendChild(tr);
    });

    var playoffSize = playoffSizeFor(state.leagueSize);
    document.getElementById("btn-league-playoffs").textContent =
      window.I18n.t("league.continueToPlayoffsDynamic", { size: playoffSize });

    window.AppNav.showScreen("leagueTable");
  }

  function playMatch(teamA, teamB) {
    var scoreA = simulateMatchScore(teamA.offense, teamB.defense, teamA.varianceMultiplier);
    var scoreB = simulateMatchScore(teamB.offense, teamA.defense, teamB.varianceMultiplier);
    if (scoreA === scoreB) {
      if (Math.random() < 0.5) scoreA++;
      else scoreB++;
    }
    return {
      teamA: teamA,
      teamB: teamB,
      scoreA: scoreA,
      scoreB: scoreB,
      winner: scoreA > scoreB ? teamA : teamB,
    };
  }

  function runPlayoffs() {
    if (!lastStandings) return;
    var size = playoffSizeFor(state.leagueSize);
    var top8 = lastStandings.slice(0, size);

    var qf = null;
    var sfTeams;
    if (size === 8) {
      var qfPairsIdx = [[0, 7], [3, 4], [2, 5], [1, 6]];
      qf = qfPairsIdx.map(function (pair) {
        return playMatch(top8[pair[0]], top8[pair[1]]);
      });
      sfTeams = qf.map(function (r) { return r.winner; });
    } else {
      // Mini-league (4-team) playoff: straight to the semifinals, no
      // quarterfinal round. Seeded 1v4 / 2v3 like the 8-team bracket above,
      // so the top two seeds can't meet before the final.
      sfTeams = [top8[0], top8[3], top8[1], top8[2]];
    }

    var sf = [
      playMatch(sfTeams[0], sfTeams[1]),
      playMatch(sfTeams[2], sfTeams[3]),
    ];

    var finalTeams = sf.map(function (r) { return r.winner; });
    var finalMatch = playMatch(finalTeams[0], finalTeams[1]);

    renderPlayoffs({ top8: top8, qf: qf, sf: sf, final: finalMatch, champion: finalMatch.winner });
  }

  function matchTeamRowHtml(team, score, isWinner) {
    return (
      '<div class="pmatch-team' + (isWinner ? " winner" : "") + (team.isMine ? " mine" : "") + '">' +
      '<span class="pmatch-name">' + window.TeamBadge.html(team.label, "badge-sm") + team.label + (team.isMine ? " ★" : "") + "</span>" +
      '<span class="pmatch-score">' + score + "</span>" +
      "</div>"
    );
  }

  function matchHtml(result) {
    return (
      '<div class="pmatch">' +
      matchTeamRowHtml(result.teamA, result.scoreA, result.winner === result.teamA) +
      matchTeamRowHtml(result.teamB, result.scoreB, result.winner === result.teamB) +
      "</div>"
    );
  }

  function describeMyRun(data) {
    var rounds = [
      { name: window.I18n.t("league.roundQF"), matches: data.qf || [] },
      { name: window.I18n.t("league.roundSF"), matches: data.sf },
      { name: window.I18n.t("league.roundFinal"), matches: [data.final] },
    ];
    var lastRoundName = null;
    var won = false;
    rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        if (m.teamA.isMine || m.teamB.isMine) {
          lastRoundName = round.name;
          won = m.winner.isMine === true;
        }
      });
    });
    return { roundName: lastRoundName, won: won };
  }

  function renderPlayoffs(data) {
    var container = document.getElementById("playoffs-bracket");
    container.innerHTML =
      (data.qf ? '<div class="playoff-round"><h3>' + window.I18n.t("league.headerQF") + "</h3>" + data.qf.map(matchHtml).join("") + "</div>" : "") +
      '<div class="playoff-round"><h3>' + window.I18n.t("league.headerSF") + "</h3>" + data.sf.map(matchHtml).join("") + "</div>" +
      '<div class="playoff-round"><h3>' + window.I18n.t("league.headerFinal") + "</h3>" + matchHtml(data.final) + "</div>";

    var titleEl = document.getElementById("playoffs-result-title");
    var myInTop8 = data.top8.some(function (t) { return t.isMine; });

    if (data.champion.isMine) {
      titleEl.textContent = "🏆 " + window.I18n.t("league.playoffChampionTitle");
      window.Achievements.unlock("league_playoff_champion");
      window.Effects.confetti();
    } else if (myInTop8) {
      var run = describeMyRun(data);
      titleEl.textContent = window.I18n.t("league.eliminatedTitle", { round: run.roundName, champion: data.champion.label });
    } else {
      var missedKey = data.qf ? "league.missedQuarterfinals" : "league.missedPlayoffs";
      titleEl.textContent = window.I18n.t("league.notReachedTitle", { missed: window.I18n.t(missedKey), champion: data.champion.label });
    }

    window.AppNav.showScreen("leaguePlayoffs");
  }

  document.getElementById("btn-league-restart").addEventListener("click", function () {
    showTeamSelect();
  });
  document.getElementById("btn-league-reroll").addEventListener("click", reroll);

  document.getElementById("btn-league-freeagent-open").addEventListener("click", function () {
    document.getElementById("league-freeagent-search").value = "";
    document.getElementById("league-freeagent-results").innerHTML = "";
    document.getElementById("league-freeagent-slots-wrap").hidden = true;
    freeAgentTargetEntry = null;
    window.AppNav.showScreen("leagueFreeAgent");
  });
  document.getElementById("btn-league-freeagent-back").addEventListener("click", function () {
    window.AppNav.showScreen("leagueLineup");
  });
  document.getElementById("league-freeagent-search").addEventListener("input", function (e) {
    renderFreeAgentResults(e.target.value);
  });

  document.querySelectorAll("#league-format-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#league-format-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("league-format-buttons"));
      state.leagueSize = parseInt(btn.dataset.leagueSize, 10);
    });
  });

  function renderSystemSelectScreen() {
    var grid = document.getElementById("league-system-grid");
    grid.innerHTML = "";
    window.PlaySystems.forEach(function (sys) {
      var card = document.createElement("button");
      card.className = "system-card" + (state.playSystem === sys ? " selected" : "");
      card.innerHTML =
        '<div class="system-name">' + window.PlaySystemsAPI.label(sys) + "</div>" +
        '<div class="system-desc">' + window.PlaySystemsAPI.desc(sys) + "</div>";
      card.addEventListener("click", function () {
        state.playSystem = sys;
        window.AppNav.showScreen("leagueSimChoice");
      });
      grid.appendChild(card);
    });
    window.AppNav.showScreen("leagueSystem");
  }

  document.getElementById("btn-league-lineup-continue").addEventListener("click", function () {
    renderSystemSelectScreen();
  });
  document.getElementById("btn-league-sim-all").addEventListener("click", function () {
    finishDraftAndBuildLeague("all");
  });
  document.getElementById("btn-league-sim-live").addEventListener("click", function () {
    finishDraftAndBuildLeague("live");
  });
  document.getElementById("btn-league-live-next").addEventListener("click", liveNext);
  document.getElementById("btn-league-trade-skip").addEventListener("click", proceedAfterTradeDecision);
  document.getElementById("btn-league-playoffs").addEventListener("click", runPlayoffs);

  window.LeagueGame = { showTeamSelect: showTeamSelect };
})();
