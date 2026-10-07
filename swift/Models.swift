// NebenkostenCheck – Datenmodelle für eine spätere native iOS-App.
//
// 1:1 zum JSON-Format (docs/schema/nebenkostencheck.schema.json), damit die iOS-App
// Sicherungen der Web-App und Claude-Importdateien direkt lesen kann.
// Rechenlogik: siehe js/analysis.js – Ergebnisse müssen tests/golden.json entsprechen.
//
// Hinweis: In dieser Umgebung nicht kompiliert – beim Anlegen des Xcode-Projekts prüfen.

import Foundation

// MARK: - Import / Sicherung

struct ImportFile: Codable {
    var format: String              // "nebenkostencheck" | "nebenkostencheck-backup"
    var formatVersion: Int          // aktuell 1
    var statements: [Statement] = []
    var contracts: [Contract] = []
    var files: [Attachment]? = nil  // nur in Sicherungen
}

/// Dokument zu einem Vertrag (in der Sicherung als Base64).
/// iOS: Datei im App-Container ablegen, Metadaten in SwiftData; Anzeige per QuickLook.
struct Attachment: Codable, Identifiable, Hashable {
    var id: String
    var contractId: String
    var name: String
    var type: String?               // MIME-Typ
    var size: Int?
    var addedAt: String?            // ISO 8601
    var data: Data?                 // Codable dekodiert Base64-Strings automatisch zu Data
}

// MARK: - Nebenkostenabrechnung

enum CostCategory: String, Codable, CaseIterable {
    case heizung, warmwasser, wasser, hausmeister, reinigung, garten, grundsteuer, muell
    case versicherung, strom, aufzug, kabel, wartung, stellplatz, sonstiges

    /// Dashboard-Gruppe (feste Reihenfolge = feste Farbe)
    var group: CostGroup {
        switch self {
        case .heizung: return .heizung
        case .warmwasser: return .warmwasser
        case .wasser: return .wasser
        case .hausmeister, .reinigung, .garten: return .hausmeister
        case .grundsteuer: return .grundsteuer
        case .muell: return .muell
        case .versicherung: return .versicherung
        case .strom, .aufzug, .kabel, .wartung, .stellplatz, .sonstiges: return .sonstiges
        }
    }
}

enum CostGroup: String, CaseIterable {
    case wasser, heizung, hausmeister, warmwasser, grundsteuer, muell, versicherung, sonstiges
}

struct Position: Codable, Hashable {
    var label: String
    var category: CostCategory
    var amount: Decimal              // Anteil des Mieters
    var buildingTotal: Decimal?
    var allocationKey: String?
    var share: String?
    var source: String?
    var note: String?
}

struct Unit: Codable, Hashable {
    var label: String?
    var livingArea: Decimal?
    var meaShare: Decimal?
    var meaTotal: Decimal?
}

struct Totals: Codable, Hashable {
    var costs: Decimal?
    var prepayments: Decimal?
    var balance: Decimal?            // prepayments − costs; negativ = Nachzahlung
}

struct PrepaymentRate: Codable, Hashable {
    var months: Int
    var monthly: Decimal
}

struct Consumption: Codable, Hashable {
    var heatingKwh: Decimal?
    var hotWaterM3: Decimal?
    var hotWaterKwh: Decimal?
    var coldWaterM3: Decimal?
    var waterTotalM3: Decimal?
    var heatingKwhPerM2: Decimal?
    var heatingKwhPerM2Building: Decimal?
    var hotWaterKwhPerM2: Decimal?
    var hotWaterKwhPerM2Building: Decimal?
    var co2CostTenant: Decimal?
    var energyPricePerKwh: Decimal?
}

struct ConsumptionHistory: Codable, Hashable {
    var year: Int
    var heatingKwh: Decimal?
    var hotWaterKwh: Decimal?
    var waterTotalM3: Decimal?
}

struct Tax35a: Codable, Hashable {
    var householdServices: Decimal?
    var craftsmenServices: Decimal?
}

struct Statement: Codable, Identifiable, Hashable {
    var id: Int { year }
    var year: Int
    var periodFrom: String?          // "YYYY-MM-DD"
    var periodTo: String?
    var usageFrom: String?
    var usageTo: String?
    var issuedOn: String?
    var receivedOn: String?
    var dueOn: String?
    var issuer: String?
    var unit: Unit?
    var positions: [Position]
    var totals: Totals?
    var prepaymentSchedule: [PrepaymentRate]?
    var consumption: Consumption?
    var consumptionHistory: [ConsumptionHistory]?
    var tax35a: Tax35a?
    var notes: [String]?
}

// MARK: - Verträge

enum ContractCategory: String, Codable, CaseIterable {
    case versicherung = "Versicherung", handy = "Handy", internet = "Internet", strom = "Strom", gas = "Gas"
    case streaming = "Streaming", rundfunk = "Rundfunk", fitness = "Fitness", auto = "Auto", bank = "Bank"
    case software = "Software", sonstiges = "Sonstiges"
}

struct ContractYear: Codable, Hashable {
    var year: Int
    var cost: Decimal?               // Kosten im Kalenderjahr (alternativ monthly × 12)
    var monthly: Decimal?
    var tariff: String?
    var provider: String?
    var benchmark: Decimal?          // günstigstes Angebot pro Jahr (alternativ benchmarkMonthly × 12)
    var benchmarkMonthly: Decimal?
    var benchmarkNote: String?
    var note: String?
    var fromEstimate: Bool?          // aus Schätzung übernommen → rückgängig machbar
}

struct Contract: Codable, Identifiable, Hashable {
    var id: String?                  // fehlt bei Claude-Importen → beim Import UUID vergeben
    var name: String
    var category: ContractCategory
    var provider: String?
    var contractNo: String?
    var startDate: String?
    var endDate: String?
    var noticePeriodMonths: Int?
    var autoRenewMonths: Int?
    var active: Bool?
    var notes: String?
    var years: [ContractYear]
}
