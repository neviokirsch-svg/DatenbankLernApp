import Foundation
import JavaScriptCore

/// Aufgabentyp des Trainers. Erzeugt bei jedem Aufruf eine neue Aufgabe.
struct CalcGenerator: Identifiable {
    let id: String
    let title: String
    let group: String
    let icon: String
    let formula: String
    let ref: String
    let lvl: Int
    let pts: Int
    let make: () -> Question
}

/// Die Logik liegt einmal in engine.js und wird über JavaScriptCore genutzt.
/// So rechnen HTML-Version und App garantiert gleich, und die Tests in tools/ gelten für beide.
enum CalcEngine {
    private struct Info: Codable {
        let id: String
        let title: String
        let group: String
        let icon: String
        let formula: String
        let ref: String
        let lvl: Int
        let pts: Int
    }

    private static let context: JSContext? = {
        guard let url = Bundle.main.url(forResource: "engine_js", withExtension: "txt"),
              let code = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        let created: JSContext? = JSContext()
        guard let ctx = created else { return nil }
        ctx.evaluateScript(code)
        return ctx
    }()

    static let all: [CalcGenerator] = {
        guard let text = context?.evaluateScript("JSON.stringify(DBEngine.Calc.list())")?.toString(),
              let data = text.data(using: .utf8),
              let list = try? JSONDecoder().decode([Info].self, from: data) else { return [] }
        return list.map { info in
            CalcGenerator(id: info.id, title: info.title, group: info.group, icon: info.icon, formula: info.formula,
                          ref: info.ref, lvl: info.lvl, pts: info.pts, make: { makeQuestion(id: info.id) })
        }
    }()

    static func generator(id: String) -> CalcGenerator? { all.first { $0.id == id } }

    static var groups: [String] {
        var seen: [String] = []
        for g in all where !seen.contains(g.group) { seen.append(g.group) }
        return seen
    }

    private static func makeQuestion(id: String) -> Question {
        if let text = context?.evaluateScript("JSON.stringify(DBEngine.Calc.make('\(id)'))")?.toString(),
           let data = text.data(using: .utf8),
           let q = try? JSONDecoder().decode(Question.self, from: data) {
            return q
        }
        return Question(id: id, k: .open, lvl: 1, pts: 1, q: "Die Aufgabe konnte nicht erzeugt werden.", model: ["Bitte die App neu starten."])
    }
}
