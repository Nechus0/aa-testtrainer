#!/usr/bin/env python3
"""
Ergaenzt fragenpool_fr.js (Sprachtest Franzoesisch) um einen neuen Tagesabschnitt.

Aufruf:
    python3 fragen_ergaenzen_fr.py fragenpool_fr.js neue_fragen_fr.json

neue_fragen_fr.json:
{
  "texte":  [{"titel": "...", "quelle": "D'apres lemonde.fr", "text": "...",
              "fragen": [{"frage": "...", "optionen": [4], "loesung": 0, "erlaeuterung": "..."}]}],
  "fragen": [{"teil": "wortschatz"|"grammatik", "thema": "...", "frage": "...",
              "optionen": [4], "loesung": 0, "erlaeuterung": "...", "schwierigkeit": 2}]
}

Block und IDs vergibt das Skript. Franzoesische Typografie (Apostroph U+2019,
schmales geschuetztes Leerzeichen vor ? ! : ; und in Guillemets) wird normalisiert.

Rueckgabe auf stdout: kurze Bilanz. Exit 1 bei Fehlern.
"""
import json, sys, re, datetime, shutil, os

TEILE = ("textverstaendnis", "wortschatz", "grammatik")
KUERZEL = {"wortschatz": "FW", "grammatik": "FG"}
NNBSP = " "


def lade(pfad):
    roh = open(pfad, encoding="utf-8").read()
    def block(name):
        m = re.search(r"window\.%s\s*=\s*(\[.*?\])\s*;\s*(?:window\.|$)" % name, roh, re.S)
        if not m:
            sys.exit("FEHLER: window.%s nicht gefunden in %s" % (name, pfad))
        return json.loads(m.group(1))
    meta = re.search(r"window\.AA_FR_META\s*=\s*(\{.*?\})\s*;", roh, re.S)
    return json.loads(meta.group(1)) if meta else {}, block("AA_FR_TEXTE"), block("AA_FR_FRAGEN")


def schreibe(pfad, meta, texte, fragen):
    meta = dict(meta or {})
    meta["aktualisiert"] = datetime.date.today().isoformat()
    out = ("// Fragenpool Sprachtest Franzoesisch - Auswahlverfahren hoeherer Auswaertiger Dienst\n"
           "// Automatisch erweitert durch die taegliche Aufgabe. Nicht von Hand umformatieren.\n"
           "window.AA_FR_META = %s;\n" % json.dumps(meta, ensure_ascii=False))
    out += "window.AA_FR_TEXTE = " + json.dumps(texte, ensure_ascii=False, indent=1) + ";\n"
    out += "window.AA_FR_FRAGEN = " + json.dumps(fragen, ensure_ascii=False, indent=1) + ";\n"
    tmp = pfad + ".tmp"
    open(tmp, "w", encoding="utf-8").write(out)
    os.replace(tmp, pfad)


def norm(s):
    """Franzoesische Typografie vereinheitlichen."""
    if not isinstance(s, str):
        return s
    s = s.replace("'", "’").replace(" ", " ")
    s = re.sub(r"\s*([?!:;])", NNBSP + r"\1", s)
    s = re.sub(r"«\s*", "«" + NNBSP, s)
    s = re.sub(r"\s*»", NNBSP + "»", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def normfrage(q):
    q = dict(q)
    for f in ("frage", "titel", "quelle", "text", "thema"):
        if f in q:
            q[f] = norm(q[f])
    if "optionen" in q:
        q["optionen"] = [norm(o) for o in q["optionen"]]
    if "erlaeuterung" in q:                      # deutsch, keine franz. Typografie
        q["erlaeuterung"] = " ".join(str(q["erlaeuterung"]).replace(" ", " ").split())
    return q


def pruefeFrage(q, wo, stems, fehler, dubletten, mitTeil, stammPruefen=True):
    for f in ("frage", "optionen", "loesung", "erlaeuterung"):
        if f not in q:
            fehler.append("%s: Feld '%s' fehlt" % (wo, f))
            return
    if mitTeil and q.get("teil") not in ("wortschatz", "grammatik"):
        fehler.append("%s: teil muss 'wortschatz' oder 'grammatik' sein" % wo)
    o = q["optionen"]
    if not isinstance(o, list) or len(o) != 4 or any(not str(x).strip() for x in o):
        fehler.append("%s: es muessen genau 4 nicht leere Optionen sein" % wo)
    elif len(set(map(str, o))) != 4:
        fehler.append("%s: doppelte Antwortoptionen" % wo)
    if not isinstance(q["loesung"], int) or not 0 <= q["loesung"] <= 3:
        fehler.append("%s: loesung muss ein Index 0-3 sein" % wo)
    if len(str(q["erlaeuterung"])) < 60:
        fehler.append("%s: Erlaeuterung zu kurz (mind. 60 Zeichen)" % wo)
    if mitTeil and "…" not in q["frage"] and "..." not in q["frage"]:
        fehler.append("%s: Lueckensatz ohne Auslassungszeichen" % wo)
    if stammPruefen:
        schluessel = " ".join(str(q["frage"]).lower().split())
        if schluessel in stems:
            dubletten.append(wo + ": " + str(q["frage"])[:70])


def naechster_tag(texte, fragen):
    n = [int(x["block"].split()[-1]) for x in list(texte) + list(fragen)
         if isinstance(x.get("block"), str) and x["block"].startswith("Tag ")]
    return (max(n) + 1) if n else 1


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    pool_pfad, neu_pfad = sys.argv[1], sys.argv[2]
    meta, texte, fragen = lade(pool_pfad)
    neu = json.load(open(neu_pfad, encoding="utf-8"))
    if not isinstance(neu, dict):
        sys.exit("FEHLER: neue_fragen_fr.json muss ein Objekt mit 'texte' und/oder 'fragen' sein")
    ntexte = [normfrage(t) for t in neu.get("texte", [])]
    nfragen = [normfrage(q) for q in neu.get("fragen", [])]
    if not ntexte and not nfragen:
        sys.exit("FEHLER: weder 'texte' noch 'fragen' enthalten")

    stems = {" ".join(q["frage"].lower().split()) for q in fragen}
    titel = {t.get("titel", "").lower() for t in texte}
    fehler, dubletten = [], []

    for i, t in enumerate(ntexte, 1):
        wo = "Text %d" % i
        if not t.get("text") or len(t["text"].split()) < 70:
            fehler.append("%s: Artikel fehlt oder ist kuerzer als 70 Woerter (Ziel 90-150)" % wo)
        if len(t["text"].split()) > 180:
            fehler.append("%s: Artikel laenger als 180 Woerter (Ziel 90-150)" % wo)
        if t.get("titel", "").lower() in titel:
            fehler.append("%s: Titel bereits vorhanden" % wo)
        qs = t.get("fragen") or []
        if not 2 <= len(qs) <= 4:
            fehler.append("%s: es muessen 2 bis 4 Fragen zum Text sein" % wo)
        for j, q in enumerate(qs, 1):
            pruefeFrage(q, "%s Frage %d" % (wo, j), stems, fehler, dubletten, False,
                        stammPruefen=False)

    for i, q in enumerate(nfragen, 1):
        pruefeFrage(q, "Frage %d" % i, stems, fehler, dubletten, True)

    if fehler:
        sys.exit("FEHLER:\n  " + "\n  ".join(fehler))
    weg = {d.split(":")[0] for d in dubletten}
    nfragen = [q for i, q in enumerate(nfragen, 1) if ("Frage %d" % i) not in weg]
    if not ntexte and not nfragen:
        sys.exit("FEHLER: nach Dublettenabzug bleibt nichts uebrig")

    tag = naechster_tag(texte, fragen)
    block = "Tag %d" % tag
    belegt = {x["id"] for x in texte} | {x["id"] for x in fragen}

    for i, t in enumerate(ntexte, 1):
        tid = "FT-T%02d-%02d" % (tag, i)
        while tid in belegt:
            tid += "x"
        belegt.add(tid)
        t["id"] = tid
        t["block"] = block
        t["fragen"] = [dict({"id": "FV-T%02d-%02d%d" % (tag, i, j), "frage": q["frage"],
                             "optionen": q["optionen"], "loesung": q["loesung"],
                             "erlaeuterung": q["erlaeuterung"]},
                            **({"stand": q["stand"]} if q.get("stand") else {}))
                       for j, q in enumerate(t["fragen"], 1)]
        texte.append({k: t[k] for k in ("id", "block", "titel", "quelle", "text", "fragen") if k in t})

    zaehler = {"wortschatz": 0, "grammatik": 0}
    for q in nfragen:
        zaehler[q["teil"]] += 1
        qid = "%s-T%02d-%02d" % (KUERZEL[q["teil"]], tag, zaehler[q["teil"]])
        while qid in belegt:
            qid += "x"
        belegt.add(qid)
        eintrag = {"id": qid, "teil": q["teil"], "block": block, "thema": q.get("thema", ""),
                   "frage": q["frage"], "optionen": q["optionen"], "loesung": q["loesung"],
                   "erlaeuterung": q["erlaeuterung"], "schwierigkeit": q.get("schwierigkeit", 2)}
        if q.get("stand"):
            eintrag["stand"] = q["stand"]
        fragen.append(eintrag)

    shutil.copyfile(pool_pfad, pool_pfad + ".bak")
    schreibe(pool_pfad, meta, texte, fragen)
    _, kt, kf = lade(pool_pfad)
    assert len(kt) == len(texte) and len(kf) == len(fragen), "Schreibkontrolle fehlgeschlagen"

    tvneu = sum(len(t["fragen"]) for t in ntexte)
    print("OK: %s ergaenzt um %d Text(e) mit %d Verstaendnisfragen, %d Wortschatz, %d Grammatik."
          % (block, len(ntexte), tvneu, zaehler["wortschatz"], zaehler["grammatik"]))
    print("Pool gesamt: %d Texte, %d Verstaendnisfragen, %d Einzelfragen."
          % (len(kt), sum(len(t["fragen"]) for t in kt), len(kf)))
    if dubletten:
        print("Uebersprungen (Dublette bei Wortschatz/Grammatik): %d" % len(dubletten))
        for d in dubletten:
            print("  " + d)


if __name__ == "__main__":
    main()
