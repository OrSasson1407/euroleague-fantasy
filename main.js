(function () {
  "use strict";

  var idMap = {
    home: "screen-home",
    start: "screen-start",
    round: "screen-round",
    singleLineup: "screen-single-lineup",
    final: "screen-final",
    singleShare: "screen-single-share",
    singleExhibition: "screen-single-exhibition",
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
    playerSearch: "screen-player-search",
    careerHome: "screen-career-home",
    careerCreate: "screen-career-create",
    careerHub: "screen-career-hub",
    careerSummary: "screen-career-summary",
  };

  function showScreen(name) {
    Object.keys(idMap).forEach(function (key) {
      var el = document.getElementById(idMap[key]);
      if (el) el.classList.toggle("active", key === name);
    });
  }

  window.AppNav = { showScreen: showScreen };

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
