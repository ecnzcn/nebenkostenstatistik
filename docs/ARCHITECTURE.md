# Architektur

NebenkostenCheck ist eine PWA ohne Build-Schritt. Die Struktur ist so geschnitten,
dass sich die App später 1:1 als native iOS-App (Swift/SwiftUI) umsetzen lässt.

## Schichten

```
┌──────────────────────────────────────────────────────────────┐
│ Oberfläche        js/app.js, js/charts.js, css/app.css        │  ← plattformspezifisch
│                   (Router, Views, SVG-Diagramme)              │     (SwiftUI + Swift Charts)
├──────────────────────────────────────────────────────────────┤
│ Logik (rein)      js/analysis.js  Kennzahlen, Prognose,       │  ← 1:1 nach Swift portieren,
│                                   Prüfhinweise, Verträge      │     abgesichert durch
│                   js/model.js     Kategorien, Import,         │     tests/golden.json
│                                   Normalisierung              │
│                   js/calendar.js  Erinnerungen (.ics)         │
├──────────────────────────────────────────────────────────────┤
│ Speicher          js/store.js     localStorage + Änderungslog │  ← SwiftData / Codable-Datei
├──────────────────────────────────────────────────────────────┤
│ Datenvertrag      docs/schema/nebenkostencheck.schema.json    │  ← identisch auf allen
│                   (Claude-Import, Sicherung, iOS-App)         │     Plattformen
└──────────────────────────────────────────────────────────────┘
```

Regeln, damit das so bleibt:

- **Logik-Module greifen nie auf DOM, `window` oder `localStorage` zu.** Alles, was vom
  aktuellen Datum abhängt, nimmt einen optionalen Parameter `now` (testbar, portierbar).
- **Ein Datenformat für alles.** Claude-Import, Sicherung und iOS-App lesen dasselbe JSON
  (`formatVersion: 1`). Änderungen am Format → `formatVersion` erhöhen + Migration in `store.js`.
- **Golden-Tests.** `npm test` rechnet die Fixtures durch und vergleicht mit
  `tests/golden.json`. Die Swift-App lädt dieselben Fixtures und muss dieselben Werte liefern.

## Umsetzung als native iOS-App

| Web (heute) | iOS (später) |
|---|---|
| `js/model.js`, Schema | `swift/Models.swift` (Codable-Structs, liegen schon bereit) |
| `js/analysis.js` | `Analysis.swift` – Funktion für Funktion portieren, gegen `tests/golden.json` testen (XCTest) |
| `js/store.js` (localStorage) | SwiftData oder JSON-Datei in iCloud Drive (Sync zwischen Geräten gratis) |
| `js/charts.js` (SVG) | Swift Charts (`BarMark`, `LineMark` mit `.lineStyle(dash:)` für Prognose, `SectorMark` für Torten) |
| `js/calendar.js` (.ics) | `UNUserNotificationCenter` (lokale Mitteilungen) oder EventKit |
| Import per Text/Datei | Share-Extension / „Öffnen mit“ für `.json`, Kamera-Scan + Claude API |
| Service Worker (offline) | entfällt – native Apps sind offline |
| Theme-Schalter | `@AppStorage("theme")` + `.preferredColorScheme` |

Beträge in Swift als `Decimal` (nicht `Double`), gerundet auf 2 Nachkommastellen wie in JS.
Unbekannte Kategorien beim Import auf `sonstiges` / `Sonstiges` abbilden (wie `model.js`).

## Tests

```bash
npm test               # Golden-Tests der Rechenlogik (Node ≥ 18, keine Abhängigkeiten)
npm run test:update    # nach bewusster Änderung der Logik die Erwartungswerte neu schreiben
```
