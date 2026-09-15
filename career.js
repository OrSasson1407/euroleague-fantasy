(function () {
  "use strict";

  var STORAGE_KEY = "career_save_v1";
  var LAST_KEY = "career_last_v1";
  var RETIRE_MIN_AGE = 30;
  var RETIRE_FORCE_AGE = 38;
  var ACADEMY_END_AGE = 19; // three academy seasons: 16, 17, 18

  // Each academy is tied to a real country - its clubs list is drawn from our
  // own historical EuroLeague dataset, and the draft (age 19) picks its 3
  // offers only from that pool: pick a Spanish academy, get drafted by a
  // Spanish club, etc.
  var ACADEMIES = [
    {
      label: "אקדמיה ספרדית", country: "ספרד",
      desc: "ידועה בפיתוח מתקפי וזריקה - בוגריה מגיעים בעיקר לקבוצות ספרדיות",
      offBias: 0.65, reputationBonus: 0,
      clubs: ["Baskonia", "Bilbao Basket", "Estudiantes", "FC Barcelona", "Gran Canaria", "Joventut Badalona", "Real Madrid", "Unicaja Malaga", "Valencia Basket"],
    },
    {
      label: "אקדמיה יוונית", country: "יוון",
      desc: "מתמקדת בחוסן מנטלי ומוניטין מוקדם - בוגריה מגיעים בעיקר לקבוצות יווניות",
      offBias: 0.5, reputationBonus: 10,
      clubs: ["AEK", "Aris", "Iraklis", "Olympiacos", "Panathinaikos", "Panionios", "Peristeri"],
    },
    {
      label: "אקדמיה טורקית", country: "טורקיה",
      desc: "קבוצות עשירות ותחרות פנימית קשה - בוגריה מגיעים בעיקר לקבוצות טורקיות",
      offBias: 0.55, reputationBonus: 0,
      clubs: ["Anadolu Efes", "Besiktas", "Darussafaka", "Fenerbahce", "Galatasaray", "Karsiyaka", "Ulker"],
    },
    {
      label: "אקדמיה איטלקית", country: "איטליה",
      desc: "מסורת עשירה ומשחק טקטי - בוגריה מגיעים בעיקר לקבוצות איטלקיות",
      offBias: 0.45, reputationBonus: 0,
      clubs: ["Avellino", "Benetton Treviso", "Cantu", "Fortitudo Bologna", "Montepaschi Siena", "Napoli", "Olimpia Milano", "Sassari", "Scavolini Pesaro", "Virtus Bologna", "Virtus Roma"],
    },
    {
      label: "אקדמיה צרפתית", country: "צרפת",
      desc: "ידועה בפיתוח אתלטי ומהירות - בוגריה מגיעים בעיקר לקבוצות צרפתיות",
      offBias: 0.55, reputationBonus: 0,
      clubs: ["AS Monaco", "ASVEL", "Chalon", "Cholet", "Le Mans", "Limoges", "Nancy", "Nanterre", "Paris Basketball", "Pau-Orthez", "Roanne", "SLUC Nancy", "Strasbourg"],
    },
    {
      label: "אקדמיה רוסית", country: "רוסיה",
      desc: "פיתוח פיזי וקשוח עם דגש הגנתי - בוגריה מגיעים בעיקר לקבוצות רוסיות",
      offBias: 0.35, reputationBonus: 0,
      clubs: ["CSKA Moscow", "Dynamo Moscow", "Khimki", "Lokomotiv Kuban", "Nizhny Novgorod", "UNICS Kazan", "Ural Great", "Zenit St Petersburg"],
    },
    {
      label: "אקדמיה גרמנית", country: "גרמניה",
      desc: "משחק ממושמע ומאוזן - בוגריה מגיעים בעיקר לקבוצות גרמניות",
      offBias: 0.5, reputationBonus: 0,
      clubs: ["Alba Berlin", "Bayern Munich", "Brose Bamberg", "Cologne", "Oldenburg", "Opel Skyliners"],
    },
    {
      label: "אקדמיה קרואטית", country: "קרואטיה",
      desc: "ידועה בהפקת יורים מוכשרים - בוגריה מגיעים בעיקר לקבוצות קרואטיות",
      offBias: 0.6, reputationBonus: 0,
      clubs: ["Cedevita", "Cibona", "Split", "Zadar", "Zagreb"],
    },
    {
      label: "אקדמיה ליטאית", country: "ליטא",
      desc: "פיתוח מאוזן ויסודות משחק - בוגריה מגיעים בעיקר לקבוצות ליטאיות",
      offBias: 0.5, reputationBonus: 0,
      clubs: ["Lietuvos Rytas", "Neptunas", "Zalgiris Kaunas"],
    },
    {
      label: "אקדמיה סרבית", country: "סרביה",
      desc: "ידועה בפיתוח הגנתי קשוח - בוגריה מגיעים בעיקר לקבוצות סרביות",
      offBias: 0.35, reputationBonus: 0,
      clubs: ["Crvena zvezda", "Partizan"],
    },
    {
      label: "אקדמיה פולנית", country: "פולין",
      desc: "עבודה קשה ויסודות מוצקים - בוגריה מגיעים בעיקר לקבוצות פולניות",
      offBias: 0.45, reputationBonus: 0,
      clubs: ["Asseco Prokom Gdynia", "Prokom Trefl Sopot", "Slask Wroclaw", "Turow Zgorzelec", "Zielona Gora"],
    },
    {
      label: "אקדמיה ישראלית", country: "ישראל",
      desc: "אינטנסיביות ותנופה התקפית - בוגריה מגיעים בעיקר לקבוצות ישראליות",
      offBias: 0.55, reputationBonus: 0,
      clubs: ["Hapoel Tel Aviv", "Maccabi Raanana", "Maccabi Tel Aviv"],
    },
  ];

  var BACKGROUNDS = [
    { label: "ילד הכרך הגדול", desc: "גדל בתשומת לב תקשורתית - בונוס קטן למוניטין", reputationStart: 10 },
    { label: "ילד העיירה", desc: "גדל הרחק מהזרקורים - התמקדות טהורה במשחק", offRatingBonus: 1, defRatingBonus: 1 },
    { label: "משפחת כדורסל", desc: "גדל בבית עם רקע כדורסלי - קפיצת התחלה קטנה", offRatingBonus: 2 },
    { label: "התפתחות מאוחרת", desc: "התחיל מאוחר יותר מהרגיל - פחות בהתחלה, יותר פוטנציאל", offRatingBonus: -2, defRatingBonus: -2 },
  ];

  var TRAINING_FOCUS = [
    { id: "offense", label: "התמקדות בהתקפה", desc: "צמיחה מוגברת בהתקפה" },
    { id: "defense", label: "התמקדות בהגנה", desc: "צמיחה מוגברת בהגנה" },
    { id: "balanced", label: "אימון מאוזן", desc: "צמיחה שווה משני הצדדים" },
  ];

  var EVENTS = [
    {
      title: "רגע קלאץ'",
      desc: "המשחק צמוד בשניות האחרונות. המאמן מסתכל עליכם.",
      choiceA: { label: "לקחת את הזריקה", riskFail: 0.4, reputationDelta: 8, failReputationDelta: -4 },
      choiceB: { label: "להעביר לחבר לקבוצה", reputationDelta: 2 },
    },
    {
      title: "הצעת חסות",
      desc: "חברת ציוד ספורט מציעה לכם חוזה חסות קטן.",
      choiceA: { label: "לקבל את ההצעה", moneyDelta: 8000 },
      choiceB: { label: "לסרב ולהתמקד במשחק", reputationDelta: 3 },
    },
    {
      title: "חילוקי דעות עם המאמן",
      desc: "המאמן רוצה שתשחקו בתפקיד שונה מהרגיל שלכם.",
      choiceA: { label: "להסכים ולהתאים את עצמכם", coachMeterDelta: 10 },
      choiceB: { label: "לעמוד על שלכם", coachMeterDelta: -8, reputationDelta: 3 },
    },
    {
      title: "ראיון תקשורתי",
      desc: "כתב מבקש ראיון אחרי המשחק.",
      choiceA: { label: "ראיון צנוע וממוקד קבוצה", coachMeterDelta: 4 },
      choiceB: { label: "ראיון בטחוני ומגניב", reputationDelta: 6, coachMeterDelta: -2 },
    },
    {
      title: "אירוע משפחתי",
      desc: "המשפחה מזמינה אתכם לאירוע חשוב באותו שבוע שבו תוכנן אימון נוסף.",
      choiceA: { label: "לבלות עם המשפחה", reputationDelta: 4 },
      choiceB: { label: "להישאר ולהתאמן", coachMeterDelta: 5 },
    },
    {
      title: "בעיה בריאותית קלה",
      desc: "אתם מרגישים לא במיטבכם בימים שלפני המשחק החשוב.",
      choiceA: { label: "לנוח כמה ימים", coachMeterDelta: -3 },
      choiceB: { label: "להתעלם ולהמשיך כרגיל", riskFail: 0.35, reputationDelta: 5, failReputationDelta: -6 },
    },
    {
      title: "הזמנה לפעילות קהילתית",
      desc: "ארגון מקומי מזמין אתכם להשתתף באירוע קהילתי למען הנוער באזור.",
      choiceA: { label: "להשתתף בשמחה", reputationDelta: 6 },
      choiceB: { label: "להתנצל ולהתמקד במנוחה", coachMeterDelta: 3 },
    },
    {
      title: "הצעת לימודים במקביל",
      desc: "מוסד אקדמי מציע לכם ללמוד קורס במקביל לקריירה.",
      choiceA: { label: "ללמוד במקביל לקריירה", reputationDelta: 5, coachMeterDelta: -2 },
      choiceB: { label: "להתמקד רק בכדורסל", coachMeterDelta: 4 },
    },
  ];

  var DIFFICULTIES = [
    { id: "arcade", label: "ארקייד", desc: "פחות פציעות, ירידה מתונה יותר עם הגיל, קצת יותר סלחני", injuryMult: 0.6, declineMult: 0.6, growthMult: 1.1 },
    { id: "realistic", label: "ריאליסטי", desc: "פציעות שכיחות יותר וירידה חדה יותר עם הגיל - אתגר אמיתי", injuryMult: 1.4, declineMult: 1.4, growthMult: 0.9 },
  ];

  var GOALS = [
    {
      id: "winning",
      label: "עונה מנצחת",
      desc: "לסיים עם יותר ניצחונות מהפסדים",
      check: function (record) { return record.wins > record.losses; },
      rewardRep: 8,
      rewardMoney: 0,
    },
    {
      id: "health",
      label: "להישאר בריאים",
      desc: "לסיים את העונה בלי פציעה חדשה",
      check: function (record) { return !record.injuryEvent; },
      rewardRep: 4,
      rewardMoney: 5000,
    },
    {
      id: "coach",
      label: "לשפר יחסים עם המאמן",
      desc: "לסיים את העונה עם שיפור ביחסים עם המאמן",
      check: function (record) { return record.coachMeterDelta > 0; },
      rewardRep: 5,
      rewardMoney: 0,
    },
  ];

  var AGENT_COST = 20000;
  var SECONDARY_ARCHETYPE_RATING_THRESHOLD = 75;
  var INJURY_SHIELD_COST = 15000;
  var COACH_BOOST_COST = 10000;
  var PR_CAMPAIGN_COST = 10000;
  var FAN_FAVORITE_SEASONS_NEEDED = 3;
  var FAN_FAVORITE_REPUTATION_NEEDED = 50;
  var FAN_FAVORITE_BONUS = 2;

  // Career-wide milestones, checked once per pro season and shown as a
  // celebratory banner the moment they're first crossed.
  var MILESTONE_DEFS = [
    { id: "wins_50", label: "🎉 עברתם 50 ניצחונות בקריירה!", check: function (t) { return t.wins >= 50; } },
    { id: "wins_100", label: "🎉 עברתם 100 ניצחונות בקריירה!", check: function (t) { return t.wins >= 100; } },
    { id: "seasons_5", label: "🎉 5 עונות מקצועניות מאחוריכם!", check: function (t) { return t.proSeasons >= 5; } },
    { id: "seasons_10", label: "🎉 10 עונות מקצועניות - קריירה ארוכה ומרשימה!", check: function (t) { return t.proSeasons >= 10; } },
    { id: "rating_70", label: "🎉 שברתם את מחסום ה-70 בדירוג!", check: function (t) { return t.peakRating >= 70; } },
    { id: "rating_80", label: "🎉 שברתם את מחסום ה-80 בדירוג - עלית אמיתית!", check: function (t) { return t.peakRating >= 80; } },
    { id: "rating_90", label: "🎉 דירוג 90+ - אתם בין הגדולים שההיסטוריה זוכרת!", check: function (t) { return t.peakRating >= 90; } },
    { id: "trophies_1", label: "🎉 האליפות הראשונה שלכם!", check: function (t) { return t.trophies >= 1; } },
    { id: "trophies_3", label: "🎉 3 אליפויות קריירה - שושלת אמיתית!", check: function (t) { return t.trophies >= 3; } },
    { id: "money_1m", label: "🎉 עברתם מיליון שקל בהכנסות קריירה!", check: function (t) { return t.money >= 1000000; } },
    { id: "money_5m", label: "🎉 5 מיליון שקל - קריירה עשירה!", check: function (t) { return t.money >= 5000000; } },
  ];

  function computeCareerTotals() {
    var wins = 0, proSeasons = 0, trophies = 0;
    career.seasonHistory.forEach(function (r) {
      if (r.phase === "pro") {
        proSeasons++;
        wins += r.wins;
        if (r.champion) trophies++;
      }
    });
    return { wins: wins, proSeasons: proSeasons, trophies: trophies, peakRating: Math.round(career.peakRating), money: career.money };
  }

  // Upgrades cost more as the underlying rating climbs, so the early boosts
  // are cheap and late-career gains get progressively pricier.
  function getUpgradeOptions() {
    var offCost = Math.round(900 * career.offRating);
    var defCost = Math.round(900 * career.defRating);
    var options = [
      {
        id: "offense", label: "שדרוג התקפה (+2)",
        desc: "עלות: ₪" + offCost.toLocaleString(), cost: offCost,
        apply: function () { career.offRating = clamp(career.offRating + 2, 30, 99); updatePeakRating(); },
      },
      {
        id: "defense", label: "שדרוג הגנה (+2)",
        desc: "עלות: ₪" + defCost.toLocaleString(), cost: defCost,
        apply: function () { career.defRating = clamp(career.defRating + 2, 30, 99); updatePeakRating(); },
      },
      {
        id: "coach", label: "אימון אישי עם המאמן",
        desc: "יחסים עם המאמן +8 מיידית &middot; עלות: ₪" + COACH_BOOST_COST.toLocaleString(), cost: COACH_BOOST_COST,
        apply: function () { career.team.coachMeter = clamp(career.team.coachMeter + 8, 0, 100); },
      },
      {
        id: "pr", label: 'קמפיין יח"צ',
        desc: "מוניטין +8 מיידית &middot; עלות: ₪" + PR_CAMPAIGN_COST.toLocaleString(), cost: PR_CAMPAIGN_COST,
        apply: function () { career.reputation = clamp(career.reputation + 8, 0, 100); },
      },
    ];
    if (!career.injuryShieldActive) {
      options.push({
        id: "injuryShield", label: "אימון מניעת פציעות",
        desc: "מחצית מהסיכון לפציעה בעונה הקרובה &middot; עלות: ₪" + INJURY_SHIELD_COST.toLocaleString(), cost: INJURY_SHIELD_COST,
        apply: function () { career.injuryShieldActive = true; },
      });
    }
    return options;
  }

  var career = null;
  var createState = null;
  var pendingFocus = null;
  var pendingGoal = null;
  var pendingPlayThroughInjury = false;

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

  function clubAverageStrength(club) {
    var total = 0, n = 0;
    getAllCombos().forEach(function (combo) {
      if (combo.team !== club) return;
      combo.players.forEach(function (p) {
        if (typeof p.rating === "number") {
          total += p.rating;
          n++;
        }
      });
    });
    return n > 0 ? total / n : 65;
  }

  // Opponents vary around the PLAYER'S OWN club tier, not the whole dataset's
  // average - the historical dataset skews toward notable (mostly strong)
  // EuroLeague seasons, so a flat random draw would make weaker/loan clubs
  // face disproportionately tough opposition every single season.
  function opponentStrengthNear(baseStrength) {
    return clamp(baseStrength + bellRandom(16), 45, 95);
  }

  function bellRandom(totalSpread) {
    var part = totalSpread / 3;
    return (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part + (Math.random() * 2 - 1) * part;
  }

  function simScore(offense, defense) {
    var base = 60 + (offense - defense) * 0.6;
    return Math.round(base + bellRandom(20));
  }

  function reputationLabel(rep) {
    if (rep >= 80) return "כוכב-על";
    if (rep >= 60) return "ידוע";
    if (rep >= 40) return "מוכר";
    if (rep >= 20) return "מתחיל";
    return "אלמוני";
  }

  function updatePeakRating() {
    var avg = (career.offRating + career.defRating) / 2;
    if (avg > career.peakRating) career.peakRating = avg;
  }

  function overallRating() {
    return Math.round((career.offRating + career.defRating) / 2);
  }

  function ratingHeaderHtml() {
    return (
      '<div class="career-rating-badge">דירוג כולל: <strong>' + overallRating() + "</strong>" +
      ' <span class="off-tag">התק׳ ' + Math.round(career.offRating) + "</span>" +
      ' <span class="def-tag">הג׳ ' + Math.round(career.defRating) + "</span></div>"
    );
  }

  function ratingChangeHtml(beforeOff, beforeDef, afterOff, afterDef) {
    var before = Math.round((beforeOff + beforeDef) / 2);
    var after = Math.round((afterOff + afterDef) / 2);
    var diff = after - before;
    var arrow = diff > 0 ? "⬆" : diff < 0 ? "⬇" : "➡";
    var diffText = (diff >= 0 ? "+" : "") + diff;
    return (
      "<p>דירוג כולל: מ-" + before + " ל-" + after + " (" + diffText + " " + arrow + ")</p>" +
      "<p>התקפה: מ-" + Math.round(beforeOff) + " ל-" + Math.round(afterOff) + " &middot; הגנה: מ-" +
      Math.round(beforeDef) + " ל-" + Math.round(afterDef) + "</p>"
    );
  }

  function effectiveOffense() {
    var base = career.offRating + (career.archetype ? career.archetype.offBonus : 0);
    if (career.secondaryArchetype) base += career.secondaryArchetype.offBonus * 0.5;
    if (career.fanFavorite) base += FAN_FAVORITE_BONUS;
    var fit = window.PlaySystemsAPI.fitBonus({ archetype: career.archetype }, career.team.system, null);
    return base + fit.off;
  }

  function effectiveDefense() {
    var base = career.defRating + (career.archetype ? career.archetype.defBonus : 0);
    if (career.secondaryArchetype) base += career.secondaryArchetype.defBonus * 0.5;
    if (career.fanFavorite) base += FAN_FAVORITE_BONUS;
    var fit = window.PlaySystemsAPI.fitBonus({ archetype: career.archetype }, career.team.system, null);
    return base + fit.def;
  }

  function saveCareer() {
    if (window.Auth && !window.Auth.canSave()) return; // guest mode - nothing persists
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
    } catch (e) {
      // ignore storage failures
    }
  }

  function loadCareer() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearCareer() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }

  function saveLastCareer(summary) {
    if (window.Auth && !window.Auth.canSave()) return; // guest mode - nothing persists
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(summary));
    } catch (e) {
      // ignore
    }
  }

  function loadLastCareer() {
    try {
      var raw = localStorage.getItem(LAST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- Home screen ----------

  function openHome() {
    var saved = loadCareer();
    document.getElementById("career-continue-wrap").hidden = !saved;

    var lastEl = document.getElementById("career-last-summary");
    var last = loadLastCareer();
    if (last) {
      lastEl.hidden = false;
      lastEl.innerHTML =
        "הקריירה הקודמת שלכם: <strong>" + last.name + "</strong> (" + last.position + ") &middot; שיא דירוג " +
        last.peakRating + " &middot; פרש/ה בגיל " + last.retirementAge + " &middot; " + last.trophies + " אליפויות";
    } else {
      lastEl.hidden = true;
    }
    window.AppNav.showScreen("careerHome");
  }

  function continueCareer() {
    var saved = loadCareer();
    if (!saved) return;
    career = saved;
    if (career.phase === "academy") renderAcademyHub();
    else renderSeasonHub();
    window.AppNav.showScreen("careerHub");
  }

  // ---------- Character creation ----------

  function buildSelectGrid(containerId, items, onPick) {
    var grid = document.getElementById(containerId);
    grid.innerHTML = "";
    items.forEach(function (item, i) {
      var btn = document.createElement("button");
      btn.className = "system-card" + (i === 0 ? " selected" : "");
      btn.innerHTML = '<div class="system-name">' + item.label + '</div><div class="system-desc">' + item.desc + "</div>";
      btn.addEventListener("click", function () {
        Array.from(grid.children).forEach(function (c) {
          c.classList.remove("selected");
        });
        btn.classList.add("selected");
        onPick(item);
      });
      grid.appendChild(btn);
    });
  }

  function updatePointsDisplay() {
    document.getElementById("career-off-points").textContent = 40 + createState.offPoints;
    document.getElementById("career-def-points").textContent = 40 + (20 - createState.offPoints);
  }

  function renderCreateScreen() {
    createState = {
      academy: ACADEMIES[0],
      position: "Guard",
      archetype: window.RatingArchetypes[0],
      background: BACKGROUNDS[0],
      difficulty: DIFFICULTIES[0],
      offPoints: 10,
    };
    document.getElementById("career-name-input").value = "";
    document.querySelectorAll("#career-position-buttons .era-btn").forEach(function (b, i) {
      b.classList.toggle("selected", i === 0);
    });

    buildSelectGrid("career-academy-grid", ACADEMIES, function (a) { createState.academy = a; });
    buildSelectGrid("career-archetype-grid", window.RatingArchetypes, function (a) { createState.archetype = a; });
    buildSelectGrid("career-background-grid", BACKGROUNDS, function (b) { createState.background = b; });
    buildSelectGrid("career-difficulty-grid", DIFFICULTIES, function (d) { createState.difficulty = d; });

    updatePointsDisplay();
    window.AppNav.showScreen("careerCreate");
  }

  function startCareer() {
    var name = document.getElementById("career-name-input").value.trim() || "שחקן אלמוני";
    career = {
      name: name,
      position: createState.position,
      archetype: createState.archetype,
      secondaryArchetype: null,
      academy: createState.academy,
      background: createState.background,
      difficulty: createState.difficulty,
      offRating: 40 + createState.offPoints + (createState.background.offRatingBonus || 0),
      defRating: 40 + (20 - createState.offPoints) + (createState.background.defRatingBonus || 0),
      age: 16,
      phase: "academy",
      team: null,
      contract: null,
      money: 0,
      hasAgent: false,
      injuryShieldActive: false,
      fanFavorite: false,
      milestonesCrossed: {},
      reputation: 20 + (createState.background.reputationStart || 0) + (createState.academy.reputationBonus || 0),
      onNationalTeam: false,
      injury: null,
      seasonHistory: [],
      peakRating: 0,
      retirementAge: null,
    };
    updatePeakRating();
    saveCareer();
    renderAcademyHub();
    window.AppNav.showScreen("careerHub");
  }

  // ---------- Academy phase ----------

  function resolveAcademySeason(focusId) {
    var beforeOff = career.offRating, beforeDef = career.defRating;

    var growth = 4 + Math.random() * 3;
    var focusBias = focusId === "offense" ? 0.75 : focusId === "defense" ? 0.25 : 0.5;
    var offShare = (career.academy.offBias + focusBias) / 2;

    var breakout = Math.random() < 0.15;
    if (breakout) growth += 3 + Math.random() * 3;

    var offGrowth = growth * offShare;
    var defGrowth = growth - offGrowth;
    career.offRating = clamp(career.offRating + offGrowth, 30, 99);
    career.defRating = clamp(career.defRating + defGrowth, 30, 99);
    updatePeakRating();

    var youthNationalTeam = (career.offRating + career.defRating) / 2 >= 55 && Math.random() < 0.3;

    var record = {
      phase: "academy",
      age: career.age,
      team: career.academy.label,
      rating: Math.round((career.offRating + career.defRating) / 2),
      breakout: breakout,
      beforeOff: beforeOff,
      beforeDef: beforeDef,
      afterOff: career.offRating,
      afterDef: career.defRating,
      focusLabel: TRAINING_FOCUS.filter(function (f) { return f.id === focusId; })[0].label,
      youthNationalTeam: youthNationalTeam,
    };
    career.seasonHistory.push(record);
    career.age++;
    saveCareer();
    return record;
  }

  function renderAcademyHub() {
    document.getElementById("career-hub-title").textContent = career.academy.label + " · גיל " + career.age;
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<p style="text-align:center;color:var(--text-dim);">על מה תתמקדו באימונים העונה?</p>' +
      '<div class="system-select-grid" id="career-academy-focus-grid"></div>' +
      '<div style="text-align:center;margin-top:10px;"><button class="secondary" id="btn-career-stats">📊 סטטיסטיקת קריירה</button></div>';

    var grid = document.getElementById("career-academy-focus-grid");
    grid.innerHTML = "";
    TRAINING_FOCUS.forEach(function (f) {
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.innerHTML = '<div class="system-name">' + f.label + '</div><div class="system-desc">' + f.desc + "</div>";
      btn.addEventListener("click", function () {
        var record = resolveAcademySeason(f.id);
        renderAcademyRecap(record);
      });
      grid.appendChild(btn);
    });

    document.getElementById("btn-career-stats").addEventListener("click", function () {
      renderCareerStatsScreen(renderAcademyHub);
    });
  }

  function renderAcademyRecap(record) {
    document.getElementById("career-hub-title").textContent = "סיכום עונת אקדמיה - גיל " + record.age;
    document.getElementById("career-hub-status").textContent = "";

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>אימון שנבחר: " + record.focusLabel + "</p>" +
      ratingChangeHtml(record.beforeOff, record.beforeDef, record.afterOff, record.afterDef) +
      (record.breakout ? "<p>🌟 עונת פריצת דרך! קפיצה גדולה בסטטים.</p>" : "") +
      (record.youthNationalTeam ? "<p>🇪🇺 נבחרתם לנבחרת הנוער!</p>" : "") +
      "</div>" +
      '<div class="final-actions"><button id="btn-career-academy-next">המשך &raquo;</button></div>';

    document.getElementById("btn-career-academy-next").addEventListener("click", function () {
      if (career.age >= ACADEMY_END_AGE) renderDraft();
      else renderAcademyHub();
    });
  }

  // ---------- Draft ----------

  // Picks `count` clubs from a pool, allowing repeats only if the pool is
  // smaller than count (e.g. a 2-club academy like Serbia's).
  function pickClubsForOffers(pool, count) {
    var shuffled = shuffle(pool);
    var result = [];
    for (var i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    return result;
  }

  function generateDraftOffers() {
    var clubs = pickClubsForOffers(career.academy.clubs, 3);
    var draftRating = (career.offRating + career.defRating) / 2;
    return clubs.map(function (club, i) {
      var strength = clubAverageStrength(club);
      var isLoan = i === 2;
      if (isLoan) strength = Math.min(strength, 68);
      var role = strength > 78 ? "ספסל" : "תפקיד מתחלף";
      var salary = Math.round(draftRating * 1200 * (isLoan ? 0.5 : 1) * (0.8 + Math.random() * 0.4));
      return {
        club: club,
        strength: strength,
        role: role,
        salary: salary,
        isLoan: isLoan,
        system: window.PlaySystems[Math.floor(Math.random() * window.PlaySystems.length)],
      };
    });
  }

  function renderDraft() {
    document.getElementById("career-hub-title").textContent = "יום הדראפט - גיל 19";
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var offers = generateDraftOffers();
    var content = document.getElementById("career-hub-content");
    content.innerHTML = '<div class="system-select-grid" id="career-draft-grid"></div>';

    var grid = document.getElementById("career-draft-grid");
    offers.forEach(function (o) {
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.innerHTML =
        '<div class="system-name">' + window.TeamBadge.html(o.club) + o.club + (o.isLoan ? " (השאלה)" : "") + "</div>" +
        '<div class="system-desc">תפקיד: ' + o.role + " &middot; משכורת: ₪" + o.salary.toLocaleString() + "</div>";
      btn.addEventListener("click", function () {
        acceptDraft(o);
      });
      grid.appendChild(btn);
    });
  }

  function acceptDraft(o) {
    career.team = { label: o.club, baseStrength: o.strength, system: o.system, coachMeter: 50, joinAge: career.age };
    career.contract = { yearsLeft: 2 + Math.floor(Math.random() * 2), salary: o.salary };
    career.phase = "pro";
    window.Achievements.unlock("career_first_pro");
    saveCareer();
    renderSeasonHub();
  }

  // ---------- Pro season hub ----------

  function renderSeasonHub() {
    document.getElementById("career-hub-title").innerHTML =
      window.TeamBadge.html(career.team.label) + career.team.label + " · גיל " + career.age;
    document.getElementById("career-hub-status").innerHTML =
      ratingHeaderHtml() +
      '<div class="career-status-line">' +
      "חוזה: " + career.contract.yearsLeft + " עונות נותרו &middot; משכורת: ₪" + career.contract.salary.toLocaleString() +
      " &middot; בנק: ₪" + career.money.toLocaleString() +
      " &middot; יחסים עם המאמן: " + career.team.coachMeter + "/100" +
      " &middot; מוניטין: " + reputationLabel(career.reputation) +
      (career.onNationalTeam ? " &middot; 🇪🇺 נבחרת לאומית" : "") +
      (career.fanFavorite ? " &middot; ❤️ אהובי הקהל" : "") +
      "</div>";

    pendingGoal = GOALS[0];
    var content = document.getElementById("career-hub-content");

    if (career.injury) {
      content.innerHTML =
        '<div class="career-event-card"><h3>פציעה</h3><p>אתם מתמודדים עם פציעה (' +
        (career.injury.severe ? "קשה" : "קלה") + '). איך תתקדמו העונה?</p>' +
        '<div class="h2h-setup-buttons"><button id="btn-career-injury-play">לשחק על אף הכאב (סיכון)</button>' +
        '<button id="btn-career-injury-rest">להיזהר ולהתאושש</button></div></div>';
      document.getElementById("btn-career-injury-play").addEventListener("click", function () {
        beginSeasonAction("balanced", true);
      });
      document.getElementById("btn-career-injury-rest").addEventListener("click", function () {
        beginSeasonAction("balanced", false);
      });
      return;
    }

    var showAgentOffer = !career.hasAgent && career.money >= AGENT_COST;

    content.innerHTML =
      '<p style="text-align:center;color:var(--text-dim);">חנות שדרוגים - השקיעו מהכסף שצברתם (בבנק: ₪' + career.money.toLocaleString() + "):</p>" +
      '<div class="system-select-grid" id="career-shop-grid"></div>' +
      '<p style="text-align:center;color:var(--text-dim);">מטרה לעונה:</p>' +
      '<div class="system-select-grid" id="career-goal-grid"></div>' +
      '<p style="text-align:center;color:var(--text-dim);">בחרו על מה תתמקדו באימונים העונה:</p>' +
      '<div class="system-select-grid" id="career-focus-grid"></div>' +
      (showAgentOffer
        ? '<div style="text-align:center;margin-top:10px;"><button class="secondary" id="btn-career-hire-agent">לשכור סוכן מקצועי (₪' + AGENT_COST.toLocaleString() + ")</button></div>"
        : "") +
      '<div style="text-align:center;margin-top:10px;"><button class="secondary" id="btn-career-stats">📊 סטטיסטיקת קריירה</button></div>' +
      (career.age >= RETIRE_MIN_AGE
        ? '<div style="text-align:center;margin-top:10px;"><button class="secondary" id="btn-career-retire-now">לשקול פרישה</button></div>'
        : "");

    document.getElementById("btn-career-stats").addEventListener("click", function () {
      renderCareerStatsScreen(renderSeasonHub);
    });

    var shopGrid = document.getElementById("career-shop-grid");
    getUpgradeOptions().forEach(function (u) {
      var affordable = career.money >= u.cost;
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.disabled = !affordable;
      btn.innerHTML = '<div class="system-name">' + u.label + '</div><div class="system-desc">' + u.desc + "</div>";
      if (affordable) {
        btn.addEventListener("click", function () {
          career.money -= u.cost;
          u.apply();
          saveCareer();
          renderSeasonHub();
        });
      }
      shopGrid.appendChild(btn);
    });

    var goalGrid = document.getElementById("career-goal-grid");
    GOALS.forEach(function (g, i) {
      var btn = document.createElement("button");
      btn.className = "system-card" + (i === 0 ? " selected" : "");
      btn.innerHTML = '<div class="system-name">' + g.label + '</div><div class="system-desc">' + g.desc + "</div>";
      btn.addEventListener("click", function () {
        pendingGoal = g;
        Array.from(goalGrid.children).forEach(function (c) { c.classList.remove("selected"); });
        btn.classList.add("selected");
      });
      goalGrid.appendChild(btn);
    });

    var grid = document.getElementById("career-focus-grid");
    TRAINING_FOCUS.forEach(function (f) {
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.innerHTML = '<div class="system-name">' + f.label + '</div><div class="system-desc">' + f.desc + "</div>";
      btn.addEventListener("click", function () {
        beginSeasonAction(f.id, false);
      });
      grid.appendChild(btn);
    });

    if (showAgentOffer) {
      document.getElementById("btn-career-hire-agent").addEventListener("click", function () {
        career.money -= AGENT_COST;
        career.hasAgent = true;
        saveCareer();
        renderSeasonHub();
      });
    }

    if (career.age >= RETIRE_MIN_AGE) {
      document.getElementById("btn-career-retire-now").addEventListener("click", showRetirePrompt);
    }
  }

  function beginSeasonAction(focusId, playingThroughInjury) {
    if (career.injury) {
      if (playingThroughInjury) {
        if (Math.random() < 0.4) career.injury.seasonsLeft += 1;
        else career.injury = null;
      } else {
        career.injury.seasonsLeft -= 1;
        if (career.injury.seasonsLeft <= 0) career.injury = null;
      }
    }

    pendingFocus = focusId;
    if (Math.random() < 0.3) {
      renderEventDialog();
    } else {
      finalizeSeason(focusId);
    }
  }

  function renderEventDialog() {
    var event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    document.getElementById("career-hub-title").textContent = event.title;
    document.getElementById("career-hub-status").textContent = "";

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>' + event.desc + "</p>" +
      '<div class="h2h-setup-buttons"><button id="btn-event-a">' + event.choiceA.label + "</button>" +
      '<button id="btn-event-b">' + event.choiceB.label + "</button></div></div>";

    document.getElementById("btn-event-a").addEventListener("click", function () {
      resolveEvent(event, event.choiceA);
    });
    document.getElementById("btn-event-b").addEventListener("click", function () {
      resolveEvent(event, event.choiceB);
    });
  }

  function resolveEvent(event, choice) {
    var success = choice.riskFail ? Math.random() >= choice.riskFail : true;
    var changes = [];
    if (success) {
      if (choice.reputationDelta) {
        career.reputation = clamp(career.reputation + choice.reputationDelta, 0, 100);
        changes.push("מוניטין " + (choice.reputationDelta >= 0 ? "+" : "") + choice.reputationDelta);
      }
      if (choice.moneyDelta) {
        career.money += choice.moneyDelta;
        changes.push("כסף +₪" + choice.moneyDelta.toLocaleString());
      }
      if (choice.coachMeterDelta) {
        career.team.coachMeter = clamp(career.team.coachMeter + choice.coachMeterDelta, 0, 100);
        changes.push("יחסים עם המאמן " + (choice.coachMeterDelta >= 0 ? "+" : "") + choice.coachMeterDelta);
      }
    } else if (choice.failReputationDelta) {
      career.reputation = clamp(career.reputation + choice.failReputationDelta, 0, 100);
      changes.push("מוניטין " + choice.failReputationDelta);
    }
    saveCareer();
    renderEventOutcome(event, choice, success, changes);
  }

  function renderEventOutcome(event, choice, success, changes) {
    document.getElementById("career-hub-title").textContent = event.title + " - " + (success ? "✅ הצליח!" : "❌ לא הצליח");
    document.getElementById("career-hub-status").textContent = "";

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>בחרתם: ' + choice.label + "</p>" +
      (changes.length ? changes.map(function (c) { return "<p>" + c + "</p>"; }).join("") : "<p>אין השפעה ישירה הפעם.</p>") +
      "</div>" +
      '<div class="final-actions"><button id="btn-event-outcome-next">המשך לעונה &raquo;</button></div>';

    document.getElementById("btn-event-outcome-next").addEventListener("click", function () {
      finalizeSeason(pendingFocus);
    });
  }

  // A light standings table for the season: 19 generated clubs near your
  // own club's tier each play a similar quick schedule, so your record can
  // be placed into a rank out of 20 - not just a bare win/loss line.
  function computeLeagueStanding(myWins, myLosses) {
    var others = shuffle(uniqueClubs().filter(function (c) { return c !== career.team.label; })).slice(0, 19);
    var table = [{ label: career.team.label, wins: myWins, losses: myLosses, mine: true }];
    others.forEach(function (club) {
      var strength = clubAverageStrength(club);
      var w = 0, l = 0;
      for (var i = 0; i < 8; i++) {
        var opp = opponentStrengthNear(strength);
        if (simScore(strength, opp) > simScore(opp, strength)) w++;
        else l++;
      }
      table.push({ label: club, wins: w, losses: l, mine: false });
    });
    table.sort(function (a, b) { return b.wins - a.wins; });
    var rank = -1;
    table.forEach(function (t, i) {
      if (t.mine) rank = i + 1;
    });
    return { rank: rank, total: table.length };
  }

  function resolveProSeason(focusId) {
    var beforeOff = career.offRating, beforeDef = career.defRating;
    var beforeReputation = career.reputation, beforeCoachMeter = career.team.coachMeter;
    var diff = getDifficulty();

    var starter = career.team.coachMeter >= 40 || career.age - career.team.joinAge >= 2;
    var contributionWeight = starter ? 0.35 : 0.15;

    var myOffense = effectiveOffense();
    var myDefense = effectiveDefense();
    var teamOffense = career.team.baseStrength * (1 - contributionWeight) + myOffense * contributionWeight;
    var teamDefense = career.team.baseStrength * (1 - contributionWeight) + myDefense * contributionWeight;

    var wins = 0, losses = 0;
    var GAMES = 8;
    for (var i = 0; i < GAMES; i++) {
      var opp = opponentStrengthNear(career.team.baseStrength);
      var myScore = simScore(teamOffense, opp);
      var oppScore = simScore(opp, teamDefense);
      if (myScore > oppScore) wins++;
      else losses++;
    }

    var ppg = Math.max(2, ((myOffense - 50) * 0.45 + 8) * (starter ? 1 : 0.5));

    var delta = ageGrowthDelta(career.age);
    var offShare = focusId === "offense" ? 0.7 : focusId === "defense" ? 0.3 : 0.5;
    career.offRating = clamp(career.offRating + delta * offShare, 30, 99);
    career.defRating = clamp(career.defRating + delta * (1 - offShare), 30, 99);
    updatePeakRating();

    var shieldActive = !!career.injuryShieldActive;
    var injuryChance = 0.08 * diff.injuryMult * (shieldActive ? 0.5 : 1);
    var injuryEvent = null;
    if (!career.injury && Math.random() < injuryChance) {
      injuryEvent = { severe: Math.random() < 0.3, seasonsLeft: Math.random() < 0.3 ? 2 : 1 };
      career.injury = injuryEvent;
      wins = Math.round(wins * 0.6);
      ppg *= 0.7;
    }
    if (shieldActive) career.injuryShieldActive = false;

    var awards = [];
    if (starter && ppg >= 18 && Math.random() < 0.4) awards.push("נבחר לחמישיית העל של העונה");
    var champion = wins >= 6 && Math.random() < 0.25;
    if (champion) awards.push("אלופת העונה!");

    var qualifiesNT = (myOffense + myDefense) / 2 >= 78 && career.reputation >= 40;
    career.onNationalTeam = qualifiesNT && Math.random() < 0.5;
    var specialEvent = career.onNationalTeam && career.age % 4 === 0 ? "יורובאסקט" : null;

    var standing = computeLeagueStanding(wins, losses);

    var fitsSystem = window.PlaySystemsAPI.fits({ archetype: career.archetype }, career.team.system, null);
    career.team.coachMeter = clamp(career.team.coachMeter + (fitsSystem ? 4 : -2) + (wins > losses ? 2 : -2), 0, 100);

    var record = {
      phase: "pro",
      age: career.age,
      team: career.team.label,
      wins: wins,
      losses: losses,
      ppg: Math.round(ppg * 10) / 10,
      rating: Math.round((career.offRating + career.defRating) / 2),
      awards: awards,
      champion: champion,
      onNationalTeam: career.onNationalTeam,
      specialEvent: specialEvent,
      injuryEvent: injuryEvent,
      starter: starter,
      beforeOff: beforeOff,
      beforeDef: beforeDef,
      afterOff: career.offRating,
      afterDef: career.defRating,
      focusLabel: TRAINING_FOCUS.filter(function (f) { return f.id === focusId; })[0].label,
      leagueRank: standing.rank,
      leagueTotal: standing.total,
      coachMeterDelta: career.team.coachMeter - beforeCoachMeter,
      fitsSystem: fitsSystem,
      shieldUsed: shieldActive,
    };

    var goal = pendingGoal;
    var goalAchieved = false;
    if (goal) {
      goalAchieved = goal.check(record);
      record.goalLabel = goal.label;
      record.goalAchieved = goalAchieved;
    }

    career.reputation = clamp(
      career.reputation + (wins - losses) + awards.length * 5 + (career.onNationalTeam ? 5 : 0) +
        (goalAchieved ? goal.rewardRep : 0),
      0,
      100
    );
    record.reputationDelta = career.reputation - beforeReputation;

    var seasonEarnings = career.contract.salary + Math.round(career.reputation * 200) + (goalAchieved ? goal.rewardMoney : 0);
    career.money += seasonEarnings;
    record.moneyEarned = seasonEarnings;

    // A club that's unhappy with your performance and your relationship with
    // the coach may cut ties early, forcing you into free agency right away.
    if (career.team.coachMeter < 20 && wins < losses && Math.random() < 0.25) {
      record.released = true;
      career.contract.yearsLeft = 0;
    }

    if (!career.secondaryArchetype && career.peakRating >= SECONDARY_ARCHETYPE_RATING_THRESHOLD) {
      record.secondaryUnlockPending = true;
    }

    career.seasonHistory.push(record);

    // Fan-favorite status: loyal to the same club long enough, with a decent
    // reputation, and the crowd starts lifting you - resets if you ever leave.
    if (!career.fanFavorite) {
      var seasonsWithTeam = career.seasonHistory.filter(function (r) {
        return r.phase === "pro" && r.team === career.team.label;
      }).length;
      if (seasonsWithTeam >= FAN_FAVORITE_SEASONS_NEEDED && career.reputation >= FAN_FAVORITE_REPUTATION_NEEDED) {
        career.fanFavorite = true;
        record.fanFavoriteJustEarned = true;
      }
    }

    // Career-wide milestones, checked once per season and only announced the
    // first time each one is crossed.
    var totals = computeCareerTotals();
    var milestonesHit = [];
    MILESTONE_DEFS.forEach(function (m) {
      if (!career.milestonesCrossed[m.id] && m.check(totals)) {
        career.milestonesCrossed[m.id] = true;
        milestonesHit.push(m.label);
      }
    });
    record.milestonesHit = milestonesHit;

    career.age++;
    career.contract.yearsLeft--;

    return record;
  }

  function getDifficulty() {
    return career.difficulty || { injuryMult: 1, declineMult: 1, growthMult: 1 };
  }

  function ageGrowthDelta(age) {
    var diff = getDifficulty();
    if (age <= 23) return (2 + Math.random() * 2) * diff.growthMult;
    if (age <= 29) return Math.random() * 1.5 * diff.growthMult;
    if (age <= 33) return -Math.random() * 1.5 * diff.declineMult;
    return -(1.5 + Math.random() * 2) * diff.declineMult;
  }

  function finalizeSeason(focusId) {
    var record = resolveProSeason(focusId);
    saveCareer();
    renderRecap(record);
  }

  function renderRecap(record) {
    document.getElementById("career-hub-title").textContent = "סיכום עונה - גיל " + record.age;
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var lines = [];
    lines.push("אימון שנבחר: " + record.focusLabel);
    lines.push("תפקיד: " + (record.starter ? "חמישייה פותחת" : "ספסל"));
    lines.push("שיא עונתי: " + record.wins + "-" + record.losses);
    lines.push("מיקום בטבלה: " + record.leagueRank + " מתוך " + record.leagueTotal);
    lines.push("ממוצע נקודות: " + record.ppg);
    if (record.champion) {
      lines.push("🏆 אלופת העונה!");
      window.Effects.confetti();
    }
    record.awards.forEach(function (a) {
      if (a !== "אלופת העונה!") lines.push("🌟 " + a);
    });
    if (record.onNationalTeam) lines.push("🇪🇺 נבחרתם לנבחרת הלאומית!");
    if (record.specialEvent) lines.push("🌍 " + record.specialEvent + " - חוויה בינלאומית מיוחדת");
    if (record.injuryEvent) lines.push("🩹 נפצעתם (" + (record.injuryEvent.severe ? "פציעה קשה" : "פציעה קלה") + ")");
    if (record.shieldUsed && !record.injuryEvent) lines.push("🛡️ אימון מניעת הפציעות עבד - נשארתם בריאים!");
    if (record.goalLabel) {
      lines.push((record.goalAchieved ? "🎯 יעד הושג: " : "❌ יעד לא הושג: ") + record.goalLabel);
    }
    if (record.released) lines.push("😬 הקבוצה החליטה לא להאריך את החוזה שלכם");
    if (record.fanFavoriteJustEarned) lines.push("❤️ הפכתם לאהובי הקהל אצל " + career.team.label + "!");

    var moneyLine = "כסף שהורווח העונה: ₪" + record.moneyEarned.toLocaleString() + " &middot; בנק כולל: ₪" + career.money.toLocaleString();
    var coachLine = "יחסים עם המאמן: " +
      (record.fitsSystem ? "מתאימים לשיטת המאמן" : "לא מתאימים לשיטת המאמן") +
      " (" + (record.coachMeterDelta >= 0 ? "+" : "") + record.coachMeterDelta + ") &middot; כעת: " + career.team.coachMeter + "/100";
    var repLine = "מוניטין: " + (record.reputationDelta >= 0 ? "+" : "") + record.reputationDelta +
      " &middot; כעת: " + reputationLabel(career.reputation);

    var milestoneBanner = record.milestonesHit && record.milestonesHit.length
      ? '<div class="career-milestone-banner">' +
        record.milestonesHit.map(function (m) { return "<p>" + m + "</p>"; }).join("") +
        "</div>"
      : "";

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      milestoneBanner +
      '<div class="career-event-card">' +
      lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") +
      ratingChangeHtml(record.beforeOff, record.beforeDef, record.afterOff, record.afterDef) +
      "<p>" + moneyLine + "</p>" +
      "<p>" + coachLine + "</p>" +
      "<p>" + repLine + "</p>" +
      "</div>" +
      '<div class="final-actions"><button id="btn-career-next">המשך &raquo;</button></div>';

    document.getElementById("btn-career-next").addEventListener("click", function () {
      if (record.secondaryUnlockPending) {
        renderSecondaryArchetypeUnlock();
        return;
      }
      proceedAfterRecap();
    });
  }

  function proceedAfterRecap() {
    if (career.age >= RETIRE_FORCE_AGE) {
      finishCareer();
      return;
    }
    if (career.contract.yearsLeft <= 0) {
      renderContractOffers();
      return;
    }
    renderSeasonHub();
  }

  function renderSecondaryArchetypeUnlock() {
    document.getElementById("career-hub-title").textContent = "🌟 פריצת דרך בקריירה!";
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var options = window.RatingArchetypes.filter(function (a) { return a.id !== career.archetype.id; });
    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<p style="text-align:center;color:var(--text-dim);">הגעתם לרמה חדשה - בחרו תכונת אופי משנית שתתווסף לתכונה הראשית שלכם:</p>' +
      '<div class="system-select-grid" id="career-secondary-grid"></div>';

    var grid = document.getElementById("career-secondary-grid");
    options.forEach(function (a) {
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.innerHTML = '<div class="system-name">' + a.label + '</div><div class="system-desc">' + a.desc + "</div>";
      btn.addEventListener("click", function () {
        career.secondaryArchetype = a;
        saveCareer();
        proceedAfterRecap();
      });
      grid.appendChild(btn);
    });
  }

  function renderCareerStatsScreen(returnFn) {
    document.getElementById("career-hub-title").textContent = "📊 סטטיסטיקת קריירה";
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var totals = computeCareerTotals();
    var academySeasons = career.seasonHistory.filter(function (r) { return r.phase === "academy"; }).length;
    var totalPpg = 0, proCount = 0;
    career.seasonHistory.forEach(function (r) {
      if (r.phase === "pro") { totalPpg += r.ppg; proCount++; }
    });
    var avgPpg = proCount > 0 ? Math.round((totalPpg / proCount) * 10) / 10 : 0;

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>שם: " + career.name + " &middot; עמדה: " + career.position + " &middot; גיל נוכחי: " + career.age + "</p>" +
      "<p>עונות אקדמיה: " + academySeasons + " &middot; עונות מקצועניות: " + totals.proSeasons + "</p>" +
      "<p>סה\"כ ניצחונות קריירה: " + totals.wins + " &middot; ממוצע נקודות לעונה: " + avgPpg + "</p>" +
      "<p>אליפויות: " + totals.trophies + " &middot; שיא דירוג עד כה: " + totals.peakRating + "</p>" +
      "<p>סה\"כ הכנסות: ₪" + career.money.toLocaleString() + "</p>" +
      "<p>קבוצה נוכחית: " + (career.team ? career.team.label : "-") + (career.fanFavorite ? " &middot; ❤️ אהובי הקהל" : "") + "</p>" +
      "<p>שיטת אופי: " + career.archetype.label + (career.secondaryArchetype ? " + " + career.secondaryArchetype.label : "") + "</p>" +
      "</div>" +
      '<div class="final-actions"><button id="btn-career-stats-back">חזרה &raquo;</button></div>';

    document.getElementById("btn-career-stats-back").addEventListener("click", returnFn);
  }

  // ---------- Contract renewal / free agency ----------

  function generateContractOffers() {
    var offers = [];
    var draftRating = (career.offRating + career.defRating) / 2;
    var agentMult = career.hasAgent ? 1.2 : 1;

    var staySalary = Math.round(career.contract.salary * (0.9 + career.reputation / 200 + Math.random() * 0.2) * agentMult);
    offers.push({
      club: career.team.label,
      role: career.team.coachMeter >= 40 ? "חמישייה פותחת" : "ספסל",
      salary: staySalary,
      stay: true,
      strength: career.team.baseStrength,
      system: career.team.system,
    });

    var others = shuffle(uniqueClubs().filter(function (c) { return c !== career.team.label; })).slice(0, 2);
    others.forEach(function (club) {
      var strength = clubAverageStrength(club);
      var salary = Math.round(draftRating * 1500 * (0.8 + Math.random() * 0.6) * (1 + career.reputation / 200) * agentMult);
      offers.push({
        club: club,
        role: strength > 78 ? "ספסל" : "חמישייה פותחת",
        salary: salary,
        stay: false,
        strength: strength,
        system: window.PlaySystems[Math.floor(Math.random() * window.PlaySystems.length)],
      });
    });

    return offers;
  }

  function renderContractOffers() {
    document.getElementById("career-hub-title").textContent = "חוזה חדש";
    document.getElementById("career-hub-status").textContent = "החוזה שלכם עם " + career.team.label + " הסתיים";

    var offers = generateContractOffers();
    var content = document.getElementById("career-hub-content");
    content.innerHTML = '<div class="system-select-grid" id="career-contract-grid"></div>';

    var grid = document.getElementById("career-contract-grid");
    offers.forEach(function (o) {
      var btn = document.createElement("button");
      btn.className = "system-card";
      btn.innerHTML =
        '<div class="system-name">' + window.TeamBadge.html(o.club) + o.club + (o.stay ? " (הישארות)" : "") + "</div>" +
        '<div class="system-desc">תפקיד: ' + o.role + " &middot; משכורת: ₪" + o.salary.toLocaleString() + "</div>";
      btn.addEventListener("click", function () {
        acceptContract(o);
      });
      grid.appendChild(btn);
    });
  }

  function acceptContract(o) {
    if (!o.stay) {
      career.team = { label: o.club, baseStrength: o.strength, system: o.system, coachMeter: 50, joinAge: career.age };
      career.fanFavorite = false; // fan-favorite status is tied to loyalty with the club you're leaving
    }
    career.contract = { yearsLeft: 2 + Math.floor(Math.random() * 3), salary: o.salary };
    saveCareer();
    renderContractConfirmation(o);
  }

  function renderContractConfirmation(o) {
    document.getElementById("career-hub-title").textContent = "החוזה נחתם!";
    document.getElementById("career-hub-status").textContent = "";

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card">' +
      "<p>חתמתם עם <strong>" + o.club + "</strong>" + (o.stay ? " (המשכתם אצל הקבוצה שלכם)" : " (קבוצה חדשה)") + "</p>" +
      "<p>תפקיד: " + o.role + " &middot; משכורת: ₪" + o.salary.toLocaleString() +
      " &middot; אורך חוזה: " + career.contract.yearsLeft + " עונות</p>" +
      (o.stay ? "" : "<p>שיטת המאמן החדשה: " + o.system.label + "</p>") +
      "</div>" +
      '<div class="final-actions"><button id="btn-contract-confirm-next">המשך &raquo;</button></div>';

    document.getElementById("btn-contract-confirm-next").addEventListener("click", renderSeasonHub);
  }

  // ---------- Retirement ----------

  function showRetirePrompt() {
    document.getElementById("career-hub-title").textContent = "לשקול פרישה?";
    document.getElementById("career-hub-status").innerHTML = ratingHeaderHtml();

    var content = document.getElementById("career-hub-content");
    content.innerHTML =
      '<div class="career-event-card"><p>האם ברצונכם לפרוש כעת ולסיים את הקריירה?</p>' +
      '<div class="h2h-setup-buttons"><button id="btn-retire-yes">לפרוש עכשיו</button>' +
      '<button class="secondary" id="btn-retire-no">להמשיך לשחק</button></div></div>';

    document.getElementById("btn-retire-yes").addEventListener("click", finishCareer);
    document.getElementById("btn-retire-no").addEventListener("click", renderSeasonHub);
  }

  function checkCareerAchievements() {
    window.Achievements.unlock("career_retired");
    var teams = {};
    career.seasonHistory.forEach(function (r) {
      if (r.phase === "pro") teams[r.team] = true;
    });
    var teamCount = Object.keys(teams).length;
    if (teamCount === 1) window.Achievements.unlock("career_loyal");
    if (teamCount >= 3) window.Achievements.unlock("career_journeyman");
    if (career.seasonHistory.some(function (r) { return r.champion; })) window.Achievements.unlock("career_champion");
    if (career.seasonHistory.some(function (r) { return r.onNationalTeam; })) window.Achievements.unlock("career_national_team");
    if (career.peakRating >= 90) window.Achievements.unlock("career_legend_rating");
    var runs = window.Achievements.incrementCounter("career_runs_completed");
    if (runs >= 2) window.Achievements.unlock("career_second_run");
  }

  function buildSummary() {
    var teams = {};
    career.seasonHistory.forEach(function (r) {
      if (r.phase === "pro") teams[r.team] = true;
    });
    return {
      name: career.name,
      position: career.position,
      peakRating: Math.round(career.peakRating),
      retirementAge: career.retirementAge,
      trophies: career.seasonHistory.filter(function (r) { return r.champion; }).length,
      teams: Object.keys(teams),
      totalMoney: career.money,
    };
  }

  function finishCareer() {
    career.phase = "retired";
    career.retirementAge = career.age;
    checkCareerAchievements();
    saveLastCareer(buildSummary());
    clearCareer();
    renderSummaryScreen();
  }

  function renderSummaryScreen() {
    var content = document.getElementById("career-summary-content");
    var peakRounded = Math.round(career.peakRating);

    var chartBars = career.seasonHistory.map(function (r) {
      var heightPct = Math.max(8, Math.round(((r.rating - 30) / (99 - 30)) * 100));
      var isPeak = r.rating === peakRounded;
      return (
        '<div class="chart-bar-wrap" title="גיל ' + r.age + " &middot; " + r.team + " - " + r.rating + '">' +
        '<div class="chart-bar' + (isPeak ? " peak" : "") + '" style="height:' + heightPct + '%"></div>' +
        '<div class="chart-bar-label">' + r.age + "</div></div>"
      );
    }).join("");

    var rows = career.seasonHistory.slice().reverse().map(function (r) {
      if (r.phase === "academy") {
        return (
          '<div class="player-appearance-row">' +
          "<span>גיל " + r.age + " &middot; " + r.team + " (אקדמיה)</span>" +
          window.RatingTag.html(r.rating) +
          (r.breakout ? '<span class="archetype-tag">פריצת דרך</span>' : "") +
          "</div>"
        );
      }
      return (
        '<div class="player-appearance-row' + (r.champion ? " peak" : "") + '">' +
        "<span>גיל " + r.age + " &middot; " + r.team + "</span>" +
        "<span>" + (r.starter ? "פותח" : "ספסל") + "</span>" +
        window.RatingTag.html(r.rating) +
        "<span>" + r.wins + "-" + r.losses + "</span>" +
        "<span>" + r.ppg + " נק'</span>" +
        (r.champion ? '<span class="archetype-tag">🏆 אלופים</span>' : "") +
        (r.onNationalTeam ? '<span class="archetype-tag">🇪🇺 נבחרת</span>' : "") +
        (r.awards && r.awards.length
          ? r.awards.filter(function (a) { return a !== "אלופת העונה!"; })
              .map(function (a) { return '<span class="archetype-tag">🌟 ' + a + "</span>"; }).join("")
          : "") +
        "</div>"
      );
    }).join("");

    var summary = buildSummary();

    var teamCounts = {};
    career.seasonHistory.forEach(function (r) {
      if (r.phase === "pro") teamCounts[r.team] = (teamCounts[r.team] || 0) + 1;
    });
    var mostTeam = null, mostCount = 0;
    Object.keys(teamCounts).forEach(function (t) {
      if (teamCounts[t] > mostCount) {
        mostCount = teamCounts[t];
        mostTeam = t;
      }
    });

    var ceremonyHtml = "";
    if (peakRounded >= 80 && mostTeam) {
      ceremonyHtml =
        '<div class="career-event-card"><h3>🎉 טקס פרישה מיוחד</h3>' +
        "<p>קריירה יוצאת דופן! " + mostTeam + " (" + mostCount + " עונות) תזכור אתכם לתמיד. שיא דירוג של " +
        peakRounded + " מציב אתכם בין השחקנים הגדולים שההיסטוריה זוכרת.</p></div>";
    }

    content.innerHTML =
      '<h2 class="player-profile-name">' + career.name + "</h2>" +
      '<p class="player-profile-summary">' +
      career.position + " &middot; פרש/ה בגיל " + career.retirementAge + " &middot; שיא דירוג " + peakRounded +
      " &middot; " + summary.teams.length + " קבוצות &middot; " + summary.trophies + ' אליפויות &middot; סה"כ הכנסות: ₪' +
      career.money.toLocaleString() +
      "</p>" +
      ceremonyHtml +
      '<div class="player-rating-chart">' + chartBars + "</div>" +
      '<div class="player-appearances-list">' + rows + "</div>";

    window.AppNav.showScreen("careerSummary");
  }

  // ---------- Wiring ----------

  document.getElementById("btn-career-new").addEventListener("click", renderCreateScreen);
  document.getElementById("btn-career-new-2").addEventListener("click", renderCreateScreen);
  document.getElementById("btn-career-continue").addEventListener("click", continueCareer);
  document.getElementById("btn-career-start").addEventListener("click", startCareer);

  document.querySelectorAll("#career-position-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#career-position-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      createState.position = btn.dataset.pos;
    });
  });

  document.getElementById("btn-career-off-plus").addEventListener("click", function () {
    createState.offPoints = Math.min(20, createState.offPoints + 2);
    updatePointsDisplay();
  });
  document.getElementById("btn-career-def-plus").addEventListener("click", function () {
    createState.offPoints = Math.max(0, createState.offPoints - 2);
    updatePointsDisplay();
  });

  window.CareerGame = { open: openHome };
})();
