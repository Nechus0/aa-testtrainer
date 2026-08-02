# Anleitung für die tägliche Aufgabe

Diese Datei ist die Arbeitsanweisung für den automatischen Lauf, der jeden Morgen einen neuen
Abschnitt für den Testtrainer erzeugt. Sie wird von einer frischen Sitzung ohne Vorwissen gelesen —
alles Nötige steht hier.

---

## Ziel

Pro Lauf zwei Lieferungen:

**A — Fachtests: 75 neue Prüfungsfragen**, 25 je Kategorie `recht`, `geschichte`, `wirtschaft`.
Anhängen an `fragenpool.js`. Der Trainer zeigt sie unter **Fachtests → Heute**.

**B — Sprachtest Französisch: 25 neue Aufgaben** — ein Zeitungsartikel mit drei Verständnisfragen,
11 Wortschatzfragen, 11 Grammatikfragen. Anhängen an `fragenpool_fr.js`. Der Trainer zeigt sie
unter **Französisch → Heute**. Die Einzelheiten stehen weiter unten im eigenen Abschnitt.

Beide Lieferungen bekommen denselben Blocknamen „Tag N".

Es gibt **genau drei Kategorien**, sie entsprechen den drei Fachtests des schriftlichen
Auswahlverfahrens:

| Schlüssel | Fachtest |
|---|---|
| `recht` | Fachtest in Völker-, Europa- und Staatsrecht |
| `geschichte` | Fachtest in Geschichte und Politik |
| `wirtschaft` | Fachtest in Wirtschaft |

Eine Kategorie „allgemein" gibt es **nicht**; entsprechende Inhalte (internationale Organisationen,
aktuelle Außenpolitik, Berufsbild des Auswärtigen Dienstes) werden in die drei Fachtests
eingeordnet. Das Hilfsskript weist jede andere Kategorie zurück.

**Prüfungstermin: Dienstag, 1. September 2026** (schriftliches Auswahlverfahren, online).
Ab dem Vortag ist der Lauf gegenstandslos.

---

## Dateien

Ordner auf dem Gerät: `/Users/joschapocha/Documents/Claude Projekte/Test Trainer`

| Datei | Rolle |
|---|---|
| `Testtrainer.html` | die App. **Nie ändern.** |
| `fragenpool.js` | der Fragenbestand. Wird ergänzt, nie umgeschrieben. |
| `fragenpool_fr.js` | der französische Bestand. Wird ergänzt, nie umgeschrieben. |
| `fragen_ergaenzen.py` | Hilfsskript für die Fachtests. Immer benutzen, nie von Hand editieren. |
| `fragen_ergaenzen_fr.py` | Hilfsskript für Französisch. Immer benutzen, nie von Hand editieren. |
| `standalone_bauen.py` | baut die Einzeldatei fürs Telefon. Nach jedem Lauf ausführen. |
| `Testtrainer_standalone.html` | Einzeldatei mit eingebauten Fragen, fürs Telefon und als Artefakt |
| `Anleitung_Tagesaufgabe.md` | diese Datei |

Quellenkorpus: `/Users/joschapocha/Desktop/AA-Vorbereitung-PDFs` — 108 PDFs in zehn Themenordnern
(bpb-Hefte, OpenRewi-Lehrbücher, Grundgesetz, EUV/AEUV, UN-Charta, Bundesbank, SVR-Gutachten,
Nationale Sicherheitsstrategie, amtliche Fachtests 2019/2023). `00_README.md` dort beschreibt den
Bestand.

---

## Ablauf

0. **Tagesnummer N bestimmen.** Sie steuert die Themenrotation und muss vor dem Schreiben
   feststehen. Maßgeblich ist der Fachtestpool, damit beide Lieferungen dieselbe Rotation
   verwenden:
   ```
   python3 -c "import json,re;d=json.loads(re.search(r'window\.AA_FRAGEN\s*=\s*(\[.*\])\s*;\s*$',open('fragenpool.js',encoding='utf-8').read(),re.S).group(1));print(max([int(q['block'].split()[-1]) for q in d if q['block'].startswith('Tag ')]+[0])+1)"
   ```
   Die Blocknamen vergeben die Skripte anschließend selbst; sollten die beiden Pools einmal
   auseinanderlaufen, gilt für die Rotation die Zahl aus dem Fachtestpool.
1. **Bestand lesen.** `fragenpool.js`, `fragenpool_fr.js` und beide Hilfsskripte stagen. Aus den
   Pools die letzten zwei Tagesblöcke und alle `thema`-Werte ziehen — sie sagen, was schon dran
   war. **Tag 1 ist die Erstbefüllung und kein Maßstab für die Tagesmenge**: dort stehen im
   Französischen drei Artikel und 50 Einzelfragen. Maßgeblich ist allein das Tagespensum unten.
2. **Quellen wählen.** Zwei bis vier PDFs aus dem Korpus nach der Rotation unten stagen und gezielt
   lesen (Inhaltsverzeichnis, dann die einschlägigen Seiten — nicht ganze Bände).
3. **Fragen schreiben.** 25 je Kategorie nach den Stilregeln unten.
4. **Prüfen.** Jede Frage gegenlesen: Ist die markierte Option wirklich die einzige richtige?
   Stimmt das Normzitat? Stimmt die Größenordnung? Bei aktuellen Fakten per Websuche verifizieren.
   Im Zweifel die Frage streichen und durch eine zeitlose ersetzen — **eine falsche Frage ist
   schlimmer als eine fehlende.**
5. **Französisch erzeugen.** In einem Zug alle drei Quellen stagen — amtliche Musteraufgaben,
   Leseprobe, das Korpusheft der Französisch-Rotation für N — und dann nach dem Abschnitt
   „Sprachtest Französisch" weiter unten arbeiten. Die genauen Pfade stehen dort.
6. **Anhängen.**
   ```
   python3 fragen_ergaenzen.py    fragenpool.js    neue_fragen.json
   python3 fragen_ergaenzen_fr.py fragenpool_fr.js neue_fragen_fr.json
   ```
   Die Skripte vergeben Block und IDs, verwerfen Dubletten, validieren und legen ein `.bak` an.
   Bricht eines mit FEHLER ab: Ursache beheben und erneut laufen lassen — **nie** von Hand in
   die Pooldateien schreiben.
7. **Zurückschreiben.** `fragenpool.js` und `fragenpool_fr.js` mit `SendUserFile` +
   `device_commit_files` zurück in den Ordner `Test Trainer` legen (`force: true`, da die Dateien
   dort ersetzt werden).
9. **Melden.** Kurze Nachricht: Tagesnummer, Fragenzahl je Kategorie und für Französisch,
   Themenschwerpunkte, Poolgröße gesamt, verbleibende Tage bis zum 1. September.
   Keine langen Erklärungen.

**Wenn das Gerät nicht erreichbar ist:** Aufgaben trotzdem erzeugen, `neue_fragen.json` und
`neue_fragen_fr.json` per `SendUserFile` schicken und in der Nachricht sagen, dass sie manuell mit
den beiden Hilfsskripten eingespielt werden müssen. Für den Französischteil liegt eine Kopie der
amtlichen Musteraufgaben zusätzlich im Arbeitsordner
(`Test Trainer/Sprachtest_Franzoesisch_Musteraufgaben.pdf`); ist auch die nicht erreichbar, dient
der Block „AA-Musteraufgaben" im Pool als Ersatzmaßstab — er enthält dieselben sieben amtlichen
Aufgaben im Wortlaut.

---

## Stilregeln — verbindlich

Maßstab sind die amtlichen Fachtests 2019 und 2023, die im Pool unter den Blöcken
„Original 2019" und „Original 2023" liegen. **Vor dem Schreiben ein Dutzend davon lesen.**

- **Genau vier Optionen**, genau eine richtig.
- Fragestamm **kurz**, ein bis drei Zeilen. Keine Fallvignetten, keine Rechenaufgaben.
- Optionen kurz und **parallel gebaut**; im Recht dürfen sie ein bis zwei Zeilen lang sein.
- Im Original steht rechnerisch **eine Frage pro 24 Sekunden** — der Zuschnitt muss dazu passen.
- Fragetypen mischen: Definition · Normzuordnung mit echter Artikelnummer · Institutionenzuordnung ·
  Negativfrage („Was beschreibt – kein – …?", 2–3 pro 25er-Satz) · Größenordnung mit plausiblen
  Nachbarwerten · Jahreszahl · Amtsträger · Aussagenprüfung (Stichwort als `thema`, vier
  Behauptungssätze, eine trifft zu — das Format des Geschichtstests 2023).
- **Distraktoren plausibel**: echte Institutionen, benachbarte Artikel, nahe Jahreszahlen.
- Richtige Antwort **nicht systematisch die längste**; Lösungen gleichmäßig über A/B/C/D
  (keine Position häufiger als 9 von 25).
- Amtliche Terminologie: VN-Charta, IGH, IStGH, EUV/AEUV, EMRK, EGMR, BVerfG, AWZ, ius cogens …
- Zuschnitt: **Grundkenntnisse mit außenpolitischem Bezug**, nicht Examensrecht.
- **Keine Wiederholung** vorhandener Fragen. Ein Thema darf wiederkehren, wenn es aus einem anderen
  Blickwinkel gefragt wird.
- Schwierigkeit im Satz mischen: etwa 8 × Stufe 1, 12 × Stufe 2, 5 × Stufe 3.

### Erläuterung
Zu jeder Frage zwei bis vier Sätze: warum die Lösung richtig ist, und wo lehrreich, warum der
naheliegendste Distraktor falsch ist. Norm oder Quelle nennen, wo es passt. Das ist der eigentliche
Lernwert.

### Format `neue_fragen.json`
Array von Objekten, kein Codefence, valides JSON. Felder `block` und `id` **weglassen** — die
vergibt das Skript.

```json
[
  {
    "kategorie": "recht",
    "thema": "Völkerrecht – Rechtsquellen",
    "frage": "In welcher Norm werden nach allgemeiner Auffassung die wichtigsten Rechtsquellen des Völkerrechts aufgezählt?",
    "optionen": ["Art. 5 S. 2 Römisches Statut", "Art. 38 Abs. 1 IGH-Statut", "Art. 92 VN-Charta", "Art. 2 Abs. 1 WVRK"],
    "loesung": 1,
    "erlaeuterung": "Art. 38 Abs. 1 IGH-Statut nennt Verträge, Völkergewohnheitsrecht und allgemeine Rechtsgrundsätze als Hauptrechtsquellen sowie Judikatur und Lehre als Hilfsmittel. Art. 92 VN-Charta errichtet den IGH nur als Hauptorgan.",
    "schwierigkeit": 2
  }
]
```

---

## Themenrotation

Damit über die Wochen der ganze Stoff drankommt, richtet sich der Schwerpunkt nach der Tagesnummer
modulo 7. Die übrigen Themen der Kategorie bleiben beigemischt — der Schwerpunkt stellt nur etwa
die Hälfte des jeweiligen Satzes.

| N mod 7 | Recht | Geschichte und Politik | Wirtschaft |
|---|---|---|---|
| 0 | Rechtsquellen, WVRK, Staatenverantwortlichkeit | Wiener Kongress bis Reichsgründung | Mikroökonomie, Marktformen, Wettbewerbsrecht |
| 1 | VN-Charta, Sicherheitsrat, Gewaltverbot, Peacekeeping | Kaiserreich, Imperialismus, Erster Weltkrieg | VGR, BIP, Konjunktur, Arbeitsmarkt |
| 2 | Diplomaten- und Konsularrecht (WÜD/WÜK) | Weimar, Versailles, Völkerbund | Geldpolitik, EZB, Inflation, Bankenaufsicht |
| 3 | EU-Organe, Rechtsakte, Gesetzgebungsverfahren | NS-Außenpolitik, Zweiter Weltkrieg | Außenwirtschaft, Zahlungsbilanz, WTO, Handelspolitik |
| 4 | EuGH-Rechtsprechung, Grundfreiheiten, Art. 7 EUV | Gründung BRD/DDR, Westintegration, Kalter Krieg | Steuern, Bundeshaushalt, Schuldenbremse, Föderalismus |
| 5 | Staatsrecht mit Außenbezug: Art. 23/24/25/32/59 GG | Neue Ostpolitik, KSZE, europäische Integration | IWF, Weltbank, BIZ, OECD, EIB, Entwicklungsfinanzierung |
| 6 | Menschenrechte, EMRK/EGMR, humanitäres Völkerrecht | Dekolonisierung, 1989/91, Zwei-plus-Vier, aktuelle Krisen | EU-Binnenmarkt, Währungsunion, Fiskalregeln, Energie/Klima |

Passende Quellenordner: `03`/`05` für Recht, `01`/`02`/`06` für Geschichte und Politik,
`07` für Wirtschaft, `04` für Europarecht in Recht und Wirtschaft, `08`/`09` als Beimischung.

Aktuelle internationale Politik, Organisationen und das Berufsbild des Auswärtigen Dienstes gehören
in die Kategorie `geschichte` (Politik-Anteil); internationale Finanzinstitutionen in `wirtschaft`.

---

## Sprachtest Französisch

### Quellen — vor dem Schreiben stagen und lesen

Alle Pfade auf dem Gerät. Mit `mcp__remote-devices__device_stage_files` holen.

**Verbindlich bei jedem Lauf:**

`/Users/joschapocha/Desktop/AA-Vorbereitung-PDFs/10_Musteraufgaben_Auswahlverfahren/Sprachtest_Franzoesisch_Musteraufgaben.pdf`

Das sind die amtlichen Musteraufgaben des Auswärtigen Amts (Stand 04.09.2025) mit Aufbau,
Punkteschlüssel und je zwei bis drei Beispielaufgaben pro Teil. **Jedes Mal neu lesen**, nicht aus
dem Gedächtnis arbeiten. Dieselben Aufgaben liegen im Pool unter dem Block „AA-Musteraufgaben" —
sie sind der einzige verbindliche Maßstab für Frageformat, Satzlänge und Anspruch.

**Als Anregung, nie zum Abschreiben:**

`…/10_Musteraufgaben_Auswahlverfahren/Sprachtest_Franzoesisch_Leseprobe_Bewerbertrainer.pdf`

Leseprobe eines kommerziellen Bewerbertrainers mit Lückentexten aus früheren Prüfungsunterlagen
(u. a. eine Rede von Jacques Chirac vor der VN-Generalversammlung, eine AFP-Meldung zu einer
Geiselbefreiung in Somalia). Das **Aufgabenformat dort ist ein anderes** (Lückentext mit
Wortliste) und darf nicht übernommen werden. Nutze die Datei nur für zweierlei: als Beleg für die
thematische Bandbreite (Gesundheitspolitik, Entwicklungsfinanzierung, Konsularfälle, Piraterie,
internationale Organisationen) und als Fundgrube für Vokabular und Wendungen, die im Auswärtigen
Dienst tatsächlich vorkommen. Keine Sätze wörtlich übernehmen.

**Inhaltlicher Steinbruch für die Textverständnis-Artikel:** der übrige Korpus in
`/Users/joschapocha/Desktop/AA-Vorbereitung-PDFs`. Die Artikel sollen über Sachverhalte handeln,
die Joscha ohnehin lernt — dann trainiert der Sprachtest zweimal. Nimm nach der Rotation unten
zwei bis drei Seiten aus einem passenden Heft, verstehe den Sachverhalt und **formuliere daraus
einen eigenen französischen Presseartikel**. Nichts übersetzen, nichts zitieren — der Text muss
klingen, als stünde er in Le Monde, nicht als sei er aus dem Deutschen übertragen.

### Amtliche Vorgabe

52 Fragen in **30 Minuten**, **60 Punkte**, bestanden ab **30**. Drei Teile, jede Frage mit genau
vier Optionen und genau einer richtigen Antwort:

| Teil | Fragen | Punkte je Frage | empfohlene Zeit |
|---|---|---|---|
| Textverständnis | 8 (zu drei kurzen Zeitungsartikeln) | 2 | ca. 15 Min |
| Wortschatz/Idiomatik | 22 | 1 | ca. 7–8 Min |
| Grammatik/Zeitformen | 22 | 1 | ca. 7–8 Min |

### Tagespensum

- **ein** Zeitungsartikel von 90–150 Wörtern mit **drei** Verständnisfragen
- **11** Wortschatzfragen
- **11** Grammatikfragen

Der Trainer stellt die Vollsimulation aus dem Gesamtbestand zusammen und nimmt dafür immer drei
Artikel und genau acht Verständnisfragen. Liefere deshalb konsequent **drei** Fragen pro Artikel.
Das Skript ließe zwei bis vier zu — diese Spanne ist nur ein Sicherheitsnetz, nicht die Vorgabe.

**Schwierigkeitsverteilung** je 11er-Satz: etwa 3 × Stufe 1, 6 × Stufe 2, 2 × Stufe 3. Beim
Textverständnis eine leichte, eine mittlere, eine anspruchsvolle Frage.

**Wenn das Rotationsthema schon dran war:** dasselbe Sachfeld ist erlaubt, aber nur aus einem
anderen Blickwinkel — anderer Akteur, andere Ebene, andere Streitfrage. Wörtliche oder inhaltliche
Wiederholung eines vorhandenen Artikels nicht.

### Niveau — B2, mit Ausschlägen nach B2+

Französisch ist die zweite Prüfsprache; die Ausschreibung verlangt „sehr gute Kenntnisse … in
etwa Stufe B2". Das ist der Zielkorridor, und er wird nach beiden Seiten oft verfehlt.

**Zu leicht — nicht aufnehmen:** Präsens-Konjugation regelmäßiger Verben, Artikel und Genus,
Zahlen, Uhrzeit, direkte Übersetzungspaare, Alltagswortschatz (*manger, la voiture, aller à*),
Fragen, die man aus dem Deutschen erraten kann.

**Richtig — der Korridor:** subjonctif nach Wertung und Zweifel, Bedingungssätze aller drei Typen,
concordance des temps, Pronomen `y`, `en`, `dont`, `lequel`, Rektion von Verben und Adjektiven,
participe passé mit Angleichung, gérondif; im Wortschatz Presse- und Verwaltungssprache mit
Kollokationen (*faire l'objet de, à l'issue de, se heurter à, au détriment de, prendre acte de*).

**Zu schwer — nicht aufnehmen:** passé simple und imparfait du subjonctif in aktiver Verwendung,
literarische Stilfiguren, Fachjargon einzelner Rechtsgebiete, regionale oder umgangssprachliche
Wendungen, Wortspiele, alles, was ein gebildeter Muttersprachler erst nachschlagen müsste.

**Prüfmaß am Text:** Sätze im Artikel im Schnitt 15–25 Wörter, höchstens ein Nebensatz zweiten
Grades; Tempora im Wesentlichen présent, passé composé, imparfait, futur, conditionnel; ein bis
zwei anspruchsvolle Wendungen pro Artikel, nicht mehr.

**Sprachliche Korrektheit hat Vorrang vor Menge.** Jeden französischen Satz einzeln gegenlesen:
Akzente, Genus, Rektion, Zeichensetzung. Bei der geringsten Unsicherheit umformulieren oder die
Frage streichen. Das Hilfsskript normalisiert Apostroph und geschütztes Leerzeichen selbst.

### Inhalt der Teile

**Textverständnis** — eigenständig formulierter Artikel im Presseton. Die Quellenangabe folgt der
Form des amtlichen Musters („D'après …"), nennt aber **keine reale Zeitung**, weil der Text
erfunden ist: „D'après la presse européenne", „D'après la presse économique française",
„D'après la presse régionale française". Fragetypen wie im amtlichen Muster: „Quelle phrase résume le mieux cet
article ?", Satzanfang zum sinngemäßen Fortsetzen („Les entreprises productrices de batteries en
France : …"), „Que signifie l'expression … dans ce contexte ?". Die Distraktoren müssen im Text
verankert und trotzdem falsch sein — richtiges Wort, falscher Bezug; Teilaussage, die zu weit
geht; Aussage, die der Text nicht trifft. Keine Frage darf allein aus Weltwissen beantwortbar
sein.

**Wortschatz/Idiomatik** — Lückensatz mit „…", vier Wörter derselben Wortart. Schwerpunkt Rektion
und Kollokation. Mischung **im Tagessatz von 11 Aufgaben**: etwa 6 Verben oder Verbalausdrücke,
2 Substantive oder Adjektive, 3 idiomatische Wendungen. Die Distraktoren sind reale, gebräuchliche Wörter, die im gegebenen Satz eindeutig
falsch sind — Kontext so bauen, dass wirklich nur eine Option passt.

**Grammatik/Zeitformen** — Lückensatz mit vier Formen. Schwerpunkte siehe Niveaukorridor oben.
Mindestens eine Frage mit **Doppellücke**, bei der alle vier Optionen vollständige Formenpaare
sind. Beispielsätze aus der Welt des Auswärtigen Dienstes — Verhandlungen, Delegationen,
Botschaften, Konsularfälle, Gipfel —, keine Schulbuchsätze.

### Themenrotation Französisch

Die Artikel folgen derselben Tagesnummer wie die Fachtests. Quelle ist jeweils ein Heft aus dem
Korpus; daraus wird ein eigener französischer Artikel geschrieben.

| N mod 7 | Thema des Artikels | Steinbruch im Korpus |
|---|---|---|
| 0 | Europäische Integration, Erweiterung, Institutionen | `04_Europa_Europarecht` — IzpB 345, „Die EU in 12 Lektionen" |
| 1 | Vereinte Nationen, Friedensmissionen, humanitäre Hilfe | `05_Voelkerrecht_UNO_Sicherheitspolitik` — IzpB 363 |
| 2 | Außenhandel, Lieferketten, Industriepolitik | `07_Volkswirtschaft_Finanzen` — SVR-Jahresgutachten |
| 3 | Sicherheitspolitik, Rüstungskontrolle, NATO | `05_…` — Nationale Sicherheitsstrategie 2023, Friedensgutachten |
| 4 | Klima, Energie, Entwicklungszusammenarbeit | `06_Aussenpolitik…` — IzpB 347 Klima |
| 5 | Gesellschaft, Migration, Demografie, Kultur | `07_…`/`08_…` — Sozialbericht, IzpB 350 |
| 6 | Regionen und Partner: China, Indien, Türkei, Naher Osten, USA | `06_Aussenpolitik…` — IzpB 337, 335, 356, 331, 349 |

Der Wortschatzsatz nimmt dasselbe Sachfeld auf, damit Text und Vokabeln zusammenpassen. Der
Grammatiksatz bleibt thematisch frei, bedient sich aber derselben Berufswelt.

### Format `neue_fragen_fr.json`

```json
{
  "texte": [
    {
      "titel": "Élargissement de l'Union : le soutien sans le calendrier",
      "quelle": "D'après lemonde.fr",
      "text": "Réunis à Bruxelles, les ministres … (90–150 Wörter)",
      "fragen": [
        {"frage": "Quelle phrase résume le mieux cet article ?",
         "optionen": ["…", "…", "…", "…"], "loesung": 1,
         "erlaeuterung": "Der Artikel betont durchgehend …"}
      ]
    }
  ],
  "fragen": [
    {"teil": "wortschatz", "thema": "Verben – Rektion",
     "frage": "La Chine … des composants électroniques aux entreprises européennes.",
     "optionen": ["délibère", "ravitaille", "fournit", "renseigne"], "loesung": 2,
     "erlaeuterung": "«fournir qc à qn» ist die passende Konstruktion …", "schwierigkeit": 2}
  ]
}
```

Felder `id` und `block` weglassen — die vergibt das Skript. Ein `"stand": "JJJJ-MM"` bleibt
erhalten und gehört an jede Aufgabe mit veränderlichem Sachbezug.

**Was das Skript hart prüft** (Abbruch mit FEHLER):

- genau vier Optionen, keine leere, keine doppelte
- `loesung` als Index 0–3
- Erläuterung mindestens 60 Zeichen
- Lückensatz bei Wortschatz und Grammatik enthält „…"
- `teil` nur `wortschatz` oder `grammatik`
- Artikel 70–180 Wörter (Zielkorridor bleibt 90–150)
- zwei bis vier Fragen je Artikel (Vorgabe bleibt genau drei)
- Artikeltitel noch nicht vergeben

**Was das Skript still bereinigt:** Apostroph auf ’, schmales geschütztes Leerzeichen vor
`? ! : ;` und in « », doppelte Leerzeichen. Wortschatz- und Grammatikfragen mit einem bereits
vorhandenen Fragestamm werden übersprungen und in der Bilanz genannt.

### Kontrolle vor dem Anhängen

1. Genau ein Artikel mit genau drei Fragen, 11 Wortschatz-, 11 Grammatikfragen.
2. Artikel 90–150 Wörter, eigenständig formuliert, kein übersetztes Deutsch.
3. Jede Frage: vier Optionen, genau eine richtig, Kontext schließt die anderen drei aus.
4. Lösungen über die vier Positionen gestreut — keine Position häufiger als 5 von 11 in einem
   Teilsatz.
5. Jeder französische Satz einzeln gegengelesen.
6. Niveaukorridor eingehalten — nichts aus den Listen „zu leicht" und „zu schwer".

---

## Aktualität

Alles, was sich ändern kann — Amtsträger, Mitgliedszahlen, laufende Missionen, Haushaltszahlen,
Vertragsstände — **vor Aufnahme per Websuche verifizieren** und im Objekt mit
`"stand": "JJJJ-MM"` markieren. Was sich nicht belegen lässt, kommt nicht in den Pool.
