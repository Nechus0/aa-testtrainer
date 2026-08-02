# Testtrainer · Auswahlverfahren höherer Auswärtiger Dienst

Prüfung: **Dienstag, 1. September 2026**, schriftlicher Teil online.

## Loslegen

`Testtrainer.html` doppelklicken. Die Datei öffnet sich im Browser und braucht kein Internet.
Wichtig: `Testtrainer.html`, `fragenpool.js` und `fragenpool_fr.js` müssen im **selben Ordner**
bleiben.

## Die drei Fachtests

Der Trainer bildet genau die drei Fachtests des schriftlichen Verfahrens nach — je 25 Fragen in
10 Minuten, vier Optionen, eine richtig.

| Fachtest | Bestand am Start |
|---|---|
| Völker-, Europa- und Staatsrecht | 75 |
| Geschichte und Politik | 75 |
| Wirtschaft | 75 |

Davon sind **150 Originalfragen** aus den vom Auswärtigen Amt veröffentlichten Fachtests 2019 und
2023. Die Lösungen der 2019er Tests sind gegen das amtliche Antwortraster geprüft; die 2023er
Rechtsfragen tragen die amtlichen Lösungen. Jede Frage hat eine Erläuterung.

## Trainingsmodi

- **Heute** — der Abschnitt, der in der Nacht neu erzeugt wurde, je Fachtest 25 Fragen mit Timer.
- **Vollsimulation** — drei Tests hintereinander, je 25 Fragen in 10 Minuten, zufällig aus dem
  gesamten Pool. Das ist der realistischste Durchgang.
- **Auswahlverfahren 2019 / 2023** — die veröffentlichten Bögen im Original.
- **Wiederholung** — alle Fragen, die du zuletzt falsch hattest. Der wirksamste Teil.
- **Zufallssatz je Fachtest** und **Nur neue Fragen** für gezieltes Üben.

Während eines Tests: Antwort anklicken springt weiter, über die Übersicht unten kommst du zurück,
mit ☆ markierst du Fragen zum Nochmal-Ansehen. Nach dem Auswerten steht zu jeder Frage die richtige
Lösung mit Erläuterung.

## Dashboard

Trefferquote gesamt und je Fachtest, Verlauf über die Tage, die schwächsten Themen und die letzten
Durchgänge. Der Countdown zählt bis zur Prüfung.

## Täglicher Nachschub

Jeden Morgen um 6 Uhr läuft eine automatische Aufgabe. Sie erzeugt 75 neue Fachtestfragen
(25 je Fachtest) für `fragenpool.js` und 25 neue Französischaufgaben für `fragenpool_fr.js` —
einen Zeitungsartikel mit drei Verständnisfragen, 11 Wortschatz- und 11 Grammatikfragen. Sie arbeitet mit den PDFs aus `Desktop/AA-Vorbereitung-PDFs` und
rotiert die Schwerpunkte, damit über die Wochen der ganze Stoff drankommt. Danach genügt es, den
Trainer im Browser neu zu laden.

Wenn du an einem Tag nichts Neues siehst: Seite mit ⌘R neu laden. Kommt trotzdem nichts, war der
Rechner nachts vermutlich aus — die Aufgabe schickt dann eine Nachricht in den Chat.

## Fortschritt

Deine Ergebnisse liegen im lokalen Speicher des Browsers, mit dem du die Datei geöffnet hast — sie
verlassen den Rechner nicht. Wenn du den Browser wechselst oder den Verlauf löschst, sind sie weg.
Unter **Daten** kannst du sie deshalb exportieren und wieder einspielen; es gibt dort auch einen
CSV-Export aller Antworten.

## Dateien

| Datei | Zweck |
|---|---|
| `Testtrainer.html` | die App |
| `fragenpool.js` | alle Fragen |
| `fragenpool_fr.js` | alle Französischaufgaben |
| `fragen_ergaenzen.py` | hängt neue Fachtestfragen an, prüft und dedupliziert |
| `fragen_ergaenzen_fr.py` | dasselbe für Französisch |
| `Anleitung_Tagesaufgabe.md` | Arbeitsanweisung für den nächtlichen Lauf |

Neue Fragen von Hand einspielen:

```
cd "~/Documents/Claude Projekte/Test Trainer"
python3 fragen_ergaenzen.py    fragenpool.js    neue_fragen.json
python3 fragen_ergaenzen_fr.py fragenpool_fr.js neue_fragen_fr.json
```

## Sprachtest Französisch

Der zweite Baustein ist da. Er bildet den amtlichen Sprachtest genau nach: **52 Fragen in
30 Minuten, 60 Punkte, bestanden ab 30**.

| Teil | Fragen | Punkte je Frage | empfohlene Zeit |
|---|---|---|---|
| Textverständnis | 8 zu drei Zeitungsartikeln | 2 | ca. 15 Min |
| Wortschatz und Idiomatik | 22 | 1 | ca. 7–8 Min |
| Grammatik und Zeitformen | 22 | 1 | ca. 7–8 Min |

Die **Vollsimulation** läuft mit einem gemeinsamen Zeitbudget von 30 Minuten über alle drei Teile,
so wie im Original, und sagt dir am Ende Punktzahl und bestanden oder nicht. Die vom Auswärtigen
Amt veröffentlichten Beispielaufgaben sind als eigener Durchgang enthalten. Einzelne Teile kannst
du auch für sich üben.

Niveau: B2, die zweite Prüfsprache. Frage und Antworten stehen auf Französisch, die Erläuterung
ist deutsch.
