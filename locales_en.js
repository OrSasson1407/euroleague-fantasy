// English translation resource for i18next (window.I18n, see i18n.js).
// Structure must mirror locales_he.js exactly (same keys) - i18next falls
// back to Hebrew for any key missing here, which would otherwise silently
// mix languages instead of erroring loudly.
window.LOCALE_EN = {
  common: {
    appName: "EuroLeague Fantasy",
    home: "Home",
  },
  topbar: {
    shop: "Shop",
    profile: "Profile",
    settings: "Settings",
    coins: "Coins",
  },
  home: {
    title: "All-Time Squad - EuroLeague",
    subtitle: "Choose a game mode",
    modes: {
      single: {
        title: "Squad Builder",
        desc: "10 rounds - build one dream squad (starting five + bench) from EuroLeague history",
      },
      h2h: {
        title: "Head to Head",
        desc: "Face a friend or the computer - each side builds a five (2 guards, 2 forwards, a center), then a simulation decides the winner",
      },
      league: {
        title: "League",
        desc: "Pick a favorite club, build it a 10-player squad from across its history, then play a full 20-team season against 19 other real clubs",
      },
      trivia: {
        title: "Trivia",
        desc: "Choose to identify the club or the season - 25 questions per topic. How many will you get right?",
      },
      badges: {
        title: "🏅 Badges",
        desc: "Collect badges for achievements across every mode - how many can you unlock?",
      },
      playerSearch: {
        title: "🔍 Player Profile",
        desc: "Search any player from EuroLeague history and see every one of their seasons, including their rating history",
      },
      career: {
        title: "🏀 Career",
        desc: "Start as a 16-year-old academy player, develop into the pros, and manage a full career through retirement",
      },
    },
  },
  settings: {
    language: {
      label: "Language",
      desc: "Hebrew or English - changing this reloads the page",
    },
  },
};
