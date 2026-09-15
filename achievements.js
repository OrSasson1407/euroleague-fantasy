(function () {
  "use strict";

  var STORAGE_KEY = "euroleague_achievements_v1";
  var MODES = ["single", "h2h", "league", "trivia"];

  var DEFS = [
    { id: "single_first", title: "צעד ראשון", desc: "השלמתם הרכב אחד במצב בניית סגל", icon: "🥉" },
    { id: "single_elite", title: "סגל עלית", desc: "השלמתם הרכב עם דירוג משוקלל של 85 ומעלה", icon: "💎" },
    { id: "single_legend", title: "כוכב-על", desc: "שיבצתם בהרכב שחקן עם דירוג 95 ומעלה", icon: "🌟" },
    { id: "single_exhibition_win", title: "ניצחון תערוכה", desc: "ניצחתם במשחק תערוכה חד-פעמי במצב בניית סגל", icon: "🎮" },
    { id: "h2h_first_win", title: "ניצחון ראשון", desc: "ניצחתם סדרת 1 על 1 ראשונה", icon: "🥇" },
    { id: "h2h_sweep", title: "מטאטא", desc: "ניצחתם סדרת 1 על 1 בתוצאה 2-0", icon: "🧹" },
    { id: "h2h_upset", title: "רוח גבית", desc: "ניצחתם ב-1 על 1 למרות דירוג ממוצע נמוך יותר מהיריב", icon: "🐎" },
    { id: "h2h_veteran", title: "ותיק הזירה", desc: "שיחקתם 5 סדרות 1 על 1", icon: "🎖️" },
    { id: "league_first", title: "עונה ראשונה", desc: "השלמתם עונת ליגה ראשונה", icon: "🏁" },
    { id: "league_champion", title: "אלופת הליגה", desc: "סיימתם במקום הראשון בטבלת הליגה", icon: "🥇" },
    { id: "league_playoff_champion", title: "אלופת הפלייאוף", desc: "ניצחתם את הפלייאוף", icon: "🏆" },
    { id: "league_undefeated", title: "עונה מושלמת", desc: "סיימתם עונה סדירה בלי הפסד אחד", icon: "💯" },
    { id: "league_close_win", title: "עד הבאזר", desc: "ניצחתם משחק ליגה בהפרש של נקודה אחת", icon: "⏱️" },
    { id: "league_trade", title: "מנהל חכם", desc: "השלמתם העברת שחקן באמצע העונה", icon: "🔄" },
    { id: "league_veteran", title: "בנאי אימפריה", desc: "השלמתם 3 עונות ליגה", icon: "🏛️" },
    { id: "trivia_perfect_team", title: "מומחה קבוצות", desc: "ציון מושלם 25/25 בטריוויית קבוצות", icon: "🧠" },
    { id: "trivia_perfect_season", title: "מומחה עונות", desc: "ציון מושלם 25/25 בטריוויית עונות", icon: "📅" },
    { id: "trivia_expert", title: "היסטוריון היורוליג", desc: "ציון 20+ בשני סוגי הטריוויה", icon: "📚" },
    { id: "explorer", title: "חוקר המשחק", desc: "שיחקתם בכל אחד מ-4 המשחקונים", icon: "🧭" },
    { id: "live_watch_full", title: "צופה נלהב", desc: "עקבתם אחרי כל משחקי הליגה במצב משחק אחר משחק", icon: "📺" },
    { id: "collector", title: "אספן באנרים", desc: "פתחתם 10 באנרים אחרים", icon: "🎁" },
    { id: "career_first_pro", title: "חוזה ראשון", desc: "נחתמתם לחוזה מקצועני ראשון במצב קריירה", icon: "✍️" },
    { id: "career_champion", title: "אלופה!", desc: "זכיתם באליפות עונה במצב קריירה", icon: "🏆" },
    { id: "career_national_team", title: "נבחרת לאומית", desc: "נבחרתם לנבחרת הלאומית במצב קריירה", icon: "🇪🇺" },
    { id: "career_journeyman", title: "נווד", desc: "שיחקתם ב-3 קבוצות שונות או יותר באותה קריירה", icon: "🧳" },
    { id: "career_loyal", title: "נאמנות", desc: "סיימתם קריירה שלמה באותה קבוצה", icon: "❤️" },
    { id: "career_legend_rating", title: "אגדה", desc: "הגעתם לדירוג 90+ במצב קריירה", icon: "🌟" },
    { id: "career_retired", title: "פרישה בכבוד", desc: "השלמתם קריירה שלמה עד הפרישה", icon: "🎽" },
    { id: "career_second_run", title: "ניסיון שני", desc: "התחלתם קריירה חדשה אחרי שסיימתם קודמת", icon: "🔁" },
  ];

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
    toast.innerHTML =
      '<span class="achievement-toast-icon">' + def.icon + "</span>" +
      '<div><div class="achievement-toast-title">באנר חדש: ' + def.title + "</div>" +
      '<div class="achievement-toast-desc">' + def.desc + "</div></div>";
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
      return { id: d.id, title: d.title, desc: d.desc, icon: d.icon, unlocked: isUnlocked(d.id) };
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
