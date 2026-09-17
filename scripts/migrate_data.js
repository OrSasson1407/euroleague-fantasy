"use strict";
// One-off migration that added offRating/defRating/height/age placeholder
// fields to every player record in euroleague_data.js (rating/position were
// already real researched data; the new fields are dummy values "for now",
// per the same to-be-replaced-with-real-data convention). Kept here for
// reference in case the dataset needs to be regenerated or extended the
// same way - re-running it will re-roll all placeholder fields.
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

const HEIGHT_RANGE = {
  Guard: [1.83, 1.98],
  Forward: [1.96, 2.08],
  Center: [2.03, 2.18],
};
const HEIGHT_FALLBACK = [1.9, 2.05];

function randomHeight(position) {
  const range = HEIGHT_RANGE[position] || HEIGHT_FALLBACK;
  const h = range[0] + Math.random() * (range[1] - range[0]);
  return Math.round(h * 100) / 100;
}

// Simple triangular-ish distribution centered around 25-26 (typical pro
// basketball prime), spanning roughly 18-39 - not modeling anything real,
// just a plausible-looking placeholder spread until real per-player ages
// replace it.
function randomAge() {
  const t = (Math.random() + Math.random() + Math.random()) / 3;
  return Math.round(18 + t * 21);
}

function randomOffDefSplit(rating) {
  const spread = 6 + Math.random() * 10; // 6-16 point gap between offense/defense
  const skew = (Math.random() - 0.5) * 2 * spread;
  return {
    offRating: clamp(Math.round(rating + skew), 30, 99),
    defRating: clamp(Math.round(rating - skew), 30, 99),
  };
}

let playerCount = 0;
data.forEach((combo) => {
  combo.players.forEach((p) => {
    const split = randomOffDefSplit(p.rating);
    p.offRating = split.offRating;
    p.defRating = split.defRating;
    p.height = randomHeight(p.position);
    p.age = randomAge();
    playerCount++;
  });
});

const header =
  "// EUROLEAGUE_DATA: array of { team, season, players[] }\n" +
  '// season format: "YYYY-YY" (e.g. "2013-14" = 2013/2014 season)\n' +
  '// players[]: array of { name, position, rating, offRating, defRating, height, age } -\n' +
  '//   position is "Guard"/"Forward"/"Center" or null; rating is a season-specific 0-99\n' +
  "//   simulation OVR (researched); offRating/defRating/height(meters)/age are placeholder\n" +
  "//   values for now, not researched per player - filled in by scripts/migrate_data.js,\n" +
  "//   to be replaced with real data later.\n" +
  "// Researched from Wikipedia / RealGM / EuroLeague archives.\n";

const output = header + "window.EUROLEAGUE_DATA = " + JSON.stringify(data, null, 2) + ";\n";
fs.writeFileSync(filePath, output, "utf8");

console.log("Migrated " + playerCount + " players across " + data.length + " team-season combos.");
