import SwiftUI

// MARK: - Relationen

/// Eine Relation als Tabelle mit markierten Zeilen.
struct RelationTable: View {
    let table: NetTable

    private func rowColor(_ index: Int) -> Color {
        if (table.ok ?? []).contains(index) { return Theme.good.opacity(0.18) }
        if (table.bad ?? []).contains(index) { return Theme.bad.opacity(0.18) }
        if (table.hl ?? []).contains(index) { return Theme.primary.opacity(0.18) }
        return Color.clear
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let title = table.title {
                RichText(title).font(.caption.bold()).foregroundStyle(.secondary)
            }
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(Array(table.head.enumerated()), id: \.offset) { _, cell in
                        RichText(cell)
                            .font(.caption.bold())
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.primary.opacity(0.13))
                    }
                }
                ForEach(Array(table.rows.enumerated()), id: \.offset) { index, row in
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            RichText(cell)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(cell == "NULL" ? Theme.bad : Color.primary)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 5)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(rowColor(index))
                                .opacity((table.dim ?? []).contains(index) ? 0.35 : 1)
                        }
                    }
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color.secondary.opacity(0.25), lineWidth: 0.5))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}

/// Mehrere Relationen nebeneinander, bei Bedarf seitlich scrollbar.
struct RelationGroup: View {
    let tables: [NetTable]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(tables.enumerated()), id: \.offset) { _, table in
                    RelationTable(table: table)
                }
            }
        }
    }
}

// MARK: - Schrittfolge

/// Block `st`: Formel, Tabellen und Erklärung je Schritt, zum Beispiel die Division.
struct StepBlockView: View {
    let block: Block
    @State private var step = 0

    var body: some View {
        let steps = block.steps ?? []
        let current: NetStep? = steps.isEmpty ? nil : steps[min(step, steps.count - 1)]
        VizCard(title: block.title) {
            if let current = current {
                if let formula = current.f {
                    RichText(formula)
                        .font(.system(.headline, design: .serif))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Theme.violet.opacity(0.13), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                if let tabs = current.tabs {
                    RelationGroup(tables: tabs)
                }
                CaptionBox(text: current.x)
            }
            if steps.count > 1 {
                StepControls(step: $step, maxStep: steps.count - 1, interval: 2.6)
            }
        }
    }
}
