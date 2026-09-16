(function () {
  "use strict";

  var formatSeason = window.PlayerSearch.formatSeason;

  var filters = { position: "", eraMin: 0, eraMax: 9999, minRating: 0 };

  function hasActiveFilters() {
    return !!(filters.position || filters.eraMin || filters.eraMax < 9999 || filters.minRating);
  }

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
    if (trimmed.length < 2 && !hasActiveFilters()) {
      resultsEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon" aria-hidden="true">🔍</div>' +
          '<p class="empty-state-text">' + window.I18n.t("playerSearch.emptyText") + "</p>" +
          '<p class="empty-state-hint">' + window.I18n.t("playerSearch.emptyHint") + "</p>" +
        "</div>";
      return;
    }

    var matches = window.PlayerSearch.search(trimmed, {
      position: filters.position || null,
      eraMin: filters.eraMin,
      eraMax: filters.eraMax,
      minRating: filters.minRating,
    });
    if (matches.length === 0) {
      var noResultsText = trimmed.length >= 2
        ? window.I18n.t("playerSearch.noResultsNamed", { query: escapeHtml(trimmed) })
        : window.I18n.t("playerSearch.noResultsFiltered");
      resultsEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon" aria-hidden="true">🕵️</div>' +
          '<p class="empty-state-text">' + noResultsText + "</p>" +
          '<p class="empty-state-hint">' + window.I18n.t("playerSearch.noResultsHint") + "</p>" +
        "</div>";
      return;
    }

    matches.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.className = "player-search-result";
      btn.innerHTML =
        '<span class="name">' + entry.name + "</span>" +
        '<span class="meta">' + window.I18n.t("playerSearch.seasonsBestRating", { count: entry.seasonsCount, rating: (typeof entry.bestAppearance.rating === "number" ? entry.bestAppearance.rating : "-") }) + "</span>";
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
        "<span>" + a.team + " &middot; " + window.I18n.t("single.seasonLabel", { season: formatSeason(a.season) }) + "</span>" +
        "<span>" + (a.position || "-") + "</span>" +
        (typeof a.rating === "number" ? window.RatingTag.html(a.rating) : '<span class="rating-tag">-</span>') +
        (typeof a.offRating === "number" ? '<span class="off-tag">' + window.I18n.t("common.offAbbr") + " " + a.offRating + "</span>" : "") +
        (typeof a.defRating === "number" ? '<span class="def-tag">' + window.I18n.t("common.defAbbr") + " " + a.defRating + "</span>" : "") +
        (a.archetype ? '<span class="archetype-tag">' + window.RatingArchetypesAPI.label(a.archetype) + "</span>" : "") +
        "</div>"
      );
    }).join("");

    container.innerHTML =
      '<h2 class="player-profile-name">' + entry.name + "</h2>" +
      '<p class="player-profile-summary">' +
        window.I18n.t("playerSearch.summaryLine", {
          seasons: entry.seasonsCount,
          teams: entry.teamsCount,
          rating: (typeof entry.bestAppearance.rating === "number" ? entry.bestAppearance.rating : "-"),
        }) +
        " (" + entry.bestAppearance.team + " " + formatSeason(entry.bestAppearance.season) + ")" +
      "</p>" +
      '<div class="player-rating-chart">' + chartBars + "</div>" +
      '<div class="player-appearances-list">' + rows + "</div>" +
      '<button class="secondary" id="btn-player-profile-back">&raquo; ' + window.I18n.t("playerSearch.backToResults") + "</button>";

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

  function currentQuery() {
    return document.getElementById("player-search-input").value;
  }

  document.querySelectorAll("#player-search-position-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#player-search-position-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("player-search-position-buttons"));
      filters.position = btn.dataset.pos;
      renderResults(currentQuery());
    });
  });

  document.querySelectorAll("#player-search-era-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#player-search-era-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("player-search-era-buttons"));
      filters.eraMin = parseInt(btn.dataset.min, 10);
      filters.eraMax = parseInt(btn.dataset.max, 10);
      renderResults(currentQuery());
    });
  });

  document.querySelectorAll("#player-search-rating-buttons .era-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#player-search-rating-buttons .era-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      btn.classList.add("selected");
      window.UiSelect.sync(document.getElementById("player-search-rating-buttons"));
      filters.minRating = parseInt(btn.dataset.minRating, 10);
      renderResults(currentQuery());
    });
  });

  window.PlayerProfile = { open: openSearchScreen };
})();
