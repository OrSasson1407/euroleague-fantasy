(function () {
  "use strict";

  var STORAGE_KEY = "coach_career_save_v1";
  var LAST_KEY = "coach_career_last_v1";
  var ROSTER_TARGET_SIZE = 11;
  var MIN_SEASONS_BEFORE_RETIRE = 3;
  var SLOT_TEMPLATE = ["Guard", "Guard", "Forward", "Forward", "Center"];
  var POS_LABEL = { Guard: window.I18n.t("common.posGuard"), Forward: window.I18n.t("common.posForward"), Center: window.I18n.t("common.posCenter") };
  var LEAGUE_SIZE = 20;
  var SKILL_POINTS_PER_SEASON = 1;
  var SKILL_POINTS_PER_TROPHY = 2;

  var COACH_BACKGROUNDS = [
    { id: "exPlayer", captainMoraleStart: 15 },
    { id: "risingAnalyst", budgetStartMult: 1.2 },
    { id: "fitnessCoach", scoutingSkillStart: 1 },
  ];
  COACH_BACKGROUNDS.forEach(function (b) {
    b.label = window.I18n.t("coachCareer.backgrounds." + b.id + ".label");
    b.desc = window.I18n.t("coachCareer.backgrounds." + b.id + ".desc");
  });

  // Board goals are assigned by tier, not chosen - a big club demands a top
  // finish, a small one just wants to avoid the relegation zone. Each check
  // runs against the final 1-based rank out of LEAGUE_SIZE.
  var BOARD_GOALS = [
    { id: "top4", tier: "big", check: function (rank) { return rank <= 4; } },
    { id: "playoffs", tier: "mid", check: function (rank) { return rank <= 8; } },
    { id: "avoidBottom", tier: "small", check: function (rank) { return rank <= LEAGUE_SIZE - 4; } },
  ];
  BOARD_GOALS.forEach(function (g) {
    g.label = window.I18n.t("coachCareer.goals." + g.id + ".label");
    g.desc = window.I18n.t("coachCareer.goals." + g.id + ".desc");
  });

  // A one-time, permanent hire (feature 14) - unlike skill points, there's
  // no further upgrade once one is hired, matching career.js's hasAgent's
  // simplicity for a comparable one-off purchase.
  var ASSISTANT_COACH_TYPES = [
    { id: "offense", cost: 60000 },
    { id: "defense", cost: 60000 },
    { id: "development", cost: 80000 },
  ];
  ASSISTANT_COACH_TYPES.forEach(function (a) {
    a.label = window.I18n.t("coachCareer.assistant." + a.id + ".label");
    a.desc = window.I18n.t("coachCareer.assistant." + a.id + ".desc");
  });
  var ASSISTANT_COACH_TYPES_BY_ID = {};
  ASSISTANT_COACH_TYPES.forEach(function (a) { ASSISTANT_COACH_TYPES_BY_ID[a.id] = a; });

  var COACH_EVENTS = [
    {
      id: "boardMeeting",
      choiceA: { coachMeterDelta: 6 },
      choiceB: { reputationDelta: 4, coachMeterDelta: -3 },
    },
    {
      id: "mediaPressure",
      choiceA: { coachMeterDelta: 3 },
      choiceB: { reputationDelta: 6, coachMeterDelta: -2 },
    },
    {
      id: "sponsorOffer",
      choiceA: { budgetDelta: 25000 },
      choiceB: { reputationDelta: 3 },
    },
    {
      id: "veteranAdvice",
      choiceA: { moraleDelta: 8 },
      choiceB: { coachMeterDelta: 4 },
    },
    {
      id: "scoutingTrip",
      choiceA: { riskFail: 0.4, reputationDelta: 5, failReputationDelta: -2 },
      choiceB: { coachMeterDelta: 3 },
    },
    {
      id: "restDay",
      choiceA: { moraleDelta: 6, coachMeterDelta: -2 },
      choiceB: { coachMeterDelta: 4 },
    },
  ];
  COACH_EVENTS.forEach(resolveEventText);

  // Only fire when a captain is set - captain-specific narrative beats.
  var COACH_CAPTAIN_EVENTS = [
    {
      id: "captainClash",
      choiceA: { moraleDelta: -6, coachMeterDelta: 5 },
      choiceB: { moraleDelta: 8, coachMeterDelta: -4 },
    },
    {
      id: "captainLeadership",
      choiceA: { moraleDelta: 10 },
      choiceB: { reputationDelta: 4 },
    },
  ];
  COACH_CAPTAIN_EVENTS.forEach(resolveEventText);

  // Condition-triggered rather than pure random - picked by pickConflictEvent().
  var COACH_CONFLICT_EVENTS = [
    {
      id: "benchComplaint",
      choiceA: { moraleDelta: 8, coachMeterDelta: -4 },
      choiceB: { moraleDelta: -5, coachMeterDelta: 3 },
    },
    {
      id: "starDemands",
      choiceA: { budgetDelta: -15000, moraleDelta: 10 },
      choiceB: { moraleDelta: -8, reputationDelta: 3 },
    },
  ];
  COACH_CONFLICT_EVENTS.forEach(resolveEventText);

  var COACH_CRISIS_EVENTS = [
    {
      id: "starInjuryScare",
      choiceA: { budgetDelta: -20000, moraleDelta: 6 },
      choiceB: { coachMeterDelta: -6 },
    },
    {
      id: "lockerRoomScandal",
      choiceA: { moraleDelta: -10, reputationDelta: 4 },
      choiceB: { moraleDelta: 4, coachMeterDelta: -6 },
    },
  ];
  COACH_CRISIS_EVENTS.forEach(resolveEventText);

  // Triggered before the playoffs specifically - a genuinely "big game"
  // media moment, distinct from the lighter regular-season press beats.
  var COACH_PRESS_EVENTS = [
    {
      id: "playoffPreview",
      choiceA: { imageDelta: 8, coachMeterDelta: -3 },
      choiceB: { imageDelta: -2, coachMeterDelta: 4 },
    },
    {
      id: "confidenceQuestion",
      choiceA: { imageDelta: 6, riskFail: 0.3, failReputationDelta: -4 },
      choiceB: { imageDelta: 2, coachMeterDelta: 3 },
    },
  ];
  COACH_PRESS_EVENTS.forEach(resolveEventText);

  // Triggered once, right after the season recap - a reflective, personal
  // note rather than a mid-season management decision (feature: end-of-
  // season interview).
  var COACH_INTERVIEW_EVENTS = [
    {
      id: "seasonReflection",
      choiceA: { imageDelta: 5, reputationDelta: 2 },
      choiceB: { imageDelta: -3, reputationDelta: 5 },
    },
    {
      id: "futurePlans",
      choiceA: { coachMeterDelta: 5 },
      choiceB: { imageDelta: 6 },
    },
  ];
  COACH_INTERVIEW_EVENTS.forEach(resolveEventText);

  function resolveEventText(ev) {
    ev.title = window.I18n.t("coachCareer.events." + ev.id + ".title");
    ev.desc = window.I18n.t("coachCareer.events." + ev.id + ".desc");
    ev.choiceA.label = window.I18n.t("coachCareer.events." + ev.id + ".choiceA");
    ev.choiceB.label = window.I18n.t("coachCareer.events." + ev.id + ".choiceB");
  }

  var MILESTONE_DEFS = [
    { id: "wins_50", check: function (t) { return t.wins >= 50; } },
    { id: "wins_100", check: function (t) { return t.wins >= 100; } },
    { id: "seasons_5", check: function (t) { return t.seasons >= 5; } },
    { id: "seasons_10", check: function (t) { return t.seasons >= 10; } },
    { id: "trophies_1", check: function (t) { return t.trophies >= 1; } },
    { id: "trophies_3", check: function (t) { return t.trophies >= 3; } },
  ];
  MILESTONE_DEFS.forEach(function (m) {
    m.label = "🎉 " + window.I18n.t("coachCareer.milestones." + m.id);
  });

  var coach = null;
  var createState = null;
  var pendingEventKind = null; // "general" | "captain" | "conflict" | "crisis" - which pool resolveCoachEvent() came from
  var pendingSeasonTeams = null; // full 20-team array while the season is being played
  var pendingSeasonRecord = null;
  var pendingPlayoffTeams = null; // held while a pre-playoffs press event is being resolved
  var pendingPlayoffRank = null;
  var liveOpponentIndex = 0;
  var transferTargetQuery = "";

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
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

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  // Hebrew's "מקום X" construct needs no suffix, but English needs "1st"/
  // "2nd"/"3rd" rather than a bare number - same fix as league.js's rankDisplay().
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
    return list;
  }

  function combosForClub(club) {
    return getAllCombos().filter(function (c) { return c.team === club; });
  }

  function clubAverageStrength(club) {
    var total = 0, n = 0;
    getAllCombos().forEach(function (combo) {
      if (combo.team !== club) return;
      combo.players.forEach(function (p) {
        if (typeof p.rating === "number") { total += p.rating; n++; }
      });
    });
    return n > 0 ? total / n : 65;
  }

  function clubTier(strength) {
    if (strength >= 80) return "big";
    if (strength >= 68) return "mid";
    return "small";
  }

  function bellRandom(totalSpread) {
    var part = totalSpread / 3;
    return (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part;
  }

  function rosterEntryId(player, team, season) {
    return normalizeName(player) + "|" + team + "|" + season;
  }

  function buildSelectGrid(containerId, items, onPick, labelFn, descFn) {
    labelFn = labelFn || function (item) { return item.label; };
    descFn = descFn || function (item) { return item.desc; };
    var grid = document.getElementById(containerId);
    grid.innerHTML = "";
    items.forEach(function (item, i) {
      var btn = document.createElement("button");
      btn.className = "system-card" + (i === 0 ? " selected" : "");
      btn.innerHTML = '<div class="system-name">' + labelFn(item) + '</div><div class="system-desc">' + descFn(item) + "</div>";
      btn.addEventListener("click", function () {
        Array.from(grid.children).forEach(function (c) { c.classList.remove("selected"); });
        btn.classList.add("selected");
        window.UiSelect.sync(grid);
        onPick(item);
      });
      grid.appendChild(btn);
    });
    window.UiSelect.sync(grid);
  }

  function showScreen(name) {
    window.AppNav.showScreen(name);
  }

  // ---------- Persistence ----------

  function saveCoach() {
    if (window.Auth && !window.Auth.canSave()) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(coach)); } catch (e) {}
  }

  function loadCoach() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearCoach() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function saveLastCoach(summary) {
    if (window.Auth && !window.Auth.canSave()) return;
    try { localStorage.setItem(LAST_KEY, JSON.stringify(summary)); } catch (e) {}
  }

  function loadLastCoach() {
    try {
      var raw = localStorage.getItem(LAST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ---------- Home ----------

  function openHome() {
    var saved = loadCoach();
    document.getElementById("coach-continue-wrap").hidden = !saved;

    var lastEl = document.getElementById("coach-last-summary");
    var last = loadLastCoach();
    if (last) {
      lastEl.hidden = false;
      lastEl.innerHTML = window.I18n.t("coachCareer.home.lastCareerSummary", {
        name: last.name, clubs: last.clubs.length, trophies: last.trophies, seasons: last.seasons,
      });
    } else {
      lastEl.hidden = true;
    }
    showScreen("coachHome");
  }

  function continueCoach() {
    var saved = loadCoach();
    if (!saved) return;
    coach = saved;
    // localStorage round-trips these as plain data (losing the live object's
    // resolved label/desc if the UI language changed since the last save, and
    // dropping BOARD_GOALS' .check function) - re-resolve each by id from its
    // live source array so both the current language and behavior are correct.
    if (coach.boardGoal) {
      var freshGoal = BOARD_GOALS.filter(function (g) { return g.id === coach.boardGoal.id; })[0];
      if (freshGoal) coach.boardGoal = freshGoal;
    }
    if (coach.background) {
      var freshBg = COACH_BACKGROUNDS.filter(function (b) { return b.id === coach.background.id; })[0];
      if (freshBg) coach.background = freshBg;
    }
    if (coach.identitySystem) {
      var freshSys = window.PlaySystems.filter(function (s) { return s.id === coach.identitySystem.id; })[0];
      if (freshSys) coach.identitySystem = freshSys;
    }
    if (coach.phase === "jobSearch") renderJobOffers();
    else renderPreseasonHub();
    showScreen("coachHub");
  }

  // ---------- Character creation ----------

  function renderCreateScreen() {
    createState = { background: COACH_BACKGROUNDS[0], identitySystem: window.PlaySystems[0] };
    document.getElementById("coach-name-input").value = "";
    buildSelectGrid("coach-background-grid", COACH_BACKGROUNDS, function (b) { createState.background = b; });
    buildSelectGrid("coach-philosophy-grid", window.PlaySystems, function (s) { createState.identitySystem = s; },
      window.PlaySystemsAPI.label, window.PlaySystemsAPI.desc);
    showScreen("coachCreate");
  }

  function startCoachCareer() {
    var name = document.getElementById("coach-name-input").value.trim() || window.I18n.t("coachCareer.create.defaultName");
    coach = {
      name: name,
      background: createState.background,
      identitySystem: createState.identitySystem,
      reputation: 50,
      boardConfidence: 60,
      publicImage: 50,
      fanSupport: 50,
      budget: 0,
      sponsor: null,
      scoutingBoostActive: false,
      skills: { scouting: createState.background.scoutingSkillStart || 0, motivation: 0, tactics: 0 },
      skillPoints: 0,
      assistantCoach: null,
      club: null,
      contract: null,
      roster: [],
      captainId: null,
      playSystem: null,
      boardGoal: null,
      seasonNumber: 0,
      seasonHistory: [],
      milestonesCrossed: {},
      trophies: 0,
      coachOfYearCount: 0,
      crossoverSigned: false,
      phase: "jobSearch",
      fired: false,
    };
    saveCoach();
    renderJobOffers();
    showScreen("coachHub");
  }

  // ---------- Job market ----------

  // A coach's fame (how far public image sits from neutral, in either
  // direction) makes boards more willing to gamble on a bigger job than raw
  // coaching reputation alone would justify - a beloved AND a controversial
  // coach both sell tickets, so this only ever adds to marketability.
  function effectiveReputation() {
    return coach.reputation + Math.abs(coach.publicImage - 50) * 0.3;
  }

  function generateCoachJobOffers() {
    var offers = [];
    var effRep = effectiveReputation();
    if (coach.club && !coach.fired) {
      offers.push({
        club: coach.club.label, tier: coach.club.tier, stay: true,
        salary: Math.round((coach.contract ? coach.contract.salary : 40000) * (0.95 + effRep / 300)),
      });
      // A veteran coach occasionally gets a golden-handshake offer instead
      // of a normal renewal - a board-initiated nudge toward retirement.
      if (coach.seasonNumber >= 10 && Math.random() < 0.25) {
        offers.push({ special: "retire", payout: Math.round((coach.contract ? coach.contract.salary : 40000) * 1.5) });
      }
    }
    var excludeClub = coach.club ? coach.club.label : null;
    var candidates = shuffle(uniqueClubs().filter(function (c) { return c !== excludeClub; }));
    var wantedTiers = effRep >= 65 ? ["big", "mid", "mid"] : effRep >= 35 ? ["mid", "mid", "small"] : ["small", "small", "mid"];
    var used = {};
    wantedTiers.forEach(function (wantTier) {
      for (var i = 0; i < candidates.length; i++) {
        var club = candidates[i];
        if (used[club]) continue;
        var strength = clubAverageStrength(club);
        if (clubTier(strength) !== wantTier) continue;
        used[club] = true;
        offers.push({
          club: club, tier: wantTier, stay: false,
          salary: Math.round((strength * 900) * (0.85 + effRep / 250)),
        });
        return;
      }
    });
    // Fall back to any unused club if a tier had no candidates left.
    while (offers.length < (coach.club && !coach.fired ? 3 : 3)) {
      var fallback = candidates.filter(function (c) { return !used[c]; })[0];
      if (!fallback) break;
      used[fallback] = true;
      var fbStrength = clubAverageStrength(fallback);
      offers.push({ club: fallback, tier: clubTier(fbStrength), stay: false, salary: Math.round(fbStrength * 900) });
    }
    return offers;
  }

  function renderJobOffers() {
    document.getElementById("coach-hub-title").textContent = coach.fired
      ? window.I18n.t("coachCareer.jobOffers.titleFired")
      : window.I18n.t("coachCareer.jobOffers.title");
    document.getElementById("coach-hub-status").textContent = window.I18n.t("coachCareer.jobOffers.reputationLine", { rep: coach.reputation });

    var offers = generateCoachJobOffers();
    var content = document.getElementById("coach-hub-content");
    content.innerHTML = '<div class="system-select-grid" id="coach-job-grid"></div>';
    var grid = document.getElementById("coach-job-grid");
    offers.forEach(function (o) {
      var btn = document.createElement("button");
      if (o.special === "retire") {
        btn.className = "system-card";
        btn.innerHTML =
          '<div class="system-name">🤝 ' + window.I18n.t("coachCareer.jobOffers.retirementOfferLabel") + "</div>" +
          '<div class="system-desc">' + window.I18n.t("coachCareer.jobOffers.retirementOfferDesc", { payout: o.payout.toLocaleString() }) + "</div>";
        btn.addEventListener("click", finishCoachCareer);
        grid.appendChild(btn);
        return;
      }
      btn.className = "system-card";
      btn.innerHTML =
        '<div class="system-name">' + window.TeamBadge.html(o.club) + o.club + (o.stay ? " (" + window.I18n.t("coachCareer.jobOffers.staySuffix") + ")" : "") + "</div>" +
        '<div class="system-desc">' + window.I18n.t("coachCareer.jobOffers.offerDesc", { salary: o.salary.toLocaleString() }) + "</div>";
      btn.addEventListener("click", function () { acceptJob(o); });
      grid.appendChild(btn);
    });
  }

  function acceptJob(offer) {
    var strength = clubAverageStrength(offer.club);
    var isNewClub = !offer.stay;
    coach.club = { label: offer.club, tier: clubTier(strength), strength: strength };
    coach.contract = { yearsLeft: 2 + Math.floor(Math.random() * 3), salary: offer.salary };
    coach.fired = false;
    if (isNewClub) {
      coach.roster = generateStartingRoster(offer.club, strength);
      coach.captainId = null;
      coach.crossoverSigned = false;
    }
    coach.phase = "hub";
    window.Achievements.unlock("coach_first_hire");
    saveCoach();
    startNewSeason();
    showScreen("coachHub");
  }

  // ---------- Starting roster (auto-generated from the club's own history) ----------

  function generateStartingRoster(club, targetStrength) {
    var combos = combosForClub(club);
    if (combos.length === 0) return [];
    var best = window.LeagueSimCore.pickBalancedCombo(combos, targetStrength);
    var used = {};
    var entries = [];
    var MIN_NEEDED = { Guard: 2, Forward: 2, Center: 1 };

    function addPlayer(p, team, season) {
      var key = normalizeName(p.name);
      if (used[key] || !p.position) return false;
      used[key] = true;
      entries.push(makeRosterEntry(p, team, season));
      return true;
    }
    function missingPositions() {
      var counts = { Guard: 0, Forward: 0, Center: 0 };
      entries.forEach(function (e) { if (counts[e.position] !== undefined) counts[e.position]++; });
      return Object.keys(MIN_NEEDED).filter(function (pos) { return counts[pos] < MIN_NEEDED[pos]; });
    }

    // Candidate pool: the hired-tier combo first (its own players sorted by
    // rating, since it's meant to represent the club's actual squad), then
    // other seasons of the same club as fallback depth. Built once and
    // consumed in two passes below, so a position minimum (2 Guards/2
    // Forwards/1 Center) can't get crowded out just because the primary
    // combo happens to be rich in one position.
    var pool = best.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); })
      .map(function (p) { return { p: p, team: best.team, season: best.season }; });
    shuffle(combos.filter(function (c) { return c !== best; })).forEach(function (combo) {
      combo.players.forEach(function (p) { pool.push({ p: p, team: combo.team, season: combo.season }); });
    });

    pool.forEach(function (entry) {
      if (entries.length >= ROSTER_TARGET_SIZE) return;
      if (missingPositions().indexOf(entry.p.position) === -1) return;
      addPlayer(entry.p, entry.team, entry.season);
    });
    pool.forEach(function (entry) {
      if (entries.length >= ROSTER_TARGET_SIZE) return;
      addPlayer(entry.p, entry.team, entry.season);
    });

    // league.js's shared splitStartersBench() just takes the top 5 by rating
    // regardless of position - fine for a rating estimate, but this roster's
    // starters must actually fill the 2 Guard/2 Forward/1 Center template so
    // the roster screen's slot display has something in every slot.
    var byPos = { Guard: [], Forward: [], Center: [] };
    entries.forEach(function (e) { if (byPos[e.position]) byPos[e.position].push(e); });
    Object.keys(byPos).forEach(function (pos) {
      byPos[pos].sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    });
    var counters = { Guard: 0, Forward: 0, Center: 0 };
    var starters = [];
    SLOT_TEMPLATE.forEach(function (pos) {
      var candidate = byPos[pos][counters[pos]++];
      if (candidate) starters.push(candidate);
    });
    entries.forEach(function (e) { e.half = starters.indexOf(e) !== -1 ? 1 : 2; });
    return entries;
  }

  function makeRosterEntry(p, team, season) {
    var isStarterAge = Math.random() < 0.6;
    var age = isStarterAge ? 22 + Math.floor(Math.random() * 8) : (Math.random() < 0.5 ? 19 + Math.floor(Math.random() * 5) : 30 + Math.floor(Math.random() * 5));
    return {
      id: rosterEntryId(p.name, team, season),
      player: p.name, position: p.position, rating: p.rating, offRating: p.offRating, defRating: p.defRating,
      archetype: p.archetype, team: team, season: season,
      half: 2, age: age, injury: null, morale: 60, isLegendCrossover: false,
      contract: makePlayerContract(p.rating),
    };
  }

  // Individual player contracts (feature 6) - a separate wage/years-left
  // pair per roster entry, distinct from the coach's own contract, so a
  // player can come up for renewal/release on their own schedule.
  function makePlayerContract(rating) {
    var r = typeof rating === "number" ? rating : 60;
    // Scaled so a full roster's wage bill fits comfortably inside a season's
    // budget (computeSeasonBudget()) - at *15 an ~11-player roster's wages
    // ran to 700K+ against budgets of a few hundred thousand, so payWageBill()
    // clamped the budget to 0 every season and permanently broke transfers/renewals.
    return { yearsLeft: 2 + Math.floor(Math.random() * 3), salary: Math.round(r * r * 4) };
  }

  // ---------- Preseason hub ----------

  function pickBoardGoal() {
    var pool = BOARD_GOALS.filter(function (g) { return g.tier === coach.club.tier; });
    return pool[0] || BOARD_GOALS[0];
  }

  // Gate revenue and the missed-goal penalty both key off LAST season's
  // record (the only thing known at this point) rather than the season
  // about to be played; sponsor income also resolves here since it's
  // another once-per-season budget input.
  function computeSeasonBudget() {
    var tierBase = coach.club.tier === "big" ? 500000 : coach.club.tier === "mid" ? 250000 : 120000;
    var mult = (1 + coach.reputation / 200) * (coach.seasonNumber <= 1 ? (coach.background.budgetStartMult || 1) : 1);
    var base = tierBase * mult;

    var lastRecord = coach.seasonHistory[coach.seasonHistory.length - 1];
    var gateRevenue = 0;
    if (lastRecord) {
      var winPct = lastRecord.wins / Math.max(1, lastRecord.wins + lastRecord.losses);
      gateRevenue = tierBase * 0.15 * winPct * (1 + coach.reputation / 300);
      if (!lastRecord.goalAchieved) base *= 0.85;
    }

    var sponsorIncome = 0;
    if (coach.sponsor) {
      sponsorIncome = coach.sponsor.annualAmount;
      coach.sponsor.yearsLeft--;
      if (coach.sponsor.yearsLeft <= 0) coach.sponsor = null;
    }

    return Math.round(base + gateRevenue + sponsorIncome);
  }

  function tickPlayerContracts() {
    var expired = [];
    coach.roster.forEach(function (e) {
      if (!e.contract) e.contract = makePlayerContract(e.rating);
      e.contract.yearsLeft--;
      if (e.contract.yearsLeft <= 0) expired.push(e);
    });
    return expired;
  }

  function payWageBill() {
    var total = 0;
    coach.roster.forEach(function (e) { total += (e.contract ? e.contract.salary : 0); });
    coach.budget = Math.max(0, coach.budget - total);
  }

  function startNewSeason() {
    coach.seasonNumber++;
    coach.boardGoal = pickBoardGoal();
    coach.scoutingBoostActive = false;
    coach.budget = computeSeasonBudget();
    coach.playSystem = null;
    // Opponents for the season are picked now, before the transfer window,
    // so a trade can target this season's actual rivals rather than the
    // whole of EuroLeague history - the same 19 combos are simulated later
    // in buildAndPlaySeason(), any trades against them already applied.
    coach.leagueOpponents = generateLeagueOpponents();
    healInjuriesAndAge();
    payWageBill();
    var expiredContracts = tickPlayerContracts();
    saveCoach();
    if (expiredContracts.length) {
      renderPlayerContractDecisions(expiredContracts, 0);
    } else {
      renderPreseasonHub();
    }
  }

  function generateLeagueOpponents() {
    var myRating = myTeamRating();
    var otherClubs = shuffle(uniqueClubs().filter(function (c) { return c !== coach.club.label; })).slice(0, LEAGUE_SIZE - 1);
    var opponents = [];
    otherClubs.forEach(function (club) {
      var combos = combosForClub(club);
      if (combos.length === 0) return;
      var combo = window.LeagueSimCore.pickBalancedCombo(combos, myRating);
      opponents.push({ team: combo.team, season: combo.season, players: combo.players.slice() });
    });
    return opponents;
  }

  function healInjuriesAndAge() {
    coach.roster.forEach(function (e) {
      if (e.injury) {
        e.injury.seasonsLeft--;
        if (e.injury.seasonsLeft <= 0) e.injury = null;
      }
    });
  }

  // One decision per expired player contract, resolved before the normal
  // preseason hub is shown - mirrors the "queue, resolve one at a time"
  // shape of the trade/transfer screens elsewhere in this file.
  function renderPlayerContractDecisions(list, index) {
    if (index >= list.length) { renderPreseasonHub(); return; }
    var entry = list[index];
    document.getElementById("coach-hub-title").textContent = window.I18n.t("coachCareer.contracts.title");
    document.getElementById("coach-hub-status").textContent = "";
    var renewCost = Math.round(entry.contract.salary * 0.5);
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + window.I18n.t("coachCareer.contracts.expiredLine", { name: entry.player }) + window.RatingTag.html(entry.rating) + "</p>" +
      '<div class="h2h-setup-buttons">' +
      '<button id="btn-contract-renew"' + (coach.budget < renewCost ? " disabled" : "") + ">" + window.I18n.t("coachCareer.contracts.renewBtn", { cost: renewCost.toLocaleString() }) + "</button>" +
      // Only block release at the roster floor when renewing is actually affordable -
      // otherwise a broke coach with a minimal roster would have no legal action at all.
      '<button class="secondary" id="btn-contract-release"' + (coach.roster.length <= 8 && coach.budget >= renewCost ? " disabled" : "") + ">" + window.I18n.t("coachCareer.contracts.releaseBtn") + "</button>" +
      "</div></div>";
    document.getElementById("btn-contract-renew").addEventListener("click", function () {
      coach.budget = Math.max(0, coach.budget - renewCost);
      entry.contract = makePlayerContract(entry.rating);
      saveCoach();
      renderPlayerContractDecisions(list, index + 1);
    });
    document.getElementById("btn-contract-release").addEventListener("click", function () {
      coach.roster = coach.roster.filter(function (x) { return x !== entry; });
      if (coach.captainId === entry.id) coach.captainId = null;
      saveCoach();
      renderPlayerContractDecisions(list, index + 1);
    });
  }

  function renderPreseasonHub() {
    document.getElementById("coach-hub-title").innerHTML = window.TeamBadge.html(coach.club.label) + window.I18n.t("coachCareer.hub.teamSeasonHeader", { team: coach.club.label, season: coach.seasonNumber });
    document.getElementById("coach-hub-status").innerHTML = window.I18n.t("coachCareer.hub.statusLine", {
      years: coach.contract.yearsLeft, salary: coach.contract.salary.toLocaleString(), budget: coach.budget.toLocaleString(),
      board: coach.boardConfidence, rep: coach.reputation,
    });

    var scoutingBoostCost = computeScoutingBoostCost();
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + window.I18n.t("coachCareer.hub.boardGoalLine", { goal: coach.boardGoal.label }) + "</p>" +
      "<p>" + coach.boardGoal.desc + "</p>" +
      (coach.assistantCoach ? "<p>" + window.I18n.t("coachCareer.assistant.hiredLine", { label: ASSISTANT_COACH_TYPES_BY_ID[coach.assistantCoach].label }) + "</p>" : "") +
      (coach.sponsor ? "<p>" + window.I18n.t("coachCareer.sponsor.activeLine", { amount: coach.sponsor.annualAmount.toLocaleString(), years: coach.sponsor.yearsLeft }) + "</p>" : "") +
      "</div>" +
      (!coach.assistantCoach
        ? '<p style="text-align:center;color:var(--text-dim);">' + window.I18n.t("coachCareer.assistant.prompt") + "</p>" +
          '<div class="system-select-grid" id="coach-assistant-grid"></div>'
        : "") +
      (!coach.sponsor
        ? '<p style="text-align:center;color:var(--text-dim);">' + window.I18n.t("coachCareer.sponsor.prompt") + "</p>" +
          '<div class="system-select-grid" id="coach-sponsor-grid"></div>'
        : "") +
      '<p style="text-align:center;color:var(--text-dim);">' + window.I18n.t("common.chooseSystem") + "</p>" +
      '<div class="system-select-grid" id="coach-system-grid"></div>' +
      '<div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
      '<button class="secondary" id="btn-coach-roster">👥 ' + window.I18n.t("coachCareer.hub.rosterBtn") + "</button>" +
      '<button class="secondary" id="btn-coach-transfer">💰 ' + window.I18n.t("coachCareer.hub.transferBtn") + "</button>" +
      '<button class="secondary" id="btn-coach-skills">🧠 ' + window.I18n.t("coachCareer.hub.skillsBtn") + "</button>" +
      '<button class="secondary" id="btn-coach-stats">📊 ' + window.I18n.t("coachCareer.hub.statsBtn") + "</button>" +
      (!coach.scoutingBoostActive
        ? '<button class="secondary" id="btn-coach-scouting-boost"' + (coach.budget < scoutingBoostCost ? " disabled" : "") + ">🔍 " + window.I18n.t("coachCareer.hub.scoutingBoostBtn", { cost: scoutingBoostCost.toLocaleString() }) + "</button>"
        : "") +
      (coach.seasonNumber >= MIN_SEASONS_BEFORE_RETIRE
        ? '<button class="secondary" id="btn-coach-retire-now">' + window.I18n.t("coachCareer.hub.considerRetireBtn") + "</button>"
        : "") +
      "</div>" +
      '<div style="text-align:center;margin-top:16px;"><button id="btn-coach-start-season" disabled>' + window.I18n.t("coachCareer.hub.startSeasonBtn") + "</button></div>";

    buildSelectGrid("coach-system-grid", window.PlaySystems, function (sys) {
      coach.playSystem = sys;
      document.getElementById("btn-coach-start-season").disabled = false;
    }, window.PlaySystemsAPI.label, window.PlaySystemsAPI.desc);
    var systemGrid = document.getElementById("coach-system-grid");
    systemGrid.querySelectorAll(".selected").forEach(function (b) { b.classList.remove("selected"); });
    window.UiSelect.sync(systemGrid);

    if (!coach.assistantCoach) {
      var assistantGrid = document.getElementById("coach-assistant-grid");
      assistantGrid.innerHTML = "";
      ASSISTANT_COACH_TYPES.forEach(function (a) {
        var btn = document.createElement("button");
        btn.className = "system-card";
        btn.disabled = coach.budget < a.cost;
        btn.innerHTML = '<div class="system-name">' + a.label + "</div><div class=\"system-desc\">" + a.desc + " &middot; " + window.I18n.t("career.costLabel", { cost: a.cost.toLocaleString() }) + "</div>";
        btn.addEventListener("click", function () {
          coach.budget -= a.cost;
          coach.assistantCoach = a.id;
          saveCoach();
          renderPreseasonHub();
        });
        assistantGrid.appendChild(btn);
      });
    }

    if (!coach.sponsor) {
      var sponsorGrid = document.getElementById("coach-sponsor-grid");
      sponsorGrid.innerHTML = "";
      var sponsorOffer = computeSponsorOffer();
      var sponsorBtn = document.createElement("button");
      sponsorBtn.className = "system-card";
      sponsorBtn.innerHTML = '<div class="system-name">' + window.I18n.t("coachCareer.sponsor.dealLabel") + "</div><div class=\"system-desc\">" +
        window.I18n.t("coachCareer.sponsor.dealDesc", { amount: sponsorOffer.annualAmount.toLocaleString(), years: sponsorOffer.yearsLeft }) + "</div>";
      sponsorBtn.addEventListener("click", function () {
        coach.sponsor = sponsorOffer;
        saveCoach();
        renderPreseasonHub();
      });
      sponsorGrid.appendChild(sponsorBtn);
    }

    document.getElementById("btn-coach-roster").addEventListener("click", renderRosterScreen);
    document.getElementById("btn-coach-transfer").addEventListener("click", function () { transferTradeSelection = null; renderTransferScreen(""); });
    document.getElementById("btn-coach-skills").addEventListener("click", renderSkillsScreen);
    document.getElementById("btn-coach-stats").addEventListener("click", function () { renderStatsScreen(renderPreseasonHub); });
    if (!coach.scoutingBoostActive) {
      document.getElementById("btn-coach-scouting-boost").addEventListener("click", function () {
        coach.budget -= scoutingBoostCost;
        coach.scoutingBoostActive = true;
        saveCoach();
        renderPreseasonHub();
      });
    }
    if (coach.seasonNumber >= MIN_SEASONS_BEFORE_RETIRE) {
      document.getElementById("btn-coach-retire-now").addEventListener("click", showRetirePrompt);
    }
    document.getElementById("btn-coach-start-season").addEventListener("click", beginSeasonFlow);
  }

  function computeSponsorOffer() {
    var tierBase = coach.club.tier === "big" ? 500000 : coach.club.tier === "mid" ? 250000 : 120000;
    return { annualAmount: Math.round(tierBase * 0.2 * (1 + coach.reputation / 300)), yearsLeft: 3 };
  }

  function computeScoutingBoostCost() {
    var tierBase = coach.club.tier === "big" ? 500000 : coach.club.tier === "mid" ? 250000 : 120000;
    return Math.round(tierBase * 0.1);
  }

  function beginSeasonFlow() {
    renderFriendlyMatch();
  }

  // A quick, low-stakes preseason exhibition (feature 27) - no impact on
  // the league table, just a small morale/reputation nudge from the result.
  function renderFriendlyMatch() {
    var myRating = myTeamRating();
    var opponentClub = shuffle(uniqueClubs().filter(function (c) { return c !== coach.club.label; }))[0];
    var combos = combosForClub(opponentClub);
    var combo = combos.length ? window.LeagueSimCore.pickBalancedCombo(combos, clamp(myRating + 8, 45, 95)) : null;
    if (!combo) { afterFriendlyMatch(); return; }

    var oppOffense = window.LeagueSimCore.offenseForRoster(combo.players, false);
    var oppDefense = window.LeagueSimCore.defenseForRoster(combo.players, false);
    var myScore = window.LeagueSimCore.simulateMatchScore(myTeamOffense(), oppDefense, 1);
    var oppScore = window.LeagueSimCore.simulateMatchScore(oppOffense, myTeamDefense(), 1);
    if (myScore === oppScore) { if (Math.random() < 0.5) myScore++; else oppScore++; }
    var won = myScore > oppScore;

    if (won) { coach.fanSupport = clamp(coach.fanSupport + 2, 0, 100); coach.reputation = clamp(coach.reputation + 1, 0, 100); }
    saveCoach();

    document.getElementById("coach-hub-title").textContent = window.I18n.t("coachCareer.friendly.title");
    document.getElementById("coach-hub-status").textContent = "";
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>" + window.I18n.t("coachCareer.friendly.vsLabel", { opponent: window.TeamBadge.html(combo.team) + combo.team + " " + formatSeason(combo.season) }) + "</p>" +
      '<div class="share-rating">' + myScore + " - " + oppScore + "</div>" +
      "<p>" + (won ? window.I18n.t("coachCareer.friendly.wonLine") : window.I18n.t("coachCareer.friendly.lostLine")) + "</p>" +
      "</div>" +
      '<div class="final-actions"><button id="btn-coach-friendly-next">' + window.I18n.t("coachCareer.hub.continueBtn") + "</button></div>";
    document.getElementById("btn-coach-friendly-next").addEventListener("click", afterFriendlyMatch);
  }

  function afterFriendlyMatch() {
    if (Math.random() < 0.3) {
      renderEventDialog("general");
    } else {
      renderSimChoice();
    }
  }

  // ---------- Event dialogs (general / captain / conflict / crisis) ----------

  function pickConflictEvent() {
    var lowMorale = coach.roster.filter(function (e) { return e.morale < 40; });
    if (lowMorale.length === 0) return null;
    return COACH_CONFLICT_EVENTS[Math.floor(Math.random() * COACH_CONFLICT_EVENTS.length)];
  }

  function renderEventDialog(kind) {
    var pool = kind === "captain" ? COACH_CAPTAIN_EVENTS : kind === "conflict" ? COACH_CONFLICT_EVENTS : kind === "crisis" ? COACH_CRISIS_EVENTS : kind === "press" ? COACH_PRESS_EVENTS : kind === "interview" ? COACH_INTERVIEW_EVENTS : COACH_EVENTS;
    var event = pool[Math.floor(Math.random() * pool.length)];
    pendingEventKind = kind;
    document.getElementById("coach-hub-title").textContent = event.title;
    document.getElementById("coach-hub-status").textContent = "";
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + event.desc + "</p>" +
      '<div class="h2h-setup-buttons"><button id="btn-coach-event-a">' + event.choiceA.label + "</button>" +
      '<button id="btn-coach-event-b">' + event.choiceB.label + "</button></div></div>";
    document.getElementById("btn-coach-event-a").addEventListener("click", function () { resolveEvent(event, event.choiceA); });
    document.getElementById("btn-coach-event-b").addEventListener("click", function () { resolveEvent(event, event.choiceB); });
  }

  function applyMorale(delta) {
    if (pendingEventKind === "captain" && coach.captainId) {
      var captain = coach.roster.filter(function (e) { return e.id === coach.captainId; })[0];
      if (captain) captain.morale = clamp(captain.morale + delta, 0, 100);
    } else {
      coach.roster.forEach(function (e) { e.morale = clamp(e.morale + delta, 0, 100); });
    }
  }

  function resolveEvent(event, choice) {
    var success = choice.riskFail ? Math.random() >= choice.riskFail : true;
    var changes = [];
    if (success) {
      if (choice.reputationDelta) {
        coach.reputation = clamp(coach.reputation + choice.reputationDelta, 0, 100);
        changes.push(window.I18n.t("coachCareer.events.reputationChangeLine", { delta: (choice.reputationDelta >= 0 ? "+" : "") + choice.reputationDelta }));
      }
      if (choice.budgetDelta) {
        coach.budget = Math.max(0, coach.budget + choice.budgetDelta);
        changes.push(window.I18n.t("coachCareer.events.budgetChangeLine", { delta: (choice.budgetDelta >= 0 ? "+" : "") + choice.budgetDelta.toLocaleString() }));
      }
      if (choice.coachMeterDelta) {
        coach.boardConfidence = clamp(coach.boardConfidence + choice.coachMeterDelta, 0, 100);
        changes.push(window.I18n.t("coachCareer.events.boardChangeLine", { delta: (choice.coachMeterDelta >= 0 ? "+" : "") + choice.coachMeterDelta }));
      }
      if (choice.moraleDelta) {
        applyMorale(choice.moraleDelta);
        changes.push(window.I18n.t("coachCareer.events.moraleChangeLine", { delta: (choice.moraleDelta >= 0 ? "+" : "") + choice.moraleDelta }));
      }
      if (choice.imageDelta) {
        coach.publicImage = clamp(coach.publicImage + choice.imageDelta, 0, 100);
        changes.push(window.I18n.t("coachCareer.events.imageChangeLine", { delta: (choice.imageDelta >= 0 ? "+" : "") + choice.imageDelta }));
      }
    } else if (choice.failReputationDelta) {
      coach.reputation = clamp(coach.reputation + choice.failReputationDelta, 0, 100);
      changes.push(window.I18n.t("coachCareer.events.reputationChangeLine", { delta: choice.failReputationDelta }));
    }
    saveCoach();
    renderEventOutcome(event, choice, success, changes);
  }

  function renderEventOutcome(event, choice, success, changes) {
    document.getElementById("coach-hub-title").textContent = event.title + " - " + (success ? "✅ " + window.I18n.t("coachCareer.events.successLabel") : "❌ " + window.I18n.t("coachCareer.events.failLabel"));
    document.getElementById("coach-hub-status").textContent = "";
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + window.I18n.t("coachCareer.events.chosenLabel", { choice: choice.label }) + "</p>" +
      (changes.length ? changes.map(function (c) { return "<p>" + c + "</p>"; }).join("") : "<p>" + window.I18n.t("coachCareer.events.noDirectEffect") + "</p>") +
      "</div>" +
      '<div class="final-actions"><button id="btn-coach-event-outcome-next">' + window.I18n.t("coachCareer.hub.continueBtn") + "</button></div>";
    document.getElementById("btn-coach-event-outcome-next").addEventListener("click", function () {
      if (pendingEventKind === "general") renderSimChoice();
      else if (pendingEventKind === "press") runCoachPlayoffs(pendingPlayoffTeams, pendingPlayoffRank);
      else afterSeasonEventsResolved();
    });
  }

  // ---------- Sim choice + season simulation ----------

  function renderSimChoice() {
    document.getElementById("coach-hub-title").textContent = window.I18n.t("league.howToWatch");
    document.getElementById("coach-hub-status").textContent = "";
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="h2h-setup-buttons">' +
      '<button id="btn-coach-sim-all">' + window.I18n.t("league.simAll") + "</button>" +
      '<button id="btn-coach-sim-live">' + window.I18n.t("league.simLive") + "</button>" +
      "</div>";
    document.getElementById("btn-coach-sim-all").addEventListener("click", function () { buildAndPlaySeason("all"); });
    document.getElementById("btn-coach-sim-live").addEventListener("click", function () { buildAndPlaySeason("live"); });
  }

  function effectiveRoster() {
    return coach.roster.map(function (e) {
      var mult = e.injury ? (e.injury.severe ? 0.7 : 0.85) : 1;
      return {
        position: e.position, half: e.half, archetype: e.archetype,
        rating: e.rating, offRating: typeof e.offRating === "number" ? e.offRating * mult : e.offRating,
        defRating: typeof e.defRating === "number" ? e.defRating * mult : e.defRating,
      };
    });
  }

  function chemistryBonus(picks) {
    var counts = {};
    coach.roster.forEach(function (e) { counts[e.team] = (counts[e.team] || 0) + 1; });
    var bonus = 0;
    Object.keys(counts).forEach(function (team) {
      var c = counts[team];
      if (c >= 2) bonus += (c - 1) * 3;
    });
    return bonus;
  }

  function averageMorale() {
    if (coach.roster.length === 0) return 60;
    var total = 0;
    coach.roster.forEach(function (e) { total += e.morale; });
    return total / coach.roster.length;
  }

  // Objects round-tripped through localStorage lose reference identity even
  // when they represent the same system, so this must compare ids, not "===".
  function matchesIdentitySystem() {
    return !!(coach.playSystem && coach.identitySystem && coach.playSystem.id === coach.identitySystem.id);
  }

  function myTeamOffense() {
    var roster = effectiveRoster();
    var base = window.LeagueSimCore.offenseForMyRoster(roster, coach.playSystem);
    base += chemistryBonus() / 2;
    base += (averageMorale() - 60) / 10;
    base += (coach.fanSupport - 50) / 15;
    if (matchesIdentitySystem()) base += 2;
    if (coach.assistantCoach === "offense") base += 2;
    return base;
  }

  function myTeamDefense() {
    var roster = effectiveRoster();
    var base = window.LeagueSimCore.defenseForMyRoster(roster, coach.playSystem);
    base += chemistryBonus() / 2;
    base += (averageMorale() - 60) / 10;
    base += (coach.fanSupport - 50) / 15;
    if (matchesIdentitySystem()) base += 2;
    if (coach.assistantCoach === "defense") base += 2;
    return base;
  }

  function myTeamRating() {
    var split = window.LeagueSimCore.splitStartersBench(effectiveRoster(), true);
    return window.LeagueSimCore.weightedTeamRating(split.starters, split.bench);
  }

  function buildAndPlaySeason(mode) {
    var teams = [{
      label: coach.club.label, isMine: true, rating: myTeamRating(),
      offense: myTeamOffense(), defense: myTeamDefense(),
      varianceMultiplier: coach.playSystem ? coach.playSystem.varianceMultiplier : 1,
      wins: 0, losses: 0, pf: 0, pa: 0,
    }];
    // Opponents were already picked at season start (see generateLeagueOpponents)
    // so the transfer window's trade-with-rivals view matches who's actually
    // simulated here - any trade already mutated a club's .players in place.
    coach.leagueOpponents.forEach(function (opp) {
      if (opp.players.length === 0) return;
      teams.push({
        label: opp.team + " " + formatSeason(opp.season), isMine: false,
        rating: window.LeagueSimCore.ratingForHistoricalRoster(opp.players),
        offense: window.LeagueSimCore.offenseForRoster(opp.players, false),
        defense: window.LeagueSimCore.defenseForRoster(opp.players, false),
        varianceMultiplier: 1, wins: 0, losses: 0, pf: 0, pa: 0,
      });
    });

    // Non-mine pairs are independent of my roster - resolve them all up front.
    for (var i = 1; i < teams.length; i++) {
      for (var j = i + 1; j < teams.length; j++) {
        var a = teams[i], b = teams[j];
        var scoreA = window.LeagueSimCore.simulateMatchScore(a.offense, b.defense, a.varianceMultiplier);
        var scoreB = window.LeagueSimCore.simulateMatchScore(b.offense, a.defense, b.varianceMultiplier);
        if (scoreA === scoreB) { if (Math.random() < 0.5) scoreA++; else scoreB++; }
        a.pf += scoreA; a.pa += scoreB; b.pf += scoreB; b.pa += scoreA;
        if (scoreA > scoreB) { a.wins++; b.losses++; } else { b.wins++; a.losses++; }
      }
    }

    pendingSeasonTeams = teams;
    if (mode === "live") {
      liveOpponentIndex = 0;
      renderLiveSeason();
    } else {
      teams.slice(1).forEach(function (opponent) { playMyGame(teams[0], opponent); });
      finishSeasonSim();
    }
  }

  function playMyGame(myTeam, opponent) {
    var scoreA = window.LeagueSimCore.simulateMatchScore(myTeam.offense, opponent.defense, myTeam.varianceMultiplier);
    var scoreB = window.LeagueSimCore.simulateMatchScore(opponent.offense, myTeam.defense, opponent.varianceMultiplier);
    if (scoreA === scoreB) { if (Math.random() < 0.5) scoreA++; else scoreB++; }
    myTeam.pf += scoreA; myTeam.pa += scoreB; opponent.pf += scoreB; opponent.pa += scoreA;
    if (scoreA > scoreB) { myTeam.wins++; opponent.losses++; } else { opponent.wins++; myTeam.losses++; }
    return { opponent: opponent, myScore: scoreA, oppScore: scoreB, won: scoreA > scoreB };
  }

  function renderLiveSeason() {
    var myTeam = pendingSeasonTeams[0];
    var opponents = pendingSeasonTeams.slice(1);
    document.getElementById("coach-hub-title").textContent = window.I18n.t("league.yourGamesTitle");
    document.getElementById("coach-hub-status").textContent = window.I18n.t("league.gameOfTotal", { n: liveOpponentIndex + 1, total: opponents.length });
    var content = document.getElementById("coach-hub-content");
    var log = document.getElementById("coach-live-log-store") || [];
    content.innerHTML = '<div class="league-live-log" id="coach-live-log"></div>' +
      '<div class="final-actions"><button id="btn-coach-live-next">' + window.I18n.t("h2h.nextGameBtn") + "</button></div>";
    var logEl = document.getElementById("coach-live-log");
    logEl.innerHTML = (window.__coachLiveRows || []).join("");

    document.getElementById("btn-coach-live-next").addEventListener("click", function () {
      if (liveOpponentIndex >= opponents.length) {
        finishSeasonSim();
        return;
      }
      var result = playMyGame(myTeam, opponents[liveOpponentIndex]);
      var row = '<div class="live-game-row ' + (result.won ? "win" : "loss") + '">' +
        "<span>" + window.I18n.t("league.vsOpponent", { opponent: result.opponent.label }) + "</span>" +
        "<span>" + result.myScore + " - " + result.oppScore + "</span>" +
        "<span>" + (result.won ? window.I18n.t("league.winLabel") : window.I18n.t("league.lossLabel")) + "</span></div>";
      window.__coachLiveRows = (window.__coachLiveRows || []).concat(row);
      liveOpponentIndex++;
      renderLiveSeason();
    });
  }

  function finishSeasonSim() {
    window.__coachLiveRows = [];
    window.LeagueSimCore.finalizeStandings(pendingSeasonTeams);
    renderStandingsTable(pendingSeasonTeams);
  }

  function renderStandingsTable(teams) {
    document.getElementById("coach-hub-title").textContent = "";
    document.getElementById("coach-hub-status").textContent = "";
    var myRank = -1;
    teams.forEach(function (t, i) { if (t.isMine) myRank = i + 1; });
    var content = document.getElementById("coach-hub-content");
    var rows = teams.map(function (t, i) {
      var diff = t.pf - t.pa;
      return "<tr" + (t.isMine ? ' class="my-team-row"' : "") + ">" +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + window.TeamBadge.html(t.label, "badge-sm") + t.label + "</td>" +
        "<td>" + t.rating.toFixed(1) + "</td>" +
        "<td>" + t.wins + "</td><td>" + t.losses + "</td>" +
        "<td>" + (diff >= 0 ? "+" : "") + diff + "</td></tr>";
    }).join("");
    content.innerHTML =
      '<h3 style="text-align:center;">' + window.I18n.t("coachCareer.hub.finishedRankLine", { rank: rankDisplay(myRank), total: teams.length }) + "</h3>" +
      '<div class="league-table-wrap"><table class="league-table"><thead><tr><th>#</th><th data-i18n="league.colClub">' + window.I18n.t("league.colClub") +
      "</th><th>" + window.I18n.t("league.colRating") + "</th><th>" + window.I18n.t("league.colWins") + "</th><th>" + window.I18n.t("league.colLosses") +
      "</th><th>" + window.I18n.t("league.colDiff") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="final-actions"><button id="btn-coach-to-playoffs">' + window.I18n.t("coachCareer.hub.continueToPlayoffsBtn") + "</button></div>";
    document.getElementById("btn-coach-to-playoffs").addEventListener("click", function () {
      if (Math.random() < 0.4) {
        pendingPlayoffTeams = teams;
        pendingPlayoffRank = myRank;
        renderEventDialog("press");
      } else {
        runCoachPlayoffs(teams, myRank);
      }
    });
  }

  function runCoachPlayoffs(teams, myRank) {
    var bracket = window.LeagueSimCore.computePlayoffBracket(teams, LEAGUE_SIZE);
    var content = document.getElementById("coach-hub-content");
    function matchRow(team, score, isWinner) {
      return '<div class="pmatch-team' + (isWinner ? " winner" : "") + (team.isMine ? " mine" : "") + '">' +
        '<span class="pmatch-name">' + window.TeamBadge.html(team.label, "badge-sm") + team.label + (team.isMine ? " ★" : "") + "</span>" +
        '<span class="pmatch-score">' + score + "</span></div>";
    }
    function matchHtml(r) {
      return '<div class="pmatch">' + matchRow(r.teamA, r.scoreA, r.winner === r.teamA) + matchRow(r.teamB, r.scoreB, r.winner === r.teamB) + "</div>";
    }
    content.innerHTML =
      '<div class="playoffs-bracket">' +
      (bracket.qf ? '<div class="playoff-round"><h3>' + window.I18n.t("league.headerQF") + "</h3>" + bracket.qf.map(matchHtml).join("") + "</div>" : "") +
      '<div class="playoff-round"><h3>' + window.I18n.t("league.headerSF") + "</h3>" + bracket.sf.map(matchHtml).join("") + "</div>" +
      '<div class="playoff-round"><h3>' + window.I18n.t("league.headerFinal") + "</h3>" + matchHtml(bracket.final) + "</div>" +
      "</div>" +
      '<div class="final-actions"><button id="btn-coach-to-recap">' + window.I18n.t("coachCareer.hub.continueBtn") + "</button></div>";
    document.getElementById("btn-coach-to-recap").addEventListener("click", function () {
      resolveSeasonEnd(teams, myRank, bracket);
    });
  }

  // ---------- Season resolution / recap ----------

  function seasonMvp() {
    var sorted = coach.roster.slice().sort(function (a, b) {
      var sa = (a.rating || 0) + (a.half === 1 ? 3 : 0);
      var sb = (b.rating || 0) + (b.half === 1 ? 3 : 0);
      return sb - sa;
    });
    return sorted[0];
  }

  function resolveSeasonEnd(teams, myRank, bracket) {
    var mine = teams[0];
    // coach.boardGoal is a plain object once round-tripped through
    // localStorage (JSON.stringify drops function properties), so its
    // .check() must be looked up fresh from the live BOARD_GOALS list by id
    // rather than called directly on the persisted copy.
    var goalDef = BOARD_GOALS.filter(function (g) { return g.id === coach.boardGoal.id; })[0];
    var goalAchieved = goalDef ? goalDef.check(myRank) : false;
    var wonPlayoffs = bracket.champion.isMine;
    var reachedPlayoffs = bracket.top8.some(function (t) { return t.isMine; });

    var boardDelta = (goalAchieved ? 6 : -6) + (mine.wins > mine.losses ? 2 : -2) + (wonPlayoffs ? 8 : 0);
    coach.boardConfidence = clamp(coach.boardConfidence + boardDelta, 0, 100);
    var repDelta = (goalAchieved ? 5 : -3) + (wonPlayoffs ? 12 : reachedPlayoffs ? 4 : 0);
    coach.reputation = clamp(coach.reputation + repDelta, 0, 100);
    var fanDelta = (mine.wins > mine.losses ? 4 : -4) + (goalAchieved ? 3 : -3) + (wonPlayoffs ? 10 : 0);
    coach.fanSupport = clamp(coach.fanSupport + fanDelta, 0, 100);

    var coachOfYear = (myRank === 1 || (myRank <= 3 && goalAchieved)) && Math.random() < 0.4;
    if (wonPlayoffs) { coach.trophies++; window.Achievements.unlock("coach_playoff_champion"); }
    if (myRank === 1) window.Achievements.unlock("coach_champion");
    if (coachOfYear) { coach.coachOfYearCount++; window.Achievements.unlock("coach_coach_of_year"); window.Effects.confetti(); }

    resolveInjuries();
    applyGrowthAndDecline();
    var academyProspect = maybeCallUpAcademyProspect();

    coach.skillPoints += SKILL_POINTS_PER_SEASON + (wonPlayoffs ? SKILL_POINTS_PER_TROPHY : 0);

    var record = {
      seasonNumber: coach.seasonNumber, club: coach.club.label, wins: mine.wins, losses: mine.losses,
      rank: myRank, goalAchieved: goalAchieved, wonPlayoffs: wonPlayoffs, coachOfYear: coachOfYear,
    };
    coach.seasonHistory.push(record);

    var totals = { wins: 0, seasons: coach.seasonHistory.length, trophies: coach.trophies };
    coach.seasonHistory.forEach(function (r) { totals.wins += r.wins; });
    var milestonesHit = [];
    MILESTONE_DEFS.forEach(function (m) {
      if (!coach.milestonesCrossed[m.id] && m.check(totals)) {
        coach.milestonesCrossed[m.id] = true;
        milestonesHit.push(m.label);
      }
    });

    window.GameHistory.record({
      mode: "coach", icon: "🧢", title: coach.club.label,
      detail: window.I18n.t("league.historyDetail", { rank: myRank, total: teams.length, wins: mine.wins, losses: mine.losses }),
      outcome: myRank === 1 ? "win" : (reachedPlayoffs ? "neutral" : "loss"),
    });

    var fired = coach.boardConfidence < 15 && !goalAchieved && Math.random() < 0.3;
    if (fired) { coach.reputation = clamp(coach.reputation - 10, 0, 100); coach.fired = true; window.Achievements.unlock("coach_fired"); }

    saveCoach();
    pendingSeasonRecord = { record: record, goalAchieved: goalAchieved, wonPlayoffs: wonPlayoffs, coachOfYear: coachOfYear, mvp: seasonMvp(), milestonesHit: milestonesHit, fired: fired, academyProspect: academyProspect };
    renderRecap();
  }

  function resolveInjuries() {
    coach.roster.forEach(function (e) {
      if (e.injury) return;
      var chance = 0.06 * (1 + Math.max(0, e.age - 27) * 0.04);
      if (Math.random() < chance) {
        e.injury = { severe: Math.random() < 0.3, seasonsLeft: Math.random() < 0.3 ? 2 : 1 };
      }
    });
  }

  // A homegrown talent (feature 13) - drawn from a real, currently-unused
  // EuroLeague player record and re-purposed as a fresh young prospect,
  // matching this app's convention of only ever using real names/positions.
  function maybeCallUpAcademyProspect() {
    var chance = 0.2 + coach.skills.scouting * 0.05;
    if (Math.random() >= chance) return null;
    if (coach.roster.length >= ROSTER_TARGET_SIZE + 4) return null;
    var currentNames = {};
    coach.roster.forEach(function (e) { currentNames[normalizeName(e.player)] = true; });
    var combos = shuffle(getAllCombos());
    for (var i = 0; i < combos.length; i++) {
      var candidates = combos[i].players.filter(function (p) { return p.position && !currentNames[normalizeName(p.name)]; });
      if (candidates.length === 0) continue;
      var pick = candidates[Math.floor(Math.random() * candidates.length)];
      var entry = makeRosterEntry(pick, coach.club.label, "academy");
      entry.rating = clamp(50 + Math.round(Math.random() * 10), 30, 99);
      entry.offRating = entry.rating;
      entry.defRating = entry.rating;
      entry.age = 18 + Math.floor(Math.random() * 2);
      entry.half = 2;
      entry.contract = makePlayerContract(entry.rating); // cheap prospect wage, not the real player's historical rating
      coach.roster.push(entry);
      return entry;
    }
    return null;
  }

  function applyGrowthAndDecline() {
    coach.roster.forEach(function (e) {
      if (typeof e.rating !== "number") return;
      var delta = 0;
      if (e.age <= 23) {
        delta = (1.5 + coach.skills.scouting * 0.4) * (e.half === 2 ? 1.3 : 1) * (0.5 + Math.random());
        if (coach.assistantCoach === "development") delta *= 1.5;
      } else if (e.age >= 30) {
        delta = -(1 + (e.age - 30) * 0.3) * (0.5 + Math.random());
      } else {
        delta = (Math.random() - 0.5) * 1.5;
      }
      // Rounded to whole numbers - every other mode in the app treats
      // ratings as integers (RatingTag.html() just stringifies them with
      // no rounding of its own), so an unrounded fractional delta compounding
      // season after season would eventually display as a long decimal.
      e.rating = Math.round(clamp(e.rating + delta, 30, 99));
      if (typeof e.offRating === "number") e.offRating = Math.round(clamp(e.offRating + delta, 30, 99));
      if (typeof e.defRating === "number") e.defRating = Math.round(clamp(e.defRating + delta, 30, 99));
      e.age++;
    });
  }

  function renderRecap() {
    var p = pendingSeasonRecord;
    document.getElementById("coach-hub-title").textContent = window.I18n.t("coachCareer.hub.recapTitle", { season: p.record.seasonNumber });
    document.getElementById("coach-hub-status").textContent = "";

    var lines = [];
    lines.push(window.I18n.t("coachCareer.hub.seasonRecordLine", { wins: p.record.wins, losses: p.record.losses, rank: p.record.rank, total: LEAGUE_SIZE }));
    lines.push((p.goalAchieved ? "🎯 " + window.I18n.t("coachCareer.hub.goalAchievedLine", { goal: coach.boardGoal.label }) : "❌ " + window.I18n.t("coachCareer.hub.goalMissedLine", { goal: coach.boardGoal.label })));
    if (p.wonPlayoffs) { lines.push("🏆 " + window.I18n.t("coachCareer.awards.playoffChampion")); }
    if (p.coachOfYear) lines.push("🌟 " + window.I18n.t("coachCareer.awards.coachOfYear"));
    if (p.mvp) lines.push(window.I18n.t("coachCareer.hub.mvpLine", { name: p.mvp.player, rating: Math.round(p.mvp.rating) }));
    var injured = coach.roster.filter(function (e) { return e.injury; });
    if (injured.length) lines.push("🩹 " + window.I18n.t("coachCareer.hub.injuryReportLine", { count: injured.length }));
    if (p.fired) lines.push("😬 " + window.I18n.t("coachCareer.hub.firedLine"));
    if (p.academyProspect) lines.push("🎓 " + window.I18n.t("coachCareer.hub.academyCallUpLine", { name: p.academyProspect.player }));

    var milestoneBanner = p.milestonesHit.length
      ? '<div class="career-milestone-banner">' + p.milestonesHit.map(function (m) { return "<p>" + m + "</p>"; }).join("") + "</div>"
      : "";

    var content = document.getElementById("coach-hub-content");
    content.innerHTML = milestoneBanner +
      '<div class="career-event-card">' + lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") + "</div>" +
      '<div class="final-actions"><button id="btn-coach-recap-next">' + window.I18n.t("coachCareer.hub.continueBtn") + "</button></div>";
    document.getElementById("btn-coach-recap-next").addEventListener("click", function () {
      if (Math.random() < 0.5) renderEventDialog("interview");
      else afterSeasonEventsResolved();
    });
  }

  function afterSeasonEventsResolved() {
    var conflict = pickConflictEvent();
    var wantsCrisis = Math.random() < 0.12;
    var wantsCaptain = coach.captainId && Math.random() < 0.2;
    if (wantsCrisis) { renderEventDialog("crisis"); return; }
    if (conflict && Math.random() < 0.35) { renderEventDialog("conflict"); return; }
    if (wantsCaptain) { renderEventDialog("captain"); return; }
    proceedToOffSeason();
  }

  function proceedToOffSeason() {
    coach.contract.yearsLeft--;
    if (coach.fired) {
      window.AppNav.showScreen("coachHub");
      renderJobOffers();
      return;
    }
    var poached = coach.reputation >= 65 && Math.random() < 0.15;
    if (poached || coach.contract.yearsLeft <= 0) {
      renderJobOffers();
      return;
    }
    startNewSeason();
  }

  // ---------- Roster screen ----------

  function buildSlotDisplay(picksForHalf) {
    var byPos = { Guard: [], Forward: [], Center: [] };
    picksForHalf.forEach(function (p) { if (byPos[p.position]) byPos[p.position].push(p); });
    var counters = { Guard: 0, Forward: 0, Center: 0 };
    return SLOT_TEMPLATE.map(function (posKey) {
      var idx = counters[posKey]++;
      return { posKey: posKey, pick: byPos[posKey][idx] || null };
    });
  }

  function swapRosterEntries(a, b) {
    var tmp = a.half; a.half = b.half; b.half = tmp;
  }

  var rosterSelection = null;

  function renderRosterSlotsPanel(containerId, half) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    var picks = coach.roster.filter(function (e) { return e.half === half; });
    if (half === 1) {
      buildSlotDisplay(picks).forEach(function (slot) { appendChip(container, slot.pick, POS_LABEL[slot.posKey]); });
    } else {
      picks.forEach(function (pick) { appendChip(container, pick, null); });
    }
  }

  function appendChip(container, entry, emptyLabel) {
    var chip = document.createElement("div");
    chip.className = "h2h-slot-chip" + (entry ? " filled swappable" : "");
    if (entry && entry === rosterSelection) chip.classList.add("selected-swap");
    var captainTag = entry && entry.id === coach.captainId ? " 👑" : "";
    var injuryTag = entry && entry.injury ? '<span class="taken-tag">🩹</span>' : "";
    var archetypeTag = entry && entry.archetype ? '<span class="archetype-tag">' + window.RatingArchetypesAPI.label(entry.archetype) + "</span>" : "";
    chip.innerHTML = entry
      ? '<span class="h2h-slot-type">' + window.RatingTag.html(entry.rating) + "</span>" +
        '<span class="h2h-slot-player">' + entry.player + captainTag + injuryTag + archetypeTag + "</span>"
      : '<span class="h2h-slot-type">' + (emptyLabel || "") + "</span>";
    if (entry) chip._entry = entry;
    container.appendChild(chip);
  }

  function onRosterChipClick(entry) {
    if (!rosterSelection) { rosterSelection = entry; }
    else if (rosterSelection === entry) { rosterSelection = null; }
    else if (rosterSelection.position === entry.position) { swapRosterEntries(rosterSelection, entry); rosterSelection = null; }
    else { rosterSelection = entry; }
    renderRosterScreen();
  }

  function renderRosterScreen() {
    rosterSelection = null;
    renderRosterSlotsPanel("coach-roster-starters", 1);
    renderRosterSlotsPanel("coach-roster-bench", 2);
    var chips = document.querySelectorAll("#coach-roster-starters .filled, #coach-roster-bench .filled");
    window.ChipDrag.wireGroup(chips, {
      getEntry: function (chipEl) { return chipEl._entry; },
      isValidTarget: function (dragged, other) { return dragged !== other && dragged.position === other.position; },
      onDrop: function (dragged, other) { swapRosterEntries(dragged, other); renderRosterScreen(); },
      onTap: onRosterChipClick,
    });

    var captainGrid = document.getElementById("coach-captain-grid");
    captainGrid.innerHTML = "";
    coach.roster.forEach(function (e) {
      var btn = document.createElement("button");
      btn.className = "era-btn" + (e.id === coach.captainId ? " selected" : "");
      btn.textContent = e.player;
      btn.addEventListener("click", function () {
        var wasNoCaptain = !coach.captainId;
        coach.captainId = e.id;
        if (wasNoCaptain && coach.background.captainMoraleStart) e.morale = clamp(e.morale + coach.background.captainMoraleStart, 0, 100);
        renderRosterScreen();
      });
      captainGrid.appendChild(btn);
    });
    window.UiSelect.sync(captainGrid);

    showScreen("coachRoster");
  }

  // ---------- Transfer screen ----------

  function transferPrice(rating, age) {
    var r = typeof rating === "number" ? rating : 60;
    var base = Math.max(0, r - 40) * Math.max(0, r - 40) * 30;
    var ageFactor = (age >= 24 && age <= 29) ? 1 : (age < 24 ? 0.85 : 0.6);
    var scoutingDiscount = coach.scoutingBoostActive ? 0.8 : 1;
    return Math.max(5000, Math.round(base * ageFactor * scoutingDiscount));
  }

  var transferTradeSelection = null; // roster entry currently offered for trade, or null

  function renderTransferScreen(query) {
    document.getElementById("coach-transfer-budget").textContent = window.I18n.t("coachCareer.transfer.budgetRemaining", { amount: coach.budget.toLocaleString() });
    renderTransferRoster();
    renderTransferTradeCurrent();
    renderTransferTradeCandidates();
    renderTransferMarket(query || "");
    showScreen("coachTransfer");
  }

  function renderTransferTradeCurrent() {
    var container = document.getElementById("coach-transfer-trade-current");
    container.innerHTML = "";
    coach.roster.forEach(function (entry) {
      var chip = document.createElement("div");
      chip.className = "h2h-slot-chip filled swappable" + (entry === transferTradeSelection ? " selected-swap" : "");
      chip.innerHTML =
        '<span class="h2h-slot-type">' + (POS_LABEL[entry.position] || "") + "</span>" +
        '<span class="h2h-slot-player">' + entry.player + window.RatingTag.html(entry.rating) + "</span>";
      chip.addEventListener("click", function () {
        transferTradeSelection = entry === transferTradeSelection ? null : entry;
        renderTransferTradeCurrent();
        renderTransferTradeCandidates();
      });
      container.appendChild(chip);
    });
  }

  function tradeCandidatePool(position) {
    var pool = [];
    coach.leagueOpponents.forEach(function (opp, oppIndex) {
      opp.players.forEach(function (p) {
        if (p.position !== position) return;
        pool.push({ player: p, oppIndex: oppIndex, club: opp.team, season: opp.season });
      });
    });
    return pool;
  }

  function renderTransferTradeCandidates() {
    var card = document.getElementById("coach-transfer-trade-candidates-card");
    var grid = document.getElementById("coach-transfer-trade-candidates");
    grid.innerHTML = "";
    if (!transferTradeSelection) { card.style.display = "none"; return; }
    card.style.display = "";
    var candidates = shuffle(tradeCandidatePool(transferTradeSelection.position)).slice(0, 5);
    if (candidates.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-dim);">' + window.I18n.t("coachCareer.transfer.noTradeCandidates") + "</p>";
      return;
    }
    candidates.forEach(function (cand) {
      var btn = document.createElement("button");
      btn.className = "player-btn";
      btn.innerHTML = cand.player.name +
        '<span class="pos-tag">' + cand.player.position + "</span>" +
        window.RatingTag.html(cand.player.rating) +
        '<span class="taken-tag">' + cand.club + " " + formatSeason(cand.season) + "</span>";
      btn.addEventListener("click", function () { completeTrade(cand); });
      grid.appendChild(btn);
    });
  }

  function completeTrade(cand) {
    var outgoing = transferTradeSelection;
    var idx = coach.roster.indexOf(outgoing);
    if (idx === -1) return;
    var opp = coach.leagueOpponents[cand.oppIndex];
    opp.players = opp.players.filter(function (p) { return p !== cand.player; });
    var incoming = makeRosterEntry(cand.player, cand.club, cand.season);
    incoming.half = outgoing.half;
    coach.roster[idx] = incoming;
    if (coach.captainId === outgoing.id) coach.captainId = null;
    transferTradeSelection = null;
    saveCoach();
    renderTransferScreen(transferTargetQuery);
  }

  function renderTransferRoster() {
    var container = document.getElementById("coach-transfer-roster");
    container.innerHTML = "";
    coach.roster.forEach(function (e) {
      var card = document.createElement("div");
      card.className = "squad-player-card";
      card.innerHTML =
        '<div class="name">' + e.player + window.RatingTag.html(e.rating) + "</div>" +
        '<div class="meta">' + e.team + " " + formatSeason(e.season) + "</div>";
      var btn = document.createElement("button");
      btn.className = "player-dual-btn";
      btn.textContent = window.I18n.t("coachCareer.transfer.sellBtn", { price: transferPrice(e.rating, e.age).toLocaleString() });
      btn.disabled = coach.roster.length <= 8;
      btn.addEventListener("click", function () {
        coach.budget += Math.round(transferPrice(e.rating, e.age) * 0.6);
        coach.roster = coach.roster.filter(function (x) { return x !== e; });
        if (coach.captainId === e.id) coach.captainId = null;
        if (transferTradeSelection === e) transferTradeSelection = null;
        saveCoach();
        renderTransferScreen(transferTargetQuery);
      });
      card.appendChild(btn);
      container.appendChild(card);
    });
  }

  function renderTransferMarket(query) {
    transferTargetQuery = query;
    var resultsEl = document.getElementById("coach-transfer-results");
    resultsEl.innerHTML = "";

    var lastCareer = !coach.crossoverSigned ? window.CareerGame.getLastCareerSummary() : null;
    var currentNames = {};
    coach.roster.forEach(function (e) { currentNames[normalizeName(e.player)] = true; });

    if (lastCareer && !currentNames[normalizeName(lastCareer.name)]) {
      var legendBtn = document.createElement("button");
      legendBtn.className = "player-search-result";
      legendBtn.innerHTML =
        '<span class="name">🎓 ' + lastCareer.name + "</span>" +
        '<span class="meta">' + window.I18n.t("coachCareer.transfer.crossoverTag") + "</span>";
      legendBtn.addEventListener("click", function () {
        coach.roster.push({
          id: rosterEntryId(lastCareer.name, coach.club.label, "career"), player: lastCareer.name,
          position: lastCareer.position, rating: lastCareer.peakRating, offRating: lastCareer.peakRating, defRating: lastCareer.peakRating,
          archetype: lastCareer.archetype ? { id: lastCareer.archetype, offBonus: 0, defBonus: 0 } : null,
          team: coach.club.label, season: "career", half: 2, age: 33, injury: null, morale: 70, isLegendCrossover: true,
          contract: makePlayerContract(lastCareer.peakRating),
        });
        coach.crossoverSigned = true;
        saveCoach();
        renderTransferScreen(transferTargetQuery);
      });
      resultsEl.appendChild(legendBtn);
    }

    var trimmed = (query || "").trim();
    if (trimmed.length < 2) return;
    var matches = window.PlayerSearch.search(trimmed).filter(function (entry) { return !currentNames[normalizeName(entry.name)]; });
    matches.slice(0, coach.scoutingBoostActive ? 15 : 10).forEach(function (entry) {
      var b = entry.bestAppearance;
      var price = transferPrice(b.rating, 26);
      var btn = document.createElement("button");
      btn.className = "player-search-result";
      btn.disabled = coach.budget < price || coach.roster.length >= ROSTER_TARGET_SIZE + 3;
      btn.innerHTML =
        '<span class="name">' + entry.name + "</span>" +
        '<span class="meta">' + window.I18n.t("coachCareer.transfer.buyBtn", { price: price.toLocaleString() }) + "</span>" +
        window.RatingTag.html(b.rating);
      btn.addEventListener("click", function () {
        coach.budget -= price;
        coach.roster.push(makeRosterEntry({ name: entry.name, position: b.position, rating: b.rating, offRating: b.offRating, defRating: b.defRating, archetype: b.archetype }, b.team, b.season));
        coach.roster[coach.roster.length - 1].half = 2;
        saveCoach();
        renderTransferScreen(transferTargetQuery);
      });
      resultsEl.appendChild(btn);
    });
  }

  // ---------- Skills screen ----------

  function renderSkillsScreen() {
    document.getElementById("coach-skills-points").textContent = window.I18n.t("coachCareer.skills.pointsAvailable", { points: coach.skillPoints });
    var grid = document.getElementById("coach-skills-grid");
    grid.innerHTML = "";
    ["scouting", "motivation", "tactics"].forEach(function (skill) {
      var card = document.createElement("div");
      card.className = "system-card";
      card.innerHTML =
        '<div class="system-name">' + window.I18n.t("coachCareer.skills." + skill + ".label") + " (" + coach.skills[skill] + ")</div>" +
        '<div class="system-desc">' + window.I18n.t("coachCareer.skills." + skill + ".desc") + "</div>";
      var btn = document.createElement("button");
      btn.className = "secondary";
      btn.textContent = window.I18n.t("coachCareer.skills.upgradeBtn");
      btn.disabled = coach.skillPoints <= 0;
      btn.addEventListener("click", function () {
        coach.skills[skill]++;
        coach.skillPoints--;
        saveCoach();
        renderSkillsScreen();
      });
      card.appendChild(btn);
      grid.appendChild(card);
    });
    showScreen("coachSkills");
  }

  // ---------- Stats screen ----------

  function renderStatsScreen(returnFn) {
    document.getElementById("coach-hub-title").textContent = window.I18n.t("coachCareer.hub.statsBtn");
    document.getElementById("coach-hub-status").textContent = "";
    var totalWins = 0, totalLosses = 0;
    var clubs = {};
    coach.seasonHistory.forEach(function (r) { totalWins += r.wins; totalLosses += r.losses; clubs[r.club] = true; });
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>" + window.I18n.t("coachCareer.stats.nameLine", { name: coach.name, rep: coach.reputation }) + "</p>" +
      "<p>" + window.I18n.t("coachCareer.stats.recordLine", { seasons: coach.seasonHistory.length, wins: totalWins, losses: totalLosses }) + "</p>" +
      "<p>" + window.I18n.t("coachCareer.stats.trophiesLine", { trophies: coach.trophies, coachOfYear: coach.coachOfYearCount }) + "</p>" +
      "<p>" + window.I18n.t("coachCareer.stats.clubsLine", { count: Object.keys(clubs).length }) + "</p>" +
      "<p>" + window.I18n.t("coachCareer.stats.imageLine", { image: coach.publicImage }) + "</p>" +
      "<p>" + window.I18n.t("coachCareer.stats.fanSupportLine", { support: coach.fanSupport }) + "</p>" +
      (coach.assistantCoach ? "<p>" + window.I18n.t("coachCareer.assistant.hiredLine", { label: ASSISTANT_COACH_TYPES_BY_ID[coach.assistantCoach].label }) + "</p>" : "") +
      (coach.sponsor ? "<p>" + window.I18n.t("coachCareer.sponsor.activeLine", { amount: coach.sponsor.annualAmount.toLocaleString(), years: coach.sponsor.yearsLeft }) + "</p>" : "") +
      "</div>" +
      '<div class="final-actions"><button id="btn-coach-stats-back">' + window.I18n.t("career.backBtn") + "</button></div>";
    document.getElementById("btn-coach-stats-back").addEventListener("click", returnFn);
  }

  // ---------- Retirement ----------

  function showRetirePrompt() {
    document.getElementById("coach-hub-title").textContent = window.I18n.t("career.retirePromptTitle");
    document.getElementById("coach-hub-status").textContent = "";
    var content = document.getElementById("coach-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + window.I18n.t("coachCareer.summary.retireQuestion") + "</p>" +
      '<div class="h2h-setup-buttons"><button id="btn-coach-retire-yes">' + window.I18n.t("career.retireYesBtn") + "</button>" +
      '<button class="secondary" id="btn-coach-retire-no">' + window.I18n.t("career.retireNoBtn") + "</button></div></div>";
    document.getElementById("btn-coach-retire-yes").addEventListener("click", finishCoachCareer);
    document.getElementById("btn-coach-retire-no").addEventListener("click", renderPreseasonHub);
  }

  function buildSummary() {
    var clubs = {};
    coach.seasonHistory.forEach(function (r) { clubs[r.club] = true; });
    return {
      name: coach.name, clubs: Object.keys(clubs), trophies: coach.trophies,
      coachOfYearCount: coach.coachOfYearCount, seasons: coach.seasonHistory.length,
    };
  }

  function finishCoachCareer() {
    window.Achievements.unlock("coach_retired");
    var clubs = {};
    coach.seasonHistory.forEach(function (r) { clubs[r.club] = true; });
    var clubCount = Object.keys(clubs).length;
    if (clubCount === 1) window.Achievements.unlock("coach_loyal");
    if (clubCount >= 3) window.Achievements.unlock("coach_journeyman");
    var runs = window.Achievements.incrementCounter("coach_runs_completed");
    if (runs >= 2) window.Achievements.unlock("coach_second_run");

    saveLastCoach(buildSummary());
    clearCoach();
    renderSummaryScreen();
  }

  function renderSummaryScreen() {
    var content = document.getElementById("coach-summary-content");
    var rows = coach.seasonHistory.slice().reverse().map(function (r) {
      return '<div class="player-appearance-row' + (r.wonPlayoffs ? " peak" : "") + '">' +
        "<span>" + window.I18n.t("coachCareer.summary.seasonRowLabel", { season: r.seasonNumber, club: r.club }) + "</span>" +
        "<span>" + r.wins + "-" + r.losses + "</span>" +
        (r.wonPlayoffs ? '<span class="archetype-tag">🏆</span>' : "") +
        (r.coachOfYear ? '<span class="archetype-tag">🌟</span>' : "") +
        "</div>";
    }).join("");
    var clubs = {};
    coach.seasonHistory.forEach(function (r) { clubs[r.club] = true; });
    content.innerHTML =
      '<h2 class="player-profile-name">' + coach.name + "</h2>" +
      '<p class="player-profile-summary">' + window.I18n.t("coachCareer.summary.line", {
        seasons: coach.seasonHistory.length, clubs: Object.keys(clubs).length, trophies: coach.trophies, coachOfYear: coach.coachOfYearCount,
      }) + "</p>" +
      '<div class="player-appearances-list">' + rows + "</div>";
    showScreen("coachSummary");
  }

  // ---------- Wiring ----------

  document.getElementById("btn-coach-new").addEventListener("click", renderCreateScreen);
  document.getElementById("btn-coach-new-2").addEventListener("click", renderCreateScreen);
  document.getElementById("btn-coach-continue").addEventListener("click", continueCoach);
  document.getElementById("btn-coach-start").addEventListener("click", startCoachCareer);
  document.getElementById("btn-coach-roster-continue").addEventListener("click", function () { showScreen("coachHub"); });
  document.getElementById("btn-coach-transfer-continue").addEventListener("click", function () { showScreen("coachHub"); });
  document.getElementById("coach-transfer-search").addEventListener("input", function (e) { renderTransferMarket(e.target.value); });
  document.getElementById("btn-coach-skills-continue").addEventListener("click", function () { showScreen("coachHub"); });

  window.CoachCareerGame = { open: openHome };
})();
