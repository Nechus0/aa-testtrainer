# Tagesaufgabe: täglich neue Fragen

Jeden Morgen um 6 Uhr (Berliner Zeit) erzeugt eine geplante Aufgabe einen
neuen Übungsabschnitt und schreibt ihn unmittelbar in die Datenbank. Der
Abschnitt heißt `Tag N` und erscheint in der Anwendung sofort unter „Heute“.

Umfang je Lauf:

* **75 Fachtestfragen** – 25 Recht, 25 Geschichte und Politik, 25 Wirtschaft
* **52 Aufgaben Sprachtest Französisch** – 3 Lesetexte mit 8 Verständnisfragen,
  22 Aufgaben Wortschatz und Idiomatik, 22 Aufgaben Grammatik und Zeitformen

Die Aufgabe braucht keinen Zugriff auf den eigenen Rechner. Sie läuft
vollständig in der Cloud und spricht das Supabase-Projekt an.

---

## Woraus die Fragen entstehen

Seit dem 3. August 2026 liegt die Quellensammlung **als Volltext in der
Datenbank**, nicht mehr nur als PDF im Cloudspeicher:

| Tabelle | Inhalt |
|---|---|
| `quelle` | 261 Dokumente mit Herausgeber, Lizenz, Jahr, Einstufung, Sprache |
| `quelltext` | 41 672 Seiten Volltext, seitenweise, mit Volltextsuche je Sprache |
| `fr_material` | 5 300 Einträge für den Sprachtest: Presseartikel im Prüfungsformat, thematischer und korpusbasierter Wortschatz, feste Wendungen, amtliche Terminologie, Konjugationen, Grammatikkatalog |
| `lehrplan` | 167 Themenfelder mit Gewicht; `lehrplan_stand` zeigt den Rückstand |

Damit muss die Tagesaufgabe nichts mehr erfinden: **jede Frage wird an einer
Textstelle belegt.** Die Suche liefert die Belegstelle mit:

```sql
-- Stichworte, Kategorie (oder null), Trefferzahl, Sprache der Quelle
select * from public.quelle_suchen('Bundesverfassungsgericht Organstreit', 'recht', 8, 'de');
select * from public.quelle_suchen('relations diplomatiques immunité',      null,    8, 'fr');
select * from public.quelle_suchen('monetary policy inflation targeting',   null,    8, 'en');
```

Rückgabe: Quelle, Titel, Herausgeber, Jahr, Seite, Auszug mit hervorgehobenen
Treffern, Rang. Ohne Kategorie sucht die Funktion über den gesamten Bestand.
Der Bestand ist dreisprachig: 178 deutsche, 72 englische und 11 französische
Titel – die Sprache steht in `quelle.sprache`. Deutsche Quellen zuerst; die
englischen Lehrbücher (OpenStax, Palgrave, Routledge) taugen für Theorie und
Systematik, die französischen für den Sprachtest.

---

## Einrichtung in einem anderen Konto

1. Den MCP-Server **Supabase** mit dem Projekt `xuybdwxbyfdlvydspfgq`
   verbinden.
2. Eine geplante Aufgabe anlegen, Zeitplan `0 4 * * *` (UTC, entspricht
   6 Uhr Berliner Sommerzeit).
3. Als Wortlaut den folgenden Text eintragen.

---

## Wortlaut der Aufgabe

> Erzeuge den heutigen Übungsabschnitt für den Testtrainer zum schriftlichen
> Auswahlverfahren des Auswärtigen Amts (höherer Dienst, Prüfung am
> 1. September 2026) und schreibe ihn in die Supabase-Datenbank. Arbeite
> selbstständig durch, stelle keine Rückfragen, und melde am Ende in zwei bis
> drei Sätzen, was hinzugekommen ist.
>
> ### Werkzeuge
> Nutze die Supabase-Werkzeuge (MCP-Server „Supabase“), Projekt-ID:
> `xuybdwxbyfdlvydspfgq`. Schreibvorgänge über `execute_sql`. Für aktuelle
> Sachverhalte nutze die Websuche. Eine Verbindung zum Rechner des Nutzers ist
> nicht nötig und darf nicht vorausgesetzt werden. Steht der MCP-Server nicht
> zur Verfügung, brich ab und melde das – schreibe nichts auf anderem Weg.
>
> ### Schritt 1 – Stand ermitteln
> ```sql
> select greatest(
>   coalesce((select max(cast(substring(block from 5) as int)) from frage    where block like 'Tag %'), 0),
>   coalesce((select max(cast(substring(block from 5) as int)) from fr_frage where block like 'Tag %'), 0)
> ) + 1 as neuer_tag;
> ```
> Der neue Abschnitt heißt `Tag N` mit dieser Zahl. Existiert `Tag N` schon,
> ist der Lauf für heute erledigt – dann nichts schreiben und das melden.
>
> ### Schritt 2 – Themenfelder wählen
> Der Lehrplan bestimmt, was drankommt. Er hat 167 Felder; in 30 Tagen soll
> jedes wenigstens einmal vorkommen, wichtige Felder mehrfach.
> ```sql
> select kategorie, oberfeld, unterfeld, thema, gewicht, fragen, soll, rueckstand
>   from lehrplan_stand
>  order by kategorie, rueckstand desc, random()
>  limit 60;
> ```
> Nimm je Kategorie die 8 bis 12 Felder mit dem größten Rückstand und verteile
> die 25 Fragen darauf. `thema` muss **wortgleich** aus dem Lehrplan
> übernommen werden, sonst zählt die Abdeckung nicht.
>
> ### Schritt 3 – Maßstab nehmen (wichtig, nicht überspringen)
> In der Tabelle `frage` stehen unter den Abschnitten `Original 2019` und
> `Original 2023` die **150 tatsächlichen Prüfungsfragen des Auswärtigen
> Amts**. Sie sind der verbindliche Maßstab für Zuschnitt, Frageform, Länge,
> Schwierigkeit und Art der Ablenker. Lies vor dem Schreiben je Kategorie
> mindestens zehn davon vollständig:
>
> ```sql
> select kategorie, thema, frage, optionen, loesung, erlaeuterung
>   from frage where block in ('Original 2019','Original 2023')
>   order by kategorie, random() limit 40;
> ```
>
> Für Französisch gilt dasselbe mit den amtlichen Musteraufgaben:
> ```sql
> select teil, thema, frage, optionen, loesung from fr_frage where block = 'AA-Musteraufgaben';
> select titel, quelle, text from fr_text where block = 'AA-Musteraufgaben';
> ```
>
> Gleiche Fragelänge, gleicher Ton, gleiche Art von Ablenkern, gleiche Mischung
> aus Faktenwissen und Verständnis. Keine neuen Aufgabenformate erfinden.
>
> ### Schritt 4 – Belege holen
> Zu **jedem** gewählten Themenfeld zuerst die Quellenlage lesen:
> ```sql
> select * from public.quelle_suchen('<Stichworte des Themenfelds>', '<kategorie>', 8, 'de');
> ```
> Die Rückgabe enthält Titel, Herausgeber, Seite und einen Auszug. Formuliere
> die Frage aus dieser Textstelle heraus; trage Herausgeber und Titel in die
> Erläuterung ein („Grundlage: Bundeszentrale für politische Bildung, …“).
> Findet die Suche nichts, wähle andere Stichworte oder ein anderes Feld –
> aber erfinde keine Belege. Für tagesaktuelle Sachverhalte (Amtsträger,
> Zahlen, laufende Verfahren) gilt weiterhin die Websuche.
>
> Prüfe außerdem, worüber schon gefragt wurde, damit nichts doppelt kommt:
> ```sql
> select kategorie, thema, left(frage, 90) from frage order by kategorie, thema;
> ```
>
> ### Schritt 5 – Fachtests erzeugen (75 Fragen)
> Genau 25 Fragen je Kategorie, exakt im Zuschnitt der veröffentlichten
> AA-Fachtests:
>
> * `recht` – Völker-, Europa- und Staatsrecht: Grundgesetz
>   (Staatsorganisation und Grundrechte), Völkerrecht (VN-Charta,
>   Vertragsrecht, Diplomatenrecht, humanitäres Völkerrecht,
>   Menschenrechtsschutz), Europarecht (EUV/AEUV, Organe, Rechtsakte,
>   Grundfreiheiten, EuGH, GRC).
> * `geschichte` – Geschichte und Politik: deutsche und europäische Geschichte
>   vom 19. Jahrhundert bis zur Gegenwart, deutsche Außenpolitik,
>   internationale Beziehungen, Organisationen, aktuelle weltpolitische Lage.
> * `wirtschaft` – Wirtschaft: Volkswirtschaftslehre, Geld- und Fiskalpolitik,
>   Außenhandel, EU-Wirtschaftsordnung, Entwicklungs- und Klimaökonomie,
>   deutsche Wirtschaftsstruktur.
>
> Anforderungen an jede Frage:
>
> * Vier Antwortmöglichkeiten, genau eine ist richtig; die drei falschen müssen
>   plausibel sein.
> * Sachlich zweifelsfrei richtig und durch eine Textstelle aus `quelltext`
>   oder durch die Websuche gedeckt.
> * Frageniveau wie im Original: in etwa 20 Sekunden lösbar, aber nur mit
>   echtem Fachwissen.
> * Eine `erlaeuterung` von zwei bis fünf Sätzen: warum die richtige Antwort
>   stimmt, woran die nächstliegende falsche scheitert, und woher es stammt.
> * `thema` wortgleich aus dem Lehrplan, Form „Oberfeld – Unterfeld“.
> * Kein Thema, das schon eine bestehende Frage abdeckt.
> * `schwierigkeit` 1 (leicht), 2 (mittel) oder 3 (schwer); ungefähr 5 / 15 / 5
>   je Kategorie.
>
> Kennungen: `R-TNN-01` bis `R-TNN-25`, `G-TNN-01` bis `G-TNN-25`, `W-TNN-01`
> bis `W-TNN-25`, wobei NN die zweistellige Tagesnummer ist
> (Tag 7 → `R-T07-01`, Tag 12 → `R-T12-01`).
>
> ### Schritt 6 – Sprachtest Französisch erzeugen (52 Aufgaben)
> Streng nach den amtlichen Musteraufgaben (Stand 04.09.2025): 52 Aufgaben,
> 30 Minuten, 60 Punkte, bestanden ab 30. Niveau B2.
>
> Das Material dafür liegt in `fr_material`:
> ```sql
> -- Presseartikel im richtigen Umfang, noch nicht verwendet
> select schluessel, daten from fr_material
>  where art in ('presse','lesetext')
>    and (daten->>'mots')::int between 70 and 190
>  order by random() limit 12;
> -- Wortschatz, Wendungen, Terminologie
> select schluessel, daten from fr_material where art='thema'        order by random() limit 40;
> select schluessel, daten from fr_material where art='locution'     order by random() limit 25;
> select schluessel, daten from fr_material where art='terminologie' order by random() limit 25;
> -- Grammatikkatalog: zehn Kapitel mit Regeln, Paradigmen und Korpusbelegen
> select schluessel, daten->'regles', daten->'paradigmes' from fr_material where art='grammatik';
> ```
>
> 1. **Textverständnis** – genau 3 Zeitungsartikel auf Französisch, je 70 bis
>    180 Wörter. Nimm sie aus `fr_material` (`art in ('presse','lesetext')`)
>    und kürze sie auf das Prüfungsmaß, statt Texte zu erfinden. Dazu genau
>    8 Fragen, verteilt 3 / 3 / 2, jede 2 Punkte.
>    Artikelkennungen `FT-TNN-01` bis `FT-TNN-03`, Fragen `FV-TNN-01-01`,
>    `FV-TNN-01-02` … Quellenangabe neutral halten, zum Beispiel „D'après la
>    presse européenne“.
> 2. **Wortschatz und Idiomatik** – genau 22 Aufgaben, `FW-TNN-01` bis
>    `FW-TNN-22`. Lückensätze mit vier Wortoptionen, gebildet aus `thema`,
>    `locution` und `terminologie`; diplomatischer, wirtschaftlicher und
>    allgemeinsprachlicher Wortschatz, feste Wendungen, Verbrektion, falsche
>    Freunde. Die Beispielsätze im Material sind echte Korpusbelege – nutze
>    sie als Vorlage für den Lückensatz.
> 3. **Grammatik und Zeitformen** – genau 22 Aufgaben, `FG-TNN-01` bis
>    `FG-TNN-22`, verteilt über die zehn Kapitel aus `art='grammatik'`:
>    subjonctif, conditionnel, phrases hypothétiques, connecteurs, temps de
>    l'indicatif, pronoms, voix passive, discours indirect, participes,
>    accord du participe passé.
>
> Die `erlaeuterung` steht auf Deutsch und erklärt die Regel sowie den Fehler
> in der nächstliegenden falschen Option. `thema` ebenfalls auf Deutsch, Form
> „Oberfeld – Unterfeld“. Achte auf sprachliche Korrektheit: Akzente,
> Elisionen, Typografie (« … » mit schmalem Leerraum, Apostroph ’).
>
> ### Schritt 7 – Schreiben
> Prüfe vor dem Schreiben selbst: 25/25/25 Fachfragen, 3 Artikel, 8/22/22
> Französischaufgaben, alle Kennungen neu, alle `optionen` mit genau vier
> Einträgen, alle `loesung` zwischen 0 und 3. Stimmt etwas nicht, korrigiere es
> und schreibe erst dann.
>
> Schreibe in Paketen von höchstens 25 Zeilen je `execute_sql`-Aufruf:
>
> ```sql
> insert into public.frage (id,kategorie,block,thema,frage,optionen,loesung,erlaeuterung,schwierigkeit,stand) values
> ('R-T07-01','recht','Tag 7','Europarecht – Rechtsetzung','Fragetext …',
>  '["A","B","C","D"]'::jsonb, 2, 'Erläuterung …', 2, '2026-08-09')
> on conflict (id) do nothing;
>
> insert into public.fr_text (id,block,titel,quelle,text) values
> ('FT-T07-01','Tag 7','Titel','D''après la presse européenne','Artikeltext …')
> on conflict (id) do nothing;
>
> insert into public.fr_frage (id,teil,text_id,block,thema,frage,optionen,loesung,erlaeuterung,schwierigkeit,stand) values
> ('FV-T07-01-01','textverstaendnis','FT-T07-01','Tag 7','Textverständnis','Frage …',
>  '["A","B","C","D"]'::jsonb, 0, 'Erläuterung …', 2, '2026-08-09')
> on conflict (id) do nothing;
> ```
>
> Einfache Anführungszeichen im Text werden durch Verdoppelung maskiert
> (`d''après`). `stand` ist das heutige Datum. `text_id` ist bei Wortschatz und
> Grammatik `null`.
>
> ### Schritt 8 – Nachkontrolle
> ```sql
> select block, kategorie, count(*) from frage where block = 'Tag N' group by 1,2;
> select block, teil, count(*) from fr_frage where block = 'Tag N' group by 1,2;
> select count(*) from lehrplan_stand where fragen = 0;
> ```
> Erwartet: 25 je Kategorie sowie 8 / 22 / 22. Fehlt etwas, ergänze es. Melde
> zum Schluss Tagesnummer, Anzahl, die abgedeckten Themenfelder und wie viele
> Felder des Lehrplans noch ohne Frage sind. Der Nutzer sieht den neuen
> Abschnitt sofort unter <https://nechus0.github.io/aa-testtrainer/> im
> Bereich „Heute“.

---

## Wenn ein Lauf ausfällt

Die Aufgabe ist absichtlich so gebaut, dass ein ausgefallener Tag folgenlos
bleibt: Sie zählt vom höchsten vorhandenen Abschnitt aus weiter, statt sich am
Kalender zu orientieren. Ein Lauf lässt sich jederzeit von Hand nachholen,
indem man den Wortlaut in einer neuen Unterhaltung einfügt.

Kontrolle des Bestands:

```sql
select block, kategorie, count(*) from frage group by 1,2 order by 1,2;
select block, teil, count(*) from fr_frage group by 1,2 order by 1,2;
```

---

## Bestand bleibt erhalten

Die Aufgabe ergänzt ausschließlich. Bestehende Abschnitte – insbesondere
`Original 2019`, `Original 2023` und die `AA-Musteraufgaben` – werden nie
verändert oder gelöscht. Alle `insert`-Anweisungen enden auf
`on conflict (id) do nothing`.
