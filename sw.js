/* Service Worker: haelt die App offline lauffaehig.
   Programmdateien kommen aus dem Zwischenspeicher, alles andere aus dem Netz. */
const VERSION = 'tt-2026-08-03-8';
const SCHALE = [
  './',
  './index.html',
  './app.js',
  './bibliothek/supabase.js',
  './manifest.webmanifest',
  './symbole/icon-192.png',
  './symbole/icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SCHALE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/* Die Seite darf den wartenden Dienst sofort übernehmen lassen. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.typ === 'uebernehmen') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Supabase und alles Fremde nie zwischenspeichern
  if (url.origin !== self.location.origin) return;

  // Programmdateien: erst Netz, sonst Zwischenspeicher (damit Aktualisierungen ankommen)
  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(VERSION).then((c) => c.put(e.request, kopie)).catch(() => {});
        return antwort;
      })
      .catch(() => caches.match(e.request).then((treffer) => treffer || caches.match('./index.html'))),
  );
});
