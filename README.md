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

### Auswertung
Dashboard mit Trefferquote je Kategorie, Verlauf über die Tage, schwächsten
Themenfeldern und Fehlerarchiv. Jede Frage hat eine Erläuterung.

---

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html` | Gerüst und Gestaltung |
| `app.js` | gesamte Anwendungslogik |
| `supabase.js` | mitgelieferte Client-Bibliothek (keine Abhängigkeit von einem CDN) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Installation als App auf dem Telefon |

Fragen, Durchgänge, Antworten, Konten und Quellen liegen in einem
Supabase-Projekt (Postgres mit Zeilenschutz). Im Verzeichnis liegen keine
Prüfungsunterlagen und kein Fragenbestand.

### Datenbank

| Tabelle | Inhalt |
|---|---|
| `profile` | Konto, Rolle (`admin`/`nutzer`), Status (`wartend`/`aktiv`/`gesperrt`) |
| `einladung` | Einladungslinks, einmal einlösbar, mit Ablaufdatum |
| `frage` | Fachtestfragen |
| `fr_text`, `fr_frage` | Lesetexte und Aufgaben des Sprachtests |
| `durchgang`, `antwort` | Fortschritt je Konto |
| `quellenkategorie`, `quelle` | Quellenverzeichnis, Dateien im Cloudspeicher `quellen` |

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

**Als Administrator.** Zwei zusätzliche Bereiche:

- *Quellen* – Verzeichnis nach Sachgebieten, Umbenennen, Löschen, Hochladen
  neuer Dateien in den Cloudspeicher.
- *Nutzer* – Einladungslinks erzeugen, Rollen und Status ändern, Passwörter
  neu setzen, Konten löschen.

---

## Täglich neue Fragen

Eine geplante Aufgabe erzeugt jeden Morgen um 6 Uhr einen neuen Abschnitt
`Tag N`: 75 Fachtestfragen (25 je Kategorie) und einen vollständigen
Sprachtestsatz (3 Artikel, 8 + 22 + 22 Aufgaben). Sie schreibt unmittelbar in
die Datenbank; der neue Abschnitt erscheint in der Anwendung unter „Heute“.
Der Wortlaut der Aufgabe steht in `Anleitung_Tagesaufgabe.md`.

---

## Rechtlicher Hinweis

Die Originalprüfungen 2019 und 2023 sowie die Musteraufgaben zum Sprachtest
stammen vom Auswärtigen Amt und dienen ausschließlich der persönlichen
Prüfungsvorbereitung. Die Unterlagen selbst sind nicht Teil dieses
Verzeichnisses.
