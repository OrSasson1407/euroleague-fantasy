(function () {
  "use strict";

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function statCardHtml(title, line) {
    return (
      '<div class="profile-stat-card">' +
      '<div class="profile-stat-title">' + title + "</div>" +
      '<div class="profile-stat-line">' + line + "</div>" +
      "</div>"
    );
  }

  function renderGuestView(container) {
    container.innerHTML =
      '<div class="career-event-card" style="text-align:center;">' +
      "<p>" + window.I18n.t("profile.guestMessage1") + "</p>" +
      "<p>" + window.I18n.t("profile.guestMessage2") + "</p>" +
      '<button id="btn-profile-register-cta" style="margin-top:10px;">' + window.I18n.t("profile.registerCta") + "</button>" +
      "</div>";
    var btn = document.getElementById("btn-profile-register-cta");
    if (btn) {
      btn.addEventListener("click", function () {
        window.Auth.showGate();
      });
    }
  }

  function renderRegisteredView(container) {
    var username = window.Auth.getUsername();
    var all = window.Achievements.getAll();
    var unlockedCount = all.filter(function (b) { return b.unlocked; }).length;

    var topSquads = readJson("single_top_squads_v1") || [];
    var lastCareer = readJson("career_last_v1");
    var hasCareerInProgress = !!localStorage.getItem("career_save_v1");

    var leagueSeasons = window.Achievements.getCounter("league_seasons_completed");
    var h2hSeries = window.Achievements.getCounter("h2h_series_played");
    var careerRuns = window.Achievements.getCounter("career_runs_completed");
    var triviaTeamBest = window.Achievements.getBest("trivia_best_team");
    var triviaSeasonBest = window.Achievements.getBest("trivia_best_season");

    var html = "";
    html +=
      '<div class="career-last-summary">' +
      "👤 <strong>" + escapeHtml(username) + "</strong>" +
      "<br>" + window.I18n.t("profile.badgesSummary", { count: unlockedCount, total: all.length }) +
      "</div>";

    html += '<div class="profile-stats-grid">';

    html += statCardHtml(
      window.I18n.t("profile.statSingleTitle"),
      topSquads.length
        ? window.I18n.t("profile.statSingleBest", { rating: topSquads[0].rating.toFixed(1), count: topSquads.length })
        : window.I18n.t("profile.statNeverPlayed")
    );

    html += statCardHtml(
      window.I18n.t("profile.statH2hTitle"),
      h2hSeries > 0 ? window.I18n.t("profile.statH2hPlayed", { count: h2hSeries }) : window.I18n.t("profile.statNeverPlayed")
    );

    html += statCardHtml(
      window.I18n.t("profile.statLeagueTitle"),
      leagueSeasons > 0 ? window.I18n.t("profile.statLeagueSeasons", { count: leagueSeasons }) : window.I18n.t("profile.statNeverPlayed")
    );

    html += statCardHtml(
      window.I18n.t("profile.statTriviaTitle"),
      (triviaTeamBest || triviaSeasonBest)
        ? window.I18n.t("profile.statTriviaBest", { team: triviaTeamBest, season: triviaSeasonBest })
        : window.I18n.t("profile.statNeverPlayed")
    );

    var careerLine;
    if (hasCareerInProgress) {
      careerLine = window.I18n.t("profile.careerInProgress");
    } else if (careerRuns > 0) {
      careerLine = window.I18n.t("profile.careerCompletedCount", { count: careerRuns });
      if (lastCareer) {
        careerLine += " &middot; " + window.I18n.t("profile.careerLastLabel", { name: escapeHtml(lastCareer.name || "") }) +
          (typeof lastCareer.peakRating === "number" ? window.I18n.t("profile.careerPeakSuffix", { peak: lastCareer.peakRating }) : "");
      }
    } else {
      careerLine = window.I18n.t("profile.statNeverPlayed");
    }
    html += statCardHtml(window.I18n.t("profile.statCareerTitle"), careerLine);

    html += "</div>";

    var history = window.GameHistory.getAll();
    if (history.length) {
      html += "<h3>" + window.I18n.t("profile.historyTitle") + "</h3>";
      html += history.slice(0, 15).map(function (h) {
        var dateLabel = new Date(h.date).toLocaleDateString(window.I18n.getLang() === "en" ? "en-US" : "he-IL");
        return (
          '<div class="history-row ' + (h.outcome || "") + '">' +
            '<span class="history-row-icon" aria-hidden="true">' + h.icon + "</span>" +
            '<span class="history-row-body">' +
              '<span class="history-row-title">' + escapeHtml(h.title) + "</span>" +
              '<span class="history-row-detail">' + escapeHtml(h.detail) + "</span>" +
            "</span>" +
            '<span class="history-row-date">' + dateLabel + "</span>" +
          "</div>"
        );
      }).join("");
    }

    container.innerHTML = html;
  }

  function renderProfileScreen() {
    var container = document.getElementById("profile-content");
    if (!window.Auth || !window.Auth.isRegistered()) {
      renderGuestView(container);
    } else {
      renderRegisteredView(container);
    }
  }

  function open() {
    renderProfileScreen();
    window.AppNav.showScreen("profile");
  }

  window.ProfileScreen = { open: open };
})();
