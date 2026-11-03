import SwiftUI

// MARK: - Modulübersicht

struct ModuleListView: View {
    @EnvironmentObject var library: ContentLibrary
    @EnvironmentObject var progress: ProgressStore

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if !library.loadErrors.isEmpty {
                        VStack(alignment: .leading) {
                            Label("Inhalte konnten nicht geladen werden", systemImage: "exclamationmark.triangle")
                                .font(.headline)
                            ForEach(library.loadErrors, id: \.self) { Text($0).font(.caption2) }
                        }
                        .card()
                    }
                    Text("Jeder Abschnitt besteht aus Theorie und anschließender Praxis. Die Reihenfolge folgt dem Skript, der Umfang der Klausur.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    ForEach(library.course?.examTasks ?? []) { task in
                        HStack(alignment: .firstTextBaseline) {
                            Text("Aufgabe \(task.no): \(task.title)")
                                .font(.title3.bold())
                            Spacer(minLength: 8)
                            Text("\(task.pct) %")
                                .font(.caption.bold().monospacedDigit())
                                .foregroundStyle(Theme.violet)
                        }
                        .padding(.top, 8)
                        ForEach(library.modules.filter { $0.exam == task.no }) { module in
                            NavigationLink {
                                ModuleDetailView(module: module)
                            } label: {
                                ModuleRow(module: module)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    let extra = library.modules.filter { ($0.exam ?? 0) == 0 }
                    if !extra.isEmpty {
                        Text("Ausblick auf das 4. Semester")
                            .font(.title3.bold())
                            .padding(.top, 8)
                        ForEach(extra) { module in
                            NavigationLink {
                                ModuleDetailView(module: module)
                            } label: {
                                ModuleRow(module: module)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding()
            }
            .liquidScreen()
            .navigationTitle("Lernen")
        }
    }
}

struct ModuleRow: View {
    let module: LearningModule
    @EnvironmentObject var progress: ProgressStore

    private var practiceCount: Int {
        module.sections.reduce(0) { $0 + ($1.practice ?? []).count }
    }

    var body: some View {
        HStack(spacing: 12) {
            GlyphIcon(text: module.glyph ?? "")
            VStack(alignment: .leading, spacing: 2) {
                Text(module.title)
                    .font(.headline)
                    .multilineTextAlignment(.leading)
                Text("\(module.sections.count) Abschnitte · \(practiceCount) Praxisaufgaben")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            ZStack {
                ProgressRing(value: progress.readFraction(module), color: Theme.teal, lineWidth: 4)
                    .frame(width: 38, height: 38)
                ProgressRing(value: progress.mastery(module), color: Theme.good, lineWidth: 4)
                    .frame(width: 26, height: 26)
            }
        }
        .card()
    }
}

// MARK: - Moduldetail: je Abschnitt erst Theorie, dann Praxis

struct ModuleDetailView: View {
    let module: LearningModule
    @EnvironmentObject var progress: ProgressStore
    @EnvironmentObject var library: ContentLibrary
    @State private var quiz: QuizConfig?

    private var allQuestions: [Question] {
        let calcs = module.calcIDs.compactMap { CalcEngine.generator(id: $0)?.make() }
        return (module.questions + calcs).shuffled()
    }

    var body: some View {
        let readFraction = progress.readFraction(module)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 12) {
                        GlyphIcon(text: module.glyph ?? "", size: 54)
                        VStack(alignment: .leading) {
                            Text("Skript \(SlideRepository.scriptName(module.part)), \(module.pages)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(module.title).font(.title3.bold())
                        }
                    }
                    RichText(module.goal).font(.callout)
                    if let no = module.exam, no > 0, let task = library.course?.examTasks.first(where: { $0.no == no }) {
                        Text("Klausur Aufgabe \(no): \(task.title), zusammen etwa \(task.pct) %")
                            .font(.caption.bold())
                            .foregroundStyle(Theme.violet)
                    }
                }
                .card()

                VStack(alignment: .leading, spacing: 8) {
                    ProgressView(value: readFraction).tint(Theme.teal)
                    ForEach(Array(module.sections.enumerated()), id: \.element.id) { i, section in
                        NavigationLink {
                            LessonReaderView(module: module, startIndex: i)
                        } label: {
                            HStack {
                                Image(systemName: progress.isRead(section.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(progress.isRead(section.id) ? Theme.good : Color.secondary)
                                VStack(alignment: .leading, spacing: 1) {
                                    RichText(section.title)
                                        .multilineTextAlignment(.leading)
                                    let n = (section.practice ?? []).count
                                    Text("Theorie + \(n) \(n == 1 ? "Praxisaufgabe" : "Praxisaufgaben")")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .card()

                Button {
                    quiz = QuizConfig(title: module.title, questions: allQuestions)
                } label: {
                    Label("Alle Aufgaben gemischt üben", systemImage: "shuffle").mainAction()
                }
                .liquidButton(prominent: false)
                Text("\(progress.answeredCount(module)) bearbeitet · \(Int((progress.mastery(module) * 100).rounded())) % beherrscht")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
        .liquidScreen()
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $quiz) { QuizSessionView(config: $0) }
    }
}

// MARK: - Theorie, danach Praxis

struct LessonReaderView: View {
    let module: LearningModule
    @State var startIndex: Int
    @EnvironmentObject var progress: ProgressStore
    @EnvironmentObject var library: ContentLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var quiz: QuizConfig?

    var body: some View {
        let section = module.sections[startIndex]
        let practiceCount = (section.practice ?? []).count
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ProgressView(value: Double(startIndex + 1), total: Double(module.sections.count))
                    .tint(Theme.teal)
                RichText(section.title)
                    .font(.title2.bold())
                ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in
                    if block.t == "p" || block.t == "b" {
                        BlockView(block: block).card()
                    } else {
                        BlockView(block: block)
                    }
                }
                Button {
                    progress.markRead(sectionID: section.id, moduleID: module.id)
                    if practiceCount > 0 {
                        quiz = QuizConfig(
                            title: section.title.replacingOccurrences(of: "**", with: ""),
                            questions: ReviewBuilder.questions(ids: section.practice ?? [], library: library)
                        )
                    } else {
                        goToNext()
                    }
                } label: {
                    Label(practiceCount > 0 ? "Verstanden: zur Praxis (\(practiceCount))" : "Verstanden: weiter", systemImage: "checkmark")
                        .mainAction()
                }
                .liquidButton()
                .padding(.top, 6)
            }
            .padding()
        }
        .id(section.id)
        .liquidScreen()
        .navigationTitle("\(startIndex + 1) von \(module.sections.count)")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $quiz, onDismiss: goToNext) { QuizSessionView(config: $0) }
    }

    private func goToNext() {
        if startIndex + 1 < module.sections.count {
            withAnimation { startIndex += 1 }
        } else {
            dismiss()
        }
    }
}

// MARK: - Startseite

struct HomeView: View {
    @EnvironmentObject var library: ContentLibrary
    @EnvironmentObject var progress: ProgressStore
    @State private var quiz: QuizConfig?
    @State private var showResetAlert = false

    private var nextModule: LearningModule? {
        let graded = library.modules.filter { ($0.weight ?? 0) > 0 }
        return graded.first { !progress.isFullyRead($0) } ?? graded.first { progress.mastery($0) < 0.8 }
    }

    /// Die Aufgabe, bei der am meisten Klausuranteil noch offen ist.
    private var biggestLever: (task: ExamTask, module: LearningModule)? {
        let tasks = (library.course?.examTasks ?? []).sorted {
            Double($0.pct) * (1 - taskMastery($0.no)) > Double($1.pct) * (1 - taskMastery($1.no))
        }
        guard let task = tasks.first else { return nil }
        let modules = library.modules.filter { $0.exam == task.no }
        guard let module = modules.first(where: { progress.mastery($0) < 0.8 }) ?? modules.first else { return nil }
        return (task, module)
    }

    private func taskMastery(_ no: Int) -> Double {
        let modules = library.modules.filter { $0.exam == no }
        let total = modules.reduce(0) { $0 + ($1.weight ?? 0) }
        guard total > 0 else { return 0 }
        return modules.reduce(0.0) { $0 + Double($1.weight ?? 0) * progress.mastery($1) } / Double(total)
    }

    var body: some View {
        let due = progress.dueItemIDs()
        let overall = progress.overallMastery(library.modules)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let tagline = library.course?.tagline {
                        Text(tagline).font(.callout).foregroundStyle(.secondary)
                    }
                    HStack(spacing: 16) {
                        ZStack {
                            ProgressRing(value: overall, color: Theme.good, lineWidth: 10)
                                .frame(width: 84, height: 84)
                            Text("\(Int((overall * 100).rounded())) %").font(.headline.monospacedDigit())
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Dein Lernstand").font(.headline)
                            Text("\(progress.data.readSections.count) Abschnitte gelesen, \(progress.data.items.count) Aufgaben bearbeitet. Der Wert ist nach Klausuranteil gewichtet.")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .card()

                    HStack(spacing: 12) {
                        StatTile(value: "\(progress.streak)", label: "Tage in Folge", icon: "flame.fill", color: Theme.warn)
                        StatTile(value: "\(progress.answersToday)", label: "Heute", icon: "checkmark.circle.fill", color: Theme.good)
                        StatTile(value: "\(due.count)", label: "Fällig", icon: "clock.fill", color: Theme.violet)
                    }

                    if !due.isEmpty {
                        Button {
                            quiz = QuizConfig(title: "Wiederholung", questions: ReviewBuilder.questions(ids: due, library: library))
                        } label: {
                            Label("\(due.count) Wiederholungen starten", systemImage: "arrow.triangle.2.circlepath").mainAction()
                        }
                        .liquidButton()
                    }

                    if let module = nextModule {
                        moduleLink(eyebrow: "Als Nächstes", module: module)
                    }
                    if !progress.data.items.isEmpty, let lever = biggestLever, lever.module.id != nextModule?.id {
                        moduleLink(eyebrow: "Größter Hebel: Aufgabe \(lever.task.no) zählt \(lever.task.pct) %", module: lever.module)
                    }

                    weightChart
                    activityChart
                }
                .padding()
            }
            .liquidScreen()
            .navigationTitle("Datenbanken")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Lernstand zurücksetzen", role: .destructive) { showResetAlert = true }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .fullScreenCover(item: $quiz) { QuizSessionView(config: $0) }
            .alert("Gesamten Lernstand löschen?", isPresented: $showResetAlert) {
                Button("Löschen", role: .destructive) { progress.resetAll() }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text("Gelesene Abschnitte, Antworten und Klausurergebnisse gehen verloren.")
            }
        }
    }

    private func moduleLink(eyebrow: String, module: LearningModule) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow).font(.caption.bold()).foregroundStyle(.secondary)
            NavigationLink {
                ModuleDetailView(module: module)
            } label: {
                HStack(spacing: 12) {
                    GlyphIcon(text: module.glyph ?? "")
                    VStack(alignment: .leading) {
                        Text(module.title).font(.headline).multilineTextAlignment(.leading)
                        Text(module.pages).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
        }
        .card()
    }

    /// Balken: geschätzter Klausuranteil. Dunkle Füllung: davon schon beherrscht.
    private var weightChart: some View {
        let tasks = library.course?.examTasks ?? []
        let top = Double(tasks.map { $0.pct }.max() ?? 1)
        return VStack(alignment: .leading, spacing: 10) {
            Text("So verteilt sich die Klausur").font(.headline)
            if let note = library.course?.weightNote {
                Text(note).font(.caption).foregroundStyle(.secondary)
            }
            ForEach(tasks) { task in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("A\(task.no)").font(.subheadline.bold())
                        Text(task.title).font(.subheadline)
                        Spacer(minLength: 6)
                        Text("\(task.pct) % · \(task.min) Min.")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    GeometryReader { geo in
                        let width = geo.size.width * CGFloat(Double(task.pct) / top)
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4).fill(Theme.primary.opacity(0.18)).frame(width: width)
                            RoundedRectangle(cornerRadius: 4).fill(Theme.primary).frame(width: width * CGFloat(taskMastery(task.no)))
                        }
                    }
                    .frame(height: 10)
                }
            }
        }
        .card()
    }

    private var activityChart: some View {
        let days = progress.lastDays(7)
        let top = max(days.map { $0.count }.max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 8) {
            Text("Letzte 7 Tage").font(.caption.bold()).foregroundStyle(.secondary)
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                    VStack(spacing: 4) {
                        Text("\(day.count)").font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                        RoundedRectangle(cornerRadius: 5)
                            .fill(Theme.primary)
                            .frame(height: max(4, 70 * CGFloat(day.count) / CGFloat(top)))
                        Text(day.label).font(.caption2)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .card()
    }
}
