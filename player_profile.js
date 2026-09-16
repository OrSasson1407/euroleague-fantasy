(function () {
  "use strict";

  var formatSeason = window.PlayerSearch.formatSeason;

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderResults(query) {
    var resultsEl = document.getElementById("player-search-results");
    document.getElementById("player-profile").hidden = true;
    resultsEl.hidden = false;
    resultsEl.innerHTML = "";

    var trimmed = (query || "").trim();
    if (trimmed.length < 2) {
      resultsEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon" aria-hidden="true">🔍</div>' +
          '<p class="empty-state-text">חפשו שחקן מהיסטוריית היורוליג</p>' +
          '<p class="empty-state-hint">הקלידו לפחות 2 תווים, למשל שם פרטי או משפחה</p>' +
        "</div>";
      return;
    }

    var matches = window.PlayerSearch.search(trimmed);
    if (matches.length === 0) {
      resultsEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon" aria-hidden="true">🕵️</div>' +
          '<p class="empty-state-text">לא נמצאו שחקנים בשם "' + escapeHtml(trimmed) + '"</p>' +
          '<p class="empty-state-hint">נסו לבדוק את האיות, או לחפש רק שם פרטי / משפחה</p>' +
        "</div>";
      return;
    }

    matches.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.className = "player-search-result";
      btn.innerHTML =
        '<span class="name">' + entry.name + "</span>" +
        '<span class="meta">' + entry.seasonsCount + " עונות מתועדות &middot; שיא דירוג " +
          (typeof entry.bestAppearance.rating === "number" ? entry.bestAppearance.rating : "-") + "</span>";
      btn.addEventListener("click", function () {
        renderProfile(entry);
      });
      resultsEl.appendChild(btn);
    });
  }

  function renderProfile(entry) {
    var resultsEl = document.getElementById("player-search-results");
    var container = document.getElementById("player-profile");
    resultsEl.hidden = true;
    container.hidden = false;

    var chartBars = entry.appearances.map(function (a) {
      var r = typeof a.rating === "number" ? a.rating : 0;
      var heightPct = Math.max(8, Math.round(((r - 30) / (99 - 30)) * 100));
      var isPeak = a === entry.bestAppearance;
      var yearShort = a.season.slice(2, 4);
      return (
        '<div class="chart-bar-wrap" title="' + a.team + " " + formatSeason(a.season) + " - " + r + '">' +
        '<div class="chart-bar' + (isPeak ? " peak" : "") + '" style="height:' + heightPct + '%"></div>' +
        '<div class="chart-bar-label">' + yearShort + "</div>" +
        "</div>"
      );
    }).join("");

    var rows = entry.appearances.slice().reverse().map(function (a) {
      return (
        '<div class="player-appearance-row' + (a === entry.bestAppearance ? " peak" : "") + '">' +
        "<span>" + a.team + " &middot; עונת " + formatSeason(a.season) + "</span>" +
        "<span>" + (a.position || "-") + "</span>" +
        (typeof a.rating === "number" ? window.RatingTag.html(a.rating) : '<span class="rating-tag">-</span>') +
        (typeof a.offRating === "number" ? '<span class="off-tag">התק׳ ' + a.offRating + "</span>" : "") +
        (typeof a.defRating === "number" ? '<span class="def-tag">הג׳ ' + a.defRating + "</span>" : "") +
        (a.archetype ? '<span class="archetype-tag">' + a.archetype.label + "</span>" : "") +
        "</div>"
      );
    }).join("");

    container.innerHTML =
      '<h2 class="player-profile-name">' + entry.name + "</h2>" +
      '<p class="player-profile-summary">' +
        entry.seasonsCount + " עונות מתועדות &middot; " + entry.teamsCount + " קבוצות שונות &middot; שיא: " +
        '<strong>' + (typeof entry.bestAppearance.rating === "number" ? entry.bestAppearance.rating : "-") + "</strong>" +
        " (" + entry.bestAppearance.team + " " + formatSeason(entry.bestAppearance.season) + ")" +
      "</p>" +
      '<div class="player-rating-chart">' + chartBars + "</div>" +
      '<div class="player-appearances-list">' + rows + "</div>" +
      '<button class="secondary" id="btn-player-profile-back">&raquo; חזרה לתוצאות</button>';

    document.getElementById("btn-player-profile-back").addEventListener("click", function () {
      container.hidden = true;
      resultsEl.hidden = false;
    });
  }

  function openSearchScreen() {
    var input = document.getElementById("player-search-input");
    input.value = "";
    document.getElementById("player-profile").hidden = true;
    renderResults("");
    window.AppNav.showScreen("playerSearch");
    input.focus();
  }

  document.getElementById("player-search-input").addEventListener("input", function (e) {
    renderResults(e.target.value);
  });

  window.PlayerProfile = { open: openSearchScreen };
})();
