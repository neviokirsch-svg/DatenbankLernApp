import SwiftUI
import PDFKit

// MARK: - Originalfolien

final class SlideRepository {
    static let shared = SlideRepository()
    private var documents: [Int: PDFDocument] = [:]
    private let cache = NSCache<NSString, UIImage>()

    func document(part: Int) -> PDFDocument? {
        if let d = documents[part] { return d }
        guard let url = Bundle.main.url(forResource: "skript_teil\(part)", withExtension: "pdf"),
              let d = PDFDocument(url: url) else { return nil }
        documents[part] = d
        return d
    }

    /// Zugeschnittene Folie aus Resources/Slides, derselbe Dateiname wie in tools/extract-slides.js.
    func image(part: Int, page: Int, crop: [Int]?) -> UIImage? {
        var name = "s\(part)_\(page)"
        if let crop = crop {
            name += "_" + crop.map(String.init).joined(separator: "_")
        }
        let key = name as NSString
        if let cached = cache.object(forKey: key) { return cached }
        guard let url = Bundle.main.url(forResource: name, withExtension: "png"),
              let image = UIImage(contentsOfFile: url.path) else { return nil }
        cache.setObject(image, forKey: key)
        return image
    }

    static func scriptName(_ part: Int) -> String {
        switch part {
        case 1: return "Einführung"
        case 2: return "Architektur"
        case 3: return "ERM"
        case 4: return "Relationales Modell"
        case 5: return "Relationale Algebra"
        case 6: return "Normalformen 1"
        case 7: return "Normalformen 2"
        case 8: return "Übungsblatt 5"
        case 9: return "Übungsblatt 6"
        case 10: return "Notation Tabellenmodell"
        case 11: return "Notation Relationenmodell"
        default: return "Skript"
        }
    }
}

struct SlideThumbnail: View {
    let part: Int
    let page: Int
    var crop: [Int]?
    var caption: String?
    @State private var image: UIImage?
    @State private var showViewer = false

    var body: some View {
        Button {
            showViewer = true
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                ZStack(alignment: .bottomTrailing) {
                    if let image = image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                    } else {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.1))
                            .aspectRatio(4.0 / 3.0, contentMode: .fit)
                    }
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.caption.bold())
                        .padding(7)
                        .background(.ultraThinMaterial, in: Circle())
                        .padding(8)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                Text(caption ?? "Originalfolie")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Skript \(SlideRepository.scriptName(part)), Seite \(page)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .buttonStyle(.plain)
        .task { image = SlideRepository.shared.image(part: part, page: page, crop: crop) }
        .fullScreenCover(isPresented: $showViewer) {
            SlideViewer(part: part, page: page)
        }
    }
}

struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument
    let page: Int

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = document
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        if let target = document.page(at: page - 1) {
            view.go(to: target)
        }
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

/// Vollbild-Skript: Originalfolie mit Zoom und Blättern.
struct SlideViewer: View {
    let part: Int
    let page: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let document = SlideRepository.shared.document(part: part) {
                    PDFKitView(document: document, page: page)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    ContentUnavailableView("Skript nicht gefunden", systemImage: "doc.questionmark")
                }
            }
            .navigationTitle(SlideRepository.scriptName(part))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Block-Darstellung

private struct Callout: View {
    let symbol: String
    let label: String
    let text: String
    let color: Color

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption2.bold()).foregroundStyle(color)
                RichText(text).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct BlockView: View {
    let block: Block

    var body: some View {
        switch block.t {
        case "p":
            RichText(block.x ?? "")
                .frame(maxWidth: .infinity, alignment: .leading)
        case "h":
            RichText(block.x ?? "")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
        case "b":
            VStack(alignment: .leading, spacing: 7) {
                ForEach(Array((block.i ?? []).enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Circle().fill(Theme.primary).frame(width: 6, height: 6)
                        RichText(item).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        case "k":
            Callout(symbol: "lightbulb.fill", label: "Merke", text: block.x ?? "", color: Theme.warn)
        case "w":
            Callout(symbol: "exclamationmark.triangle.fill", label: "Klausurfalle", text: block.x ?? "", color: Theme.bad)
        case "ex":
            Callout(symbol: "target", label: "Klausurbezug", text: block.x ?? "", color: Theme.violet)
        case "f":
            VStack(spacing: 4) {
                RichText(block.x ?? "")
                    .font(.system(.title3, design: .serif).bold())
                    .multilineTextAlignment(.center)
                if let title = block.title {
                    RichText(title).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(12)
            .background(Theme.violet.opacity(0.13), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        case "s":
            RichText(block.x ?? "")
                .font(.system(.footnote, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.teal.opacity(0.13), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        case "code":
            ScrollView(.horizontal, showsIndicators: false) {
                Text(block.x ?? "")
                    .font(.system(.caption, design: .monospaced))
                    .padding(12)
            }
            .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        case "tb":
            RelationGroup(tables: [NetTable(title: block.title, head: block.head ?? [], rows: block.rows ?? [])])
        case "rels":
            RelationGroup(tables: block.tabs ?? [])
        case "sl":
            SlideThumbnail(part: block.part ?? 1, page: block.page ?? 1, crop: block.crop, caption: block.x)
                .card()
        case "st":
            StepBlockView(block: block)
        case "net":
            NetDiagramView(block: block)
        case "bars":
            BarChartView(block: block)
        case "er", "x":
            WebBlockView(payload: block.jsonString)
        default:
            EmptyView()
        }
    }
}
