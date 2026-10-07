// App-Version und Änderungsprotokoll.
// Bei jeder Änderung: APP_VERSION erhöhen, Eintrag oben in CHANGELOG ergänzen
// und CACHE_VERSION in sw.js angleichen (sonst sieht das iPhone die neue Version nicht).

export const APP_VERSION = '1.4.0';
export const DATA_FORMAT_VERSION = 1;

export const CHANGELOG = [
  {
    version: '1.4.0',
    date: '2026-10-07',
    title: 'Dokumente zu Verträgen',
    changes: [
      'Verträge: Dateien hochladen (PDF, Fotos, …) – öffnen und löschen direkt in der Vertragsansicht',
      'Dokumente sind in der Sicherung enthalten und werden beim Wiederherstellen mit eingespielt',
      'Behoben: Bei „Darstellung“ war die gewählte Option erst nach einem Seitenwechsel markiert',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-07',
    title: 'Prognose, Erinnerungen & Hell/Dunkel',
    changes: [
      'Kostenentwicklung zeigt eine gestrichelte Prognose für das Folgejahr (Trend der Vorjahre, ohne Kabel-TV)',
      'Kündigungs-Erinnerung als Kalendertermin (30/7/1 Tag vorher) + Hinweis im Dashboard 60 Tage vorher',
      'Erinnerung an die Einwendungsfrist einer Abrechnung als Kalendertermin',
      'Verträge: Tortendiagramm nach Kategorie und „Kategorien im Vergleich“ über die Jahre',
      'Schätzungen übernehmen lässt sich rückgängig machen (sofort im Hinweis oder später per Button)',
      'Günstigstes Angebot und Kosten auch pro Monat eingeben – Jahr wird automatisch umgerechnet',
      'Darstellung wählbar: Automatisch, Hell oder Dunkel (unter „Mehr“)',
      'Gesamte Fixkosten zeigt die letzten 3 Jahre, ältere per „Ältere Jahre anzeigen“',
      'Behoben: überlappende Jahreszahlen in Diagrammen, Verlauf-Tabelle ragte heraus, iOS-Teilen-Symbol',
      'Architektur für eine spätere native iOS-App vorbereitet (Schema, Golden-Tests, Swift-Modelle)',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-07',
    title: 'Neues App-Icon & Fixkosten-Übersicht',
    changes: [
      'Neues App-Icon (Home-Bildschirm, Seitenleiste, Favicon)',
      'Gesamte Fixkosten: Jahre untereinander (neuestes oben) statt seitlich scrollen, mit Monatswerten',
      'Jahre nach der letzten Abrechnung zeigen die laufende Vorauszahlung (z. B. 270 €/Monat) statt „–“',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-07',
    title: 'Verträge über Jahre & Feinschliff',
    changes: [
      'Verträge zählen ab Vertragsbeginn in jedes Jahr – fehlende Jahre werden aus dem Monatsbetrag geschätzt und markiert',
      'Schätzungen lassen sich mit einem Tipp als erfasste Werte übernehmen',
      'Statistik „Gesamte Fixkosten“ zeigt alle Jahre lückenlos',
      'Versionen & Änderungen sowie das Änderungsprotokoll sind jetzt aufklappbar',
      'Behoben: Sparkline ragte aus den Kennzahl-Kacheln, Datumsfelder ragten auf dem iPhone aus dem Formular',
    ],
  },
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
