# NebenkostenCheck

PWA zum Auswerten von Nebenkostenabrechnungen und zum Tracken laufender Verträge – optimiert fürs iPhone.

**Live:** https://ecnzcn.github.io/nebenkostenstatistik/

## Funktionen
- Dashboard: Gesamtkosten, Heizung/Warmwasser, Wasser, Kosten pro m², Vorjahresvergleich, Kostenverteilung, Verbrauch
- Analyse: Hauptgründe für Veränderungen, Prüfhinweise (Kabel-TV ab 07/2024, Fristen, Richtwerte), Vorauszahlungs-Prognose
- Abrechnungen importieren per JSON (von Claude erzeugt) – siehe [docs/CLAUDE_PROMPT.md](docs/CLAUDE_PROMPT.md)
- Verträge mit Kosten je Jahr, Vergleich zum günstigsten Angebot, Kündigungserinnerung
- Statistik über alle Jahre, § 35a-Steuernachweis
- Offline-fähig, Daten bleiben lokal auf dem Gerät; Export/Import als Sicherung
- Versionierung mit Änderungsprotokoll (App) und Änderungslog (Daten)

## Auf dem iPhone installieren
Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Neue Version veröffentlichen
1. `APP_VERSION` + Eintrag in `CHANGELOG` in `js/version.js`
2. `CACHE_VERSION` in `sw.js` auf denselben Wert setzen
3. Nach `main` pushen – der Workflow veröffentlicht automatisch auf GitHub Pages.

## Entwicklung
Kein Build-Schritt. Lokal starten: `python3 -m http.server` und http://localhost:8000 öffnen.
Tests der Rechenlogik: `npm test`. Aufbau und Weg zur nativen iOS-App: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
