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
      skillFocus: ["threePoint", "speed"],
      skillWeight: { off: 1.5, def: 0 },
    },
    {
      id: "lockdown",
      fitArchetypes: ["anchor", "clutch"],
      offBonus: 0,
      defBonus: 5,
      varianceMultiplier: 0.7,
      skillFocus: ["perimeterDefense", "interiorDefense"],
      skillWeight: { off: 0, def: 1.5 },
    },
    {
      id: "balanced",
      fitArchetypes: ["allaround", "playmaker"],
      offBonus: 2,
      defBonus: 2,
      varianceMultiplier: 1.0,
      skillFocus: ["passing", "courtVision"],
      skillWeight: { off: 0.8, def: 0.8 },
    },
    {
      id: "starcentric",
      fitArchetypes: [],
      offBonus: 6,
      defBonus: 6,
      varianceMultiplier: 1.15,
      starMode: true,
      skillFocus: ["insideScoring", "midRange"],
      skillWeight: { off: 1.5, def: 0 },
    },
    {
      id: "clutch",
      fitArchetypes: ["clutch"],
      offBonus: 4,
      defBonus: 4,
      varianceMultiplier: 0.85,
      skillFocus: ["decisionMaking", "freeThrow"],
      skillWeight: { off: 1, def: 1 },
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

  // A small additional bonus/penalty on top of the archetype-based one,
  // scaled by how far above/below a 65 baseline the player's average of the
  // system's focus skill attributes sits - e.g. a Fast Break system further
  // rewards a genuinely fast, three-point-shooting player, not just anyone
  // tagged "sharpshooter". Capped at +/-2 per attribute average, so the
  // total swing (up to skillWeight.off/def each) stays modest next to the
  // archetype bonus (already +/-2 to +/-6).
  function skillFitBonus(player, system) {
    if (!system || !system.skillFocus) return { off: 0, def: 0 };
    var sum = 0, n = 0;
    system.skillFocus.forEach(function (attr) {
      if (typeof player[attr] === "number") { sum += player[attr]; n++; }
    });
    if (!n) return { off: 0, def: 0 };
    var delta = Math.max(-2, Math.min(2, (sum / n - 65) / 10));
    return { off: delta * system.skillWeight.off, def: delta * system.skillWeight.def };
  }

  // Returns { off, def } - the bonus (or small penalty) this player gets under
  // the given system. starPlayer only matters for star-centric systems.
  function fitBonus(player, system, starPlayer) {
    if (!system) return { off: 0, def: 0 };
    var archetypeBonus = fits(player, system, starPlayer)
      ? { off: system.offBonus, def: system.defBonus }
      : { off: -system.offBonus * FIT_PENALTY_RATIO, def: -system.defBonus * FIT_PENALTY_RATIO };
    var skillBonus = skillFitBonus(player, system);
    return { off: archetypeBonus.off + skillBonus.off, def: archetypeBonus.def + skillBonus.def };
  }

  window.PlaySystems = SYSTEMS;
  window.PlaySystemsAPI = { findStarPlayer: findStarPlayer, fits: fits, fitBonus: fitBonus, label: label, desc: desc };
})();
