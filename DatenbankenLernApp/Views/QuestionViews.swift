import SwiftUI

// MARK: - Antwort-Entwurf

struct AnswerDraft {
    var optionOrder: [Int] = []
    var selected: Set<Int> = []
    var tf: [Int: Bool] = [:]
    var numText: String = ""
    var order: [String] = []
    var match: [Int: String] = [:]
    var matchChoices: [String] = []
    var openText: String = ""
    var openChecks: Set<Int> = []
    var labScore: Double?

    static func fresh(for q: Question) -> AnswerDraft {
        var d = AnswerDraft()
        d.optionOrder = q.keep == true ? Array((q.o ?? []).indices) : Array((q.o ?? []).indices).shuffled()
        if case .bool(true)? = q.params?["autoDone"] { d.labScore = 1 }
        var seq = (q.seq ?? []).shuffled()
        if seq == q.seq && seq.count > 1 { seq.reverse() }
        d.order = seq
        d.matchChoices = Array(Set((q.pairs ?? []).compactMap { $0.count > 1 ? $0[1] : nil })).shuffled()
        return d
    }

    var isAnswered: Bool { !selected.isEmpty || !tf.isEmpty || !numText.isEmpty || !match.isEmpty || !openText.isEmpty || labScore != nil }

    /// Punkteanteil 0...1.
    func score(for q: Question) -> Double {
        switch q.k {
        case .mc:
            guard let correct = q.a?.first, let pick = selected.first else { return 0 }
            return pick == correct ? 1 : 0
        case .ms:
            let correct = Set(q.a ?? [])
            guard !correct.isEmpty else { return 0 }
            let hits = selected.intersection(correct).count
            let misses = selected.subtracting(correct).count
            return max(0, Double(hits - misses) / Double(correct.count))
        case .tf:
            let statements = q.st ?? []
            guard !statements.isEmpty else { return 0 }
            var hits = 0
            for (i, s) in statements.enumerated() where tf[i] == s.v { hits += 1 }
            return Double(hits) / Double(statements.count)
        case .num:
            guard let value = parseNumber(numText), let target = q.num else { return 0 }
            return abs(value - target) <= (q.tol ?? 0.01) ? 1 : 0
        case .ord:
            let solution = q.seq ?? []
            guard !solution.isEmpty else { return 0 }
            var hits = 0
            for (i, item) in order.enumerated() where i < solution.count && solution[i] == item { hits += 1 }
            return Double(hits) / Double(solution.count)
        case .match:
            let pairs = q.pairs ?? []
            guard !pairs.isEmpty else { return 0 }
            var hits = 0
            for (i, pair) in pairs.enumerated() where pair.count >= 2 && match[i] == pair[1] { hits += 1 }
            return Double(hits) / Double(pairs.count)
        case .open:
            let points = q.model ?? []
            guard !points.isEmpty else { return 0 }
            return Double(openChecks.count) / Double(points.count)
        case .lab:
            return labScore ?? 0
        }
    }
}

// MARK: - Fragenkopf

struct QuestionHeader: View {
    let q: Question

    private var kindName: String {
        switch q.k {
        case .mc: return "Einfachauswahl"
        case .ms: return "Mehrfachauswahl"
        case .tf: return "Richtig oder falsch?"
        case .num: return "Rechenaufgabe"
        case .ord: return "Reihenfolge"
        case .match: return "Zuordnung"
        case .open: return "Offene Frage"
        case .lab: return "Interaktive Aufgabe"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(kindName)
                    .font(.caption.bold())
                    .foregroundStyle(Theme.primary)
                if let src = q.src {
                    Text(src == "trainer" ? "Zufallsaufgabe" : src)
                        .font(.caption2.bold())
                        .foregroundStyle(src == "klausurnah" ? Theme.violet : Color.secondary)
                }
                Spacer()
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { i in
                        Image(systemName: i < q.lvl ? "circle.fill" : "circle")
                            .font(.system(size: 7))
                    }
                }
                .foregroundStyle(Theme.warn)
                Text("\(q.pts) P.")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            RichText(q.q)
                .font(.title3.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Eingabe

struct QuestionInputView: View {
    let q: Question
    @Binding var draft: AnswerDraft
    let locked: Bool
    let showSolution: Bool

    var body: some View {
        switch q.k {
        case .mc, .ms: optionsView
        case .tf: truthView
        case .num: numericView
        case .ord: orderView
        case .match: matchView
        case .open: openView
        case .lab: WebBlockView(payload: q.jsonString, onScore: { draft.labScore = $0 })
        }
    }

    // Einfach- und Mehrfachauswahl

    private var optionsView: some View {
        let options = q.o ?? []
        let correct = Set(q.a ?? [])
        return VStack(spacing: 8) {
            if q.k == .ms {
                Text("Mehrere Antworten können richtig sein.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            ForEach(draft.optionOrder, id: \.self) { index in
                let isSelected = draft.selected.contains(index)
                Button {
                    guard !locked else { return }
                    if q.k == .mc {
                        draft.selected = [index]
                    } else if isSelected {
                        draft.selected.remove(index)
                    } else {
                        draft.selected.insert(index)
                    }
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: optionSymbol(index: index, isSelected: isSelected, correct: correct))
                            .foregroundStyle(optionColor(index: index, isSelected: isSelected, correct: correct))
                        RichText(options[index])
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(12)
                    .background(optionBackground(index: index, isSelected: isSelected, correct: correct), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func optionSymbol(index: Int, isSelected: Bool, correct: Set<Int>) -> String {
        if showSolution {
            if correct.contains(index) { return "checkmark.circle.fill" }
            if isSelected { return "xmark.circle.fill" }
        }
        if q.k == .ms { return isSelected ? "checkmark.square.fill" : "square" }
        return isSelected ? "largecircle.fill.circle" : "circle"
    }

    private func optionColor(index: Int, isSelected: Bool, correct: Set<Int>) -> Color {
        if showSolution {
            if correct.contains(index) { return Theme.good }
            if isSelected { return Theme.bad }
            return Color.secondary
        }
        return isSelected ? Theme.primary : Color.secondary
    }

    private func optionBackground(index: Int, isSelected: Bool, correct: Set<Int>) -> Color {
        if showSolution {
            if correct.contains(index) { return Theme.good.opacity(0.18) }
            if isSelected { return Theme.bad.opacity(0.18) }
            return Color.secondary.opacity(0.08)
        }
        return isSelected ? Theme.primary.opacity(0.18) : Color.secondary.opacity(0.08)
    }

    // Richtig / Falsch

    private var truthView: some View {
        let statements = q.st ?? []
        return VStack(spacing: 10) {
            ForEach(Array(statements.enumerated()), id: \.offset) { i, statement in
                VStack(alignment: .leading, spacing: 8) {
                    RichText(statement.s).frame(maxWidth: .infinity, alignment: .leading)
                    HStack {
                        truthButton(i, value: true, label: "Richtig", statement: statement)
                        truthButton(i, value: false, label: "Falsch", statement: statement)
                    }
                    if showSolution, let e = statement.e {
                        RichText(e).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(12)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private func truthButton(_ i: Int, value: Bool, label: String, statement: TFStatement) -> some View {
        let isSelected = draft.tf[i] == value
        var background = isSelected ? Theme.primary.opacity(0.25) : Color.secondary.opacity(0.1)
        if showSolution {
            if statement.v == value {
                background = Theme.good.opacity(0.3)
            } else if isSelected {
                background = Theme.bad.opacity(0.3)
            }
        }
        return Button {
            guard !locked else { return }
            draft.tf[i] = value
        } label: {
            Text(label)
                .font(.subheadline.weight(isSelected ? .bold : .regular))
                .frame(maxWidth: .infinity, minHeight: 34)
                .background(background, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // Zahl

    private var numericView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                TextField("Ergebnis", text: $draft.numText)
                    .keyboardType(.numbersAndPunctuation)
                    .textFieldStyle(.roundedBorder)
                    .font(.title3.monospacedDigit())
                    .disabled(locked)
                if let unit = q.unit, !unit.isEmpty {
                    Text(unit).font(.headline).foregroundStyle(.secondary)
                }
            }
            if showSolution, let target = q.num {
                Text("Lösung: \(deNumber(target, maxDigits: 4)) \(q.unit ?? "")")
                    .font(.headline)
                    .foregroundStyle(Theme.good)
            }
        }
    }

    // Reihenfolge

    private var orderView: some View {
        let solution = q.seq ?? []
        return VStack(spacing: 6) {
            ForEach(Array(draft.order.enumerated()), id: \.element) { i, item in
                let right = i < solution.count && solution[i] == item
                HStack(spacing: 10) {
                    Text("\(i + 1)")
                        .font(.caption.bold())
                        .frame(width: 22, height: 22)
                        .background(Theme.primary.opacity(0.18), in: Circle())
                    RichText(item).frame(maxWidth: .infinity, alignment: .leading)
                    if !locked {
                        Button { move(i, by: -1) } label: { Image(systemName: "chevron.up") }
                            .disabled(i == 0)
                        Button { move(i, by: 1) } label: { Image(systemName: "chevron.down") }
                            .disabled(i == draft.order.count - 1)
                    } else if showSolution {
                        Image(systemName: right ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundStyle(right ? Theme.good : Theme.bad)
                    }
                }
                .buttonStyle(.plain)
                .padding(10)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            if showSolution {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Richtige Reihenfolge").font(.caption.bold())
                    ForEach(Array(solution.enumerated()), id: \.offset) { i, item in
                        Text("\(i + 1). \(item)").font(.caption)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Theme.good.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private func move(_ index: Int, by delta: Int) {
        let target = index + delta
        guard draft.order.indices.contains(target) else { return }
        withAnimation(.spring(response: 0.3)) {
            draft.order.swapAt(index, target)
        }
    }

    // Zuordnung

    private var matchView: some View {
        let pairs = q.pairs ?? []
        return VStack(spacing: 8) {
            ForEach(Array(pairs.enumerated()), id: \.offset) { i, pair in
                VStack(alignment: .leading, spacing: 5) {
                    RichText(pair.first ?? "").font(.subheadline.bold())
                    Menu {
                        ForEach(draft.matchChoices, id: \.self) { choice in
                            Button(choice) { draft.match[i] = choice }
                        }
                    } label: {
                        HStack {
                            Text(draft.match[i] ?? "Auswählen …")
                                .multilineTextAlignment(.leading)
                                .foregroundStyle(draft.match[i] == nil ? Color.secondary : Color.primary)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.caption)
                        }
                        .padding(9)
                        .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .disabled(locked)
                    if showSolution, pair.count >= 2 {
                        Label(pair[1], systemImage: draft.match[i] == pair[1] ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(draft.match[i] == pair[1] ? Theme.good : Theme.bad)
                        if pair.count > 2 {
                            RichText(pair[2]).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    // Offen

    private var openView: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Deine Antwort (Stichpunkte reichen) …", text: $draft.openText, axis: .vertical)
                .lineLimit(3...8)
                .textFieldStyle(.roundedBorder)
                .disabled(locked)
            if showSolution {
                Text("Vergleiche mit der Musterlösung und hake ab, was du genannt hast:")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ForEach(Array((q.model ?? []).enumerated()), id: \.offset) { i, point in
                    Button {
                        if draft.openChecks.contains(i) {
                            draft.openChecks.remove(i)
                        } else {
                            draft.openChecks.insert(i)
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: draft.openChecks.contains(i) ? "checkmark.square.fill" : "square")
                                .foregroundStyle(draft.openChecks.contains(i) ? Theme.good : Color.secondary)
                            RichText(point)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Erklärung

struct SolutionPanel: View {
    let q: Question
    let score: Double
    @State private var showSlide = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if q.k != .open {
                Label(
                    score >= 0.999 ? "Richtig!" : (score > 0 ? "Teilweise richtig" : "Noch nicht richtig"),
                    systemImage: score >= 0.999 ? "checkmark.seal.fill" : (score > 0 ? "circle.lefthalf.filled" : "xmark.seal.fill")
                )
                .font(.headline)
                .foregroundStyle(score >= 0.999 ? Theme.good : (score > 0 ? Theme.warn : Theme.bad))
            }
            if let steps = q.steps, !steps.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Lösungsweg").font(.caption.bold()).foregroundStyle(.secondary)
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, step in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(i + 1).").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                            RichText(step).frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            if let e = q.e {
                RichText(e).frame(maxWidth: .infinity, alignment: .leading)
            }
            ForEach(Array((q.sol ?? []).enumerated()), id: \.offset) { _, block in
                BlockView(block: block)
            }
            if let reference = q.slideReference {
                Button {
                    showSlide = true
                } label: {
                    Label("Im Skript nachsehen: \(q.ref ?? "")", systemImage: "doc.richtext")
                        .font(.subheadline)
                }
                .fullScreenCover(isPresented: $showSlide) {
                    SlideViewer(part: reference.part, page: reference.page)
                }
            }
        }
        .card()
    }
}

// MARK: - Übungs-Sitzung

struct QuizConfig: Identifiable {
    let id = UUID()
    let title: String
    let questions: [Question]
}

struct QuizSessionView: View {
    let config: QuizConfig
    @EnvironmentObject var progress: ProgressStore
    @Environment(\.dismiss) private var dismiss

    @State private var queue: [Question] = []
    @State private var index = 0
    @State private var draft = AnswerDraft()
    @State private var revealed = false
    @State private var ratedOpen = false
    @State private var totalPoints = 0.0
    @State private var maxPoints = 0.0
    @State private var wrongIDs: Set<String> = []
    @State private var requeued: Set<String> = []
    @State private var finished = false

    private var current: Question? { index < queue.count ? queue[index] : nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if finished || config.questions.isEmpty {
                        summary
                    } else if let q = current {
                        ProgressView(value: Double(index), total: Double(max(queue.count, 1)))
                            .tint(Theme.primary)
                        VStack(alignment: .leading, spacing: 14) {
                            QuestionHeader(q: q)
                            if let fig = q.fig { BlockView(block: fig) }
                        }
                        .card()
                        QuestionInputView(q: q, draft: $draft, locked: revealed && q.k != .open, showSolution: revealed)
                            .card()
                        if revealed {
                            SolutionPanel(q: q, score: draft.score(for: q))
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                        actionButton(q)
                    }
                }
                .padding()
                .animation(.spring(response: 0.4), value: revealed)
                .id(index)
            }
            .liquidScreen()
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(config.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Beenden") { dismiss() }
                }
                if !finished, !queue.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Text("\(min(index + 1, queue.count))/\(queue.count)")
                            .font(.caption.monospacedDigit())
                    }
                }
            }
        }
        .onAppear {
            if queue.isEmpty {
                queue = config.questions
                if let first = queue.first { draft = AnswerDraft.fresh(for: first) }
            }
        }
    }

    @ViewBuilder
    private func actionButton(_ q: Question) -> some View {
        if !revealed {
            Button {
                reveal(q)
            } label: {
                Text(q.k == .open ? "Musterlösung zeigen" : "Prüfen").mainAction()
            }
            .liquidButton()
            .disabled(q.k != .open && !draft.isAnswered && q.k != .ord)
        } else {
            Button {
                advance(q)
            } label: {
                Text(index + 1 < queue.count ? "Weiter" : "Abschließen").mainAction()
            }
            .liquidButton()
        }
    }

    private func reveal(_ q: Question) {
        withAnimation { revealed = true }
        if q.k != .open { apply(q) }
    }

    private func apply(_ q: Question) {
        let score = draft.score(for: q)
        totalPoints += score * Double(q.pts)
        maxPoints += Double(q.pts)
        let rating: AnswerRating = score >= 0.999 ? .good : (score >= 0.5 ? .hard : .wrong)
        progress.record(id: q.id, rating: rating)
        if rating == .wrong {
            wrongIDs.insert(q.id)
            // Falsche Fragen kommen einmal in derselben Sitzung wieder.
            if !requeued.contains(q.id) && q.k != .lab && q.k != .open {
                requeued.insert(q.id)
                queue.append(q)
            }
        }
    }

    private func advance(_ q: Question) {
        if q.k == .open { apply(q) }
        if index + 1 < queue.count {
            index += 1
            draft = AnswerDraft.fresh(for: queue[index])
            revealed = false
        } else {
            finished = true
        }
    }

    private var summary: some View {
        let ratio = maxPoints > 0 ? totalPoints / maxPoints : 0
        return VStack(spacing: 16) {
            ZStack {
                ProgressRing(value: ratio, color: ratio >= 0.5 ? Theme.good : Theme.warn, lineWidth: 12)
                    .frame(width: 130, height: 130)
                Text("\(Int((ratio * 100).rounded())) %")
                    .font(.title.bold())
            }
            Text(config.questions.isEmpty ? "Gerade ist nichts zu tun." : "Sitzung abgeschlossen")
                .font(.title2.bold())
            if !config.questions.isEmpty {
                Text("\(deNumber(totalPoints, maxDigits: 1)) von \(deNumber(maxPoints, maxDigits: 1)) Punkten")
                    .foregroundStyle(.secondary)
            }
            if !wrongIDs.isEmpty {
                Label("\(wrongIDs.count) Fragen kommen bald wieder dran.", systemImage: "arrow.triangle.2.circlepath")
                    .font(.subheadline)
                    .foregroundStyle(Theme.warn)
            }
            Button {
                dismiss()
            } label: {
                Text("Fertig").mainAction()
            }
            .liquidButton()
        }
        .card()
    }
}
