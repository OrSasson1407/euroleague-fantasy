(function () {
  "use strict";

  // Shared index over EUROLEAGUE_DATA, grouping every player record by
  // normalized name (same convention used for draft dedup everywhere else)
  // so a real player's appearances across different team-seasons can be
  // looked up together for the player-profile screen.

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function formatSeason(season) {
    return season.replace("-", "/");
  }

  var INDEX = null;

  function buildIndex() {
    var map = {};
    (window.EUROLEAGUE_DATA || []).forEach(function (combo) {
      combo.players.forEach(function (p) {
        var key = normalizeName(p.name);
        if (!map[key]) {
          map[key] = { name: p.name, appearances: [] };
        }
        map[key].appearances.push({
          team: combo.team,
          season: combo.season,
          position: p.position,
          rating: p.rating,
          offRating: p.offRating,
          defRating: p.defRating,
          archetype: p.archetype,
        });
      });
    });

    var list = Object.keys(map).map(function (k) {
      return map[k];
    });

    list.forEach(function (entry) {
      entry.appearances.sort(function (a, b) {
        return parseInt(a.season, 10) - parseInt(b.season, 10);
      });
      entry.seasonsCount = entry.appearances.length;
      var teams = {};
      entry.appearances.forEach(function (a) {
        teams[a.team] = true;
      });
      entry.teamsCount = Object.keys(teams).length;

      var best = entry.appearances[0];
      entry.appearances.forEach(function (a) {
        var bestRating = typeof best.rating === "number" ? best.rating : -1;
        var aRating = typeof a.rating === "number" ? a.rating : -1;
        if (aRating > bestRating) best = a;
      });
      entry.bestAppearance = best;
    });

    return list;
  }

  function getIndex() {
    if (!INDEX) INDEX = buildIndex();
    return INDEX;
  }

  // filters (all optional): { position: "Guard"|"Forward"|"Center", eraMin,
  // eraMax, minRating }. A player matches if AT LEAST ONE of their seasons
  // satisfies every active filter - "show me players who were ever a 90+
  // Center in the 2000s", not "were that in every season".
  function matchesFilters(entry, filters) {
    if (!filters) return true;
    return entry.appearances.some(function (a) {
      if (filters.position && a.position !== filters.position) return false;
      var year = parseInt(a.season, 10);
      if (filters.eraMin && year < filters.eraMin) return false;
      if (filters.eraMax && year > filters.eraMax) return false;
      if (filters.minRating && (typeof a.rating !== "number" || a.rating < filters.minRating)) return false;
      return true;
    });
  }

  function hasActiveFilters(filters) {
    return !!(filters && (filters.position || filters.eraMin || (filters.eraMax && filters.eraMax < 9999) || filters.minRating));
  }

  function search(query, filters) {
    var q = normalizeName(query || "");
    if (q.length < 2 && !hasActiveFilters(filters)) return [];
    return getIndex()
      .filter(function (e) {
        if (q.length >= 2 && normalizeName(e.name).indexOf(q) === -1) return false;
        return matchesFilters(e, filters);
      })
      .sort(function (a, b) {
        var ar = typeof a.bestAppearance.rating === "number" ? a.bestAppearance.rating : 0;
        var br = typeof b.bestAppearance.rating === "number" ? b.bestAppearance.rating : 0;
        return br - ar;
      })
      .slice(0, 30);
  }

  window.PlayerSearch = {
    search: search,
    getIndex: getIndex,
    normalizeName: normalizeName,
    formatSeason: formatSeason,
  };
})();
