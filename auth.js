(function () {
  "use strict";

  var AUTH_KEY = "euroleague_auth_v1";

  function load() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function persist(data) {
    try {
      if (data) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(AUTH_KEY);
      }
    } catch (e) {
      // ignore storage failures
    }
  }

  var current = load(); // null = not chosen yet, {mode:"guest"} or {mode:"registered", username}

  function hasChosen() {
    return !!current;
  }

  function isGuest() {
    return !!current && current.mode === "guest";
  }

  function isRegistered() {
    return !!current && current.mode === "registered";
  }

  function getUsername() {
    return isRegistered() ? current.username : null;
  }

  // Any code that persists personal records/progress to localStorage should
  // check this first and skip the write entirely when it's false, so a
  // guest's session never leaves anything behind after they close the tab.
  function canSave() {
    return isRegistered();
  }

  function chooseGuest() {
    current = { mode: "guest" };
    persist(current);
    renderStatusBar();
  }

  function registerAs(username) {
    current = { mode: "registered", username: username, registeredAt: new Date().toISOString() };
    persist(current);
    renderStatusBar();
  }

  function signOut() {
    current = null;
    persist(null);
    renderStatusBar();
    showGate();
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function showGate() {
    var gate = document.getElementById("auth-gate");
    if (gate) gate.hidden = false;
  }

  function hideGate() {
    var gate = document.getElementById("auth-gate");
    if (gate) gate.hidden = true;
  }

  function renderStatusBar() {
    var el = document.getElementById("auth-status-bar");
    if (!el) return;

    if (isRegistered()) {
      el.innerHTML =
        '<span class="auth-chip registered">👤 ' + escapeHtml(getUsername()) + "</span>" +
        '<button class="auth-chip-btn" id="btn-auth-signout">התנתקות</button>';
      var signoutBtn = document.getElementById("btn-auth-signout");
      if (signoutBtn) signoutBtn.addEventListener("click", signOut);
    } else if (isGuest()) {
      el.innerHTML =
        '<span class="auth-chip guest">🕶️ מצב אורח - השיאים לא נשמרים</span>' +
        '<button class="auth-chip-btn" id="btn-auth-register-from-guest">הרשמה</button>';
      var regBtn = document.getElementById("btn-auth-register-from-guest");
      if (regBtn) regBtn.addEventListener("click", showGate);
    } else {
      el.innerHTML = "";
    }
  }

  function submitRegistration() {
    var input = document.getElementById("auth-username-input");
    var errorEl = document.getElementById("auth-username-error");
    var name = (input.value || "").trim();
    if (name.length < 2) {
      errorEl.textContent = "השם חייב להכיל לפחות 2 תווים";
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    registerAs(name);
    input.value = "";
    hideGate();
  }

  document.getElementById("btn-auth-guest").addEventListener("click", function () {
    chooseGuest();
    hideGate();
  });
  document.getElementById("btn-auth-register-submit").addEventListener("click", submitRegistration);
  document.getElementById("auth-username-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") submitRegistration();
  });

  renderStatusBar();
  if (!hasChosen()) {
    showGate();
  }

  window.Auth = {
    isGuest: isGuest,
    isRegistered: isRegistered,
    canSave: canSave,
    getUsername: getUsername,
    chooseGuest: chooseGuest,
    registerAs: registerAs,
    signOut: signOut,
    showGate: showGate,
  };
})();
