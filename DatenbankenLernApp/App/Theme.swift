import SwiftUI

enum Theme {
    static let primary = Color(red: 0.10, green: 0.42, blue: 0.78)
    static let good = Color(red: 0.13, green: 0.62, blue: 0.40)
    static let bad = Color(red: 0.85, green: 0.25, blue: 0.27)
    static let warn = Color(red: 0.93, green: 0.60, blue: 0.13)
    static let violet = Color(red: 0.47, green: 0.34, blue: 0.82)
    static let teal = Color(red: 0.10, green: 0.60, blue: 0.65)

    /// Benannte Farben aus den Inhalts-Dateien.
    static func color(_ name: String?) -> Color {
        switch name {
        case "blue": return primary
        case "green": return good
        case "red": return bad
        case "orange": return warn
        case "violet": return violet
        case "teal": return teal
        case "yellow": return Color(red: 0.95, green: 0.74, blue: 0.16)
        case "gray": return Color.gray
        default: return primary
        }
    }

    static func partColor(_ part: Int) -> Color {
        part == 1 ? primary : violet
    }
}

// MARK: - Liquid Glass

/// Glaskarte: echtes Liquid Glass ab iOS 26 (Xcode 26), sonst Material.
struct CardModifier: ViewModifier {
    var cornerRadius: CGFloat = 22

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        let padded = content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            padded.glassEffect(.regular, in: shape)
        } else {
            padded
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.stroke(Color.white.opacity(0.25), lineWidth: 0.5))
        }
        #else
        padded
            .background(.ultraThinMaterial, in: shape)
            .overlay(shape.stroke(Color.white.opacity(0.25), lineWidth: 0.5))
        #endif
    }
}

/// Glas-Schaltfläche, optional eingefärbt.
struct LiquidButtonModifier: ViewModifier {
    var prominent: Bool

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            if prominent {
                content.buttonStyle(.glassProminent)
            } else {
                content.buttonStyle(.glass)
            }
        } else if prominent {
            content.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
        } else {
            content.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
        #else
        if prominent {
            content.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
        } else {
            content.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
        #endif
    }
}

/// Runde Glas-Plakette für Symbole.
struct GlassIcon: View {
    let systemName: String
    var color: Color = Theme.primary
    var size: CGFloat = 44

    var body: some View {
        let symbol = Image(systemName: systemName)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: size, height: size)
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            symbol.glassEffect(.regular.tint(color.opacity(0.18)), in: Circle())
        } else {
            symbol.background(color.opacity(0.15), in: Circle())
        }
        #else
        symbol.background(color.opacity(0.15), in: Circle())
        #endif
    }
}

/// Langsam fließender Farbverlauf hinter dem Glas – so wird der Glaseffekt sichtbar.
struct LiquidBackground: View {
    @Environment(\.colorScheme) private var scheme
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                Color(.systemGroupedBackground)
                blob(Theme.primary, diameter: size.width * 1.1)
                    .offset(x: drift ? -size.width * 0.22 : size.width * 0.12, y: drift ? -size.height * 0.34 : -size.height * 0.22)
                blob(Theme.violet, diameter: size.width * 0.95)
                    .offset(x: drift ? size.width * 0.3 : size.width * 0.05, y: drift ? size.height * 0.06 : -size.height * 0.08)
                blob(Theme.teal, diameter: size.width * 1.0)
                    .offset(x: drift ? -size.width * 0.05 : -size.width * 0.3, y: drift ? size.height * 0.34 : size.height * 0.24)
            }
            .frame(width: size.width, height: size.height)
            .clipped()
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeInOut(duration: 14).repeatForever(autoreverses: true)) { drift = true }
        }
    }

    private func blob(_ color: Color, diameter: CGFloat) -> some View {
        Circle()
            .fill(color.opacity(scheme == .dark ? 0.42 : 0.30))
            .frame(width: diameter, height: diameter)
            .blur(radius: 70)
    }
}

extension View {
    func card(cornerRadius: CGFloat = 22) -> some View { modifier(CardModifier(cornerRadius: cornerRadius)) }

    func liquidButton(prominent: Bool = true) -> some View { modifier(LiquidButtonModifier(prominent: prominent)) }

    /// Bildschirm-Hintergrund für alle Hauptansichten.
    func liquidScreen() -> some View {
        self
            .scrollContentBackground(.hidden)
            .background { LiquidBackground() }
    }

    /// Volle Breite, großer Text – für Haupt-Aktionen.
    func mainAction() -> some View {
        self
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 34)
    }

    @ViewBuilder func liquidTabBar() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
        #else
        self
        #endif
    }
}

/// Text mit einfachem Markdown (**fett**, *kursiv*, `Code`) sowie <u>unterstrichen</u> und _{tiefgestellt}.
struct RichText: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View { Text(Self.attributed(text)) }

    private static let underlineOn: Character = "\u{E000}"
    private static let underlineOff: Character = "\u{E001}"
    private static let lowOn: Character = "\u{E002}"
    private static let lowOff: Character = "\u{E003}"

    static func attributed(_ raw: String) -> AttributedString {
        var source = raw
            .replacingOccurrences(of: "<u>", with: String(underlineOn))
            .replacingOccurrences(of: "</u>", with: String(underlineOff))
        source = source.replacingOccurrences(of: "_\\{([^}]*)\\}", with: String(lowOn) + "$1" + String(lowOff), options: .regularExpression)
        let parsed = (try? AttributedString(
            markdown: source,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(source)

        // Die Marker werden nach dem Markdown ausgewertet, damit **π_{A}(R)** fett bleibt.
        var result = AttributedString()
        var underline = false
        var low = false
        for run in parsed.runs {
            var piece = ""
            func flush() {
                guard !piece.isEmpty else { return }
                var part = AttributedString(piece)
                part.mergeAttributes(run.attributes)
                if underline { part.swiftUI.underlineStyle = .single }
                if low {
                    part.swiftUI.baselineOffset = -3
                    part.swiftUI.font = .caption
                }
                result += part
                piece = ""
            }
            for ch in String(parsed[run.range].characters) {
                switch ch {
                case underlineOn: flush(); underline = true
                case underlineOff: flush(); underline = false
                case lowOn: flush(); low = true
                case lowOff: flush(); low = false
                default: piece.append(ch)
                }
            }
            flush()
        }
        return result
    }
}

/// Symbol aus der Fachnotation (σπ, ÷, α⁺ ...) statt eines Icons.
struct GlyphIcon: View {
    let text: String
    var size: CGFloat = 44

    var body: some View {
        Text(text)
            .font(.system(size: size * 0.36, weight: .bold, design: .serif))
            .foregroundStyle(Theme.primary)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
            .frame(width: size, height: size)
            .background(Theme.primary.opacity(0.15), in: Circle())
    }
}

struct ProgressRing: View {
    let value: Double
    var color: Color = Theme.primary
    var lineWidth: CGFloat = 6

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(min(max(value, 0), 1)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.6), value: value)
        }
    }
}

struct StatTile: View {
    let value: String
    let label: String
    let icon: String
    var color: Color = Theme.primary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: icon).foregroundStyle(color)
            Text(value).font(.title2.bold()).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .card()
    }
}

/// Zahl formatiert mit deutschem Komma.
func deNumber(_ value: Double, maxDigits: Int = 4) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "de_DE")
    f.numberStyle = .decimal
    f.maximumFractionDigits = maxDigits
    f.minimumFractionDigits = 0
    return f.string(from: NSNumber(value: value)) ?? String(value)
}

/// Liest eine eingegebene Zahl mit Komma oder Punkt als Dezimaltrenner.
func parseNumber(_ input: String) -> Double? {
    var s = input.trimmingCharacters(in: .whitespacesAndNewlines)
    s = s.replacingOccurrences(of: " ", with: "")
    if s.contains(",") {
        s = s.replacingOccurrences(of: ".", with: "")
        s = s.replacingOccurrences(of: ",", with: ".")
    } else if s.filter({ $0 == "." }).count > 1 {
        s = s.replacingOccurrences(of: ".", with: "")
    }
    return Double(s)
}
