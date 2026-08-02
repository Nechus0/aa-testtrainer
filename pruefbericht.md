# Prüfbericht Testtrainer · 2. August 2026

Geprüft wurde die Artefakt-Fassung (`Testtrainer_standalone.html`) automatisiert in Chromium:
vier Prüfsuiten mit 96 Einzelprüfungen, 53 vollständige Probedurchläufe über alle 18 Modi und
eine Hochrechnung auf den Bestand am Prüfungstag.

## Ergebnis

Alle Suiten laufen fehlerfrei durch, keine JavaScript-Fehler, kein Querlauf in irgendeiner
Ansicht, alle Punkt- und Trefferrechnungen stimmen mit dem erwarteten Wert überein.

## Sieben behobene Befunde

**1 · Sprachtest wäre ab morgen zu kurz gewesen (schwerwiegend).**
Das Textverständnis zog immer ganze Artikel. Solange der Startbestand einen Artikel mit zwei
Fragen enthält, ging die Rechnung auf. Sobald die tägliche Aufgabe nur noch Artikel mit drei
Fragen liefert — genau das ist vorgesehen —, hätte der vollständige Sprachtest **6 statt 8
Verständnisfragen, 50 statt 52 Fragen und 56 statt 60 Punkte** ergeben, und die Bestehensgrenze
von 30 hätte sich auf den falschen Höchstwert bezogen. Jetzt werden immer genau drei Artikel
gezogen und der letzte so weit gekürzt, dass exakt 8 Fragen herauskommen. Gegengeprüft mit einem
künstlichen Bestand aus lauter Drei-Fragen-Artikeln: 60 von 60 Ziehungen ergeben 8/22/22 und
60 Punkte.

**2 · Countdown fror beim Wechsel zwischen den Bereichen ein.**
Wurde ein Fachtest offen gelassen und danach ein Sprachtest gestartet, schrieb die Uhr in das
stehengebliebene Element des Fachtests. Der französische Countdown stand sichtbar still — die
Wertung lief zwar richtig, aber man sah die Restzeit nicht. Der jeweils andere Bereich wird jetzt
beim Start geräumt, und alle Abfragen innerhalb eines Durchgangs greifen nur noch auf den eigenen
Container zu.

**3 · Zeitablauf wertete nicht, solange man weggeklickt hatte.**
Wer während eines laufenden Tests aufs Dashboard wechselte, dessen Test wurde bei Zeitablauf nicht
gewertet, sondern erst bei der Rückkehr. Die Ablaufprüfung läuft jetzt unabhängig davon, ob die
Testansicht sichtbar ist.

**4 · Kennzahl „Bearbeitet" zählte falsch.**
Französische Antworten zählten im Zähler, aber nur die Fachtestfragen im Nenner — nach ein paar
Sprachtests stand dort „240 / 225" und „−15 noch nie gesehen". Die Kennzahl bezieht sich jetzt auf
den Gesamtbestand.

**5 · Bestehensurteil nur bei vollem Punktesatz.**
Das Urteil „Bestanden / Nicht bestanden" erscheint jetzt nur, wenn der Durchgang tatsächlich über
60 Punkte geht. Sicherung gegen falsche Aussagen bei unvollständigen Sätzen.

**6 · Freier Wechsel zwischen den Teilen des Sprachtests.**
Das Auswärtige Amt schreibt: „Sie können sich die Aufgaben zeitlich selbst einteilen." Bisher ging
es nur vorwärts. Jetzt führt in Teil 2 und 3 ein Knopf „← Teil 1" bzw. „← Teil 2" zurück, während
das gemeinsame 30-Minuten-Budget ununterbrochen weiterläuft. Die Fußzeile zeigt zusätzlich den
Gesamtstand über alle 52 Fragen.

**7 · Formatierung im Ergebnis.**
In der Teilübersicht klebten Bezeichnung und Punktzahl aneinander („TEXTVERSTÄNDNIS10/16 P.").

## Geprüfte Vorgaben

| Vorgabe | Quelle | Befund |
|---|---|---|
| Drei Fachtests, je 25 Fragen | Fachtests 2019/2023 | eingehalten, 40 Ziehungen |
| 10 Minuten je Fachtest, Timer startet je Teil neu | Fachtests 2019/2023 | eingehalten |
| Sprachtest 52 Fragen | AA-Musteraufgaben 09/2025 | eingehalten, 60 Ziehungen |
| 30 Minuten gemeinsam, kein Neustart je Teil | AA-Musteraufgaben | eingehalten |
| Textverständnis 8 Fragen à 2 Punkte, drei Artikel | AA-Musteraufgaben | eingehalten |
| Wortschatz und Grammatik je 22 Fragen à 1 Punkt | AA-Musteraufgaben | eingehalten |
| 60 Punkte, bestanden ab 30 | AA-Musteraufgaben | eingehalten |
| Vier Optionen, genau eine richtig | beide Vorlagen | alle 286 Aufgaben |

## Probedurchläufe

53 vollständige Durchgänge über alle 18 Modi, dreimal wiederholt, mit zufälliger Trefferquote und
absichtlich offen gelassenen Fragen. Bei jedem Durchgang wurden Fragenzahl, Trefferzahl und
Punktzahl gegen den erwarteten Wert geprüft — keine Abweichung. 1527 gespeicherte Antworten,
keine verwaisten Einträge, 170 kB Speicherbedarf.

Weiter geprüft: Markierungen, Rücksprung über die Übersicht, Abbruch ohne Speicherung, Erhalt des
laufenden Tests beim Ansichtswechsel, Fehlerarchiv über beide Bereiche, Wiederholung, Export und
Import mit Dublettenschutz, CSV-Ausgabe, Suche mit französischen Akzenten, Darstellung bei 1680,
1440, 1180 und 900 Pixeln Breite.

## Hochrechnung auf den Prüfungstag

30 Tageslieferungen wurden mit den echten Hilfsskripten eingespielt: **2475 Fachtestfragen** und
**811 Französischaufgaben** in 33 Blöcken, 1,24 MB und 0,35 MB. Die Datei lädt in 0,75 Sekunden,
alle Vorgaben gelten unverändert, „Heute" zeigt zuverlässig den neuesten Abschnitt, das Dashboard
bleibt bei fünf Themenfeldern.

## Bekannte Abweichung vom Original

Die Reihenfolge der drei Teile im Sprachtest ist fest (Textverständnis, Wortschatz, Grammatik).
Im echten Test kann man vermutlich frei springen. Mit dem neuen Rückwärtswechsel und dem
durchlaufenden Zeitbudget kommt der Trainer dem sehr nahe; eine völlig freie Navigation über alle
52 Fragen wäre der nächste Schritt, falls du das willst.
