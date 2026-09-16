(function () {
  "use strict";

  // Virtual currency: earned only from badges unlocked (window.Achievements),
  // never tracked as its own incrementing counter. Balance is derived as
  // (unlocked badges * COINS_PER_BADGE) - spent, so it's always consistent
  // with the badges the player actually has - including ones unlocked
  // before the shop existed - with no separate migration step needed.
  var STORAGE_KEY = "euroleague_shop_v1";
  var COINS_PER_BADGE = 100;

  // Each item is a permanent, one-time unlock (buy once, the ability is
  // yours forever after) rather than a consumable - matches how the other
  // modes' game.js/career.js/league.js check window.Shop.isOwned(id) once
  // to decide whether to offer the unlocked option at all.
  var CATALOG = [
    {
      id: "legendsDraft",
      icon: "🌟",
      title: "דראפט אגדות",
      desc: "מצב דראפט בלעדי בבניית סגל - מאגר השחקנים מוגבל לדירוג 90+ בלבד",
      price: 800,
    },
    {
      id: "freeClubChoice",
      icon: "🎽",
      title: "בחירת קבוצה חופשית",
      desc: "ביום הדראפט בקריירה, בחרו כל קבוצה שתרצו במקום לבחור מתוך ההצעות שהוצגו",
      price: 600,
    },
    {
      id: "freeAgentSigning",
      icon: "✍️",
      title: "חתימת שחקן חופשי",
      desc: "פעם בכל עונת ליגה, בחרו כל שחקן מההיסטוריה והחתימו אותו ישירות להרכב שלכם",
      price: 700,
    },
  ];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return { spent: (parsed && parsed.spent) || 0, owned: (parsed && parsed.owned) || {} };
    } catch (e) {
      return { spent: 0, owned: {} };
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

  function isOwned(id) {
    return !!data.owned[id];
  }

  function purchase(id) {
    var item = null;
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) { item = CATALOG[i]; break; }
    }
    if (!item || isOwned(id) || getBalance() < item.price) return false;
    data.spent += item.price;
    data.owned[id] = true;
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
    var balance = getBalance();
    catalogEl.innerHTML = CATALOG.map(function (item) {
      var owned = isOwned(item.id);
      var afford = balance >= item.price;
      return (
        '<div class="shop-item-card' + (owned ? " owned" : "") + '">' +
          '<div class="shop-item-icon" aria-hidden="true">' + item.icon + "</div>" +
          '<div class="shop-item-body">' +
            '<div class="shop-item-title">' + item.title + "</div>" +
            '<div class="shop-item-desc">' + item.desc + "</div>" +
          "</div>" +
          (owned
            ? '<span class="shop-item-owned">✅ נרכש</span>'
            : '<button class="shop-item-buy" data-item-id="' + item.id + '"' + (afford ? "" : " disabled") + ">🪙 " + item.price + "</button>") +
        "</div>"
      );
    }).join("");

    Array.from(catalogEl.querySelectorAll(".shop-item-buy")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (purchase(btn.dataset.itemId)) {
          window.Effects.confetti();
          renderShopScreen();
        }
      });
    });
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
    isOwned: isOwned,
    refreshTopbarDisplay: refreshTopbarDisplay,
    coinsPerBadge: COINS_PER_BADGE,
  };
})();
