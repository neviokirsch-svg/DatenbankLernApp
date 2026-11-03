import Combine
import Foundation

/// Lernstand einer Frage oder eines Aufgabentyps (vereinfachtes Spaced Repetition).
struct ItemState: Codable {
    var reps: Int = 0
    var ease: Double = 2.5
    var intervalDays: Double = 0
    var due: Date = Date()
    var correct: Int = 0
    var wrong: Int = 0
    var lastCorrect: Bool = false
    var lastAnswered: Date = Date()

    var isWeak: Bool { wrong > 0 && (!lastCorrect || reps < 2) }
    var isMastered: Bool { reps >= 3 && lastCorrect }
}

struct ExamResult: Codable, Identifiable {
    var id: UUID = UUID()
    var date: Date
    var points: Double
    var maxPoints: Double
    var minutes: Int
    var count: Int
    var examId: String = ""
    var title: String = ""
    var percent: Double { maxPoints > 0 ? points / maxPoints * 100 : 0 }
}

struct ProgressData: Codable {
    var readSections: [String: Date] = [:]
    var items: [String: ItemState] = [:]
    var exams: [ExamResult] = []
    var answersPerDay: [String: Int] = [:]
    var lastModuleID: String?
    var lastSectionID: String?
}

enum AnswerRating {
    case wrong, hard, good
}

final class ProgressStore: ObservableObject {
    @Published private(set) var data = ProgressData()
    private let fileURL: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("lernstand.json")
        if let raw = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(ProgressData.self, from: raw) {
            data = decoded
        }
    }

    private func save() {
        if let raw = try? JSONEncoder().encode(data) {
            try? raw.write(to: fileURL, options: .atomic)
        }
    }

    // MARK: Lesen

    func markRead(sectionID: String, moduleID: String) {
        if data.readSections[sectionID] == nil {
            data.readSections[sectionID] = Date()
        }
        data.lastModuleID = moduleID
        data.lastSectionID = sectionID
        save()
    }

    func isRead(_ sectionID: String) -> Bool { data.readSections[sectionID] != nil }

    func readFraction(_ module: LearningModule) -> Double {
        guard !module.sections.isEmpty else { return 0 }
        let n = module.sections.filter { isRead($0.id) }.count
        return Double(n) / Double(module.sections.count)
    }

    func isFullyRead(_ module: LearningModule) -> Bool { readFraction(module) >= 1 }

    // MARK: Wiederholen

    func state(_ id: String) -> ItemState? { data.items[id] }

    /// Trägt eine Antwort ein und plant die nächste Wiederholung.
    func record(id: String, rating: AnswerRating) {
        var s = data.items[id] ?? ItemState()
        let now = Date()
        switch rating {
        case .wrong:
            s.wrong += 1
            s.reps = 0
            s.lastCorrect = false
            s.ease = max(1.3, s.ease - 0.2)
            s.intervalDays = 0
            s.due = now.addingTimeInterval(10 * 60)
        case .hard, .good:
            s.correct += 1
            s.lastCorrect = true
            s.reps += 1
            if rating == .hard { s.ease = max(1.3, s.ease - 0.15) }
            if s.reps == 1 {
                s.intervalDays = rating == .hard ? 1 : 2
            } else if s.reps == 2 {
                s.intervalDays = rating == .hard ? 3 : 6
            } else {
                s.intervalDays = s.intervalDays * (rating == .hard ? 1.2 : s.ease)
            }
            s.due = now.addingTimeInterval(s.intervalDays * 86400)
        }
        s.lastAnswered = now
        data.items[id] = s
        let key = Self.dayKey(now)
        data.answersPerDay[key, default: 0] += 1
        save()
    }

    func dueItemIDs(now: Date = Date()) -> [String] {
        data.items
            .filter { $0.value.due <= now }
            .sorted { $0.value.due < $1.value.due }
            .map { $0.key }
    }

    func weakItemIDs() -> [String] {
        data.items
            .filter { $0.value.isWeak }
            .sorted { $0.value.wrong > $1.value.wrong }
            .map { $0.key }
    }

    func learnedItemIDs() -> [String] {
        data.items
            .sorted { $0.value.lastAnswered > $1.value.lastAnswered }
            .map { $0.key }
    }

    /// Anteil beherrschter Fragen eines Moduls (0...1).
    func mastery(_ module: LearningModule) -> Double {
        let ids = module.questions.map { $0.id } + module.calcIDs
        guard !ids.isEmpty else { return 0 }
        var sum = 0.0
        for id in ids {
            guard let s = data.items[id] else { continue }
            if s.isMastered {
                sum += 1
            } else if s.lastCorrect {
                sum += 0.5
            }
        }
        return sum / Double(ids.count)
    }

    func answeredCount(_ module: LearningModule) -> Int {
        (module.questions.map { $0.id } + module.calcIDs).filter { data.items[$0] != nil }.count
    }

    /// Gewichtet nach Klausuranteil, damit die großen Aufgaben stärker zählen.
    func overallMastery(_ modules: [LearningModule]) -> Double {
        let total = modules.reduce(0) { $0 + ($1.weight ?? 0) }
        guard total > 0 else { return 0 }
        return modules.reduce(0.0) { $0 + Double($1.weight ?? 0) * mastery($1) } / Double(total)
    }

    // MARK: Klausur

    func addExam(_ result: ExamResult) {
        data.exams.insert(result, at: 0)
        save()
    }

    // MARK: Statistik

    static func dayKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    var answersToday: Int { data.answersPerDay[Self.dayKey(Date())] ?? 0 }

    /// Aufeinanderfolgende Lerntage bis heute.
    var streak: Int {
        var count = 0
        var day = Date()
        if data.answersPerDay[Self.dayKey(day)] == nil {
            guard let y = Calendar.current.date(byAdding: .day, value: -1, to: day) else { return 0 }
            day = y
        }
        while data.answersPerDay[Self.dayKey(day)] != nil {
            count += 1
            guard let prev = Calendar.current.date(byAdding: .day, value: -1, to: day) else { break }
            day = prev
        }
        return count
    }

    func lastDays(_ n: Int) -> [(label: String, count: Int)] {
        var out: [(label: String, count: Int)] = []
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "EE"
        for offset in stride(from: n - 1, through: 0, by: -1) {
            guard let d = Calendar.current.date(byAdding: .day, value: -offset, to: Date()) else { continue }
            out.append((formatter.string(from: d), data.answersPerDay[Self.dayKey(d)] ?? 0))
        }
        return out
    }

    func resetAll() {
        data = ProgressData()
        save()
    }
}
