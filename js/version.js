// App-Version und Änderungsprotokoll.
// Bei jeder Änderung: APP_VERSION erhöhen, Eintrag oben in CHANGELOG ergänzen
// und CACHE_VERSION in sw.js angleichen (sonst sieht das iPhone die neue Version nicht).

export const APP_VERSION = '1.0.0';
export const DATA_FORMAT_VERSION = 1;

export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-10-06',
    title: 'Erste Version',
    changes: [
      'Dashboard nach Konzept: Kennzahlen, Kostenentwicklung, Kostenverteilung, Verbrauch, Detailkosten',
      'Analyse mit Hauptgründen, Prüfhinweisen (z. B. Kabelgebühren ab 07/2024) und Vorauszahlungs-Prognose',
      'Abrechnungen importieren (JSON-Datei oder Text einfügen) – Format für Claude dokumentiert',
      'Verträge (Versicherung, Handy, Strom, …) mit Kosten je Jahr und Vergleich zum günstigsten Angebot',
      'Statistik über alle Jahre, Steuer-Nachweis § 35a',
      'Offline-fähige PWA für iPhone (Zum Home-Bildschirm hinzufügen)',
      'Datensicherung: Export/Import aller Daten, Änderungsprotokoll der Daten',
    ],
  },
];
