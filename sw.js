// Service worker minimal pour Dramatic.
// Objectif : rendre l'app reconnue comme PWA installable (condition
// nécessaire pour le packaging TWA / Play Store), avec un cache basique
// de l'app shell pour un démarrage plus rapide et un minimum de
// résilience hors-ligne.

const CACHE_NAME = "dramatic-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./style.css",
  "./main.js",
  "./ost.js"
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

// ---- Notifications push ----
// Reçoit le message envoyé par l'Edge Function "send-push" (déclenchée
// automatiquement par des triggers sur notifications_interactions,
// notifications_abonnements et suggestions_a_voir) et l'affiche comme
// notification système, même si l'app n'est pas ouverte.
self.addEventListener("push", (event) => {
  let data = { title: "Dramatic", body: "Nouvelle activité sur ton carnet" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // Si le payload n'est pas du JSON valide, on garde le message par défaut
    // plutôt que de planter le gestionnaire d'évènement.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Dramatic", {
      body: data.body || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: "./" },
    })
  );
});

// Au tap sur la notification : ramène l'app au premier plan si un onglet
// est déjà ouvert, sinon en ouvre un nouveau.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
