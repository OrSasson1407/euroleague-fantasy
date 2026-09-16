(function () {
  "use strict";

  // ---------- Live "game flow" momentum graph ----------
  // Shared by h2h.js (per-series game reveal) and league.js (live game-by-
  // game viewer). Plots the running score gap (side1 - side2) at tip-off and
  // after each quarter, revealing one more point per tick so it draws itself
  // as the game plays out. Gold = side1 leading, red = side2. Callers own
  // however they split a final score into quarters/cumulative lines - this
  // only needs the resulting cum1/cum2 arrays.
  function momentumGraphHtml(cum1, cum2, revealCount) {
    var maxDiff = 30;
    var pts = [{ x: 0, diff: 0 }];
    for (var i = 0; i < revealCount; i++) {
      pts.push({ x: (i + 1) * 75, diff: cum1[i] - cum2[i] });
    }
    var toY = function (diff) {
      var clamped = Math.max(-1, Math.min(1, diff / maxDiff));
      return (50 - clamped * 40).toFixed(1);
    };
    var svgPts = pts.map(function (p) { return p.x + "," + toY(p.diff); }).join(" ");
    var last = pts[pts.length - 1];
    var leadingColor = last.diff > 0 ? "var(--accent-2)" : (last.diff < 0 ? "var(--accent)" : "var(--text-dim)");
    var labels = window.I18n ? window.I18n.t("common.momentumLabels", { returnObjects: true }) : ["התחלה", "רבע 1", "רבע 2", "רבע 3", "רבע 4"];
    var labelsHtml = labels.map(function (lab, i) {
      return '<span class="momentum-label' + (i <= revealCount ? " revealed" : "") + '">' + lab + "</span>";
    }).join("");
    return (
      '<svg class="momentum-graph" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<line x1="0" y1="50" x2="300" y2="50" class="momentum-baseline"></line>' +
        (pts.length > 1 ? '<polyline points="' + svgPts + '" class="momentum-line"></polyline>' : "") +
        '<circle cx="' + last.x + '" cy="' + toY(last.diff) + '" r="4.5" style="fill:' + leadingColor + '"></circle>' +
      "</svg>" +
      '<div class="momentum-labels">' + labelsHtml + "</div>"
    );
  }

  window.MomentumGraph = { html: momentumGraphHtml };

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

  // A "club identity" accent for whichever mode has one persistent club for
  // the whole playthrough (currently league mode) - reuses the same
  // deterministic per-team color as the badge, kept to low-risk decorative
  // uses only (a border stripe, never text) since some hashed colors don't
  // have reliable contrast as foreground text against either theme's bg.
  function setTeamAccent(teamName) {
    document.documentElement.style.setProperty("--team-accent", teamColor(teamName));
  }

  function clearTeamAccent() {
    document.documentElement.style.removeProperty("--team-accent");
  }

  window.TeamBadge = {
    html: badgeHtml,
    color: teamColor,
    initials: teamInitials,
    setAccent: setTeamAccent,
    clearAccent: clearTeamAccent,
  };

  // ---------- Rating tag, colored by tier ----------
  // 85+ gets a gold tier with a permanent flame, 75-84 a warm orange tier,
  // everything else the plain default (red-tinted) tag. Centralizing this
  // means every screen that shows a player's rating renders it consistently.
  function ratingTagHtml(rating, sizeClass) {
    if (typeof rating !== "number") return "";
    var cls = "rating-tag";
    var label = String(rating);
    if (rating >= 85) {
      cls += " rating-tag-elite";
      label = "🔥 " + rating;
    } else if (rating >= 75) {
      cls += " rating-tag-good";
    }
    if (sizeClass) cls += " " + sizeClass;
    return '<span class="' + cls + '">' + label + "</span>";
  }

  window.RatingTag = { html: ratingTagHtml };

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
        return {
          effectsEnabled: parsed.effectsEnabled !== false,
          theme: parsed.theme === "light" ? "light" : "dark",
        };
      } catch (e) {
        // fall through to the system-preference default below
      }
    }
    // No explicit choice saved yet - default to the OS's reduced-motion
    // preference instead of always defaulting effects on. The dark
    // broadcast look is this app's actual identity, though, not just a
    // neutral default, so theme always starts dark regardless of the
    // device's own light/dark preference - light is an opt-in choice.
    return { effectsEnabled: !prefersReducedMotion(), theme: "dark" };
  }

  var settings = loadSettings();

  function applyEffectsClass() {
    document.body.classList.toggle("effects-off", !settings.effectsEnabled);
  }

  function isEffectsEnabled() {
    return settings.effectsEnabled;
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore storage failures
    }
  }

  function setEffectsEnabled(enabled) {
    settings.effectsEnabled = !!enabled;
    applyEffectsClass();
    saveSettings();
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }

  function getTheme() {
    return settings.theme;
  }

  function setTheme(theme) {
    settings.theme = theme === "light" ? "light" : "dark";
    applyTheme();
    saveSettings();
  }

  applyEffectsClass();
  applyTheme();

  // ---------- Splash screen ----------
  // The CSS animation handles the actual fade; this just cleans the
  // element out of the DOM afterward (or immediately, with no fade at
  // all, when effects are off) so it never lingers as a stray fixed
  // full-screen element.
  (function initSplash() {
    var splash = document.getElementById("splash-screen");
    if (!splash) return;
    if (!settings.effectsEnabled) {
      splash.parentNode.removeChild(splash);
      return;
    }
    setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 1200);
  })();

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

  // A single scheduled tone, used to build the short win/lose melodies
  // below - startOffset lets several notes be queued on the same
  // AudioContext clock without waiting for each other.
  function scheduleTone(freq, startOffset, duration, type, volume) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    var startTime = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function playWin() {
    if (!settings.effectsEnabled) return;
    scheduleTone(523.25, 0, 0.15, "triangle", 0.1); // C5
    scheduleTone(659.25, 0.12, 0.15, "triangle", 0.1); // E5
    scheduleTone(783.99, 0.24, 0.35, "triangle", 0.12); // G5
  }

  function playLose() {
    if (!settings.effectsEnabled) return;
    scheduleTone(311.13, 0, 0.25, "sawtooth", 0.08); // Eb4
    scheduleTone(233.08, 0.2, 0.45, "sawtooth", 0.08); // Bb3
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
  // Explains a screen's rules as a centered, prominent overlay the user
  // must actively dismiss, instead of a paragraph that permanently sits on
  // the page. Always shown regardless of the effects on/off setting -
  // it's informational content, not a decorative flourish. Only one is
  // ever on screen at a time.
  function showInfoToast(html) {
    var existing = document.querySelector(".info-toast-overlay");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var overlay = document.createElement("div");
    overlay.className = "info-toast-overlay";
    overlay.setAttribute("role", "status");
    overlay.innerHTML =
      '<div class="info-toast-box">' +
      '<div class="info-toast-icon" aria-hidden="true">💡</div>' +
      '<div class="info-toast-text">' + html + "</div>" +
      '<button class="info-toast-dismiss">' + (window.I18n ? window.I18n.t("common.gotIt") : "הבנתי") + "</button>" +
      "</div>";
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add("show");
    });

    function dismiss() {
      overlay.classList.remove("show");
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    overlay.querySelector(".info-toast-dismiss").addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
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

  // ---------- Diagonal wipe transition ----------
  // A quick broadcast-style diagonal "cut" that sweeps across the whole
  // viewport - fired centrally whenever the active screen genuinely
  // changes, masking the instant DOM swap underneath.
  function wipeTransition() {
    if (!settings.effectsEnabled) return;
    var overlay = document.createElement("div");
    overlay.className = "screen-wipe";
    overlay.innerHTML = '<div class="screen-wipe-bar"></div>';
    document.body.appendChild(overlay);
    var bar = overlay.querySelector(".screen-wipe-bar");
    bar.addEventListener("animationend", function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
  }

  // ---------- Trade flip card ----------
  // A centered 3D flip from the old player to the new one, used by squad
  // builder's trade screen. Calls onDone once the animation (or, with
  // effects off, immediately) finishes, so the caller can re-render.
  function flipCard(oldLabel, oldRating, newLabel, newRating, onDone) {
    if (!settings.effectsEnabled) {
      if (onDone) onDone();
      return;
    }
    var overlay = document.createElement("div");
    overlay.className = "trade-flip-overlay";
    overlay.innerHTML =
      '<div class="trade-flip-card">' +
        '<div class="trade-flip-inner">' +
          '<div class="trade-flip-face trade-flip-front">' +
            '<div class="trade-flip-name">' + oldLabel + "</div>" +
            ratingTagHtml(oldRating) +
          "</div>" +
          '<div class="trade-flip-face trade-flip-back">' +
            '<div class="trade-flip-name">' + newLabel + "</div>" +
            ratingTagHtml(newRating) +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    var inner = overlay.querySelector(".trade-flip-inner");
    setTimeout(function () {
      inner.classList.add("flipped");
    }, 250);
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (onDone) onDone();
    }, 1300);
  }

  window.Effects = {
    confetti: confetti,
    wowPick: wowPick,
    countUp: countUp,
    playClick: playClick,
    playBuzzer: playBuzzer,
    playWin: playWin,
    playLose: playLose,
    showInfoToast: showInfoToast,
    wipeTransition: wipeTransition,
    flipCard: flipCard,
    isEnabled: isEffectsEnabled,
    setEnabled: setEffectsEnabled,
    getTheme: getTheme,
    setTheme: setTheme,
  };

  // ---------- Toggle-button accessibility state ----------
  // ".selected" on era-btn/system-card/team-select-btn groups is a purely
  // visual (color) cue - screen readers can't tell which option is picked.
  // sync() re-reads the actual class on every child and mirrors it to
  // aria-pressed, so callers just call it once after any selection change
  // instead of tracking true/false themselves.
  function syncSelectedAria(container) {
    if (!container) return;
    Array.from(container.children).forEach(function (b) {
      if (b.tagName === "BUTTON") {
        b.setAttribute("aria-pressed", b.classList.contains("selected") ? "true" : "false");
      }
    });
  }
  window.UiSelect = { sync: syncSelectedAria };
  document.querySelectorAll(".era-filter-buttons, .system-select-grid, .team-select-grid").forEach(syncSelectedAria);

  // ---------- Drag-and-drop chip swapping ----------
  // Shared by game.js and league.js's lineup screens, which both let you tap
  // one filled slot then another of the same position to swap them. This adds
  // real drag-and-drop on top of that (never replacing it - a plain tap/click
  // with no meaningful movement still falls through to onTap). Pointer Events
  // are used instead of native HTML5 drag-and-drop so it works the same way
  // with mouse, touch and pen instead of being mouse-only.
  //
  // wireGroup(chipEls, opts) where opts is:
  //   getEntry(chipEl)              -> the data object a chip represents
  //   isValidTarget(dragged, other) -> can `dragged` be swapped with `other`
  //   onDrop(dragged, other)        -> perform the swap (caller re-renders)
  //   onTap(entry)                  -> plain tap/click with no real drag
  function wireChipDragGroup(chipEls, opts) {
    var chips = Array.from(chipEls);
    var DRAG_THRESHOLD = 8;

    chips.forEach(function (chipEl) {
      var entry = opts.getEntry(chipEl);
      var startX, startY, dragging, hoverTarget;

      function onMove(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!dragging) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          dragging = true;
          beginDrag();
        }
        chipEl.style.left = (chipEl._dragBaseLeft + dx) + "px";
        chipEl.style.top = (chipEl._dragBaseTop + dy) + "px";
        updateHover(e.clientX, e.clientY);
      }

      function onUp(e) {
        chipEl.removeEventListener("pointermove", onMove);
        chipEl.removeEventListener("pointerup", onUp);
        chipEl.removeEventListener("pointercancel", onUp);
        if (dragging) {
          endDrag();
        } else {
          opts.onTap(entry);
        }
      }

      chipEl.addEventListener("pointerdown", function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        startX = e.clientX;
        startY = e.clientY;
        dragging = false;
        hoverTarget = null;
        chipEl.setPointerCapture(e.pointerId);
        chipEl.addEventListener("pointermove", onMove);
        chipEl.addEventListener("pointerup", onUp);
        chipEl.addEventListener("pointercancel", onUp);
      });

      function beginDrag() {
        var rect = chipEl.getBoundingClientRect();
        chipEl._dragBaseLeft = rect.left;
        chipEl._dragBaseTop = rect.top;
        chipEl.style.position = "fixed";
        chipEl.style.left = rect.left + "px";
        chipEl.style.top = rect.top + "px";
        chipEl.style.width = rect.width + "px";
        chipEl.classList.add("dragging");
        chips.forEach(function (other) {
          if (other === chipEl) return;
          var otherEntry = opts.getEntry(other);
          other.classList.add(opts.isValidTarget(entry, otherEntry) ? "drop-ready" : "drop-invalid");
        });
      }

      function updateHover(x, y) {
        var el = document.elementFromPoint(x, y);
        var target = el ? el.closest(".drop-ready") : null;
        if (target === hoverTarget) return;
        if (hoverTarget) hoverTarget.classList.remove("drop-hover");
        hoverTarget = target;
        if (hoverTarget) hoverTarget.classList.add("drop-hover");
      }

      function endDrag() {
        chipEl.classList.remove("dragging");
        chipEl.style.position = "";
        chipEl.style.left = "";
        chipEl.style.top = "";
        chipEl.style.width = "";
        chips.forEach(function (other) {
          other.classList.remove("drop-ready", "drop-invalid", "drop-hover");
        });
        if (hoverTarget) {
          opts.onDrop(entry, opts.getEntry(hoverTarget));
        }
      }
    });
  }
  window.ChipDrag = { wireGroup: wireChipDragGroup };
})();
