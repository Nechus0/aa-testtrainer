# Einrichtung in einem anderen Claude-Konto

Dieses Paket enthält den kompletten Testtrainer für das schriftliche Auswahlverfahren des
Auswärtigen Amts (höherer Dienst, 1. September 2026) samt der Mechanik für den täglichen
Fragennachschub. Die Einrichtung dauert etwa zehn Minuten.

---

## Was in diesem Paket liegt

| Datei | Rolle |
|---|---|
| `Testtrainer_standalone.html` | **das Artefakt.** Eine einzige Datei, alle Fragen eingebaut, läuft ohne Internet |
| `Testtrainer.html` | dieselbe App, lädt die Fragen aus den beiden Pooldateien daneben |
| `standalone_bauen.py` | baut die Einzeldatei neu, wenn die Pools gewachsen sind |
| `fragenpool.js` | 225 Fachtestfragen, davon 150 Originalfragen 2019/2023 |
| `fragenpool_fr.js` | 61 Französischaufgaben, davon 7 amtliche Musteraufgaben |
| `fragen_ergaenzen.py` | hängt neue Fachtestfragen an, prüft und dedupliziert |
| `fragen_ergaenzen_fr.py` | dasselbe für Französisch, normalisiert die Typografie |
| `Anleitung_Tagesaufgabe.md` | die Arbeitsanweisung, nach der der tägliche Lauf arbeitet |
| `Tagesaufgabe_Prompt.txt` | der fertige Prompt und Zeitplan für die geplante Aufgabe |
| `Sprachtest_Franzoesisch_Musteraufgaben.pdf` | amtliche Vorgabe des AA, Stand 04.09.2025 |
| `Sprachtest_Franzoesisch_Leseprobe_Bewerbertrainer.pdf` | Zusatzmaterial zur Orientierung |
| `LIESMICH.md` | Kurzanleitung für die tägliche Nutzung |
| `pruefbericht.md` | Prüfbericht der automatisierten Tests |

---

## Schritt 1 · Ordner anlegen

Lege auf dem Rechner einen Arbeitsordner an, zum Beispiel

```
~/Dokumente/Testtrainer AA
```

und entpacke dieses Paket vollständig hinein. **Alle Dateien müssen zusammen in einem Ordner
bleiben** — `Testtrainer.html` sucht `fragenpool.js` und `fragenpool_fr.js` direkt daneben.

## Schritt 2 · Den PDF-Korpus mitnehmen

Ja — der Ordner vom Desktop wird gebraucht. Er ist die inhaltliche Quelle, aus der der tägliche
Lauf seine Fragen und die französischen Lesetexte baut.

```
AA-Vorbereitung-PDFs/     (108 PDFs, rund 704 MB, zehn Themenordner)
```

Kopiere ihn auf den anderen Rechner. **Ohne ihn läuft der Trainer trotzdem**, und auch der
tägliche Nachschub funktioniert weiter — nur zieht er die Inhalte dann aus Modellwissen und
Websuche statt aus deinen Heften. Die Anleitung beschreibt diesen Fall unter „Wenn der Korpus
fehlt".

**Wenn du nur einen Teil übertragen willst**, nimm diese sechs Ordner — sie tragen die Rotation:

| Ordner | wofür |
|---|---|
| `03_Recht_Grundgesetz_Grundrechte` | Grundgesetz, OpenRewi Staatsorganisationsrecht und Grundrechte |
| `05_Voelkerrecht_UNO_Sicherheitspolitik` | UN-Charta, Public International Law, Sicherheitsstrategie |
| `04_Europa_Europarecht` | EUV/AEUV, IzpB Europäische Union |
| `01_Geschichte` + `02_Politisches_System_Deutschland` | Geschichts- und Politikteil |
| `07_Volkswirtschaft_Finanzen` | Bundesbank, SVR-Jahresgutachten |
| `10_Musteraufgaben_Auswahlverfahren` | die amtlichen Fachtests und der Sprachtest |

Ordner `06` (Außenpolitik, Regionen) ist für die französischen Lesetexte sehr nützlich, `08` und
`09` sind entbehrlich.

## Schritt 3 · Ordner in Cowork verbinden

Im neuen Konto eine Cowork-Sitzung öffnen und über **„Ordner hinzufügen"** beide Ordner verbinden:

1. den Arbeitsordner aus Schritt 1
2. `AA-Vorbereitung-PDFs`

Ohne diese Verbindung kann der tägliche Lauf die Dateien weder lesen noch zurückschreiben.

## Schritt 4 · Pfade in der Anleitung eintragen

`Anleitung_Tagesaufgabe.md` öffnen. Ganz oben steht eine kleine Tabelle „Pfade — einmalig
anpassen". Dort die beiden tatsächlichen Pfade eintragen. Sonst ändert sich an der Datei nichts.

## Schritt 5 · Das Artefakt anlegen

In einer Cowork-Sitzung im neuen Konto:

> Lege `Testtrainer_standalone.html` aus meinem verbundenen Ordner als Artefakt an,
> mit der Kennung `aa-testtrainer`.

Claude legt das Artefakt in der Seitenleiste an. Alternativ genügt es völlig, `Testtrainer.html`
im Ordner doppelt anzuklicken — die App läuft im Browser ohne Konto und ohne Internet.

**Wichtig zum Fortschritt:** Die Ergebnisse liegen im lokalen Speicher des Browsers
beziehungsweise des Artefakts. Artefakt und lokale Datei führen **getrennte** Stände. Entscheide
dich für einen Weg. Vom alten Rechner nimmst du den Stand über **Daten → Exportieren** mit und
spielst ihn drüben über **Daten → Importieren** ein.

## Schritt 6 · Die geplante Aufgabe anlegen

Geplante Aufgaben lassen sich nicht zwischen Konten übertragen, sie müssen einmal neu angelegt
werden. `Tagesaufgabe_Prompt.txt` enthält alles dafür.

In einer Cowork-Sitzung im neuen Konto:

> Lege eine geplante Aufgabe an mit dem Namen „Testtrainer AA – täglicher Abschnitt",
> täglich um 06:00 Uhr deutscher Zeit, mit Push-Benachrichtigung.
> Als Prompt nimm wörtlich den Text aus `Tagesaufgabe_Prompt.txt` unterhalb der Trennlinie —
> und ersetze darin die beiden Pfade durch meine tatsächlichen Ordner.

Zeitplan technisch: `0 4 * * *` in UTC entspricht 06:00 Uhr deutscher Sommerzeit.

## Schritt 7 · Einmal zur Probe auslösen

Nicht bis zum nächsten Morgen warten:

> Führe die geplante Aufgabe „Testtrainer AA" jetzt einmal probeweise aus.

Der Lauf sollte enden mit einer Meldung wie „Tag N ergänzt um 75 Fragen … Pool gesamt: … Fragen".
Danach den Trainer im Browser neu laden — unter **Fachtests → Heute** und **Französisch → Heute**
muss der neue Abschnitt stehen.

---

## Wenn etwas nicht klappt

**Der Lauf findet die Anleitung nicht.** Der Arbeitsordner ist nicht verbunden, oder der Pfad im
Prompt stimmt nicht. Beides in Schritt 3 und 6 prüfen.

**Das Hilfsskript bricht mit FEHLER ab.** Das ist Absicht — es prüft Optionszahl, Lösungsindex,
Erläuterungslänge, Artikellänge und Dubletten. Der Lauf soll die Ursache beheben und erneut
starten. Niemals von Hand in `fragenpool.js` oder `fragenpool_fr.js` schreiben; die Skripte legen
vor jeder Änderung eine `.bak`-Kopie an.

**Morgens kommt nichts.** Zuerst prüfen, ob die geplante Aufgabe überhaupt noch existiert — sie
kann verschwinden. Dann, ob der Rechner nachts an und die Claude-App offen war. War er aus,
schickt der Lauf die beiden JSON-Dateien in den Chat; einspielen mit:

```
cd "<ARBEITSORDNER>"
python3 fragen_ergaenzen.py    fragenpool.js    neue_fragen.json
python3 fragen_ergaenzen_fr.py fragenpool_fr.js neue_fragen_fr.json
```

**Der Fortschritt ist weg.** Browserverlauf gelöscht oder Browser gewechselt. Deshalb einmal pro
Woche unter **Daten → Exportieren** sichern.

---

## Auf dem Handy nutzen

Cowork-Artefakte erscheinen nur in der Seitenleiste der Desktop-App, nicht auf dem Telefon. Für
das Handy nimmst du deshalb `Testtrainer_standalone.html` direkt — die Oberfläche ist für kleine
Bildschirme ausgelegt und braucht kein Internet.

1. Die Datei auf einen freien Statik-Hoster ziehen (Netlify Drop, GitHub Pages, Cloudflare Pages)
   oder in iCloud Drive beziehungsweise Google Drive legen.
2. Die Adresse auf dem Telefon öffnen.
3. Teilen → **Zum Home-Bildschirm**. Es gibt ein eigenes Symbol, und die App startet ohne
   Browserleiste.

Der Fortschritt liegt im Speicher des jeweiligen Browsers — Telefon und Rechner führen **getrennte
Stände**. Über **Daten → Exportieren** und **Importieren** lässt sich einer auf den anderen
übertragen.

Nach jedem nächtlichen Lauf baut die Aufgabe `Testtrainer_standalone.html` neu. Wer die
Telefonfassung aktuell halten will, lädt die Datei neu hoch; wer das nicht täglich tun mag, bleibt
einfach ein paar Tage hinterher — es fehlen dann nur die neuesten Fragen.

---

## Was der Trainer abbildet

**Drei Fachtests**, je 25 Fragen in 10 Minuten, vier Optionen, eine richtig — Völker-, Europa- und
Staatsrecht · Geschichte und Politik · Wirtschaft.

**Sprachtest Französisch** nach den amtlichen Musteraufgaben: 52 Fragen in 30 Minuten, 60 Punkte,
bestanden ab 30. Textverständnis 8 Fragen à 2 Punkte zu drei Zeitungsartikeln, Wortschatz und
Idiomatik 22 à 1 Punkt, Grammatik und Zeitformen 22 à 1 Punkt. Niveau B2.

Täglicher Nachschub: 75 Fachtestfragen und 25 Französischaufgaben, mit einer Sieben-Tage-Rotation
über den Stoff.
