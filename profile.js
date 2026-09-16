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
      "<p>הפרופיל האישי זמין רק למשתמשים רשומים.</p>" +
      "<p>במצב אורח אין שיאים ונתונים שמורים להציג כאן.</p>" +
      '<button id="btn-profile-register-cta" style="margin-top:10px;">הרשמה עכשיו</button>' +
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
      "<br>🏅 " + unlockedCount + " מתוך " + all.length + " באנרים נפתחו" +
      "</div>";

    html += '<div class="profile-stats-grid">';

    html += statCardHtml(
      "🏀 בניית סגל",
      topSquads.length
        ? "שיא: <strong>" + topSquads[0].rating.toFixed(1) + "</strong> &middot; " + topSquads.length + " הרכבים שמורים"
        : "עדיין לא נשמר הרכב"
    );

    html += statCardHtml(
      "⚔️ 1 על 1",
      h2hSeries > 0 ? h2hSeries + " סדרות שוחקו" : "עדיין לא שוחק"
    );

    html += statCardHtml(
      "🏆 ליגה",
      leagueSeasons > 0 ? leagueSeasons + " עונות הושלמו" : "עדיין לא שוחק"
    );

    html += statCardHtml(
      "🧠 טריוויה",
      (triviaTeamBest || triviaSeasonBest)
        ? "קבוצות: " + triviaTeamBest + "/25 &middot; עונות: " + triviaSeasonBest + "/25"
        : "עדיין לא שוחק"
    );

    var careerLine;
    if (hasCareerInProgress) {
      careerLine = "קריירה בתהליך כרגע";
    } else if (careerRuns > 0) {
      careerLine = careerRuns + " קריירות הושלמו";
      if (lastCareer) {
        careerLine += " &middot; אחרונה: " + escapeHtml(lastCareer.name || "") +
          (typeof lastCareer.peakRating === "number" ? " (שיא " + lastCareer.peakRating + ")" : "");
      }
    } else {
      careerLine = "עדיין לא שוחק";
    }
    html += statCardHtml("🎽 קריירה", careerLine);

    html += "</div>";

    var history = window.GameHistory.getAll();
    if (history.length) {
      html += "<h3>היסטוריית משחקים</h3>";
      html += history.slice(0, 15).map(function (h) {
        var dateLabel = new Date(h.date).toLocaleDateString("he-IL");
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
