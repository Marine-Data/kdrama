// Service worker minimal pour Dramatic.
// Objectif : rendre l'app reconnue comme PWA installable (condition
// nécessaire pour le packaging TWA / Play Store), avec un cache basique
// de l'app shell pour un démarrage plus rapide et un minimum de
// résilience hors-ligne.

const CACHE_NAME = "dramatic-cache-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Stratégie "network first, fallback cache" : on privilégie toujours le
// réseau (important car l'app dépend de Supabase pour les données
// dynamiques), et on ne retombe sur le cache que hors-ligne.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // On ne met en cache que les requêtes same-origin pour éviter
          // de stocker des réponses d'API externes (Supabase, TMDB...).
          if (new URL(event.request.url).origin === self.location.origin) {
            cache.put(event.request, copy);
          }
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
