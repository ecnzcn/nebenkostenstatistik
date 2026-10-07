# Claude-Anleitung: Abrechnung → Importdatei

So bekommst du eine neue Nebenkostenabrechnung (oder Verträge) in die App:

1. Öffne in der App **Mehr → Claude-Anleitung** und tippe auf **Prompt kopieren**
   (oder kopiere den Block unten).
2. Neuer Chat in Claude → Prompt einfügen → Fotos/PDF der Abrechnung anhängen
   (am besten alle Seiten: Anschreiben des Vermieters, Betriebskostenaufstellung,
   Heizkostenabrechnung inkl. Verbrauchswerte, ggf. § 35a-Anlage).
3. Claude antwortet mit einer Datei `nebenkosten-JAHR.json` bzw. einem JSON-Block.
4. In der App: **Import** → Datei wählen *oder* Text einfügen → **Prüfen** → **Übernehmen**.

Gibt es das Jahr schon, wird es ersetzt – die alte Fassung bleibt unter
„Frühere Versionen“ in der Abrechnung sichtbar.

---

<!-- PROMPT START -->
Du bist mein Assistent für die App „NebenkostenCheck“. Lies die angehängte(n) Nebenkostenabrechnung(en) bzw. Vertragsunterlagen vollständig und erzeuge daraus EINE Importdatei im JSON-Format unten. Erstelle sie als herunterladbare Datei „nebenkosten-<JAHR>.json“ (falls das nicht geht: als einzelnen ```json-Codeblock). Danach kurz auflisten: Summenprüfung, Unsicherheiten, Auffälligkeiten.

REGELN
- Nur Werte aus den Dokumenten übernehmen, nichts erfinden. Unbekanntes weglassen oder null.
- Zahlen als JSON-Zahlen mit Punkt: 1234.56 (nicht "1.234,56 €"). Datumsangaben als "YYYY-MM-DD".
- "amount" = MEIN Anteil in Euro (Mieter), "buildingTotal" = Gesamtbetrag des Hauses.
- Nur auf Mieter umlagefähige Kosten (Betriebskosten nach BetrKV), die mir in Rechnung gestellt werden. Nicht umlagefähige WEG-Kosten (Verwaltervergütung, Instandhaltung, Rücklage …) NICHT aufnehmen.
- Die Position „Heizung/Wasser laut Heizkostenabrechnung“ in Einzelteile zerlegen, wenn die Heizkostenabrechnung beiliegt: Heizkosten (Grund+Verbrauch) → "heizung", Warmwasserkosten → "warmwasser", Wasser/Abwasser und Kaltwasserzähler-Kosten → "wasser", Rauchwarnmelder → "wartung". Die Summe der Teile muss exakt dem Betrag in der Betriebskostenabrechnung entsprechen.
- Achtung bei Fotos: Spalten können optisch verrutscht sein. Prüfe jede Zeile rechnerisch (buildingTotal × Anteil ≈ amount) und ordne Beträge entsprechend zu.
- Summe aller "amount" muss "totals.costs" ergeben (±0,02 €). balance = prepayments − costs (negativ = Nachzahlung).
- category ist genau einer von: heizung, warmwasser, wasser, hausmeister, reinigung, garten, grundsteuer, muell, versicherung, strom, aufzug, kabel, wartung, stellplatz, sonstiges.
  (Straßenreinigung/Winterdienst → reinigung, Schornsteinfeger → wartung, Entwässerung/Niederschlagswasser → wasser, Allgemeinstrom → strom, Kabel/Antenne/TV → kabel.)
- consumptionHistory: Vorjahreswerte aus Verbrauchsgrafiken (z. B. „Ihr Verbrauch für Heizung in kWh“ 2022/2023), jeweils die gemessenen, nicht die witterungsbereinigten Werte.
- tax35a: nur MEINE Anteile der umlagefähigen Betriebskosten aus der § 35a-Anlage (haushaltsnahe Dienstleistungen bzw. Handwerkerleistungen, jeweils Spalte „Ihr Anteil“ im Block „auf Mieter umlagefähig“).
- Keine Namen, Kontonummern/IBAN oder Adressen von Personen übernehmen. "unit.label" nur kurz, z. B. "Wohnung 17 · 3 Zi. · 3. OG".

FORMAT
{
  "format": "nebenkostencheck",
  "formatVersion": 1,
  "statements": [
    {
      "year": 2025,
      "periodFrom": "2025-01-01", "periodTo": "2025-12-31",
      "usageFrom": "2025-01-01", "usageTo": "2025-12-31",
      "issuedOn": "2026-04-10", "receivedOn": "2026-04-10", "dueOn": "2026-05-05",
      "issuer": "Vermieter (Verwalter: …)",
      "unit": { "label": "Wohnung 17 · 3 Zi.", "livingArea": 79.36, "meaShare": 28.14, "meaTotal": 973 },
      "positions": [
        { "label": "Müllgebühren", "category": "muell", "amount": 54.17, "buildingTotal": 1872.89, "allocationKey": "MEA", "share": "28,14 / 973", "source": "" },
        { "label": "Heizkosten", "category": "heizung", "amount": 606.24, "allocationKey": "HK-Abrechnung 30/70", "share": "79,36 m² / 3.253 kWh", "source": "Heizkostenabrechnung" }
      ],
      "totals": { "costs": 3325.58, "prepayments": 2655.00, "balance": -670.58 },
      "prepaymentSchedule": [ { "months": 9, "monthly": 205 }, { "months": 3, "monthly": 270 } ],
      "consumption": {
        "heatingKwh": 3253, "hotWaterM3": 48.545, "hotWaterKwh": 2822.89,
        "coldWaterM3": 84.115, "waterTotalM3": 132.66,
        "heatingKwhPerM2": 40.99, "heatingKwhPerM2Building": 39.92,
        "hotWaterKwhPerM2": 35.57, "hotWaterKwhPerM2Building": 14.14,
        "co2CostTenant": 69.83, "energyPricePerKwh": 0.1653
      },
      "consumptionHistory": [ { "year": 2023, "heatingKwh": 2918, "hotWaterKwh": 2351.87 } ],
      "tax35a": { "householdServices": 544.31, "craftsmenServices": 126.17 },
      "notes": [ "kurze, sachliche Hinweise aus der Abrechnung" ]
    }
  ],
  "contracts": []
}

VERTRÄGE (nur wenn ich Vertragsunterlagen/Rechnungen schicke, sonst "contracts": [])
{ "name": "Privathaftpflicht", "category": "Versicherung", "provider": "HUK-Coburg",
  "contractNo": "", "startDate": "2022-03-01", "endDate": "2026-03-01",
  "noticePeriodMonths": 1, "autoRenewMonths": 12, "active": true, "notes": "",
  "years": [ { "year": 2025, "cost": 64.90, "tariff": "Basis", "provider": "", "benchmark": null, "benchmarkNote": "", "note": "" } ] }
- category ist einer von: Versicherung, Handy, Internet, Strom, Gas, Streaming, Rundfunk, Fitness, Auto, Bank, Software, Sonstiges.
- "cost" = tatsächliche Kosten im Kalenderjahr (Monatsbetrag × Monate, inkl. Einmalkosten/Boni verrechnet).
- "benchmark" = günstigstes vergleichbares Angebot im selben Jahr, nur wenn ich es nenne.
<!-- PROMPT END -->

---

## Feldübersicht

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `year` | ja | Abrechnungsjahr |
| `positions[].amount` | ja | dein Anteil in € |
| `positions[].category` | ja | Kategorie (siehe Liste oben) |
| `totals.costs` | empfohlen | Gesamtsumme; wird sonst aus Positionen berechnet |
| `totals.prepayments` | empfohlen | Summe Vorauszahlungen |
| `totals.balance` | empfohlen | Vorauszahlungen − Kosten (negativ = Nachzahlung) |
| `consumption.*` | optional | Verbrauchswerte für die Diagramme |
| `receivedOn` | optional | Zugang der Abrechnung → Einwendungsfrist (12 Monate) |

Die App akzeptiert außerdem eine einzelne Abrechnung ohne Hülle (`{ "year": …, "positions": [ … ] }`)
und eigene Sicherungsdateien (`"format": "nebenkostencheck-backup"`).
