(function () {
  "use strict";

  // Virtual currency: earned only from badges unlocked (window.Achievements),
  // never tracked as its own incrementing counter. Balance is derived as
  // (unlocked badges * COINS_PER_BADGE) - spent, so it's always consistent
  // with the badges the player actually has - including ones unlocked
  // before the shop existed - with no separate migration step needed.
  var STORAGE_KEY = "euroleague_shop_v1";
  var COINS_PER_BADGE = 100;

  // The catalog is intentionally empty for now - prizes come in a later
  // pass. The shop screen itself, the currency, and the topbar balance are
  // real and working.
  var CATALOG = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return { spent: (parsed && parsed.spent) || 0 };
    } catch (e) {
      return { spent: 0 };
    }
  }

  var data = load();

  function save() {
    if (window.Auth && !window.Auth.canSave()) return; // guest mode - nothing persists
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore storage failures
    }
  }

  function unlockedBadgeCount() {
    return window.Achievements.getAll().filter(function (b) { return b.unlocked; }).length;
  }

  function earnedTotal() {
    return unlockedBadgeCount() * COINS_PER_BADGE;
  }

  function getBalance() {
    return Math.max(0, earnedTotal() - data.spent);
  }

  function spend(amount) {
    if (amount <= 0 || amount > getBalance()) return false;
    data.spent += amount;
    save();
    refreshTopbarDisplay();
    return true;
  }

  function refreshTopbarDisplay() {
    var el = document.getElementById("topbar-coin-balance");
    if (el) el.textContent = getBalance().toLocaleString("he-IL");
  }

  function renderShopScreen() {
    document.getElementById("shop-balance").textContent = getBalance().toLocaleString("he-IL");

    var catalogEl = document.getElementById("shop-catalog");
    if (CATALOG.length === 0) {
      catalogEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon" aria-hidden="true">🛍️</div>' +
          '<p class="empty-state-text">החנות בבנייה</p>' +
          '<p class="empty-state-hint">פריטים לרכישה יתווספו בקרוב - המשיכו לפתוח באנרים כדי לצבור מטבעות!</p>' +
        "</div>";
      return;
    }
    // Future: render CATALOG items as purchasable cards here.
  }

  function open() {
    renderShopScreen();
    window.AppNav.showScreen("shop");
  }

  document.getElementById("btn-open-shop").addEventListener("click", open);
  document.getElementById("btn-home-from-shop").addEventListener("click", function () {
    window.AppNav.showScreen("home");
  });

  refreshTopbarDisplay();

  window.Shop = {
    getBalance: getBalance,
    spend: spend,
    refreshTopbarDisplay: refreshTopbarDisplay,
    coinsPerBadge: COINS_PER_BADGE,
  };
})();
