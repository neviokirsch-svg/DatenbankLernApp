import Combine
import Foundation

// MARK: - Beliebige JSON-Werte (Parameter für Labore und ER-Diagramme)

enum JSONValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([JSONValue].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }

    subscript(key: String) -> JSONValue? {
        if case .object(let o) = self { return o[key] }
        return nil
    }
}

extension Encodable {
    /// JSON-Text für die Übergabe an die Web-Labore.
    var jsonString: String {
        guard let data = try? JSONEncoder().encode(self), let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }
}

// MARK: - Kurs und Klausur

struct Course: Codable {
    let title: String
    let subtitle: String
    let tagline: String
    let weightNote: String
    let examIntro: String
    let examNote: String
    let examTasks: [ExamTask]
}

/// Eine Aufgabe der Klausur mit geschätztem Anteil.
struct ExamTask: Codable, Identifiable {
    let no: Int
    let title: String
    let min: Int
    let pct: Int
    let what: String
    var id: Int { no }
}

struct ExamDefinition: Codable, Identifiable {
    let id: String
    let title: String
    let scenario: String
    let minutes: Int
    let tasks: [ExamTaskDefinition]
}

struct ExamTaskDefinition: Codable, Identifiable {
    let no: Int
    let title: String
    let pts: Int
    var intro: String?
    var fig: Block?
    let questions: [Question]
    var id: Int { no }
}

// MARK: - Module & Lektion

struct LearningModule: Codable, Identifiable, Hashable {
    let id: String
    let part: Int
    let order: Int
    let title: String
    let pages: String
    let icon: String
    let goal: String
    let sections: [LessonSection]
    let questions: [Question]
    let calcs: [String]?
    var exam: Int?
    var weight: Int?
    var glyph: String?

    var calcIDs: [String] { calcs ?? [] }
    static func == (lhs: LearningModule, rhs: LearningModule) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct LessonSection: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let blocks: [Block]
    /// Aufgaben, die direkt nach der Theorie dieses Abschnitts kommen.
    var practice: [String]?
    static func == (lhs: LessonSection, rhs: LessonSection) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Inhaltsblöcke

/// Ein Block eines Skript-Abschnitts. `t` bestimmt, welche Felder gesetzt sind:
/// p (Text), h (Zwischentitel), b (Stichpunkte), k (Merke), w (Klausurfalle), ex (Klausurbezug), f (Formel),
/// s (Schema), code (Quelltext), tb (Tabelle), rels (mehrere Relationen), sl (Folie), st (Schrittfolge),
/// net (Netzdiagramm), bars (Balken), er (Chen-Diagramm), x (Labor). er und x laufen über WebBlockView.
struct Block: Codable {
    let t: String
    var x: String?
    var i: [String]?
    var head: [String]?
    var rows: [[String]]?
    var part: Int?
    var page: Int?
    var crop: [Int]?
    var title: String?
    var lifelines: [String]?
    var msgs: [SeqMessage]?
    var nodes: [NetNode]?
    var edges: [NetEdge]?
    var steps: [NetStep]?
    var frames: [FrameRow]?
    var reveal: Bool?
    var bars: [BarItem]?
    var unit: String?
    var viz: String?
    var tabs: [NetTable]?
    var er: JSONValue?
    var anim: Bool?
    var params: JSONValue?
    var height: Double?
}

struct SeqMessage: Codable {
    let f: Int
    let to: Int
    let l: String
    var n: String?
    var c: String?
}

struct NetNode: Codable {
    let id: String
    let l: String
    let x: Double
    let y: Double
    var s: String?
}

struct NetEdge: Codable {
    let a: String
    let b: String
    var l: String?
}

struct NetPacket: Codable {
    let a: String
    let b: String
    var l: String?
    var c: String?
}

struct NetTable: Codable {
    var title: String?
    let head: [String]
    let rows: [[String]]
    var hl: [Int]?
    var ok: [Int]?
    var bad: [Int]?
    var dim: [Int]?
}

struct NetStep: Codable {
    let x: String
    var hn: [String]?
    var he: [[String]]?
    var dn: [String]?
    var de: [[String]]?
    var p: [NetPacket]?
    var tb: NetTable?
    var f: String?
    var tabs: [NetTable]?
}

struct FrameRow: Codable {
    var l: String?
    let segs: [FrameSeg]
}

struct FrameSeg: Codable {
    let t: String
    let w: Double
    var c: String?
    var d: String?
}

struct BarItem: Codable {
    let l: String
    let v: Double
    var v2: Double?
    var c: String?
}

// MARK: - Fragen

enum QuestionKind: String, Codable {
    case mc, ms, tf, num, ord, match, open, lab
}

struct TFStatement: Codable, Hashable {
    let s: String
    let v: Bool
    var e: String?
}

struct Question: Codable, Identifiable, Hashable {
    let id: String
    let k: QuestionKind
    let lvl: Int
    let pts: Int
    let q: String
    var o: [String]?
    var a: [Int]?
    var st: [TFStatement]?
    var num: Double?
    var tol: Double?
    var unit: String?
    var steps: [String]?
    var seq: [String]?
    var pairs: [[String]]?
    var model: [String]?
    var e: String?
    var ref: String?
    var src: String?
    var fig: Block?
    /// Reihenfolge der Optionen beibehalten, z. B. bei Attributen A bis E.
    var keep: Bool?
    /// Zusätzliche Blöcke in der Lösung, z. B. ein ER-Diagramm.
    var sol: [Block]?
    var viz: String?
    var params: JSONValue?

    static func == (lhs: Question, rhs: Question) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Skript-Folie aus der Referenz, z.B. "T3 S.15" -> (3, 15)
    var slideReference: (part: Int, page: Int)? {
        guard let ref = ref else { return nil }
        let parts = ref.replacingOccurrences(of: "–", with: "-").split(separator: " ")
        guard parts.count >= 2, parts[0].hasPrefix("T"), let p = Int(parts[0].dropFirst()) else { return nil }
        let rest = parts[1].replacingOccurrences(of: "S.", with: "")
        guard let first = rest.split(separator: "-").first, let page = Int(first) else { return nil }
        return (p, page)
    }
}

// MARK: - Inhalts-Bibliothek

final class ContentLibrary: ObservableObject {
    @Published private(set) var modules: [LearningModule] = []
    @Published private(set) var course: Course?
    @Published private(set) var exams: [ExamDefinition] = []
    @Published private(set) var loadErrors: [String] = []
    private var questionIndex: [String: Question] = [:]

    init() { load() }

    private func load() {
        let urls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: nil) ?? []
        var loaded: [LearningModule] = []
        var errors: [String] = []
        let decoder = JSONDecoder()
        for url in urls where url.lastPathComponent.hasPrefix("module_") {
            do {
                let data = try Data(contentsOf: url)
                loaded.append(try decoder.decode(LearningModule.self, from: data))
            } catch {
                errors.append("\(url.lastPathComponent): \(error)")
            }
        }
        loaded.sort { $0.order < $1.order }
        modules = loaded

        if let url = Bundle.main.url(forResource: "course", withExtension: "json") {
            do {
                course = try decoder.decode(Course.self, from: try Data(contentsOf: url))
            } catch {
                errors.append("course.json: \(error)")
            }
        }
        if let url = Bundle.main.url(forResource: "exams", withExtension: "json") {
            do {
                exams = try decoder.decode([ExamDefinition].self, from: try Data(contentsOf: url))
            } catch {
                errors.append("exams.json: \(error)")
            }
        }
        loadErrors = errors
        for m in loaded {
            for q in m.questions { questionIndex[q.id] = q }
        }
        for exam in exams {
            for task in exam.tasks {
                for q in task.questions { questionIndex[q.id] = q }
            }
        }
    }

    func question(id: String) -> Question? { questionIndex[id] }

    var allQuestions: [Question] { modules.flatMap { $0.questions } }

    func module(id: String) -> LearningModule? { modules.first { $0.id == id } }

    func module(forCalc calcID: String) -> LearningModule? {
        modules.first { $0.calcIDs.contains(calcID) }
    }
}
