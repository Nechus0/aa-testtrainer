/* Service Worker: haelt die App offline lauffaehig.
   Programmdateien kommen aus dem Zwischenspeicher, alles andere aus dem Netz.

   Grundsaetze (aus dem Nachlade-Zwischenfall vom 10./13. August 2026):
   1. Ein neuer Dienst uebernimmt NIE von selbst. Kein skipWaiting im install.
      Er wartet, bis die Seite ihn ausdruecklich per Nachricht uebernehmen laesst.
   2. Ein einzelner fehlender Anhang darf die Einrichtung nicht scheitern lassen.
      Deshalb jede Datei einzeln und Fehler geschluckt.
   3. clients.claim() nur beim allerersten Dienst (wenn vorher keiner die Kontrolle
      hatte). Danach uebernimmt der Dienst mit dem Neuladen der Seite. */
const VERSION = 'tt-2026-08-14-8';
const SCHALE = [
  './',
  './index.html',
  './app.js',
  './bibliothek/supabase.js',
  './manifest.webmanifest',
  './symbole/icon-192.png',
  './symbole/icon-512.png',
  './apple-touch-icon.png',
  './bilder/johann-enttaeuscht.jpg',
  './bilder/johann-stolz.jpg',
  './bilder/auswaertiges-amt.jpg',
];

/* Merkt sich, ob es beim Einrichten schon einen alten Dienst gab.
   Nur wenn keiner da war, ist ein clients.claim() unbedenklich.
   ANGEFORDERT wird gesetzt, wenn die Seite die Uebernahme selbst verlangt hat. */
let ERSTER_DIENST = true;
let ANGEFORDERT = false;

self.addEventListener('install', (e) => {
  /* Kein skipWaiting: der neue Dienst bleibt wartend, bis die Seite ihn ruft.
     Jede Datei einzeln, damit ein 404 nicht die ganze Einrichtung verwirft. */
  ERSTER_DIENST = !self.registration.active;
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.all(SCHALE.map((u) => c.add(u).catch(() => null))),
    ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => {
        /* Gab es vorher schon einen Dienst und hat die Seite die Uebernahme
           nicht selbst verlangt, greift dieser hier nicht zu: er bedient die
           Seite ab dem naechsten Start. So entsteht kein controllerchange und
           damit kein ungefragtes Neuladen. */
        if (ERSTER_DIENST || ANGEFORDERT) return self.clients.claim();
        return undefined;
      })
      .catch(() => {}),
  );
});

/* Nachrichten der Seite */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.typ === 'uebernehmen') { ANGEFORDERT = true; self.skipWaiting(); }
  if (d.typ === 'fassung') {
    /* Die Seite fragt, welche Fassung dieser Dienst ausliefert. */
    const antwort = {typ: 'fassung', fassung: VERSION};
    if (e.ports && e.ports[0]) e.ports[0].postMessage(antwort);
    else if (e.source) e.source.postMessage(antwort);
  }
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
