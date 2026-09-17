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
    h2hAuction: "screen-h2h-auction",
    h2hAuctionSummary: "screen-h2h-auction-summary",
    h2hSystem: "screen-h2h-system",
    h2hGame: "screen-h2h-game",
    h2hResult: "screen-h2h-result",
    h2hShare: "screen-h2h-share",
    leagueTeamSelect: "screen-league-team-select",
    leagueDraft: "screen-league-draft",
    leagueLineup: "screen-league-lineup",
    leagueFreeAgent: "screen-league-freeagent",
    leagueSystem: "screen-league-system",
    leagueSimChoice: "screen-league-simchoice",
    leagueLive: "screen-league-live",
    leagueTrade: "screen-league-trade",
    leagueTable: "screen-league-table",
    leagueStats: "screen-league-stats",
    leaguePlayoffs: "screen-league-playoffs",
    triviaSelect: "screen-trivia-select",
    triviaQuestion: "screen-trivia-question",
    triviaFinal: "screen-trivia-final",
    badges: "screen-badges",
    shop: "screen-shop",
    profile: "screen-profile",
    settings: "screen-settings",
    about: "screen-about",
    playerSearch: "screen-player-search",
    careerHome: "screen-career-home",
    careerCreate: "screen-career-create",
    careerHub: "screen-career-hub",
    careerSummary: "screen-career-summary",
    coachHome: "screen-coach-home",
    coachCreate: "screen-coach-create",
    coachHub: "screen-coach-hub",
    coachRoster: "screen-coach-roster",
    coachTransfer: "screen-coach-transfer",
    coachSkills: "screen-coach-skills",
    coachSummary: "screen-coach-summary",
  };

  // Per-screen "how this works" explanations, shown as a dismissible toast
  // instead of a paragraph that permanently sits on the page. Fires once
  // each time a screen becomes active (not on repeated re-renders of the
  // same already-active screen), keyed by idMap key.
  var SCREEN_INFO = {
    careerHome: "screenInfo.careerHome",
    start: "screenInfo.start",
    singleLineup: "screenInfo.singleLineup",
    singleTrade: "screenInfo.singleTrade",
    singleLeaderboard: "screenInfo.singleLeaderboard",
    h2hSetup: "screenInfo.h2hSetup",
    h2hAuction: "screenInfo.h2hAuction",
    h2hSystem: "screenInfo.h2hSystem",
    leagueTeamSelect: "screenInfo.leagueTeamSelect",
    leagueLineup: "screenInfo.leagueLineup",
    leagueSystem: "screenInfo.leagueSystem",
    leagueSimChoice: "screenInfo.leagueSimChoice",
    leagueTrade: "screenInfo.leagueTrade",
    triviaSelect: "screenInfo.triviaSelect",
    coachHome: "screenInfo.coachHome",
    coachRoster: "screenInfo.coachRoster",
    coachTransfer: "screenInfo.coachTransfer",
    coachSkills: "screenInfo.coachSkills",
  };

  var lastScreen = null;

  function showScreen(name) {
    if (name === "home" && window.TeamBadge) window.TeamBadge.clearAccent();
    if (window.Shop) window.Shop.refreshTopbarDisplay();
    if (name === "start" && window.Shop) {
      var legendsSection = document.getElementById("legends-mode-section");
      if (legendsSection) legendsSection.hidden = !window.Shop.isOwned("legendsDraft");
    }
    Object.keys(idMap).forEach(function (key) {
      var el = document.getElementById(idMap[key]);
      if (el) el.classList.toggle("active", key === name);
    });
    if (name !== lastScreen && window.Effects) {
      window.Effects.wipeTransition();
      if (SCREEN_INFO[name]) window.Effects.showInfoToast(window.I18n.t(SCREEN_INFO[name]));
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
  document.getElementById("btn-mode-coach").addEventListener("click", function () {
    window.CoachCareerGame.open();
  });
  document.getElementById("btn-home-from-coach-home").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-create").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-hub").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-roster").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-transfer").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-skills").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-coach-summary").addEventListener("click", function () {
    showScreen("home");
  });

  function renderBadgesScreen() {
    var all = window.Achievements.getAll();
    var unlockedCount = all.filter(function (b) {
      return b.unlocked;
    }).length;
    document.getElementById("badges-progress").textContent =
      window.I18n.t("badges.progress", { count: unlockedCount, total: all.length });

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
  document.getElementById("btn-home-from-league-freeagent").addEventListener("click", function () {
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
  document.getElementById("btn-home-from-h2hauction").addEventListener("click", function () {
    showScreen("home");
  });
  document.getElementById("btn-home-from-h2hauctionsummary").addEventListener("click", function () {
    showScreen("home");
  });

  showScreen("home");
})();
