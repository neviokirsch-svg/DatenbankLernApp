import SwiftUI

// MARK: - Steuerung für schrittweise Animationen

struct StepControls: View {
    @Binding var step: Int
    let maxStep: Int
    var interval: Double = 1.8
    @State private var playing = false

    var body: some View {
        HStack(spacing: 18) {
            Button {
                playing = false
                withAnimation { step = 0 }
            } label: {
                Image(systemName: "arrow.counterclockwise")
            }
            Button {
                playing = false
                if step > 0 { withAnimation { step -= 1 } }
            } label: {
                Image(systemName: "backward.fill")
            }
            .disabled(step == 0)
            Button {
                if step >= maxStep { step = 0 }
                playing.toggle()
            } label: {
                Image(systemName: playing ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 34))
            }
            Button {
                playing = false
                if step < maxStep { withAnimation { step += 1 } }
            } label: {
                Image(systemName: "forward.fill")
            }
            .disabled(step >= maxStep)
            Text("\(step)/\(maxStep)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.primary)
        .frame(maxWidth: .infinity)
        .task(id: playing) {
            guard playing else { return }
            while playing {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                if Task.isCancelled { return }
                if step < maxStep {
                    withAnimation { step += 1 }
                } else {
                    playing = false
                }
            }
        }
    }
}

struct VizCard<Content: View>: View {
    let title: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let title = title {
                Label(title, systemImage: "play.rectangle.on.rectangle")
                    .font(.subheadline.bold())
                    .foregroundStyle(Theme.primary)
            }
            content()
        }
        .card()
    }
}

struct CaptionBox: View {
    let text: String

    var body: some View {
        RichText(text)
            .font(.callout)
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .topLeading)
            .padding(10)
            .background(Theme.primary.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Sequenzdiagramm

struct ArrowShape: Shape {
    let from: CGPoint
    let to: CGPoint

    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: from)
        p.addLine(to: to)
        let angle = atan2(to.y - from.y, to.x - from.x)
        let len: CGFloat = 9
        let a1 = angle + .pi - 0.45
        let a2 = angle + .pi + 0.45
        p.move(to: to)
        p.addLine(to: CGPoint(x: to.x + cos(a1) * len, y: to.y + sin(a1) * len))
        p.move(to: to)
        p.addLine(to: CGPoint(x: to.x + cos(a2) * len, y: to.y + sin(a2) * len))
        return p
    }
}

private func lifelineX(_ index: Int, count: Int, width: CGFloat) -> CGFloat {
    let margin = width * 0.10
    if count <= 1 { return width / 2 }
    return margin + (width - 2 * margin) * CGFloat(index) / CGFloat(count - 1)
}

struct SeqRow: View {
    let msg: SeqMessage
    let lifelines: Int
    @State private var progress: CGFloat = 0
    private let height: CGFloat = 46

    var body: some View {
        GeometryReader { geo in
            let x1 = lifelineX(msg.f, count: lifelines, width: geo.size.width)
            let x2 = lifelineX(msg.to, count: lifelines, width: geo.size.width)
            let color = Theme.color(msg.c)
            ZStack {
                ForEach(0..<lifelines, id: \.self) { i in
                    Rectangle()
                        .fill(Color.secondary.opacity(0.35))
                        .frame(width: 2, height: height)
                        .position(x: lifelineX(i, count: lifelines, width: geo.size.width), y: height / 2)
                }
                ArrowShape(from: CGPoint(x: x1, y: 8), to: CGPoint(x: x2, y: height - 8))
                    .trim(from: 0, to: progress)
                    .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                Text(msg.l)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 4)
                    .background(.ultraThinMaterial, in: Capsule())
                    .frame(maxWidth: max(abs(x2 - x1), 60))
                    .position(x: (x1 + x2) / 2, y: height / 2 - 2)
                    .opacity(progress > 0.4 ? 1 : 0)
                Circle()
                    .fill(color)
                    .frame(width: 10, height: 10)
                    .position(x: x1 + (x2 - x1) * progress, y: 8 + (height - 16) * progress)
                    .opacity(progress < 1 ? 1 : 0)
            }
        }
        .frame(height: height)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.8)) { progress = 1 }
        }
    }
}

struct SeqDiagramView: View {
    let block: Block
    @State private var step = 0

    var body: some View {
        let lifelines = block.lifelines ?? []
        let msgs = block.msgs ?? []
        VizCard(title: block.title) {
            GeometryReader { geo in
                ZStack {
                    ForEach(Array(lifelines.enumerated()), id: \.offset) { i, name in
                        Text(name)
                            .font(.caption.bold())
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                            .frame(width: geo.size.width / CGFloat(max(lifelines.count, 1)))
                            .position(x: lifelineX(i, count: lifelines.count, width: geo.size.width), y: 18)
                    }
                }
            }
            .frame(height: 36)

            VStack(spacing: 0) {
                ForEach(0..<min(step, msgs.count), id: \.self) { i in
                    SeqRow(msg: msgs[i], lifelines: lifelines.count)
                }
                if step == 0 {
                    Text("Tippe auf ▶ und verfolge den Ablauf Nachricht für Nachricht.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
            }

            if step > 0, step <= msgs.count, let note = msgs[step - 1].n {
                CaptionBox(text: note)
            }
            StepControls(step: $step, maxStep: msgs.count, interval: 2.2)
        }
    }
}

// MARK: - Netzdiagramm

private func nodeSymbol(_ s: String?) -> String {
    switch s {
    case "host": return "desktopcomputer"
    case "laptop": return "laptopcomputer"
    case "server": return "server.rack"
    case "router": return "arrow.triangle.swap"
    case "switch": return "rectangle.connected.to.line.below"
    case "hub": return "circle.hexagongrid"
    case "cloud": return "cloud.fill"
    case "phone": return "iphone"
    case "antenna": return "antenna.radiowaves.left.and.right"
    case "proxy": return "shield.lefthalf.filled"
    case "car": return "car.fill"
    case "dot": return "circle.fill"
    default: return "circle.fill"
    }
}

private func matchesEdge(_ list: [[String]]?, _ a: String, _ b: String) -> Bool {
    guard let list = list else { return false }
    for pair in list where pair.count == 2 {
        if (pair[0] == a && pair[1] == b) || (pair[0] == b && pair[1] == a) { return true }
    }
    return false
}

struct PacketDot: View {
    let from: CGPoint
    let to: CGPoint
    let label: String?
    let color: Color
    @State private var t: CGFloat = 0

    var body: some View {
        VStack(spacing: 1) {
            if let label = label {
                Text(label)
                    .font(.system(size: 9, weight: .bold))
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 3)
                    .background(color.opacity(0.18))
                    .clipShape(RoundedRectangle(cornerRadius: 3))
            }
            RoundedRectangle(cornerRadius: 3)
                .fill(color)
                .frame(width: 16, height: 11)
        }
        .position(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: false)) { t = 1 }
        }
    }
}

struct NetCanvas: View {
    let nodes: [NetNode]
    let edges: [NetEdge]
    let current: NetStep?
    let stepKey: Int

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let pos = positions(size)
            ZStack {
                ForEach(Array(edges.enumerated()), id: \.offset) { _, edge in
                    if let a = pos[edge.a], let b = pos[edge.b] {
                        let hi = matchesEdge(current?.he, edge.a, edge.b)
                        let down = matchesEdge(current?.de, edge.a, edge.b)
                        Path { p in
                            p.move(to: a)
                            p.addLine(to: b)
                        }
                        .stroke(
                            down ? Theme.bad.opacity(0.75) : (hi ? Theme.warn : Color.secondary.opacity(0.45)),
                            style: StrokeStyle(lineWidth: hi ? 4 : 2, dash: down ? [5, 4] : [])
                        )
                        if let label = edge.l {
                            Text(label)
                                .font(.system(size: 11, weight: .bold).monospacedDigit())
                                .padding(.horizontal, 4)
                                .background(.regularMaterial, in: Capsule())
                                .position(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                        }
                    }
                }
                ForEach(Array(nodes.enumerated()), id: \.offset) { _, node in
                    if let p = pos[node.id] {
                        NetNodeView(
                            node: node,
                            highlighted: current?.hn?.contains(node.id) ?? false,
                            down: current?.dn?.contains(node.id) ?? false
                        )
                        .position(p)
                    }
                }
                if let packets = current?.p {
                    ForEach(Array(packets.enumerated()), id: \.offset) { i, packet in
                        if let a = pos[packet.a], let b = pos[packet.b] {
                            PacketDot(from: a, to: b, label: packet.l, color: Theme.color(packet.c ?? "orange"))
                                .id("\(stepKey)-\(i)")
                        }
                    }
                }
            }
        }
    }

    private func positions(_ size: CGSize) -> [String: CGPoint] {
        var out: [String: CGPoint] = [:]
        for n in nodes {
            out[n.id] = CGPoint(
                x: 26 + (size.width - 52) * CGFloat(n.x),
                y: 24 + (size.height - 48) * CGFloat(n.y)
            )
        }
        return out
    }
}

struct NetNodeView: View {
    let node: NetNode
    let highlighted: Bool
    let down: Bool

    var body: some View {
        let tint: Color = down ? Theme.bad : (highlighted ? Theme.warn : Theme.primary)
        VStack(spacing: 1) {
            ZStack {
                Circle()
                    .fill(tint.opacity(highlighted || down ? 0.28 : 0.12))
                    .frame(width: 34, height: 34)
                if node.s == nil || node.s == "dot" {
                    Text(String(node.l.prefix(2)))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(tint)
                } else {
                    Image(systemName: nodeSymbol(node.s))
                        .font(.system(size: 15))
                        .foregroundStyle(tint)
                }
                if down {
                    Image(systemName: "xmark")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(Theme.bad)
                }
            }
            .scaleEffect(highlighted ? 1.12 : 1)
            .animation(.spring(response: 0.35), value: highlighted)
            if node.s != nil && node.s != "dot" {
                Text(node.l)
                    .font(.system(size: 9, weight: .medium))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
    }
}

struct MiniTable: View {
    let title: String?
    let head: [String]
    let rows: [[String]]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let title = title {
                Text(title).font(.caption.bold())
            }
            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 3) {
                GridRow {
                    ForEach(Array(head.enumerated()), id: \.offset) { _, h in
                        Text(h).font(.caption2.bold()).foregroundStyle(.secondary)
                    }
                }
                Divider()
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            RichText(cell).font(.caption2)
                        }
                    }
                }
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct NetDiagramView: View {
    let block: Block
    @State private var step = 0

    var body: some View {
        let steps = block.steps ?? []
        let current: NetStep? = steps.isEmpty ? nil : steps[min(step, steps.count - 1)]
        VizCard(title: block.title) {
            NetCanvas(nodes: block.nodes ?? [], edges: block.edges ?? [], current: current, stepKey: step)
                .frame(height: 240)
            if let current = current {
                CaptionBox(text: current.x)
                if let table = current.tb {
                    MiniTable(title: table.title, head: table.head, rows: table.rows)
                }
            }
            if steps.count > 1 {
                StepControls(step: $step, maxStep: steps.count - 1, interval: 3.0)
            }
        }
    }
}

// MARK: - Paketformate

struct FrameDiagramView: View {
    let block: Block
    @State private var step = 0
    @State private var selected: String?

    var body: some View {
        let rows = block.frames ?? []
        let reveal = block.reveal ?? false
        let visible = reveal ? min(step + 1, rows.count) : rows.count
        VizCard(title: block.title) {
            VStack(alignment: .leading, spacing: 5) {
                ForEach(0..<visible, id: \.self) { i in
                    let row = rows[i]
                    if let label = row.l {
                        Text(label).font(.caption2.bold()).foregroundStyle(.secondary)
                    }
                    FrameRowView(row: row, selected: $selected)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.45), value: visible)
            if let selected = selected {
                CaptionBox(text: selected)
            } else if rows.contains(where: { $0.segs.contains { $0.d != nil } }) {
                Text("Tippe auf ein Feld für die Erklärung.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if reveal, rows.count > 1 {
                StepControls(step: $step, maxStep: rows.count - 1, interval: 1.6)
            }
        }
    }
}

struct FrameRowView: View {
    let row: FrameRow
    @Binding var selected: String?

    var body: some View {
        GeometryReader { geo in
            let total = row.segs.reduce(0.0) { $0 + $1.w }
            HStack(spacing: 1) {
                ForEach(Array(row.segs.enumerated()), id: \.offset) { _, seg in
                    let width = max(geo.size.width * CGFloat(seg.w / max(total, 0.0001)) - 1, 1)
                    Button {
                        if let d = seg.d { selected = "**\(seg.t):** \(d)" }
                    } label: {
                        Text(seg.t)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.5)
                            .padding(.horizontal, 1)
                            .frame(width: width, height: 38)
                            .background(Theme.color(seg.c))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(height: 38)
        .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}

// MARK: - Balkendiagramm

struct BarChartView: View {
    let block: Block
    @State private var grown = false

    var body: some View {
        let bars = block.bars ?? []
        let maxValue = bars.map { $0.v }.max() ?? 1
        VizCard(title: block.title) {
            VStack(alignment: .leading, spacing: 7) {
                ForEach(Array(bars.enumerated()), id: \.offset) { index, bar in
                    HStack(spacing: 6) {
                        Text(bar.l)
                            .font(.caption2)
                            .frame(width: 84, alignment: .trailing)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Theme.color(bar.c).opacity(bar.v2 == nil ? 1 : 0.4))
                                    .frame(width: grown ? geo.size.width * CGFloat(bar.v / maxValue) : 0)
                                if let v2 = bar.v2 {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Theme.color(bar.c))
                                        .frame(width: grown ? geo.size.width * CGFloat(v2 / maxValue) : 0)
                                }
                            }
                            .animation(.easeOut(duration: 0.7).delay(Double(index) * 0.05), value: grown)
                        }
                        .frame(height: 16)
                        Text(deNumber(bar.v))
                            .font(.caption2.monospacedDigit())
                            .frame(width: 52, alignment: .leading)
                    }
                }
            }
            if let unit = block.unit {
                Text(unit).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .onAppear { grown = true }
    }
}
