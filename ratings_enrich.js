(function () {
  "use strict";

  // Splits each player's single OVR rating into offense/defense sub-ratings and
  // assigns an archetype tag. There's no real scouting data behind this split yet -
  // every value is deterministically derived from the player's name/team/season via
  // a seeded hash, so it's stable across reloads but effectively "random for now"
  // until real per-attribute research replaces it.

  var ARCHETYPES = [
    { id: "sharpshooter", label: "יורה מטווח", desc: "בונוס קטן להתקפה", offBonus: 2, defBonus: 0 },
    { id: "anchor", label: "עוגן הגנתי", desc: "בונוס קטן להגנה", offBonus: 0, defBonus: 2 },
    { id: "playmaker", label: "פליימייקר", desc: "תורם קטן לשני הצדדים", offBonus: 1, defBonus: 1 },
    { id: "clutch", label: "קלאץ'", desc: "יציב תחת לחץ", offBonus: 0, defBonus: 0 },
    { id: "wildcard", label: "בלתי צפוי", desc: "יכול להפתיע לטובה ולרעה", offBonus: 0, defBonus: 0 },
    { id: "allaround", label: "כל-סביבי", desc: "משחק מאוזן", offBonus: 0, defBonus: 0 },
  ];

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

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function enrichPlayer(player, team, season) {
    if (typeof player.rating !== "number") {
      player.offRating = null;
      player.defRating = null;
      player.archetype = null;
      return;
    }
    var seed = hashString(player.name + "|" + team + "|" + season);
    var spread = 6 + seededRandom(seed) * 10; // 6-16 point gap between offense/defense
    var skew = (seededRandom(seed + 1) - 0.5) * 2 * spread;

    player.offRating = clamp(Math.round(player.rating + skew), 30, 99);
    player.defRating = clamp(Math.round(player.rating - skew), 30, 99);

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
})();
