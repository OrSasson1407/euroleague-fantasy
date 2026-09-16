(function () {
  "use strict";

  // A "play system" is a coaching philosophy the user assigns to their team.
  // Players whose archetype fits the system get an offense/defense bonus;
  // players who don't fit take a small penalty (10% of the matching bonus).
  var FIT_PENALTY_RATIO = 0.10;

  // label/desc are resolved through window.I18n.t() at render time (see
  // label()/desc() below) rather than stored here, so every caller that
  // displays a system automatically follows the current language.
  var SYSTEMS = [
    {
      id: "fastbreak",
      fitArchetypes: ["sharpshooter", "playmaker"],
      offBonus: 5,
      defBonus: 0,
      varianceMultiplier: 1.4,
    },
    {
      id: "lockdown",
      fitArchetypes: ["anchor", "clutch"],
      offBonus: 0,
      defBonus: 5,
      varianceMultiplier: 0.7,
    },
    {
      id: "balanced",
      fitArchetypes: ["allaround", "playmaker"],
      offBonus: 2,
      defBonus: 2,
      varianceMultiplier: 1.0,
    },
    {
      id: "starcentric",
      fitArchetypes: [],
      offBonus: 6,
      defBonus: 6,
      varianceMultiplier: 1.15,
      starMode: true,
    },
    {
      id: "clutch",
      fitArchetypes: ["clutch"],
      offBonus: 4,
      defBonus: 4,
      varianceMultiplier: 0.85,
    },
  ];

  function label(sys) {
    return sys ? window.I18n.t("systems." + sys.id + ".label") : window.I18n.t("systems.none.label");
  }

  function desc(sys) {
    return sys ? window.I18n.t("systems." + sys.id + ".desc") : window.I18n.t("systems.none.desc");
  }

  function findStarPlayer(players) {
    if (!players || players.length === 0) return null;
    var best = players[0];
    players.forEach(function (p) {
      var bestRating = typeof best.rating === "number" ? best.rating : 0;
      var pRating = typeof p.rating === "number" ? p.rating : 0;
      if (pRating > bestRating) best = p;
    });
    return best;
  }

  function fits(player, system, starPlayer) {
    if (!system) return false;
    if (system.starMode) return player === starPlayer;
    return !!(player.archetype && system.fitArchetypes.indexOf(player.archetype.id) !== -1);
  }

  // Returns { off, def } - the bonus (or small penalty) this player gets under
  // the given system. starPlayer only matters for star-centric systems.
  function fitBonus(player, system, starPlayer) {
    if (!system) return { off: 0, def: 0 };
    if (fits(player, system, starPlayer)) {
      return { off: system.offBonus, def: system.defBonus };
    }
    return { off: -system.offBonus * FIT_PENALTY_RATIO, def: -system.defBonus * FIT_PENALTY_RATIO };
  }

  window.PlaySystems = SYSTEMS;
  window.PlaySystemsAPI = { findStarPlayer: findStarPlayer, fits: fits, fitBonus: fitBonus, label: label, desc: desc };
})();
