(function () {
  "use strict";

  // Shares ui_extras.js's settings storage key (lang lives alongside
  // theme/effectsEnabled) rather than a new key - all three are the same
  // kind of thing: a device-level UI preference, not a personal record,
  // so (like theme/effects) never gated by Auth.canSave().
  var SETTINGS_KEY = "euroleague_settings_v1";

  function loadLang() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.lang === "en" || parsed.lang === "he") return parsed.lang;
      }
    } catch (e) {
      // fall through to the default below
    }
    return "he";
  }

  var currentLang = loadLang();

  i18next.init({
    lng: currentLang,
    fallbackLng: "he",
    resources: {
      he: { translation: window.LOCALE_HE },
      en: { translation: window.LOCALE_EN },
    },
  });

  function applyDirection(lang) {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "en" ? "ltr" : "rtl");
  }
  applyDirection(currentLang);

  function t(key, options) {
    return i18next.t(key, options);
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (lang !== "he" && lang !== "en") return;
    if (lang === currentLang) return;
    var settings;
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      settings = raw ? JSON.parse(raw) : {};
    } catch (e) {
      settings = {};
    }
    settings.lang = lang;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore storage failures - the reload will just fall back to "he" again
    }
    location.reload();
  }

  function formatNumber(n) {
    return n.toLocaleString(currentLang === "en" ? "en-US" : "he-IL");
  }

  // Applies every static index.html label in one pass - dynamic per-mode
  // screens call t() directly inside their own render functions instead,
  // since their markup doesn't exist until each screen is first rendered.
  // A key prefixed "[html]" (matching the i18next-dom plugin's own
  // convention) is applied as innerHTML instead of textContent, for the
  // rare string that legitimately needs inline markup (e.g. a <strong>);
  // plain keys stay textContent so nothing else can inject markup by accident.
  function applyStaticDom() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (key.indexOf("[html]") === 0) {
        el.innerHTML = t(key.slice(6));
      } else {
        el.textContent = t(key);
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
  }
  applyStaticDom();

  window.I18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    formatNumber: formatNumber,
  };
})();
