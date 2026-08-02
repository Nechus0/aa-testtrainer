#!/usr/bin/env python3
"""
Baut aus Testtrainer.html + fragenpool.js + fragenpool_fr.js eine einzelne,
in sich geschlossene Datei Testtrainer_standalone.html.

Aufruf im Arbeitsordner:
    python3 standalone_bauen.py

Diese Einzeldatei braucht nichts weiter neben sich und laesst sich deshalb
verschicken, auf ein Telefon legen oder als Artefakt einbinden.
"""
import os, sys

MARKE = '<script src="fragenpool.js"></script>\n<script src="fragenpool_fr.js"></script>'


def main():
    ordner = os.path.dirname(os.path.abspath(sys.argv[0]))
    app = os.path.join(ordner, "Testtrainer.html")
    p1 = os.path.join(ordner, "fragenpool.js")
    p2 = os.path.join(ordner, "fragenpool_fr.js")
    ziel = os.path.join(ordner, "Testtrainer_standalone.html")

    for pfad in (app, p1, p2):
        if not os.path.exists(pfad):
            sys.exit("FEHLER: %s nicht gefunden" % os.path.basename(pfad))

    html = open(app, encoding="utf-8").read()
    if MARKE not in html:
        sys.exit("FEHLER: Einbindung der Pooldateien in Testtrainer.html nicht gefunden - "
                 "wurde die Datei veraendert?")

    html = html.replace(MARKE, "<script>\n%s\n</script>\n<script>\n%s\n</script>"
                        % (open(p1, encoding="utf-8").read(),
                           open(p2, encoding="utf-8").read()))
    if 'src="fragenpool' in html:
        sys.exit("FEHLER: es ist noch ein externer Verweis uebrig")

    tmp = ziel + ".tmp"
    open(tmp, "w", encoding="utf-8").write(html)
    os.replace(tmp, ziel)
    print("OK: Testtrainer_standalone.html gebaut (%d KB)." % (len(html.encode("utf-8")) // 1024))


if __name__ == "__main__":
    main()
