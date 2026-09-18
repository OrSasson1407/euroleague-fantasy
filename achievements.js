(function () {
  "use strict";

  var STORAGE_KEY = "euroleague_achievements_v1";
  var MODES = ["single", "h2h", "league", "trivia"];

  // title/desc are resolved through window.I18n.t() at render time (see
  // defTitle/defDesc below), keyed by id under the achievements.* namespace
  // in locales_he.js/locales_en.js - keeps this list a stable set of ids
  // rather than duplicating text here.
  var DEFS = [
    { id: "single_first", icon: "🥉" },
    { id: "single_elite", icon: "💎" },
    { id: "single_legend", icon: "🌟" },
    { id: "single_exhibition_win", icon: "🎮" },
    { id: "single_exhibition_legends_win", icon: "🐐" },
    { id: "h2h_first_win", icon: "🥇" },
    { id: "h2h_sweep", icon: "🧹" },
    { id: "h2h_upset", icon: "🐎" },
    { id: "h2h_veteran", icon: "🎖️" },
    { id: "h2h_comeback", icon: "📈" },
    { id: "h2h_perfect_series", icon: "💯" },
    { id: "h2h_legends_battle", icon: "🌟" },
    { id: "h2h_series_scorer", icon: "🎯" },
    { id: "h2h_underdog", icon: "🐕" },
    { id: "league_first", icon: "🏁" },
    { id: "league_champion", icon: "🥇" },
    { id: "league_playoff_champion", icon: "🏆" },
    { id: "league_undefeated", icon: "💯" },
    { id: "league_close_win", icon: "⏱️" },
    { id: "league_trade", icon: "🔄" },
    { id: "league_veteran", icon: "🏛️" },
    { id: "trivia_perfect_team", icon: "🧠" },
    { id: "trivia_perfect_season", icon: "📅" },
    { id: "trivia_perfect_knowledge", icon: "🏆" },
    { id: "trivia_expert", icon: "📚" },
    { id: "explorer", icon: "🧭" },
    { id: "live_watch_full", icon: "📺" },
    { id: "collector", icon: "🎁" },
    { id: "career_first_pro", icon: "✍️" },
    { id: "career_champion", icon: "🏆" },
    { id: "career_national_team", icon: "🇪🇺" },
    { id: "career_journeyman", icon: "🧳" },
    { id: "career_loyal", icon: "❤️" },
    { id: "career_legend_rating", icon: "🌟" },
    { id: "career_retired", icon: "🎽" },
    { id: "career_second_run", icon: "🔁" },
    { id: "coach_first_hire", icon: "📋" },
    { id: "coach_champion", icon: "🏆" },
    { id: "coach_playoff_champion", icon: "🥇" },
    { id: "coach_coach_of_year", icon: "🌟" },
    { id: "coach_fired", icon: "📦" },
    { id: "coach_journeyman", icon: "🧳" },
    { id: "coach_loyal", icon: "❤️" },
    { id: "coach_retired", icon: "🧢" },
    { id: "coach_second_run", icon: "🔁" },
  ];

  function defTitle(id) {
    return window.I18n.t("achievements." + id + ".title");
  }

  function defDesc(id) {
    return window.I18n.t("achievements." + id + ".desc");
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { unlocked: [], counters: {}, best: {}, played: {} };
      var parsed = JSON.parse(raw);
      return {
        unlocked: parsed.unlocked || [],
        counters: parsed.counters || {},
        best: parsed.best || {},
        played: parsed.played || {},
      };
    } catch (e) {
      return { unlocked: [], counters: {}, best: {}, played: {} };
    }
  }

  var data = load();

  function save() {
    if (window.Auth && !window.Auth.canSave()) return; // guest mode - nothing persists
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Private browsing / quota / disabled storage - badges just won't persist.
    }
  }

  function showToast(def) {
    var toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML =
      '<span class="achievement-toast-icon" aria-hidden="true">' + def.icon + "</span>" +
      '<div><div class="achievement-toast-title">' + window.I18n.t("achievements.newBadgeToast", { title: defTitle(def.id) }) + "</div>" +
      '<div class="achievement-toast-desc">' + defDesc(def.id) + "</div></div>";
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 3500);
  }

  function findDef(id) {
    for (var i = 0; i < DEFS.length; i++) {
      if (DEFS[i].id === id) return DEFS[i];
    }
    return null;
  }

  function unlock(id) {
    if (data.unlocked.indexOf(id) !== -1) return false;
    var def = findDef(id);
    if (!def) return false;
    data.unlocked.push(id);
    save();
    showToast(def);
    if (id !== "collector" && data.unlocked.length >= 10) {
      unlock("collector");
    }
    return true;
  }

  function isUnlocked(id) {
    return data.unlocked.indexOf(id) !== -1;
  }

  function incrementCounter(key) {
    data.counters[key] = (data.counters[key] || 0) + 1;
    save();
    return data.counters[key];
  }

  function getCounter(key) {
    return data.counters[key] || 0;
  }

  function reportBest(key, value) {
    var prev = data.best[key] || 0;
    if (value > prev) {
      data.best[key] = value;
      save();
    }
    return Math.max(prev, value);
  }

  function getBest(key) {
    return data.best[key] || 0;
  }

  function markPlayed(mode) {
    if (data.played[mode]) return;
    data.played[mode] = true;
    save();
    var allPlayed = MODES.every(function (m) {
      return data.played[m];
    });
    if (allPlayed) unlock("explorer");
  }

  function getAll() {
    return DEFS.map(function (d) {
      return { id: d.id, title: defTitle(d.id), desc: defDesc(d.id), icon: d.icon, unlocked: isUnlocked(d.id) };
    });
  }

  window.Achievements = {
    unlock: unlock,
    isUnlocked: isUnlocked,
    incrementCounter: incrementCounter,
    getCounter: getCounter,
    reportBest: reportBest,
    getBest: getBest,
    markPlayed: markPlayed,
    getAll: getAll,
  };
})();
