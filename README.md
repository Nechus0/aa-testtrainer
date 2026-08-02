# Testtrainer · Auswahlverfahren höherer Auswärtiger Dienst

Übungstool für den schriftlichen Teil des Auswahlverfahrens des Auswärtigen Amts.
Prüfungstermin: **Dienstag, 1. September 2026**.

Eine einzelne HTML-Datei, kein Server, kein Internet, keine Abhängigkeiten. Dazu eine Mechanik,
die den Fragenbestand jede Nacht automatisch erweitert.

---

## Sofort loslegen

`Testtrainer_standalone.html` doppelklicken. Das ist die Einzeldatei mit eingebauten Fragen — sie
funktioniert überall, auch auf dem Telefon.

Wer den Bestand täglich wachsen lassen will, arbeitet mit `Testtrainer.html`; die Datei lädt die
Fragen aus `fragenpool.js` und `fragenpool_fr.js` direkt daneben. Beide Fassungen sind
inhaltsgleich; `standalone_bauen.py` erzeugt die Einzeldatei aus den anderen dreien.

---

## Was abgebildet wird

### Drei Fachtests

Je 25 Fragen in 10 Minuten, vier Optionen, genau eine richtig — so wie in den veröffentlichten
Bögen 2019 und 2023.

| Fachtest | Bestand |
|---|---|
| Völker-, Europa- und Staatsrecht | 75 |
| Geschichte und Politik | 75 |
| Wirtschaft | 75 |

Davon sind **150 Originalfragen** aus den amtlichen Fachtests. Die Lösungen der 2019er Bögen sind
gegen das amtliche Antwortraster geprüft — 74 von 75 unabhängig hergeleiteten Lösungen stimmen
überein. Zu jeder Frage gibt es eine Erläuterung.

### Sprachtest Französisch

Nach den amtlichen Musteraufgaben (Stand 04.09.2025): **52 Fragen in 30 Minuten, 60 Punkte,
bestanden ab 30.**

| Teil | Fragen | Punkte je Frage | empfohlene Zeit |
|---|---|---|---|
| Textverständnis | 8 zu drei Zeitungsartikeln | 2 | ca. 15 Min |
| Wortschatz und Idiomatik | 22 | 1 | ca. 7–8 Min |
| Grammatik und Zeitformen | 22 | 1 | ca. 7–8 Min |

Die Vollsimulation läuft mit einem gemeinsamen Zeitbudget über alle drei Teile, man kann zwischen
ihnen hin- und herwechseln, und am Ende steht Punktzahl und Bestehensurteil. Niveau B2.

### Trainingsmodi

Tagespaket · Vollsimulation · die Originalprüfungen 2019 und 2023 · Wiederholung der eigenen
Fehler · Zufallssätze je Fachtest · nur neue Fragen. Dazu ein Dashboard mit Trefferquote je
Fachtest, Verlauf, schwächsten Themenfeldern und Countdown.

---

## Täglicher Nachschub

Eine geplante Aufgabe erzeugt jede Nacht **75 Fachtestfragen** und **25 Französischaufgaben** —
einen Zeitungsartikel mit drei Verständnisfragen, elf Wortschatz- und elf Grammatikfragen — und
hängt sie über die beiden Hilfsskripte an die Pooldateien an.

- `Anleitung_Tagesaufgabe.md` — die vollständige Arbeitsanweisung: Ablauf, Stilregeln, Quellen,
  Niveaukorridor, Sieben-Tage-Themenrotation, JSON-Formate
- `Tagesaufgabe_Prompt.txt` — der fertige Prompt samt Zeitplan
- `EINRICHTUNG.md` — Einrichtung in einem anderen Konto oder auf einem anderen Rechner

Die Hilfsskripte prüfen jede Lieferung, bevor sie sie annehmen: Optionszahl, Lösungsindex,
Erläuterungslänge, Artikellänge, Dubletten. Bei Verstoß brechen sie mit `FEHLER` ab und schreiben
nichts. Vor jeder Änderung legen sie eine `.bak`-Kopie an.

```
python3 fragen_ergaenzen.py    fragenpool.js    neue_fragen.json
python3 fragen_ergaenzen_fr.py fragenpool_fr.js neue_fragen_fr.json
python3 standalone_bauen.py
```

---

## Aufbau

| Datei | Rolle |
|---|---|
| `Testtrainer.html` | die App |
| `Testtrainer_standalone.html` | Einzeldatei mit eingebauten Fragen, fürs Telefon und als Artefakt |
| `fragenpool.js` | Fachtestfragen |
| `fragenpool_fr.js` | Französischaufgaben, getrennt nach Lesetexten und Einzelfragen |
| `fragen_ergaenzen.py` · `fragen_ergaenzen_fr.py` | hängen neue Aufgaben an, prüfen, deduplizieren |
| `standalone_bauen.py` | baut die Einzeldatei |
| `Anleitung_Tagesaufgabe.md` | Arbeitsanweisung für den nächtlichen Lauf |
| `EINRICHTUNG.md` | Umzug in ein anderes Konto, Nutzung auf dem Telefon |
| `musteraufgaben/` | die amtlichen Prüfungsunterlagen als Beleg |
| `tests/` | Prüfsuiten (Playwright) |
| `pruefbericht.md` | Bericht des letzten vollständigen Prüflaufs |

### Datenformat

```jsonc
// fragenpool.js  →  window.AA_FRAGEN
{ "id": "R-T01-03", "kategorie": "recht", "block": "Tag 1",
  "thema": "Völkerrecht – Rechtsquellen", "frage": "…",
  "optionen": ["…","…","…","…"], "loesung": 1, "erlaeuterung": "…", "schwierigkeit": 2 }

// fragenpool_fr.js  →  window.AA_FR_TEXTE (Lesetexte mit ihren Fragen)
//                      window.AA_FR_FRAGEN (Wortschatz und Grammatik)
```

Der Fortschritt liegt im `localStorage` des Browsers unter `aa_testtrainer_v1` und verlässt das
Gerät nicht. Unter **Daten** lässt er sich als JSON exportieren und wieder einspielen, dazu gibt
es einen CSV-Export aller Antworten.

---

## Prüfen

```
npm install playwright && npx playwright install chromium
node tests/suite.mjs && node tests/suite2.mjs && node tests/suite3.mjs && node tests/soak.mjs
```

96 Einzelprüfungen, 53 vollständige Probedurchläufe über alle 18 Modi, Darstellungskontrolle von
320 bis 1680 Pixel Breite und eine Hochrechnung auf den Bestand am Prüfungstag. Einzelheiten in
`tests/LIESMICH.md` und `pruefbericht.md`.

---

## Rechte an den Inhalten

Dieses Repository ist **privat** und für den persönlichen Gebrauch gedacht.

- `musteraufgaben/` enthält die vom Auswärtigen Amt veröffentlichten Prüfungsunterlagen sowie eine
  Leseprobe eines kommerziellen Bewerbertrainers. Beides sind fremde Werke und werden hier nur als
  Beleg mitgeführt — nicht weiterverbreiten.
- Die 150 Originalfragen in `fragenpool.js` stammen aus diesen amtlichen Bögen.
- Die übrigen Fragen und alle französischen Lesetexte sind eigens erstellt. Die Lesetexte tragen
  bewusst keine Zuschreibung an eine reale Zeitung.
