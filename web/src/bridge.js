// Brücke für die iOS-App: WKWebView ruft renderFromNative(json) auf und bekommt Höhe und Punkte zurück.
(function () {
  'use strict';
  const post = (msg) => {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lab) {
      window.webkit.messageHandlers.lab.postMessage(msg);
    }
  };
  const reportHeight = () => post({ height: document.documentElement.scrollHeight });
  new ResizeObserver(reportHeight).observe(document.documentElement);

  // block: ein Inhaltsblock (x, er, st ...); question: eine Frage vom Typ lab.
  window.renderFromNative = function (json) {
    const payload = typeof json === 'string' ? JSON.parse(json) : json;
    const host = document.getElementById('host');
    host.replaceChildren();
    if (payload.k === 'lab') {
      window.DBLabs[payload.viz](host, payload.params || {}, { done: (score) => post({ score }) });
    } else {
      host.append(window.renderBlock(payload));
    }
    reportHeight();
  };
  post({ ready: true });
})();
