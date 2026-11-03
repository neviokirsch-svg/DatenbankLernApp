// Steuert labs.html so an wie WebBlockView in der App: renderFromNative mit JSON pro Block oder Labor-Aufgabe.
(function () {
  'use strict';
  const report = { rendered: 0, errors: [] };
  let current = '';
  window.addEventListener('error', (e) => report.errors.push(current + ': ' + e.message));
  const payloads = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.t === 'er' || n.t === 'x' || n.k === 'lab') payloads.push(n);
      Object.values(n).forEach(walk);
    }
  };
  walk(window.TEST_CONTENT);
  window.addEventListener('load', () => {
    for (const p of payloads) {
      current = p.id || p.viz || p.title || p.t;
      try {
        window.renderFromNative(JSON.stringify(p));
        if (!document.getElementById('host').children.length) report.errors.push(current + ': nichts dargestellt');
        report.rendered++;
      } catch (e) {
        report.errors.push(current + ': ' + e.message);
      }
    }
    const pre = document.createElement('pre');
    pre.id = 'labs-report';
    pre.textContent = JSON.stringify(report);
    document.body.append(pre);
  });
})();
