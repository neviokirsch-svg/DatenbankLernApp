import SwiftUI
import WebKit

/// Zeigt einen Inhaltsblock oder eine Labor-Aufgabe mit den Web-Bausteinen aus labs.html.
/// So laufen alle Labore und Chen-Diagramme sofort auf dem iPhone und lassen sich einzeln nativ nachbauen.
struct WebBlockView: View {
    let payload: String
    var onScore: ((Double) -> Void)?
    @State private var height: CGFloat = 320

    var body: some View {
        WebBridge(payload: payload, height: $height, onScore: onScore)
            .frame(height: height)
    }
}

private struct WebBridge: UIViewRepresentable {
    let payload: String
    @Binding var height: CGFloat
    let onScore: ((Double) -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "lab")
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.web = web
        if let url = Bundle.main.url(forResource: "labs", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.parent = self
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "lab")
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var parent: WebBridge
        weak var web: WKWebView?

        init(_ parent: WebBridge) { self.parent = parent }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            if body["ready"] != nil {
                web?.evaluateJavaScript("renderFromNative(\(parent.payload))", completionHandler: nil)
            }
            if let value = (body["height"] as? NSNumber)?.doubleValue, value > 0 {
                parent.height = CGFloat(value)
            }
            if let value = (body["score"] as? NSNumber)?.doubleValue {
                parent.onScore?(value)
            }
        }
    }
}
