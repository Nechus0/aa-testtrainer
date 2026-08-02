#!/usr/bin/env python3
"""
Ergaenzt fragenpool.js um einen neuen Tagesabschnitt.

Aufruf:
    python3 fragen_ergaenzen.py fragenpool.js neue_fragen.json

neue_fragen.json ist ein Array von Frageobjekten. Das Feld "block" wird
automatisch gesetzt (naechster freier Tag), "id" wird bei Kollision
umnummeriert. Vorhandene Fragen werden nie veraendert.

Rueckgabe auf stdout: kurze Bilanz. Exit 1 bei Fehlern.
"""
import json, sys, re, datetime, shutil, os

PFLICHT = ("kategorie", "thema", "frage", "optionen", "loesung", "erlaeuterung")
KATS = ("recht", "geschichte", "wirtschaft")
KUERZEL = {"recht": "R", "geschichte": "G", "wirtschaft": "W"}


def lade(pfad):
    roh = open(pfad, encoding="utf-8").read()
    m = re.search(r"window\.AA_FRAGEN\s*=\s*(\[.*\])\s*;\s*$", roh, re.S)
    if not m:
        sys.exit("FEHLER: window.AA_FRAGEN nicht gefunden in " + pfad)
    return json.loads(m.group(1))


def schreibe(pfad, fragen):
    kopf = (
        "// Fragenpool Testtrainer Auswaertiges Amt - hoeherer Auswaertiger Dienst\n"
        "// Automatisch erweitert durch die taegliche Aufgabe. Nicht von Hand umformatieren.\n"
        "window.AA_META = %s;\nwindow.AA_FRAGEN = "
        % json.dumps({"pruefung": "2026-09-01",
                      "aktualisiert": datetime.date.today().isoformat(),
                      "version": 2}, ensure_ascii=False)
    )
    tmp = pfad + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(kopf + json.dumps(fragen, ensure_ascii=False, indent=1) + ";\n")
    os.replace(tmp, pfad)


def naechster_tag(fragen):
    n = [int(q["block"].split()[-1]) for q in fragen
         if isinstance(q.get("block"), str) and q["block"].startswith("Tag ")]
    return (max(n) + 1) if n else 1


def pruefe(neu, vorhanden):
    stems = {" ".join(q["frage"].lower().split()) for q in vorhanden}
    fehler, dubletten = [], []
    for i, q in enumerate(neu):
        wo = "Frage %d" % (i + 1)
        for f in PFLICHT:
            if f not in q:
                fehler.append("%s: Feld '%s' fehlt" % (wo, f))
        if q.get("kategorie") not in KATS:
            fehler.append("%s: unbekannte Kategorie %r" % (wo, q.get("kategorie")))
        o = q.get("optionen")
        if not isinstance(o, list) or len(o) != 4 or any(not str(x).strip() for x in o):
            fehler.append("%s: es muessen genau 4 nicht leere Optionen sein" % wo)
        if len(set(map(str, o or []))) != len(o or []):
            fehler.append("%s: doppelte Antwortoptionen" % wo)
        if not isinstance(q.get("loesung"), int) or not 0 <= q["loesung"] <= 3:
            fehler.append("%s: loesung muss ein Index 0-3 sein" % wo)
        if len(str(q.get("erlaeuterung", ""))) < 60:
            fehler.append("%s: Erlaeuterung zu kurz (mind. 60 Zeichen)" % wo)
        if " ".join(str(q.get("frage", "")).lower().split()) in stems:
            dubletten.append(wo + ": " + str(q.get("frage"))[:70])
    return fehler, dubletten


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    pool_pfad, neu_pfad = sys.argv[1], sys.argv[2]
    vorhanden = lade(pool_pfad)
    neu = json.load(open(neu_pfad, encoding="utf-8"))
    if not isinstance(neu, list) or not neu:
        sys.exit("FEHLER: neue_fragen.json muss ein nicht leeres Array sein")

    fehler, dubletten = pruefe(neu, vorhanden)
    if fehler:
        sys.exit("FEHLER:\n  " + "\n  ".join(fehler))
    neu = [q for i, q in enumerate(neu)
           if ("Frage %d" % (i + 1)) not in {d.split(":")[0] for d in dubletten}]
    if not neu:
        sys.exit("FEHLER: nach Dublettenabzug bleibt nichts uebrig")

    tag = naechster_tag(vorhanden)
    block = "Tag %d" % tag
    belegt = {q["id"] for q in vorhanden}
    zaehler = {k: 0 for k in KATS}
    for q in neu:
        q["block"] = block
        q.setdefault("schwierigkeit", 2)
        zaehler[q["kategorie"]] += 1
        q["id"] = "%s-T%02d-%02d" % (KUERZEL[q["kategorie"]], tag, zaehler[q["kategorie"]])
        while q["id"] in belegt:
            q["id"] += "x"
        belegt.add(q["id"])

    shutil.copyfile(pool_pfad, pool_pfad + ".bak")
    schreibe(pool_pfad, vorhanden + neu)
    kontrolle = lade(pool_pfad)
    assert len(kontrolle) == len(vorhanden) + len(neu), "Schreibkontrolle fehlgeschlagen"

    print("OK: %s ergaenzt um %d Fragen (%s)." % (block, len(neu),
          ", ".join("%s %d" % (k, zaehler[k]) for k in KATS if zaehler[k])))
    print("Pool gesamt: %d Fragen." % len(kontrolle))
    if dubletten:
        print("Uebersprungen (Dublette): %d" % len(dubletten))
        for d in dubletten:
            print("  " + d)


if __name__ == "__main__":
    main()
