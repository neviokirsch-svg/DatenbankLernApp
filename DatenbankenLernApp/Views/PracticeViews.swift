import SwiftUI

enum ReviewBuilder {
    /// Baut aus Lernstand-IDs Fragen; Rechenaufgaben erhalten neue Zahlen.
    static func questions(ids: [String], library: ContentLibrary) -> [Question] {
        ids.compactMap { id -> Question? in
            if let generator = CalcEngine.generator(id: id) { return generator.make() }
            return library.question(id: id)
        }
    }
}

// MARK: - Wiederholen

struct ReviewHubView: View {
    @EnvironmentObject var library: ContentLibrary
    @EnvironmentObject var progress: ProgressStore
    @State private var tab = 0
    @State private var quiz: QuizConfig?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Picker("Ansicht", selection: $tab) {
                        Text("Fällig").tag(0)
                        Text("Schwächen").tag(1)
                        Text("Gelerntes").tag(2)
                    }
                    .pickerStyle(.segmented)

                    switch tab {
                    case 0: dueView
                    case 1: weakView
                    default: learnedView
                    }
                }
                .padding()
            }
            .liquidScreen()
            .navigationTitle("Wiederholen")
            .fullScreenCover(item: $quiz) { QuizSessionView(config: $0) }
        }
    }

    private var dueView: some View {
        let due = progress.dueItemIDs()
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text(due.isEmpty ? "Alles erledigt" : "\(due.count) Aufgaben sind fällig")
                    .font(.title3.bold())
                Text("Die App merkt sich jede Antwort. Richtig beantwortete Aufgaben kommen in immer größeren Abständen wieder, falsche schon nach kurzer Zeit.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                if !due.isEmpty {
                    Button {
                        quiz = QuizConfig(title: "Wiederholung", questions: ReviewBuilder.questions(ids: due, library: library))
                    } label: {
                        Label("Jetzt wiederholen", systemImage: "play.fill").mainAction()
                    }
                    .liquidButton()
                }
            }
            .card()
            itemList(due)
        }
    }

    private var weakView: some View {
        let weak = progress.weakItemIDs()
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text(weak.isEmpty ? "Keine Schwächen gespeichert" : "\(weak.count) Schwachstellen")
                    .font(.title3.bold())
                Text("Aufgaben, die du zuletzt falsch hattest oder noch nicht sicher kannst.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                if !weak.isEmpty {
                    Button {
                        quiz = QuizConfig(title: "Schwächen trainieren", questions: ReviewBuilder.questions(ids: weak, library: library))
                    } label: {
                        Label("Schwächen trainieren", systemImage: "bolt.fill").mainAction()
                    }
                    .liquidButton()
                }
            }
            .card()
            itemList(weak)
        }
    }

    private var learnedView: some View {
        let learned = progress.learnedItemIDs()
        let readModules = library.modules.filter { m in m.sections.contains { progress.isRead($0.id) } }
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Alles, was du schon gelernt hast").font(.title3.bold())
                Text("\(progress.data.readSections.count) Abschnitte gelesen · \(learned.count) Aufgaben bearbeitet")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                if !learned.isEmpty {
                    Button {
                        let sample = Array(learned.shuffled().prefix(15))
                        quiz = QuizConfig(title: "Gemischte Wiederholung", questions: ReviewBuilder.questions(ids: sample, library: library))
                    } label: {
                        Label("15 zufällige Aufgaben", systemImage: "shuffle").mainAction()
                    }
                    .liquidButton()
                }
            }
            .card()
            if !readModules.isEmpty {
                Text("Nochmal lesen").font(.headline)
                ForEach(readModules) { module in
                    NavigationLink {
                        ModuleDetailView(module: module)
                    } label: {
                        ModuleRow(module: module)
                    }
                    .buttonStyle(.plain)
                }
            }
            if !learned.isEmpty {
                Text("Bearbeitete Aufgaben").font(.headline)
                itemList(learned)
            }
        }
    }

    @ViewBuilder
    private func itemList(_ ids: [String]) -> some View {
        ForEach(ids.prefix(60), id: \.self) { id in
            let state = progress.state(id)
            Button {
                quiz = QuizConfig(title: "Einzelaufgabe", questions: ReviewBuilder.questions(ids: [id], library: library))
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: (state?.lastCorrect ?? false) ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle((state?.lastCorrect ?? false) ? Theme.good : Theme.bad)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(itemTitle(id))
                            .font(.subheadline)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Text("\(state?.correct ?? 0)× richtig, \(state?.wrong ?? 0)× falsch")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .card(cornerRadius: 16)
            }
            .buttonStyle(.plain)
        }
    }

    private func itemTitle(_ id: String) -> String {
        if let generator = CalcEngine.generator(id: id) { return generator.title }
        let raw = library.question(id: id)?.q ?? id
        return raw.replacingOccurrences(of: "**", with: "")
    }
}

// MARK: - Trainer

struct CalcHubView: View {
    @EnvironmentObject var progress: ProgressStore
    @State private var quiz: QuizConfig?

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Trainer").font(.title3.bold())
                        Text("Jede Aufgabe wird neu erzeugt und mit Lösungsweg erklärt. So kannst du Hülle, Überdeckung, Normalformen und Division beliebig oft üben, ohne die Originalklausur zu verbrauchen.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                        Button {
                            let mix = CalcEngine.all.shuffled().prefix(10).map { $0.make() }
                            quiz = QuizConfig(title: "Trainer-Mix", questions: Array(mix))
                        } label: {
                            Label("10 gemischte Aufgaben", systemImage: "shuffle").mainAction()
                        }
                        .liquidButton()
                    }
                    .card()

                    ForEach(CalcEngine.groups, id: \.self) { group in
                        Text(group).font(.headline).padding(.top, 6)
                        ForEach(CalcEngine.all.filter { $0.group == group }) { generator in
                            Button {
                                let tasks = (0..<5).map { _ in generator.make() }
                                quiz = QuizConfig(title: generator.title, questions: tasks)
                            } label: {
                                CalcRow(generator: generator, state: progress.state(generator.id))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding()
            }
            .liquidScreen()
            .navigationTitle("Trainer")
            .fullScreenCover(item: $quiz) { QuizSessionView(config: $0) }
        }
    }
}

struct CalcRow: View {
    let generator: CalcGenerator
    let state: ItemState?

    var body: some View {
        HStack(spacing: 12) {
            GlassIcon(systemName: generator.icon, color: Theme.teal, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(generator.title).font(.subheadline.bold()).multilineTextAlignment(.leading)
                RichText(generator.formula)
                    .font(.system(.caption, design: .serif))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
            }
            Spacer()
            if let state = state {
                Image(systemName: state.lastCorrect ? "checkmark.circle.fill" : "arrow.clockwise.circle")
                    .foregroundStyle(state.lastCorrect ? Theme.good : Theme.warn)
            }
        }
        .card(cornerRadius: 18)
    }
}

// MARK: - Klausur-Simulation

struct ExamConfig: Identifiable {
    let id = UUID()
    let definition: ExamDefinition

    var minutes: Int { definition.minutes }
    var questions: [Question] { definition.tasks.flatMap { $0.questions } }

    func task(of q: Question) -> ExamTaskDefinition? {
        definition.tasks.first { task in task.questions.contains { $0.id == q.id } }
    }
}

struct ExamHubView: View {
    @EnvironmentObject var library: ContentLibrary
    @EnvironmentObject var progress: ProgressStore
    @State private var exam: ExamConfig?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let course = library.course {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Klausur simulieren").font(.title3.bold())
                            RichText(course.examIntro)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                            RichText(course.examNote)
                                .font(.caption)
                                .foregroundStyle(Theme.violet)
                        }
                        .card()
                    }

                    ForEach(library.exams) { definition in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(definition.title).font(.headline)
                            Text(definition.scenario).font(.caption).foregroundStyle(.secondary)
                            Button {
                                exam = ExamConfig(definition: definition)
                            } label: {
                                Label("\(definition.minutes) Minuten starten", systemImage: "timer").mainAction()
                            }
                            .liquidButton()
                        }
                        .card()
                    }

                    if !progress.data.exams.isEmpty {
                        Text("Bisherige Versuche").font(.headline)
                        ForEach(progress.data.exams) { result in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(result.title.isEmpty ? "Probeklausur" : result.title).font(.subheadline)
                                    Text(result.date.formatted(date: .abbreviated, time: .shortened))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(Int(result.percent.rounded())) %")
                                    .font(.title3.bold().monospacedDigit())
                                    .foregroundStyle(result.percent >= 50 ? Theme.good : Theme.bad)
                            }
                            .card(cornerRadius: 16)
                        }
                    }
                }
                .padding()
            }
            .liquidScreen()
            .navigationTitle("Klausur")
            .fullScreenCover(item: $exam) { ExamRunView(config: $0) }
        }
    }
}

struct ExamRunView: View {
    let config: ExamConfig
    @EnvironmentObject var progress: ProgressStore
    @Environment(\.dismiss) private var dismiss

    private enum Stage { case running, reviewOpen, result }

    @State private var stage: Stage = .running
    @State private var index = 0
    @State private var drafts: [String: AnswerDraft] = [:]
    @State private var secondsLeft = 0
    @State private var showAbortAlert = false
    @State private var saved = false

    init(config: ExamConfig) {
        self.config = config
        _secondsLeft = State(initialValue: config.minutes * 60)
        var initial: [String: AnswerDraft] = [:]
        for q in config.questions { initial[q.id] = AnswerDraft.fresh(for: q) }
        _drafts = State(initialValue: initial)
    }

    private var questions: [Question] { config.questions }
    private var maxPoints: Int { questions.reduce(0) { $0 + $1.pts } }

    private func binding(for q: Question) -> Binding<AnswerDraft> {
        Binding(
            get: { drafts[q.id] ?? AnswerDraft.fresh(for: q) },
            set: { drafts[q.id] = $0 }
        )
    }

    private var achieved: Double {
        questions.reduce(0.0) { sum, q in
            sum + (drafts[q.id]?.score(for: q) ?? 0) * Double(q.pts)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    switch stage {
                    case .running: runningView
                    case .reviewOpen: reviewOpenView
                    case .result: resultView
                    }
                }
                .padding()
            }
            .liquidScreen()
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(stage == .running ? timeText : "Auswertung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(stage == .result ? "Schließen" : "Abbrechen") {
                        if stage == .result {
                            dismiss()
                        } else {
                            showAbortAlert = true
                        }
                    }
                }
            }
            .alert("Klausur abbrechen?", isPresented: $showAbortAlert) {
                Button("Abbrechen", role: .destructive) { dismiss() }
                Button("Weiter schreiben", role: .cancel) {}
            } message: {
                Text("Dieser Versuch wird nicht gespeichert.")
            }
        }
        .task(id: stage == .running) {
            while stage == .running && secondsLeft > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                secondsLeft -= 1
            }
            if stage == .running { submit() }
        }
    }

    private var timeText: String {
        String(format: "%02d:%02d", secondsLeft / 60, secondsLeft % 60)
    }

    @ViewBuilder
    private var runningView: some View {
        if index < questions.count {
            let q = questions[index]
            let task = config.task(of: q)
            ProgressView(value: Double(index + 1), total: Double(questions.count))
                .tint(secondsLeft < 300 ? Theme.bad : Theme.primary)
            if let task = task {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("\(task.no). Aufgabe: \(task.title)").font(.headline)
                        Spacer()
                        Text("\(task.pts) P.").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    if let intro = task.intro { RichText(intro).font(.callout) }
                    if let fig = task.fig { BlockView(block: fig) }
                }
                .card()
                .id("task-\(task.no)")
            }
            VStack(alignment: .leading, spacing: 14) {
                QuestionHeader(q: q)
                if let fig = q.fig { BlockView(block: fig) }
            }
            .card()
            .id("head-\(q.id)")
            QuestionInputView(q: q, draft: binding(for: q), locked: false, showSolution: false)
                .card()
                .id("input-\(q.id)")
            HStack {
                Button {
                    if index > 0 { index -= 1 }
                } label: {
                    Label("Zurück", systemImage: "chevron.left").frame(maxWidth: .infinity, minHeight: 30)
                }
                .liquidButton(prominent: false)
                .disabled(index == 0)
                if index + 1 < questions.count {
                    Button {
                        index += 1
                    } label: {
                        Label("Weiter", systemImage: "chevron.right").frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .liquidButton()
                } else {
                    Button {
                        submit()
                    } label: {
                        Label("Abgeben", systemImage: "paperplane.fill").frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .liquidButton()
                }
            }
        }
    }

    private var openQuestions: [Question] { questions.filter { $0.k == .open } }

    private func submit() {
        stage = openQuestions.isEmpty ? .result : .reviewOpen
        if stage == .result { saveResult() }
    }

    private var reviewOpenView: some View {
        VStack(spacing: 14) {
            Text("Offene Aufgaben bewerten").font(.title3.bold())
            Text("Vergleiche deine Antwort oder Zeichnung mit der Musterlösung und hake ab, was du hattest.")
                .font(.callout)
                .foregroundStyle(.secondary)
            ForEach(openQuestions) { q in
                VStack(alignment: .leading, spacing: 10) {
                    QuestionHeader(q: q)
                    if let fig = q.fig { BlockView(block: fig) }
                    QuestionInputView(q: q, draft: binding(for: q), locked: true, showSolution: true)
                    ForEach(Array((q.sol ?? []).enumerated()), id: \.offset) { _, block in
                        BlockView(block: block)
                    }
                }
                .card()
            }
            Button {
                stage = .result
                saveResult()
            } label: {
                Text("Auswertung anzeigen").mainAction()
            }
            .liquidButton()
        }
    }

    private func saveResult() {
        guard !saved else { return }
        saved = true
        for q in questions {
            let score = drafts[q.id]?.score(for: q) ?? 0
            let rating: AnswerRating = score >= 0.999 ? .good : (score >= 0.5 ? .hard : .wrong)
            progress.record(id: q.id, rating: rating)
        }
        progress.addExam(ExamResult(
            date: Date(),
            points: achieved,
            maxPoints: Double(maxPoints),
            minutes: config.minutes,
            count: config.definition.tasks.count,
            examId: config.definition.id,
            title: config.definition.title
        ))
    }

    private func taskPoints(_ task: ExamTaskDefinition) -> Double {
        task.questions.reduce(0.0) { $0 + (drafts[$1.id]?.score(for: $1) ?? 0) * Double($1.pts) }
    }

    private var resultView: some View {
        let ratio = maxPoints > 0 ? achieved / Double(maxPoints) : 0
        return VStack(spacing: 14) {
            VStack(spacing: 10) {
                ZStack {
                    ProgressRing(value: ratio, color: ratio >= 0.5 ? Theme.good : Theme.bad, lineWidth: 12)
                        .frame(width: 130, height: 130)
                    Text("\(Int((ratio * 100).rounded())) %").font(.title.bold())
                }
                Text("\(deNumber(achieved, maxDigits: 1)) von \(maxPoints) Punkten").font(.headline)
            }
            .frame(maxWidth: .infinity)
            .card()
            VStack(alignment: .leading, spacing: 8) {
                ForEach(config.definition.tasks) { task in
                    let got = taskPoints(task)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text("A\(task.no) \(task.title)").font(.subheadline)
                            Spacer()
                            Text("\(deNumber(got, maxDigits: 1)) / \(task.pts)").font(.caption.monospacedDigit())
                        }
                        ProgressView(value: task.pts > 0 ? got / Double(task.pts) : 0).tint(Theme.primary)
                    }
                }
            }
            .card()
            ForEach(questions) { q in
                let draft = binding(for: q)
                VStack(alignment: .leading, spacing: 10) {
                    QuestionHeader(q: q)
                    if let fig = q.fig { BlockView(block: fig) }
                    QuestionInputView(q: q, draft: draft, locked: true, showSolution: true)
                    SolutionPanel(q: q, score: draft.wrappedValue.score(for: q))
                }
                .card()
            }
        }
    }
}
