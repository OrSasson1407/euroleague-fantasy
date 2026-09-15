(function () {
  "use strict";

  var idMap = {
    home: "screen-home",
    start: "screen-start",
    round: "screen-round",
    singleLineup: "screen-single-lineup",
    singleTrade: "screen-single-trade",
    final: "screen-final",
    singleShare: "screen-single-share",
    singleExhibition: "screen-single-exhibition",
    singleLeaderboard: "screen-single-leaderboard",
    h2hSetup: "screen-h2h-setup",
    h2hDraft: "screen-h2h-draft",
    h2hSystem: "screen-h2h-system",
    h2hGame: "screen-h2h-game",
    h2hResult: "screen-h2h-result",
    leagueTeamSelect: "screen-league-team-select",
    leagueDraft: "screen-league-draft",
    leagueLineup: "screen-league-lineup",
    leagueSystem: "screen-league-system",
    leagueSimChoice: "screen-league-simchoice",
    leagueLive: "screen-league-live",
    leagueTrade: "screen-league-trade",
    leagueTable: "screen-league-table",
    leaguePlayoffs: "screen-league-playoffs",
    triviaSelect: "screen-trivia-select",
    triviaQuestion: "screen-trivia-question",
    triviaFinal: "screen-trivia-final",
    badges: "screen-badges",
    profile: "screen-profile",
    settings: "screen-settings",
    about: "screen-about",
    playerSearch: "screen-player-search",
    careerHome: "screen-career-home",
    careerCreate: "screen-career-create",
    careerHub: "screen-career-hub",
    careerSummary: "screen-career-summary",
  };

  // Per-screen "how this works" explanations, shown as a dismissible toast
  // instead of a paragraph that permanently sits on the page. Fires once
  // each time a screen becomes active (not on repeated re-renders of the
  // same already-active screen), keyed by idMap key.
  var SCREEN_INFO = {
    careerHome: "התחילו כשחקן צעיר בגיל 16, התפתחו באקדמיה, הצטרפו לליגה המקצוענית ונהלו קריירה שלמה - חוזים, פציעות, נבחרת לאומית ופרישה.",
    start: "בכל סיבוב תוגרל קבוצה ועונה אקראית. תראו את כל שחקני הסגל של אותה עונה, ולכל שחקן זמין תבחרו בעצמכם אם הוא משתבץ לחמישייה הפותחת או לספסל. שחקן שכבר נבחר (מכל עונה שלו) לא יהיה זמין לבחירה נוספת. החמישייה הפותחת והספסל כל אחד מורכב מ-2 מגנים, 2 חלוצים וסנטר - כל שחקן משתבץ לפי העמדה האמיתית שלו בלבד. בסיום הדראפט תוכלו גם להחליף שחקנים בין החמישייה לספסל (רק באותה עמדה), ואז יהיו לכם עד 2 הזדמנויות \"מסחר\" להחליף שחקן בהרכב בשחקן חדש באותה עמדה.",
    singleLineup: "לפני שממשיכים - אפשר להחליף שחקנים בין החמישייה הפותחת לספסל. לחצו על שחקן ואז על שחקן אחר באותה עמדה כדי להחליף ביניהם.",
    singleTrade: "לפני הסיכום הסופי - אפשר לבקש הצעות החלפה לשחקן בהרכב. תוצג 3 הצעות לאותה עמדה, ואתם בוחרים אם לבצע אחת מהן או להשאיר את השחקן הנוכחי.",
    singleLeaderboard: "חמשת ההרכבים עם הדירוג הסופי הגבוה ביותר ששמרתם. לחצו על הרכב כדי לראות את כל השחקנים בו.",
    h2hSetup: "כל שחקן מרכיב חמישייה: 2 מגנים, 2 חלוצים וסנטר אחד. התורות מתחלפים בין שני הצדדים - בכל תור תוגרל קבוצה ועונה אקראית ותבחרו שחקן זמין מהסגל שלה. בסוף הבחירה תשוחק הסדרה משחק אחר משחק.",
    h2hSystem: "שחקנים שמתאימים לשיטה מקבלים בונוס להתקפה/הגנה, ומי שלא - קנס קטן. משפיע על כל 5 השחקנים.",
    leagueTeamSelect: "בחרו את הקבוצה האהובה עליכם. לאחר מכן תרכיבו לה סגל של 10 שחקנים: 2 מגנים, 2 חלוצים וסנטר בחמישייה הפותחת, ואותו הרכב עמדות בספסל. בכל בחירה תוכלו לבחור בעצמכם אם השחקן משתבץ לחמישייה הפותחת או לספסל - כל עוד יש שם מקום פנוי בעמדה שלו. בכל סיבוב תוגרל עונה אקראית של אותה קבוצה בלבד.",
    leagueLineup: "לפני שהליגה מתחילה - אפשר להחליף שחקנים בין החמישייה הפותחת לספסל. לחצו על שחקן ואז על שחקן אחר באותה עמדה כדי להחליף ביניהם.",
    leagueSystem: "בתור המאמן, בחרו שיטת משחק לקבוצה שלכם לכל העונה. שחקנים שמתאימים לשיטה (לפי תכונת האופי שלהם) מקבלים בונוס להתקפה/הגנה; שחקנים שלא מתאימים מקבלים קנס קטן. משפיע על כל 10 השחקנים, עם משקל של 65% לחמישייה הפותחת ו-35% לספסל - בדיוק כמו בחישוב הדירוג המשוקלל.",
    leagueSimChoice: "אפשר לראות את כל תוצאות הליגה בבת אחת, או לעקוב אחרי המשחקים של ההרכב שלכם אחד אחרי השני.",
    leagueTrade: "אפשר להחליף שחקן אחד מההרכב שלכם בשחקן אחר, מאותה עמדה, מתוך היסטוריית הקבוצה. בחרו שחקן להחלפה ואז בחרו את המחליף - או פשוט המשיכו הלאה בלי לבצע שינוי.",
    triviaSelect: "בחרו באיזה נושא תרצו להתמקד. בכל נושא יהיו 25 שאלות ובסוף תקבלו ציון.",
  };

  var lastScreen = null;

  function showScreen(name) {
    Object.keys(idMap).forEach(function (key) {
      var el = document.getElementById(idMap[key]);
      if (el) el.classList.toggle("active", key === name);
    });
    if (name !== lastScreen && SCREEN_INFO[name] && window.Effects) {
      window.Effects.showInfoToast(SCREEN_INFO[name]);
    }
    lastScreen = name;
  }

  window.AppNav = { showScreen: showScreen };

  document.getElementById("topbar-logo").addEventListener("click", function () {
    showScreen("home");
  });

  document.getElementById("btn-mode-single").addEventListener("click", function () {
    showScreen("start");
  });
  document.getElementById("btn-mode-h2h").addEventListener("click", function () {
    showScreen("h2hSetup");
  });
  document.getElementById("btn-mode-league").addEventListener("click", function () {
    window.LeagueGame.showTeamSelect();
  });
  document.getElementById("btn-mode-trivia").addEventListener("click", function () {
    showScreen("triviaSelect");
  });
  document.getElementById("btn-mode-badges").addEventListener("click", function () {
    renderBadgesScreen();
    showScreen("badges");
  });
  document.getElementById("btn-home-from-badges").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-open-profile").addEventListener("click", function () {
    window.ProfileScreen.open();
  });
  document.getElementById("btn-home-from-profile").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-open-settings").addEventListener("click", function () {
    window.SettingsScreen.open();
  });
  document.getElementById("btn-home-from-settings").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-footer-about").addEventListener("click", function () {
    showScreen("about");
  });
  document.getElementById("btn-home-from-about").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-mode-player-search").addEventListener("click", function () {
    window.PlayerProfile.open();
  });
  document.getElementById("btn-home-from-player-search").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-mode-career").addEventListener("click", function () {
    window.CareerGame.open();
  });
  document.getElementById("btn-home-from-career-home").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-career-create").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-career-hub").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-career-summary").addEventListener("click", function () {
    showScreen("home");
  });

  function renderBadgesScreen() {
    var all = window.Achievements.getAll();
    var unlockedCount = all.filter(function (b) {
      return b.unlocked;
    }).length;
    document.getElementById("badges-progress").textContent =
      "פתחתם " + unlockedCount + " מתוך " + all.length + " באנרים";

    var grid = document.getElementById("badges-grid");
    grid.innerHTML = "";
    all.forEach(function (b) {
      var card = document.createElement("div");
      card.className = "badge-card " + (b.unlocked ? "unlocked" : "locked");
      card.innerHTML =
        '<div class="badge-icon">' + (b.unlocked ? b.icon : "🔒") + "</div>" +
        '<div class="badge-title">' + b.title + "</div>" +
        '<div class="badge-desc">' + b.desc + "</div>";
      grid.appendChild(card);
    });
  }
  document.getElementById("btn-home-from-trivia-select").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-trivia-final").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-teamselect").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-lineup").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-system").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-trade").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-simchoice").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-live").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-table").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-league-playoffs").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-league-restart-2").addEventListener("click", function () {
    window.LeagueGame.showTeamSelect();
  });
  document.getElementById("btn-home-from-start").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-single-lineup").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-single-trade").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-single-leaderboard").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-final").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-h2hsetup").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-h2hresult").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-h2hgame").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-h2hsystem").addEventListener("click", function () {
    showScreen("home");
  });

  showScreen("home");
})();
