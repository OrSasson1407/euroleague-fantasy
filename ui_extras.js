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
    return '<span class="' + cls + '" style="background:' + teamColor(teamName) + '" aria-hidden="true">' +
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

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function loadSettings() {
    var raw = null;
    try {
      raw = localStorage.getItem(SETTINGS_KEY);
    } catch (e) {
      // ignore storage failures
    }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        return { effectsEnabled: parsed.effectsEnabled !== false };
      } catch (e) {
        // fall through to the system-preference default below
      }
    }
    // No explicit choice saved yet - default to the OS's reduced-motion
    // preference instead of always defaulting effects on.
    return { effectsEnabled: !prefersReducedMotion() };
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

  // ---------- Sound effects ----------
  // Synthesized with the Web Audio API (no audio files to ship). A single
  // shared AudioContext is created lazily on first use, inside a real click
  // handler, so it satisfies browsers' autoplay-gesture requirement.
  var audioCtx = null;

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = Ctx ? new Ctx() : null;
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function playClick() {
    if (!settings.effectsEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  function playBuzzer() {
    if (!settings.effectsEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  // ---------- Confetti burst ----------
  // A small, dependency-free confetti effect for decisive win moments.
  // Pieces are absolutely-positioned spans animated with CSS, appended to
  // <body> and removed automatically once their animation finishes.
  var CONFETTI_COLORS = ["#D62828", "#FFB703", "#F5F3EF", "#37c977", "#ff5c5c", "#9AA3AE"];

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

  // ---------- WOW pick toast ----------
  // A brief, flashy banner for a standout moment mid-draft (landing a
  // 90+ rated player) - distinct from the achievements toast so the two
  // never compete for the same corner of the screen.
  function wowPick(name, rating) {
    if (!settings.effectsEnabled) return;
    var toast = document.createElement("div");
    toast.className = "wow-pick-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML =
      '<div class="wow-pick-flare" aria-hidden="true">🌟</div>' +
      '<div class="wow-pick-text">WOW PICK!</div>' +
      '<div class="wow-pick-player">' + name + ' <span class="wow-pick-rating">' + rating + "</span></div>";
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 1800);
  }

  // ---------- Dismissible info toast ----------
  // Explains a screen's rules as a toast the user must actively dismiss,
  // instead of a paragraph that permanently sits on the page. Always shown
  // regardless of the effects on/off setting - it's informational content,
  // not a decorative flourish. Only one is ever on screen at a time.
  function showInfoToast(html) {
    var existing = document.querySelector(".info-toast");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var toast = document.createElement("div");
    toast.className = "info-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML =
      '<div class="info-toast-text">' + html + "</div>" +
      '<button class="info-toast-dismiss">הבנתי</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });

    function dismiss() {
      toast.classList.remove("show");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    toast.querySelector(".info-toast-dismiss").addEventListener("click", dismiss);
  }

  // ---------- Count-up number animation ----------
  // Animates an element's text from 0 up to a target number - used for
  // "final rating reveal" moments. Skips straight to the final value when
  // effects are disabled, matching the reduced-motion behavior elsewhere.
  function countUp(el, target, opts) {
    if (!el) return;
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 1;
    var suffix = opts.suffix || "";
    var formatted = target.toFixed(decimals) + suffix;

    if (!settings.effectsEnabled) {
      el.textContent = formatted;
      return;
    }

    var duration = opts.duration || 1000;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatted;
      }
    }
    requestAnimationFrame(step);
  }

  window.Effects = {
    confetti: confetti,
    wowPick: wowPick,
    countUp: countUp,
    playClick: playClick,
    playBuzzer: playBuzzer,
    showInfoToast: showInfoToast,
    isEnabled: isEffectsEnabled,
    setEnabled: setEffectsEnabled,
  };
})();
