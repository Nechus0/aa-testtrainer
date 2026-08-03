# Testtrainer · Höherer Auswärtiger Dienst

Übungstool für den schriftlichen Teil des Auswahlverfahrens des Auswärtigen Amts.
Prüfungstermin: **Dienstag, 1. September 2026**.

**Anwendung:** <https://nechus0.github.io/aa-testtrainer/>

Der Zugang ist geschützt. Konten entstehen ausschließlich über einen
Einladungslink, den ein Administrator in der Anwendung erzeugt.

---

## Was das Programm abbildet

### Fachtests
Drei Tests im Originalzuschnitt, je **25 Fragen in 10 Minuten**, vier
Antwortmöglichkeiten, genau eine richtig:

| Kategorie | Inhalt |
|---|---|
| Recht | Völker-, Europa- und Staatsrecht |
| Geschichte | Geschichte und Politik |
| Wirtschaft | Volkswirtschaft und Wirtschaftspolitik |

Enthalten sind die veröffentlichten Originalprüfungen 2019 und 2023 sowie
jeden Tag ein neuer Abschnitt.

### Sprachtest Französisch
Nach den amtlichen Musteraufgaben (Stand 04.09.2025): **52 Aufgaben in
30 Minuten, 60 Punkte, bestanden ab 30**, Niveau B2.

| Teil | Aufgaben | Punkte je Aufgabe | Richtzeit |
|---|---|---|---|
| Textverständnis | 8 (zu drei Artikeln) | 2 | ca. 15 Min |
| Wortschatz und Idiomatik | 22 | 1 | ca. 8 Min |
| Grammatik und Zeitformen | 22 | 1 | ca. 8 Min |

Die 30 Minuten sind ein gemeinsames Budget; die Einteilung übernimmt die
prüfende Person selbst – wie im Original.

### Aufbau der Anwendung
Vier Bereiche, auf dem Telefon und am Rechner gleich:

| Bereich | Inhalt |
|---|---|
| Übersicht | Countdown, die Aufgaben des Tages, Trefferquote je Kategorie, Verlauf, schwächste Themenfelder |
| Trainer | frei zusammengestellter Durchgang: Bereiche, Anzahl, Zeitdruck, „nur neue Fragen“, „Fehler wiederholen“, Markierungen, vollständige Prüfungssimulation |
| Fragen | der gesamte Bestand zum Nachschlagen, gefiltert nach Stand (alle / falsch / nie gesehen / richtig / markiert), Prüfungsteil und Abschnitt; darunter die Abdeckung des Lehrplans mit Aufstieg über Prüfungsteil → Oberfeld → Themenfeld |
| Mehr | Konto, Installation auf dem iPhone, Stand der täglichen Läufe – für Administratoren zusätzlich Quellen und Nutzer |

Geübt wird ausschließlich über die Übersicht (Aufgaben des Tages) und den
Trainer. „Fragen“ ist zum Nachschlagen da.

Jede Frage hat eine Erläuterung. Markierungen aus einem Durchgang bleiben
erhalten und sind im Bereich „Fragen“ wieder auffindbar.

---

## Aufbau

```
index.html               Gerüst und Gestaltung
app.js                   gesamte Anwendungslogik
sw.js                    Zwischenspeicher für den Betrieb ohne Netz
manifest.webmanifest     Angaben für die Installation auf dem Telefon
apple-touch-icon.png     Symbol für den Home-Bildschirm
bibliothek/              mitgelieferte fremde Bibliotheken
  supabase.js            Client der Datenbank
  pdf.mjs                pdf.js, nur beim Aufnehmen neuer Quellen geladen
  pdf.worker.mjs
symbole/                 Symbole der installierten App
  icon-192.png  icon-512.png  icon-maskable.png
doku/
  Anleitung_Tagesaufgabe.md   Wortlaut und Einrichtung der täglichen Aufgabe
```

`index.html`, `app.js`, `sw.js` und `manifest.webmanifest` müssen im
Wurzelverzeichnis bleiben: GitHub Pages liefert die Seite von dort aus, und der
Service Worker deckt nur ab, was unterhalb seines eigenen Ortes liegt.

Fragen, Durchgänge, Antworten, Konten und Quellen liegen in einem
Supabase-Projekt (Postgres mit Zeilenschutz). Im Verzeichnis liegen keine
Prüfungsunterlagen und kein Fragenbestand.

Die Quellen liegen ausschließlich als **Volltext** in der Datenbank; PDF-Dateien
werden nicht mehr gespeichert. Neue Quellen nimmt ein Administrator unter
*Mehr → Quellen → Quellen aufnehmen* auf: Datei wählen, Prüfungsteil und
Herkunft festlegen – der Text wird im Browser gewonnen (`pdf.mjs`) und
seitenweise nach `quelltext` geschrieben.

### Datenbank

| Tabelle | Inhalt |
|---|---|
| `profile` | Konto, Rolle (`admin`/`nutzer`), Status (`wartend`/`aktiv`/`gesperrt`) |
| `einladung` | Einladungslinks, einmal einlösbar, mit Ablaufdatum |
| `frage` | Fachtestfragen |
| `fr_text`, `fr_frage` | Lesetexte und Aufgaben des Sprachtests |
| `durchgang`, `antwort` | Fortschritt je Konto |
| `quellenkategorie`, `quelle` | Quellenverzeichnis: 261 Dokumente mit Herausgeber, Lizenz, Jahr und Einstufung |
| `quelltext` | 41 672 Seiten Volltext der Quellen, seitenweise, mit Volltextsuche je Sprache |
| `fr_material` | 5 321 Einträge für den Sprachtest: Presseartikel, Wortschatz, Wendungen, Terminologie, Konjugationen, Grammatikkatalog |
| `lehrplan` | 167 Themenfelder mit Gewicht; `lehrplan_stand` zeigt den Rückstand |

Der Zeilenschutz erlaubt jedem Konto ausschließlich die eigenen Ergebnisse.
Fragen sind für aktive Konten lesbar, Quellen und Konten nur für
Administratoren.

---

## Bedienung

**Anmelden.** E-Mail und Passwort. Wer noch kein Konto hat, öffnet den
Einladungslink oder trägt den Code unter „Einladung einlösen“ ein. Es werden
keine Bestätigungsmails verschickt.

**Auf dem iPhone installieren.** In Safari öffnen, auf *Teilen* tippen, dann
*Zum Home-Bildschirm*. Danach startet der Trainer mit eigenem Symbol ohne
Adressleiste. Die Fragen werden zwischengespeichert und stehen auch ohne Netz
zur Verfügung; Ergebnisse werden nachgereicht, sobald wieder Netz da ist.

**Als Administrator.** Unter *Mehr* erscheinen zwei zusätzliche Kacheln:

- *Quellen* – Verzeichnis nach Prüfungsteilen, Volltext nachlesen, Angaben
  bearbeiten, Quellen entfernen und über *Quellen aufnehmen* neue Dateien
  einlesen.
- *Nutzer* – Einladungslinks erzeugen, Rollen und Status ändern, Passwörter
  neu setzen, Konten löschen.

Die Kachel *Tägliche Fragen* zeigt jedem Konto, wann der letzte Abschnitt kam,
wann der nächste kommt und was bisher zusammengekommen ist.

---

## Täglich neue Fragen

Eine geplante Aufgabe erzeugt jeden Morgen um 6 Uhr einen neuen Abschnitt
`Tag N`: 75 Fachtestfragen (25 je Kategorie) und einen vollständigen
Sprachtestsatz (3 Artikel, 8 + 22 + 22 Aufgaben). Sie schreibt unmittelbar in
die Datenbank; der neue Abschnitt erscheint in der Anwendung unter „Heute“.
Der Wortlaut der Aufgabe steht in `doku/Anleitung_Tagesaufgabe.md`.

Welche Themenfelder drankommen, bestimmt der Lehrplan: die Aufgabe nimmt die
Felder mit dem größten Rückstand, sodass alle 167 Felder innerhalb von rund
30 Tagen wenigstens einmal abgedeckt sind. Jede Frage wird an einer Textstelle
aus `quelltext` belegt; Herausgeber und Titel stehen in der Erläuterung. Für
den Sprachtest liefert `fr_material` echte Presseartikel im Prüfungsumfang,
Korpusbelege für den Wortschatz und einen Grammatikkatalog mit zehn Kapiteln.

---

## Rechtlicher Hinweis

Die Originalprüfungen 2019 und 2023 sowie die Musteraufgaben zum Sprachtest
stammen vom Auswärtigen Amt und dienen ausschließlich der persönlichen
Prüfungsvorbereitung. Die Unterlagen selbst sind nicht Teil dieses
Verzeichnisses.
