(function () {
  "use strict";

  // Assigns each player an archetype tag, biased by their offense/defense split
  // (now baked into euroleague_data.js itself, see migrate_data.js) - a bigger
  // offense-leaning gap nudges toward "sharpshooter", a bigger defense-leaning
  // gap nudges toward "anchor". The archetype pick itself is deterministically
  // derived from the player's name/team/season via a seeded hash, so it's
  // stable across reloads.

  // label/desc are resolved through window.I18n.t() (see RatingArchetypesAPI
  // below) rather than stored here, so every caller that displays an
  // archetype automatically follows the current language.
  var ARCHETYPES = [
    { id: "sharpshooter", offBonus: 2, defBonus: 0 },
    { id: "anchor", offBonus: 0, defBonus: 2 },
    { id: "playmaker", offBonus: 1, defBonus: 1 },
    { id: "clutch", offBonus: 0, defBonus: 0 },
    { id: "wildcard", offBonus: 0, defBonus: 0 },
    { id: "allaround", offBonus: 0, defBonus: 0 },
  ];

  function archetypeLabel(a) {
    return a ? window.I18n.t("archetypes." + a.id + ".label") : "";
  }

  function archetypeDesc(a) {
    return a ? window.I18n.t("archetypes." + a.id + ".desc") : "";
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    var t = (seed + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function enrichPlayer(player, team, season) {
    if (typeof player.rating !== "number") {
      player.archetype = null;
      return;
    }
    var seed = hashString(player.name + "|" + team + "|" + season);
    var skew = (typeof player.offRating === "number" && typeof player.defRating === "number")
      ? player.offRating - player.defRating
      : 0;

    var archIdx = Math.floor(seededRandom(seed + 2) * ARCHETYPES.length);
    if (skew >= 6 && seededRandom(seed + 3) < 0.6) archIdx = 0; // lean into sharpshooter
    else if (skew <= -6 && seededRandom(seed + 3) < 0.6) archIdx = 1; // lean into anchor
    player.archetype = ARCHETYPES[archIdx];
  }

  (window.EUROLEAGUE_DATA || []).forEach(function (combo) {
    combo.players.forEach(function (p) {
      enrichPlayer(p, combo.team, combo.season);
    });
  });

  window.RatingArchetypes = ARCHETYPES;
  window.RatingArchetypesAPI = { label: archetypeLabel, desc: archetypeDesc };
})();
