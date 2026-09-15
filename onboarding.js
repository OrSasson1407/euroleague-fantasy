(function () {
  "use strict";

  var SEEN_KEY = "euroleague_onboarding_v1";

  var SLIDES = [
    {
      icon: "🏀",
      title: "ברוכים הבאים ליורוליג פנטזי!",
      desc: "כל המצבים כאן בנויים סביב נתוני אמת של שחקנים וקבוצות מההיסטוריה של היורוליג - לא שמות אקראיים.",
    },
    {
      icon: "🎮",
      title: "7 דרכים לשחק",
      desc: "בניית סגל, 1 על 1, ליגה שלמה, טריוויה וגם מצב קריירה - כל מצב נבחר מדף הבית, עם כללים משלו.",
    },
    {
      icon: "🏅",
      title: "באנרים והתקדמות",
      desc: "בכל מצב אפשר לפתוח באנרים על הישגים, ולעקוב אחרי הכל במסך הפרופיל האישי למעלה.",
    },
    {
      icon: "🚀",
      title: "בואו נתחיל!",
      desc: "בחרו מצב מדף הבית ותתחילו לשחק. אפשר תמיד לחזור לדף הבית בלחיצה על הלוגו למעלה.",
    },
  ];

  var step = 0;
  var lastFocused = null;

  function hasSeen() {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch (e) {
      // ignore storage failures
    }
  }

  function renderStep() {
    var slide = SLIDES[step];
    document.getElementById("onboarding-content").innerHTML =
      '<div class="onboarding-icon" aria-hidden="true">' + slide.icon + "</div>" +
      '<h2 id="onboarding-title" tabindex="-1">' + slide.title + "</h2>" +
      '<p class="auth-gate-desc">' + slide.desc + "</p>";

    var dots = document.getElementById("onboarding-dots");
    dots.innerHTML = "";
    SLIDES.forEach(function (s, i) {
      var dot = document.createElement("div");
      dot.className = "onboarding-dot" + (i === step ? " current" : i < step ? " filled" : "");
      dots.appendChild(dot);
    });

    var nextBtn = document.getElementById("btn-onboarding-next");
    nextBtn.textContent = step === SLIDES.length - 1 ? "בואו נתחיל!" : "הבא »";

    var title = document.getElementById("onboarding-title");
    if (title) title.focus();
  }

  function open() {
    step = 0;
    lastFocused = document.activeElement;
    renderStep();
    document.getElementById("onboarding-overlay").hidden = false;
  }

  function close() {
    markSeen();
    document.getElementById("onboarding-overlay").hidden = true;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function next() {
    if (step >= SLIDES.length - 1) {
      close();
      return;
    }
    step++;
    renderStep();
  }

  function maybeShow() {
    if (hasSeen()) return;
    open();
  }

  document.getElementById("btn-onboarding-next").addEventListener("click", next);
  document.getElementById("btn-onboarding-skip").addEventListener("click", close);

  window.Onboarding = { maybeShow: maybeShow };
})();
