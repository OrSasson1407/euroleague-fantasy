(function () {
  "use strict";

  var deferredInstallPrompt = null;
  var resetArmed = false;
  var resetArmTimeout = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderSettingsScreen();
  });

  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    renderSettingsScreen();
  });

  function renderSettingsScreen() {
    var container = document.getElementById("settings-content");
    if (!container) return;

    var effectsOn = window.Effects ? window.Effects.isEnabled() : true;
    var theme = window.Effects ? window.Effects.getTheme() : "dark";
    var lang = window.I18n ? window.I18n.getLang() : "he";

    var html = "";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">' + window.I18n.t("settings.language.label") + "</div>" +
      '<div class="settings-row-desc">' + window.I18n.t("settings.language.desc") + "</div></div>" +
      '<div class="era-filter-buttons" id="settings-lang-buttons">' +
      '<button class="era-btn' + (lang === "he" ? " selected" : "") + '" data-lang-choice="he">🇮🇱 עברית</button>' +
      '<button class="era-btn' + (lang === "en" ? " selected" : "") + '" data-lang-choice="en">🇬🇧 English</button>' +
      "</div>" +
      "</div></div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">' + window.I18n.t("settings.theme.label") + "</div>" +
      '<div class="settings-row-desc">' + window.I18n.t("settings.theme.desc") + "</div></div>" +
      '<div class="era-filter-buttons" id="settings-theme-buttons">' +
      '<button class="era-btn' + (theme === "dark" ? " selected" : "") + '" data-theme-choice="dark">🌙 ' + window.I18n.t("settings.theme.dark") + "</button>" +
      '<button class="era-btn' + (theme === "light" ? " selected" : "") + '" data-theme-choice="light">☀️ ' + window.I18n.t("settings.theme.light") + "</button>" +
      "</div>" +
      "</div></div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">' + window.I18n.t("settings.effects.label") + "</div>" +
      '<div class="settings-row-desc">' + window.I18n.t("settings.effects.desc") + "</div></div>" +
      '<button class="settings-toggle-btn" id="btn-settings-toggle-effects" aria-pressed="' + (effectsOn ? "true" : "false") + '">' +
      (effectsOn ? window.I18n.t("settings.effects.on") : window.I18n.t("settings.effects.off")) + "</button>" +
      "</div></div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">' + window.I18n.t("settings.install.label") + "</div>" +
      '<div class="settings-row-desc">' + window.I18n.t("settings.install.desc") + "</div></div>" +
      (deferredInstallPrompt ? '<button id="btn-settings-install">📲 ' + window.I18n.t("settings.install.btn") + "</button>" :
        '<span class="settings-row-note">' + window.I18n.t("settings.install.unavailable") + "</span>") +
      "</div>" +
      '<p class="settings-row-note" style="margin-top:8px;">' + window.I18n.t("settings.install.iosNote") + "</p>" +
      "</div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">' + window.I18n.t("settings.reset.label") + "</div>" +
      '<div class="settings-row-desc">' + window.I18n.t("settings.reset.desc") + "</div></div>" +
      '<button class="danger-btn" id="btn-settings-reset">' +
      (resetArmed ? window.I18n.t("settings.reset.confirm") : "🗑️ " + window.I18n.t("settings.reset.btn")) + "</button>" +
      "</div></div>";

    container.innerHTML = html;

    var langButtons = document.getElementById("settings-lang-buttons");
    if (langButtons) {
      window.UiSelect.sync(langButtons);
      Array.from(langButtons.querySelectorAll(".era-btn")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          window.I18n.setLang(btn.dataset.langChoice);
        });
      });
    }

    var themeButtons = document.getElementById("settings-theme-buttons");
    if (themeButtons) {
      window.UiSelect.sync(themeButtons);
      Array.from(themeButtons.querySelectorAll(".era-btn")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          window.Effects.setTheme(btn.dataset.themeChoice);
          renderSettingsScreen();
        });
      });
    }

    var effectsBtn = document.getElementById("btn-settings-toggle-effects");
    if (effectsBtn) {
      effectsBtn.addEventListener("click", function () {
        window.Effects.setEnabled(!window.Effects.isEnabled());
        renderSettingsScreen();
      });
    }

    var installBtn = document.getElementById("btn-settings-install");
    if (installBtn) {
      installBtn.addEventListener("click", function () {
        if (!deferredInstallPrompt) return;
        var promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        promptEvent.userChoice.finally(function () {
          renderSettingsScreen();
        });
      });
    }

    var resetBtn = document.getElementById("btn-settings-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!resetArmed) {
          resetArmed = true;
          renderSettingsScreen();
          clearTimeout(resetArmTimeout);
          resetArmTimeout = setTimeout(function () {
            resetArmed = false;
            renderSettingsScreen();
          }, 4000);
          return;
        }
        clearTimeout(resetArmTimeout);
        resetArmed = false;
        performReset();
      });
    }
  }

  function performReset() {
    ["euroleague_achievements_v1", "single_top_squads_v1", "career_save_v1", "career_last_v1", "euroleague_auth_v1"].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    });
    window.location.reload();
  }

  function open() {
    renderSettingsScreen();
    window.AppNav.showScreen("settings");
  }

  window.SettingsScreen = { open: open };
})();
