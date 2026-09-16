(function () {
  "use strict";

  // A personal log of past series/leagues, shown on the profile screen.
  // Same guest/registered gating as achievements - nothing persists in
  // guest mode, matching every other personal record in the app.
  var STORAGE_KEY = "euroleague_game_history_v1";
  var MAX_ENTRIES = 30;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore storage failures
    }
  }

  function record(entry) {
    if (window.Auth && !window.Auth.canSave()) return; // guest mode - nothing persists
    var list = load();
    list.unshift({
      mode: entry.mode,
      icon: entry.icon,
      title: entry.title,
      detail: entry.detail,
      outcome: entry.outcome, // "win" | "loss" | "neutral"
      date: new Date().toISOString(),
    });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    save(list);
  }

  function getAll() {
    return load();
  }

  window.GameHistory = { record: record, getAll: getAll };
})();
