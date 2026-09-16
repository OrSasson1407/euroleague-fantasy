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

    var html = "";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">אפקטים וצלילים</div>' +
      '<div class="settings-row-desc">קונפטי, אנימציות מעבר בין מסכים, וצלילי קליק/באזר בדראפט ובתוצאות</div></div>' +
      '<button class="settings-toggle-btn" id="btn-settings-toggle-effects" aria-pressed="' + (effectsOn ? "true" : "false") + '">' +
      (effectsOn ? "מופעל ✅" : "כבוי ❌") + "</button>" +
      "</div></div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">התקנה כאפליקציה</div>' +
      '<div class="settings-row-desc">מוסיפים את המשחק למסך הבית ומריצים אותו כמו אפליקציה, כולל שימוש בסיסי בלי חיבור לרשת.</div></div>' +
      (deferredInstallPrompt ? '<button id="btn-settings-install">📲 התקנה</button>' :
        '<span class="settings-row-note">לא זמין כרגע בדפדפן הזה</span>') +
      "</div>" +
      '<p class="settings-row-note" style="margin-top:8px;">באייפון/ספארי: תפריט השיתוף &larr; "הוספה למסך הבית".</p>' +
      "</div>";

    html += '<div class="settings-section"><div class="settings-row">' +
      '<div><div class="settings-row-title">איפוס נתונים</div>' +
      '<div class="settings-row-desc">מוחק לצמיתות את כל הבאנרים, השיאים והקריירה השמורים במכשיר זה, ומתנתק מהחשבון.</div></div>' +
      '<button class="danger-btn" id="btn-settings-reset">' +
      (resetArmed ? "בטוחים? לחצו שוב לאישור מחיקה" : "🗑️ איפוס נתונים") + "</button>" +
      "</div></div>";

    container.innerHTML = html;

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
