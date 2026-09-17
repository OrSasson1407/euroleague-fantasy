"use strict";
// Adds jerseyNumber plus 23 granular skill attributes to every player record
// in euroleague_data.js, on top of the name/position/rating/offRating/
// defRating/height/age fields scripts/migrate_data.js already added. All
// placeholder/dummy values "for now" - each attribute is derived from the
// player's existing rating/offRating/defRating/position/age with a position
// bias and a random spread, so the numbers are plausible rather than pure
// noise, but none of this is researched per player yet.
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "euroleague_data.js");

const raw = fs.readFileSync(filePath, "utf8");
const marker = "window.EUROLEAGUE_DATA = ";
const markerIdx = raw.indexOf(marker);
if (markerIdx === -1) throw new Error("Could not find 'window.EUROLEAGUE_DATA = ' marker");
const start = markerIdx + marker.length;
const end = raw.lastIndexOf("]") + 1;
const data = JSON.parse(raw.slice(start, end));

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function posBias(position, guardVal, forwardVal, centerVal, fallback) {
  if (position === "Guard") return guardVal;
  if (position === "Forward") return forwardVal;
  if (position === "Center") return centerVal;
  return typeof fallback === "number" ? fallback : (guardVal + forwardVal + centerVal) / 3;
}

// base + position bias + random spread, clamped to the same 30-99 scale as
// rating/offRating/defRating.
function skill(base, bias, spread) {
  return clamp(Math.round(base + bias + (Math.random() - 0.5) * 2 * spread), 30, 99);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

let playerCount = 0;
data.forEach((combo) => {
  const jerseyPool = shuffle(Array.from({ length: 100 }, (_, i) => i));
  combo.players.forEach((p, idx) => {
    p.jerseyNumber = jerseyPool[idx % jerseyPool.length];

    const off = p.offRating, def = p.defRating, ovr = p.rating;
    const ageFactor = clamp((28 - p.age) * 0.8, -10, 8); // younger skews athletic attributes up, older skews down

    // Scoring
    p.insideScoring = skill(off, posBias(p.position, -6, 2, 8), 8);
    p.midRange = skill(off, posBias(p.position, 4, 2, -6), 8);
    p.threePoint = skill(off, posBias(p.position, 8, 0, -14, -2), 9);
    p.freeThrow = skill(off, posBias(p.position, 4, 0, -4, 0), 9);
    p.dunk = skill(ovr, posBias(p.position, -8, 4, 10, 0) + ageFactor * 0.5, 9);
    p.layup = skill(off, posBias(p.position, 4, 0, -2, 0), 8);
    p.postScoring = skill(off, posBias(p.position, -14, 2, 12, -4), 9);

    // Playmaking
    p.passing = skill(off, posBias(p.position, 8, 0, -8, 0), 8);
    p.ballHandling = skill(off, posBias(p.position, 10, -2, -14, 0), 8);
    p.courtVision = skill(off, posBias(p.position, 8, 0, -6, 0), 8);
    p.decisionMaking = skill(ovr, clamp((p.age - 24) * 0.4, -4, 6), 8);
    p.pickAndRoll = skill(ovr, posBias(p.position, 4, 2, 4, 0), 8);
    p.offBallMovement = skill(off, posBias(p.position, 2, 4, -2, 0), 8);
    p.screening = skill(ovr, posBias(p.position, -8, 4, 10, 0), 8);

    // Rebounding
    p.offensiveRebounding = skill(ovr, posBias(p.position, -10, 4, 14, -2), 9);
    p.defensiveRebounding = skill(def, posBias(p.position, -10, 4, 14, -2), 9);

    // Defense
    p.perimeterDefense = skill(def, posBias(p.position, 6, 0, -8, 0), 8);
    p.interiorDefense = skill(def, posBias(p.position, -10, 2, 10, 0), 8);

    // Athleticism
    p.speed = skill(70, posBias(p.position, 10, 0, -14, 0) + ageFactor, 9);
    p.acceleration = skill(70, posBias(p.position, 9, 0, -12, 0) + ageFactor, 9);
    p.agility = skill(70, posBias(p.position, 8, 0, -10, 0) + ageFactor, 9);
    p.strength = skill(65, posBias(p.position, -10, 4, 12, 0), 9);
    p.vertical = skill(65, posBias(p.position, 2, 8, 6, 0) + ageFactor, 9);
    p.stamina = skill(70, clamp((26 - p.age) * 0.6, -8, 6), 9);

    playerCount++;
  });
});

const header =
  "// EUROLEAGUE_DATA: array of { team, season, players[] }\n" +
  '// season format: "YYYY-YY" (e.g. "2013-14" = 2013/2014 season)\n' +
  '// players[]: array of {\n' +
  '//   name, position ("Guard"/"Forward"/"Center" or null), rating (season-specific\n' +
  '//   0-99 simulation OVR, researched),\n' +
  '//   jerseyNumber, offRating, defRating, height (meters), age,\n' +
  '//   insideScoring, midRange, threePoint, freeThrow, dunk, layup, postScoring,\n' +
  '//   passing, ballHandling, courtVision, decisionMaking, pickAndRoll,\n' +
  '//   offBallMovement, screening, offensiveRebounding, defensiveRebounding,\n' +
  '//   perimeterDefense, interiorDefense, speed, acceleration, agility,\n' +
  '//   strength, vertical, stamina\n' +
  "// } - everything past name/position/rating is a placeholder value for now, not\n" +
  "// researched per player (see scripts/migrate_data.js and\n" +
  "// scripts/add_player_attributes.js), to be replaced with real data later.\n" +
  "// Researched from Wikipedia / RealGM / EuroLeague archives.\n";

const output = header + "window.EUROLEAGUE_DATA = " + JSON.stringify(data, null, 2) + ";\n";
fs.writeFileSync(filePath, output, "utf8");

console.log("Added attributes to " + playerCount + " players across " + data.length + " team-season combos.");
