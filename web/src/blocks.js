// Darstellung der Inhaltsblöcke aus den module_*.json (entspricht Views/BlockViews.swift).
(function () {
  'use strict';

  const SCRIPT_NAMES = { 1: 'Einführung', 2: 'Architektur', 3: 'ERM', 4: 'Relationales Modell', 5: 'Relationale Algebra', 6: 'Normalformen 1', 7: 'Normalformen 2', 8: 'Übungsblatt 5', 9: 'Übungsblatt 6', 10: 'Notation Tabellenmodell', 11: 'Notation Relationenmodell' };
  window.scriptName = (part) => SCRIPT_NAMES[part] || 'Skript';
  window.refLabel = function (ref) {
    const m = /^T(\d+) S\.(.+)$/.exec(ref || '');
    return m ? 'Skript ' + scriptName(+m[1]) + ', S. ' + m[2] : ref;
  };

  // Dateiname einer Folie, derselbe Aufbau wie in tools/extract-slides.js und in der App.
  window.slideName = function (b) {
    const crop = b.crop ? '_' + b.crop.join('_') : '';
    return 's' + b.part + '_' + b.page + crop;
  };
  const slideSrc = (b) => {
    const name = slideName(b);
    return (window.DB_SLIDES && window.DB_SLIDES[name]) || 'slides/' + name + '.png';
  };

  window.openLightbox = function (src, title) {
    const old = document.getElementById('lightbox');
    if (old) old.remove();
    const close = () => { box.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const zoomBtn = h('button', { type: 'button', class: 'btn s', onclick: () => { box.classList.toggle('zoom'); zoomBtn.textContent = box.classList.contains('zoom') ? 'Verkleinern' : 'Vergrößern'; } }, 'Vergrößern');
    const box = h('div', { id: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Folie' },
      h('div', { class: 'bar-top' }, h('span', null, title || ''), h('span', { class: 'btns' }, zoomBtn, h('button', { type: 'button', class: 'btn s', onclick: close }, 'Schließen'))),
      h('img', { src, alt: title || 'Folie aus dem Skript' }));
    document.body.append(box);
    document.addEventListener('keydown', esc);
  };

  const R = {
    p: (b) => rich(b.x, 'prose'),
    h: (b) => h('h3', { class: 'sub', html: md(b.x) }),
    b: (b) => h('ul', { class: 'points' }, (b.i || []).map((x) => h('li', { html: md(x) }))),
    k: (b) => callout('k', 'bulb', 'Merke', b.x),
    w: (b) => callout('w', 'warn', 'Klausurfalle', b.x),
    ex: (b) => callout('ex', 'target', 'Klausurbezug', b.x),
    f: (b) => h('div', { class: 'formula' }, h('span', { html: md(b.x) }), b.title ? h('small', { html: md(b.title) }) : null),
    s: (b) => h('div', { class: 'schema', html: md(b.x) }),
    code: (b) => h('pre', { class: 'code' }, b.x),
    tb: (b) => relTable({ title: b.title, head: b.head || [], rows: b.rows || [] }, { data: false }),
    rels: (b) => relGroup(b.tabs || []),
    sl: (b) => {
      const src = slideSrc(b);
      const label = 'Skript ' + scriptName(b.part) + ', S. ' + b.page;
      return h('figure', { class: 'dia' },
        h('button', { type: 'button', class: 'slide', 'aria-label': 'Folie groß anzeigen: ' + (b.x || label), onclick: () => openLightbox(src, (b.x ? b.x + ' · ' : '') + label) },
          h('img', { src, alt: b.x || label, loading: 'lazy' })),
        h('figcaption', { class: 'fig-cap' }, (b.x ? b.x + ' · ' : '') + label));
    },
    st: (b) => stepBlock(b),
    er: (b) => ER.block(b),
    net: (b) => netBlock(b),
    bars: (b) => barsBlock(b),
    x: (b) => labBlock(b)
  };

  function callout(cls, ic, tag, text) {
    return h('div', { class: 'call ' + cls }, icon(ic), h('div', { class: 'prose' }, h('span', { class: 'tag' }, tag), h('span', { html: md(text) })));
  }

  window.renderBlock = function (b) {
    const fn = R[b.t];
    if (!fn) return h('div', { class: 'caption bad' }, 'Unbekannter Blocktyp: ' + b.t);
    return fn(b);
  };
  window.renderBlocks = (list) => h('div', { class: 'blocks' }, (list || []).map(renderBlock));

  // Schrittfolge mit Text, Formel und Tabellen, z. B. die Division.
  function stepBlock(b) {
    const stage = h('div', { class: 'stack' });
    const dots = b.steps.length - 1;
    const controls = stepControls(dots, (i) => {
      const s = b.steps[i];
      stage.replaceChildren(
        ...[
          s.f ? h('div', { class: 'formula fade-in', html: md(s.f) }) : null,
          s.tabs ? relGroup(s.tabs) : null,
          s.x ? caption(s.x) : null
        ].filter(Boolean)
      );
    });
    return vizCard(b.title || 'Schritt für Schritt', stage, controls.el);
  }

  // Knoten-Kanten-Diagramm mit Schritten (gleiches Format wie NetDiagramView in Swift).
  function netBlock(b) {
    const W = 620;
    const H = b.height || 260;
    const px = (n) => [34 + n.x * (W - 68), 26 + n.y * (H - 52)];
    const nodeById = Object.fromEntries(b.nodes.map((n) => [n.id, n]));
    const svgFor = (step) => {
      const hn = (step && step.hn) || [];
      const he = (step && step.he) || [];
      const dn = (step && step.dn) || [];
      const de = (step && step.de) || [];
      const pair = (list, e) => list.some((x) => (x[0] === e.a && x[1] === e.b) || (x[0] === e.b && x[1] === e.a));
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (b.title || 'Diagramm').replace(/"/g, '') + '">';
      for (const e of b.edges || []) {
        const [x1, y1] = px(nodeById[e.a]);
        const [x2, y2] = px(nodeById[e.b]);
        const cls = pair(he, e) ? 'edge-hit' : pair(de, e) ? 'edge-gone' : 'edge';
        s += '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
        if (e.l) s += '<text x="' + (x1 + x2) / 2 + '" y="' + ((y1 + y2) / 2 - 5) + '" text-anchor="middle" font-size="11" opacity=".75">' + e.l + '</text>';
      }
      for (const n of b.nodes) {
        const [x, y] = px(n);
        const w = Math.max(44, n.l.length * 7.2 + 16);
        const cls = hn.includes(n.id) ? 'node-hit' : dn.includes(n.id) ? 'node-bad' : 'node-box';
        s += '<rect class="node-box" x="' + (x - w / 2) + '" y="' + (y - 15) + '" width="' + w + '" height="30" rx="8"/>';
        if (cls !== 'node-box') s += '<rect class="' + cls + '" x="' + (x - w / 2) + '" y="' + (y - 15) + '" width="' + w + '" height="30" rx="8"/>';
        s += '<text x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle" font-size="12.5">' + n.l + '</text>';
      }
      return s + '</svg>';
    };
    const fig = h('div', { class: 'dia-scroll' });
    const cap = h('div');
    const steps = b.steps || [];
    const draw = (i) => {
      const step = steps[i];
      fig.innerHTML = svgFor(step);
      cap.replaceChildren(...(step ? [caption(step.x)] : []));
    };
    if (!steps.length) {
      draw(0);
      return vizCard(b.title, fig);
    }
    const controls = stepControls(steps.length - 1, draw);
    return vizCard(b.title, fig, cap, controls.el);
  }

  function barsBlock(b) {
    const top = Math.max(...b.bars.map((x) => x.v));
    return vizCard(b.title,
      h('div', { class: 'stack-s' }, b.bars.map((x) =>
        h('div', null,
          h('div', { class: 'row small' }, h('span', { class: 'grow' }, x.l), h('span', { class: 'num muted' }, String(x.v))),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + (x.v / top) * 100 + '%' }))))),
      b.unit ? h('div', { class: 'small muted' }, b.unit) : null);
  }

  function labBlock(b) {
    const host = h('div', { class: 'lab-host' });
    const fn = window.DBLabs && window.DBLabs[b.viz];
    if (!fn) {
      host.append(caption('Labor „' + b.viz + '“ nicht gefunden.', 'bad'));
      return host;
    }
    fn(host, b.params || {}, {});
    return host;
  }
  window.DBLabs = window.DBLabs || {};
})();
