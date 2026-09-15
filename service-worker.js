"use strict";

var CACHE_NAME = "euroleague-fantasy-v5";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon.svg",
  "./onboarding.js",
  "./auth.js",
  "./euroleague_data.js",
  "./ratings_enrich.js",
  "./play_systems.js",
  "./player_search.js",
  "./achievements.js",
  "./ui_extras.js",
  "./main.js",
  "./game.js",
  "./h2h.js",
  "./league.js",
  "./trivia.js",
  "./player_profile.js",
  "./career.js",
  "./profile.js",
  "./settings.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // {cache: "reload"} bypasses the browser's own HTTP cache for each
      // asset, so a fresh install never bakes stale bytes into the new
      // Cache Storage bucket just because an old response was still valid.
      var requests = CORE_ASSETS.map(function (url) {
        return new Request(url, { cache: "reload" });
      });
      return Promise.all(requests.map(function (req) {
        return fetch(req).then(function (response) {
          return cache.put(req, response);
        });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Cache-first for the app shell, falling back to network and refreshing the
// cache in the background - keeps the game playable offline once installed.
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });

      return cached || networkFetch;
    })
  );
});
