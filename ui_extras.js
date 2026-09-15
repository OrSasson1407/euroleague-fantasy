(function () {
  "use strict";

  // ---------- Generic team badges ----------
  // No real club logos are used - just a deterministic colored emblem with
  // the club's initials, so every team name gets a consistent visual "crest"
  // without needing any external image assets.
  var BADGE_COLORS = [
    "#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#8338ec",
    "#3a86ff", "#fb5607", "#06d6a0", "#ff006e", "#ffbe0b",
    "#588157", "#e56b6f",
  ];

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function teamInitials(name) {
    var cleaned = (name || "").trim();
    if (!cleaned) return "?";
    var parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function teamColor(name) {
    return BADGE_COLORS[hashString(name || "") % BADGE_COLORS.length];
  }

  // sizeClass: "" (default ~26px), "badge-sm", "badge-lg"
  function badgeHtml(teamName, sizeClass) {
    var cls = "team-badge" + (sizeClass ? " " + sizeClass : "");
    return '<span class="' + cls + '" style="background:' + teamColor(teamName) + '">' +
      teamInitials(teamName) + "</span>";
  }

  window.TeamBadge = {
    html: badgeHtml,
    color: teamColor,
    initials: teamInitials,
  };

  // ---------- Effects on/off preference ----------
  // A plain device-level UI preference (not a personal record), so it's
  // saved regardless of guest/registered mode and applies immediately by
  // toggling a body class that CSS animations key off of.
  var SETTINGS_KEY = "euroleague_settings_v1";

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return { effectsEnabled: parsed.effectsEnabled !== false };
    } catch (e) {
      return { effectsEnabled: true };
    }
  }

  var settings = loadSettings();

  function applyEffectsClass() {
    document.body.classList.toggle("effects-off", !settings.effectsEnabled);
  }

  function isEffectsEnabled() {
    return settings.effectsEnabled;
  }

  function setEffectsEnabled(enabled) {
    settings.effectsEnabled = !!enabled;
    applyEffectsClass();
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore storage failures
    }
  }

  applyEffectsClass();

  // ---------- Confetti burst ----------
  // A small, dependency-free confetti effect for decisive win moments.
  // Pieces are absolutely-positioned spans animated with CSS, appended to
  // <body> and removed automatically once their animation finishes.
  var CONFETTI_COLORS = ["#f4a825", "#2f6fed", "#37c977", "#ff5c5c", "#8338ec", "#06d6a0"];

  function confetti(count) {
    if (!settings.effectsEnabled) return;
    var total = count || 60;
    var frag = document.createDocumentFragment();
    var pieces = [];
    for (var i = 0; i < total; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      var left = Math.random() * 100;
      var delay = Math.random() * 0.3;
      var duration = 1.8 + Math.random() * 1.2;
      var drift = (Math.random() * 2 - 1) * 80;
      var rotate = Math.random() * 720 - 360;
      var color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.left = left + "vw";
      piece.style.background = color;
      piece.style.animationDelay = delay + "s";
      piece.style.animationDuration = duration + "s";
      piece.style.setProperty("--confetti-drift", drift + "px");
      piece.style.setProperty("--confetti-rotate", rotate + "deg");
      frag.appendChild(piece);
      pieces.push(piece);
    }
    document.body.appendChild(frag);
    setTimeout(function () {
      pieces.forEach(function (p) {
        if (p.parentNode) p.parentNode.removeChild(p);
      });
    }, 3400);
  }

  window.Effects = {
    confetti: confetti,
    isEnabled: isEffectsEnabled,
    setEnabled: setEffectsEnabled,
  };
})();
