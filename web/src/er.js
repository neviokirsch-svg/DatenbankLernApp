// Chen-Diagramme aus Daten zeichnen: Entitäten, Beziehungen, Attribute, Kardinalitäten, is-a.
// Präfixe bei Attributen: *Schlüssel, ~partieller Schlüssel, {mehrwertig}, /abgeleitet.
(function () {
  'use strict';

  const CHAR = 6.9;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function parseAttr(a) {
    const o = typeof a === 'string' ? { n: a } : Object.assign({}, a);
    if (o.n.startsWith('*')) { o.kind = 'key'; o.n = o.n.slice(1); }
    else if (o.n.startsWith('~')) { o.kind = 'partial'; o.n = o.n.slice(1); }
    else if (o.n.startsWith('{')) { o.kind = 'multi'; o.n = o.n.slice(1, -1); }
    else if (o.n.startsWith('/')) { o.kind = 'derived'; o.n = o.n.slice(1); }
    return o;
  }

  const attrWidth = (a) => Math.max(32, (a.n.length * CHAR) / 2 + 9);

  // Attribute fächern sich um ihren Besitzer auf. side: t, b, l, r. Der Abstand richtet sich nach der Textbreite.
  function fan(owner, attrs, side, h0) {
    const list = attrs.map(parseAttr);
    const horizontal = side !== 'l' && side !== 'r';
    const total = list.reduce((sum, a) => sum + attrWidth(a) * 2, 0) + (list.length - 1) * 6;
    let cursor = -total / 2;
    return list.map((a, i) => {
      const w = attrWidth(a);
      const center = cursor + w;
      cursor += w * 2 + 6;
      if (a.x !== undefined) return a;
      const off = i - (list.length - 1) / 2;
      const reach = h0 || 62;
      if (!horizontal) {
        const dir = side === 'l' ? -1 : 1;
        a.x = owner.x + dir * (Math.max(w + 58, 104) - Math.abs(off) * 10);
        a.y = owner.y + off * 36;
      } else {
        a.x = owner.x + center;
        a.y = owner.y + (side === 'b' ? 1 : -1) * (reach - Math.abs(off) * 8);
      }
      return a;
    });
  }

  function attrSvg(a, ox, oy, cls) {
    const rx = attrWidth(a);
    let s = '<line class="er-l ' + (cls || '') + '" x1="' + ox + '" y1="' + oy + '" x2="' + a.x + '" y2="' + a.y + '"/>';
    s += '<g class="er-a">';
    const dash = a.kind === 'derived' ? ' stroke-dasharray="4 3"' : '';
    s += '<ellipse cx="' + a.x + '" cy="' + a.y + '" rx="' + rx + '" ry="15"' + dash + '/>';
    if (a.kind === 'multi') s += '<ellipse cx="' + a.x + '" cy="' + a.y + '" rx="' + (rx - 3.5) + '" ry="11.5"/>';
    s += '<text x="' + a.x + '" y="' + (a.y + 4) + '" text-anchor="middle" font-size="12"' + (a.kind === 'key' ? ' text-decoration="underline" font-weight="700"' : '') + '>' + esc(a.n) + '</text>';
    for (const kid of a.kids || []) {
      const rk = Math.max(28, (kid.n.length * CHAR) / 2 + 8);
      s += '<line class="er-l" x1="' + a.x + '" y1="' + a.y + '" x2="' + kid.x + '" y2="' + kid.y + '"/><ellipse cx="' + kid.x + '" cy="' + kid.y + '" rx="' + rk + '" ry="14"/><text x="' + kid.x + '" y="' + (kid.y + 4) + '" text-anchor="middle" font-size="11.5">' + esc(kid.n) + '</text>';
    }
    if (a.kind === 'partial') {
      const w = (a.n.length * CHAR) / 2;
      s += '<line x1="' + (a.x - w) + '" y1="' + (a.y + 7) + '" x2="' + (a.x + w) + '" y2="' + (a.y + 7) + '" stroke="currentColor" stroke-width="1.1" stroke-dasharray="3 2"/>';
    }
    return s + '</g>';
  }

  function entityBox(e) {
    return { w: Math.max(84, e.n.length * CHAR + 26), h: 38 };
  }
  function relBox(r) {
    return { w: Math.max(96, r.n.length * CHAR + 44), h: 54 };
  }

  // Schnittpunkt der Linie vom Mittelpunkt (x,y) Richtung (tx,ty) mit dem Rechteck der Entität.
  function borderPoint(x, y, box, tx, ty, extra) {
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
    const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
    const t = Math.min(sx, sy);
    return { x: x + dx * t + (dx / len) * extra, y: y + dy * t + (dy / len) * extra, nx: -dy / len, ny: dx / len, ux: dx / len, uy: dy / len };
  }

  function linkSvg(a, b, total, cls) {
    const line = (x1, y1, x2, y2) => '<line class="er-l ' + (cls || '') + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    if (!total) return line(a.x, a.y, b.x, b.y);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 2.2;
    const ny = (dx / len) * 2.2;
    return line(a.x + nx, a.y + ny, b.x + nx, b.y + ny) + line(a.x - nx, a.y - ny, b.x - nx, b.y - ny);
  }

  // Liefert fertiges SVG in Ebenen, damit die Animation sie nacheinander einblenden kann.
  function layers(d) {
    const ents = Object.fromEntries(d.ents.map((e) => [e.id || e.n, e]));
    const out = { ents: '', attrs: '', rels: '', cards: '', isa: '' };

    for (const e of d.ents) {
      for (const a of fan(e, e.attrs || [], e.side || 't', e.reach)) out.attrs += attrSvg(a, e.x, e.y);
    }
    for (const r of d.rels || []) {
      const ends = r.ends || [{ e: r.a, c: r.ca, total: r.ta }, { e: r.b, c: r.cb, total: r.tb }];
      const box = relBox(r);
      let drawn = '';
      if (r.self) {
        // Rekursive Beziehung: zwei Linien vom selben Entitätstyp, oben und unten zur Raute.
        const E = ents[ends[0].e];
        const bx = entityBox(E);
        const sx = E.x + bx.w / 2 - 14;
        const top = E.y - bx.h / 2;
        const bottom = E.y + bx.h / 2;
        const up = Math.min(top - 26, r.y - box.h / 2 - 12);
        const down = Math.max(bottom + 26, r.y + box.h / 2 + 12);
        drawn += '<path class="er-l" d="M ' + sx + ' ' + top + ' L ' + sx + ' ' + up + ' L ' + r.x + ' ' + up + ' L ' + r.x + ' ' + (r.y - box.h / 2) + '" fill="none"/>';
        drawn += '<path class="er-l" d="M ' + sx + ' ' + bottom + ' L ' + sx + ' ' + down + ' L ' + r.x + ' ' + down + ' L ' + r.x + ' ' + (r.y + box.h / 2) + '" fill="none"/>';
        out.cards += '<text class="er-c" x="' + (sx + 8) + '" y="' + (top - 8) + '" font-size="13">' + esc(ends[0].c) + '</text>';
        out.cards += '<text class="er-c" x="' + (sx + 8) + '" y="' + (bottom + 18) + '" font-size="13">' + esc(ends[1].c) + '</text>';
        if (ends[0].role) out.cards += '<text x="' + (sx + 26) + '" y="' + (top - 8) + '" font-size="11" opacity=".8">' + esc(ends[0].role) + '</text>';
        if (ends[1].role) out.cards += '<text x="' + (sx + 26) + '" y="' + (bottom + 18) + '" font-size="11" opacity=".8">' + esc(ends[1].role) + '</text>';
      } else {
        for (const end of ends) {
          const E = ents[end.e];
          drawn += linkSvg({ x: E.x, y: E.y }, { x: r.x, y: r.y }, end.total || (r.ident && end.e === r.weak));
          const extra = 11 + String(end.c || '').length * 3.4;
          const p = borderPoint(E.x, E.y, entityBox(E), r.x, r.y, extra);
          let nx = p.nx;
          let ny = p.ny;
          if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx < 0)) { nx = -nx; ny = -ny; }
          if (end.c) out.cards += '<text class="er-c" x="' + (p.x + nx * 9) + '" y="' + (p.y + ny * 9 + 4) + '" text-anchor="middle" font-size="13">' + esc(end.c) + '</text>';
          if (end.role) out.cards += '<text x="' + (p.x - nx * 10) + '" y="' + (p.y - ny * 10 + 4) + '" font-size="11" text-anchor="middle" opacity=".8">' + esc(end.role) + '</text>';
        }
      }
      out.rels += drawn;
      for (const a of fan(r, r.attrs || [], r.side || 't', 54)) out.rels += attrSvg(a, r.x, r.y);
      const hw = box.w / 2;
      const hh = box.h / 2;
      const pts = (k) => r.x + ',' + (r.y - hh + k) + ' ' + (r.x + hw - k * 1.6) + ',' + r.y + ' ' + r.x + ',' + (r.y + hh - k) + ' ' + (r.x - hw + k * 1.6) + ',' + r.y;
      out.rels += '<g class="er-r"><polygon points="' + pts(0) + '"/>' + (r.ident ? '<polygon points="' + pts(4.5) + '"/>' : '') + '<text x="' + r.x + '" y="' + (r.y + 4) + '" text-anchor="middle" font-size="12">' + esc(r.n) + '</text></g>';
    }
    for (const g of d.isa || []) {
      const sup = ents[g.sup];
      const label = g.n || 'is-a';
      const w = Math.max(50, label.length * CHAR + 18);
      out.isa += '<line class="er-l" x1="' + sup.x + '" y1="' + sup.y + '" x2="' + g.x + '" y2="' + g.y + '"/>';
      for (const s of g.subs) {
        const E = ents[s];
        out.isa += '<line class="er-l" x1="' + g.x + '" y1="' + g.y + '" x2="' + E.x + '" y2="' + E.y + '"/>';
      }
      out.isa += '<g class="er-r"><polygon points="' + g.x + ',' + (g.y - 16) + ' ' + (g.x + w / 2) + ',' + g.y + ' ' + g.x + ',' + (g.y + 16) + ' ' + (g.x - w / 2) + ',' + g.y + '"/><text x="' + g.x + '" y="' + (g.y + 4) + '" text-anchor="middle" font-size="11">' + esc(label) + '</text></g>';
      if (g.note) out.isa += '<text x="' + (g.x + w / 2 + 6) + '" y="' + (g.y + 4) + '" font-size="10.5" opacity=".75">' + esc(g.note) + '</text>';
    }
    for (const e of d.ents) {
      const b = entityBox(e);
      const label = e.n;
      let s = '<g class="er-e"><rect x="' + (e.x - b.w / 2) + '" y="' + (e.y - b.h / 2) + '" width="' + b.w + '" height="' + b.h + '" rx="3"/>';
      if (e.weak) s += '<rect x="' + (e.x - b.w / 2 + 3.5) + '" y="' + (e.y - b.h / 2 + 3.5) + '" width="' + (b.w - 7) + '" height="' + (b.h - 7) + '" rx="2"/>';
      s += '<text x="' + e.x + '" y="' + (e.y + 4.5) + '" text-anchor="middle" font-size="13.5" font-weight="650">' + esc(label) + '</text></g>';
      out.ents += s;
    }
    return out;
  }

  function svgMarkup(d, visible) {
    const v = visible || { attrs: true, rels: true, cards: true, isa: true };
    const l = layers(d);
    const g = (name, on) => '<g class="er-step' + (on ? '' : ' off') + '">' + l[name] + '</g>';
    return '<svg viewBox="0 0 ' + d.w + ' ' + d.h + '" role="img" aria-label="' + esc(d.title || 'ER-Diagramm') + '">' +
      g('rels', v.rels) + g('isa', v.isa) + g('attrs', v.attrs) + '<g>' + l.ents + '</g>' + g('cards', v.cards) + '</svg>';
  }

  const STAGES = [
    { label: 'Entitäten aus dem Text', v: { attrs: false, rels: false, cards: false, isa: false } },
    { label: 'Attribute und unterstrichener Schlüssel', v: { attrs: true, rels: false, cards: false, isa: false } },
    { label: 'Beziehungen als Rauten', v: { attrs: true, rels: true, cards: false, isa: true } },
    { label: 'Kardinalitäten: erst damit ist das Diagramm vollständig', v: { attrs: true, rels: true, cards: true, isa: true } }
  ];

  window.ER = {
    svg: svgMarkup,
    figure(d) {
      const big = d.w > 480;
      return h('div', { class: 'dia-scroll' + (big ? ' min' : ''), html: svgMarkup(d) });
    },
    // {t:"er", anim:true} baut das Diagramm in den vier Schritten des Skripts auf.
    block(b) {
      const d = b.er || b;
      if (!b.anim) {
        return h('figure', { class: 'dia' }, this.figure(d), b.title ? h('figcaption', { class: 'fig-cap', html: md(b.title) }) : null);
      }
      const holder = h('div', { class: 'dia-scroll' + (d.w > 480 ? ' min' : '') });
      const cap = h('div');
      const controls = stepControls(STAGES.length - 1, (i) => {
        holder.innerHTML = svgMarkup(d, STAGES[i].v);
        cap.replaceChildren(caption(STAGES[i].label));
      }, { start: STAGES.length - 1 });
      return vizCard(b.title || 'ER-Diagramm aufbauen', holder, cap, controls.el);
    }
  };
})();
