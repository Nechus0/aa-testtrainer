# Prüfsuiten

Automatisierte Prüfungen der App mit Playwright und Chromium. Sie sichern die Vorgaben des
Auswärtigen Amts ab — Fragenzahlen, Zeiten, Punkte — und fangen Regressionen ab.

## Einrichten

```
npm init -y && npm install playwright && npx playwright install chromium
```

In den Dateien steht ein `executablePath` auf den Chromium der Entwicklungsumgebung. Auf einem
anderen Rechner diese Angabe entfernen, dann nimmt Playwright seinen eigenen Browser.

## Ausführen

```
node tests/suite.mjs     # Bestand und AA-Vorgaben: Fragenzahlen, Zeiten, Punkteschlüssel
node tests/suite2.mjs    # Zeitlogik, Probedurchläufe mit Rechenkontrolle, Speicherung, Bedienung
node tests/suite3.mjs    # Bereichswechsel, Textverständnis, Fehlerarchiv, Daten, Pool, Darstellung
node tests/soak.mjs      # 53 vollständige Durchläufe über alle 18 Modi
node tests/mobil.mjs     # Darstellung auf Telefonbreite
node tests/stress.mjs    # Artikelauswahl bei künftigem Bestand
```

Alle Suiten enden mit einer Bilanz und geben bei Fehlern Exit-Code 1 zurück.
Der Prüfbericht des letzten vollständigen Laufs liegt in `../pruefbericht.md`.
