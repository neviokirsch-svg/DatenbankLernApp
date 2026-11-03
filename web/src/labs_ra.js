// Labore zur relationalen Algebra: Grundoperatoren, Joins, Division, Operatorbaum, Spielwiese.
(function () {
  'use strict';
  const { RA, Calc } = DBEngine;
  const Labs = window.DBLabs;

  // Beispieldaten aus dem Skript (nach Rheinwerk Verlag, Folien 6 bis 10).
  const R0 = RA.rel(['A', 'B', 'C'], [[1, 'f', 'III'], [8, 'z', 'XI'], [5, 'a', 'V'], [2, 'q', 'VI'], [9, 'c', 'II'], [2, 'c', 'IX'], [1, 'f', 'X']], 'R');
  const R1 = RA.rel(['A', 'B', 'C'], [[1, 'f', 'III'], [8, 'z', 'XI'], [3, 'o', 'XII'], [1, 'f', 'X']], 'R');
  const S1 = RA.rel(['A', 'B', 'C'], [[7, 'e', 'V'], [2, 'i', 'V'], [3, 'o', 'XII']], 'S');
  const R2 = RA.rel(['A', 'B', 'C'], [[1, 'f', 'III'], [8, 'z', 'XI'], [3, 'd', 'V'], [3, 'o', 'XII'], [1, 'f', 'X']], 'R');
  const S2 = RA.rel(['A', 'B', 'C'], [[1, 'f', 'X'], [3, 'd', 'V']], 'S');
  const X1 = RA.rel(['A', 'B', 'C'], [[1, 'f', 'III'], [8, 'z', 'XI']], 'R');
  const X2 = RA.rel(['D', 'E'], [[7, 'e'], [2, 'i'], [9, 'f'], [4, 'o']], 'S');

  Labs.raops = function (host, params) {
    const stage = h('div', { class: 'stack' });
    const OPS = {
      sigma() {
        const preds = [
          { label: 'A = 2', f: (r) => r.A === 2, sql: 'WHERE A = 2' },
          { label: "B ≠ 'f'", f: (r) => r.B !== 'f', sql: "WHERE B <> 'f'" },
          { label: 'A > 4', f: (r) => r.A > 4, sql: 'WHERE A > 4' },
          { label: "A = 1 ∧ C = 'X'", f: (r) => r.A === 1 && r.C === 'X', sql: "WHERE A = 1 AND C = 'X'" }
        ];
        const out = h('div', { class: 'stack' });
        const pick = (p) => {
          const res = RA.select(R0, p.f);
          const keep = new Set(res.rows.map((r) => JSON.stringify(r)));
          out.replaceChildren(
            h('div', { class: 'formula fade-in', html: md('σ_{' + p.label + '}(R)') }),
            relTable(RA.table(R0, 'R: passende Zeilen bleiben'), { rowClass: (i) => (keep.has(JSON.stringify(R0.rows[i])) ? 'ok' : 'dim') }),
            caption('**' + res.rows.length + ' von ' + R0.rows.length + ' Zeilen.** Die Selektion wählt Zeilen aus, die Spalten bleiben gleich.\nSQL: `SELECT * FROM R ' + p.sql + '`'));
        };
        pick(preds[0]);
        return [h('div', { class: 'chips' }, preds.map((p) => h('button', { type: 'button', class: 'chip', onclick: () => pick(p) }, p.label))), out];
      },
      pi() {
        let on = ['A', 'B'];
        const row = h('div', { class: 'chips' });
        const out = h('div', { class: 'stack' });
        const draw = () => {
          row.replaceChildren(...R0.attrs.map((a) => h('button', { type: 'button', class: 'chip' + (on.includes(a) ? ' on' : ''), 'aria-pressed': on.includes(a) ? 'true' : 'false', onclick: () => { on = on.includes(a) ? on.filter((x) => x !== a) : R0.attrs.filter((x) => on.includes(x) || x === a); if (!on.length) on = [a]; draw(); } }, a)));
          const res = RA.project(R0, on);
          const removed = R0.rows.length - res.rows.length;
          out.replaceChildren(
            h('div', { class: 'formula fade-in', html: md('π_{' + on.join(', ') + '}(R)') }),
            relTable(RA.table(R0, 'R: ausgewählte Spalten'), { cellClass: (r, c) => (on.includes(R0.attrs[c]) ? 'hl' : 'dim'), headClass: (c) => (on.includes(R0.attrs[c]) ? 'hl' : 'dim') }),
            relTable(RA.table(res, 'Ergebnis')),
            caption(removed ? '**' + removed + (removed === 1 ? ' Duplikat fällt' : ' Duplikate fallen') + ' weg.** Die Algebra arbeitet mit Mengen. SQL bräuchte dafür `SELECT DISTINCT`.' : 'Hier entstehen keine Duplikate. Probiere nur Spalte A oder nur Spalte B.'));
        };
        draw();
        return [row, out];
      },
      cross() {
        const res = RA.cross(X1, X2);
        const body = h('div', { class: 'stack' });
        const controls = stepControls(res.rows.length, (i) => {
          body.replaceChildren(relGroup([RA.table(X1, 'R'), RA.table(X2, 'S')]),
            relTable({ title: 'R × S hat ' + X1.rows.length + ' · ' + X2.rows.length + ' = ' + res.rows.length + ' Zeilen', head: res.attrs, rows: res.rows.slice(0, i).map((r) => r.map(RA.cell)) }, { rowClass: (r) => (r === i - 1 ? 'new' : null) }));
        }, { interval: 750, start: res.rows.length });
        return [h('div', { class: 'formula', html: md('R × S') }), body, controls.el, caption('Jede Zeile von R wird mit jeder Zeile von S kombiniert. Viele Kombinationen ergeben keinen Sinn, deshalb folgt meist eine Selektion. Daraus wird der Join.')];
      },
      union() {
        const res = RA.union(R1, S1);
        return [h('div', { class: 'formula', html: md('R ∪ S') }), relGroup([RA.table(R1, 'R'), RA.table(S1, 'S'), RA.table(res, 'R ∪ S')]), caption('Beide Relationen brauchen dasselbe Schema: gleiche Attributzahl und gleiche Typen. **(3, o, XII)** steht in beiden und erscheint nur einmal. `UNION ALL` würde die Dublette behalten.')];
      },
      minus() {
        const res = RA.minus(R2, S2);
        return [h('div', { class: 'formula', html: md('R − S') }), relGroup([RA.table(R2, 'R'), RA.table(S2, 'S'), RA.table(res, 'R − S')]), caption('Es bleibt, was in R steht, aber nicht in S. Die Reihenfolge zählt: R − S ist etwas anderes als S − R. In SQL heißt das `EXCEPT`, bei Oracle `MINUS`.')];
      },
      rho() {
        const res = RA.rename(R1, { A: 'Nr' });
        return [h('div', { class: 'formula', html: md('ρ_{Nr←A}(R)') }), relGroup([RA.table(R1, 'R'), RA.table(res, 'nach der Umbenennung')]), caption('Die Daten bleiben gleich, nur der Name ändert sich. Das braucht man, wenn eine Relation mehrfach in einer Anfrage vorkommt, zum Beispiel beim Join einer Tabelle mit sich selbst. SQL: `SELECT A AS Nr FROM R`.')];
      }
    };
    const tabs = [{ id: 'sigma', label: 'σ' }, { id: 'pi', label: 'π' }, { id: 'cross', label: '×' }, { id: 'union', label: '∪' }, { id: 'minus', label: '−' }, { id: 'rho', label: 'ρ' }];
    const start = params.start || 'sigma';
    const draw = (id) => stage.replaceChildren(...OPS[id]().flat().filter(Boolean));
    host.append(vizCard('Labor: Die sechs Grundoperatoren', segmented(tabs, start, draw), stage));
    draw(start);
  };

  // ---------------------------------------------------------------------------
  Labs.joins = function (host) {
    const R = RA.rel(['ID', 'Name'], [[1, 'Alice'], [2, 'Bob'], [3, 'Carol']], 'R');
    const S = RA.rel(['ID', 'Course'], [[1, 'Math'], [2, 'Chemistry'], [4, 'Physics']], 'S');
    const J = {
      inner: { f: 'R ⋈ S', left: false, mid: true, right: false, res: RA.natural(R, S), sql: 'SELECT * FROM R JOIN S ON R.ID = S.ID', text: 'Nur Zeilen mit Partner auf beiden Seiten.' },
      left: { f: 'R ⟕ S', left: true, mid: true, right: false, res: RA.leftOuter(R, S), sql: 'SELECT * FROM R LEFT JOIN S ON R.ID = S.ID', text: 'Alle Zeilen aus R. Carol hat keinen Kurs und bekommt NULL.' },
      right: { f: 'R ⟖ S', left: false, mid: true, right: true, res: RA.rightOuter(R, S), sql: 'SELECT * FROM R RIGHT JOIN S ON R.ID = S.ID', text: 'Alle Zeilen aus S. Physics hat keinen Teilnehmer, Name wird NULL.' },
      full: { f: 'R ⟗ S', left: true, mid: true, right: true, res: RA.fullOuter(R, S), sql: 'SELECT * FROM R LEFT JOIN S … UNION SELECT * FROM R RIGHT JOIN S …', text: 'Alles von beiden Seiten. MySQL kennt FULL JOIN nicht, dort kombiniert man LEFT und RIGHT mit UNION.' }
    };
    const venn = (j) => '<svg viewBox="0 0 260 120" role="img" aria-label="Mengendiagramm des Joins" style="max-width:260px;margin:auto">' +
      '<defs><clipPath id="vl"><circle cx="100" cy="60" r="50"/></clipPath><clipPath id="vr"><circle cx="160" cy="60" r="50"/></clipPath></defs>' +
      '<circle cx="100" cy="60" r="50" class="' + (j.left ? 'fill-sel' : 'fill-off') + '"/>' +
      '<circle cx="160" cy="60" r="50" class="' + (j.right ? 'fill-sel' : 'fill-off') + '"/>' +
      '<circle cx="160" cy="60" r="50" clip-path="url(#vl)" class="' + (j.mid ? 'fill-sel' : 'fill-off') + '"/>' +
      '<circle cx="100" cy="60" r="50" class="stroke-fg"/><circle cx="160" cy="60" r="50" class="stroke-fg"/>' +
      '<text x="72" y="64" text-anchor="middle" font-size="14" font-weight="700">R</text><text x="188" y="64" text-anchor="middle" font-size="14" font-weight="700">S</text></svg>';
    const stage = h('div', { class: 'stack' });
    const draw = (id) => {
      const j = J[id];
      stage.replaceChildren(
        h('div', { class: 'dia-scroll', html: venn(j) }),
        h('div', { class: 'formula', html: md(j.f) }),
        relTable(RA.table(j.res, 'Ergebnis'), { rowClass: (i) => (j.res.rows[i].includes(null) ? 'warn new' : 'new') }),
        caption(j.text + '\nSQL: `' + j.sql + '`'));
    };
    host.append(vizCard('Labor: Inner und Outer Joins', relGroup([RA.table(R, 'R'), RA.table(S, 'S')]),
      segmented([{ id: 'inner', label: 'Inner' }, { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'full', label: 'Full' }], 'inner', draw), stage));
    draw('inner');
  };

  // ---------------------------------------------------------------------------
  // Division: Ansehen-Modus mit Animation, Üben-Modus mit Tippen auf Zeilen, immer neue Daten.
  const DIV_DATA = {
    piloten: { label: 'Piloten (Skript, Folie 21)', R: RA.rel(['PILOT', 'FLUGZEUG'], [['Snoopy', '707'], ['Snoopy', '727'], ['Snoopy', '747'], ['Meyer', '707'], ['Meyer', '727'], ['Müller', '707'], ['Müller', '727'], ['Müller', '747'], ['Müller', '777'], ['Lüdenscheid', '727']], 'R₁'), S: RA.rel(['FLUGZEUG'], [['707'], ['727'], ['747']], 'R₂'), q: 'Welche Piloten fliegen alle Flugzeuge aus R₂?' },
    lief: { label: 'Lieferanten (Skript, Folie 22)', R: RA.rel(['LiefNr', 'ArtNr'], [[5, 500001], [2, 500002], [1, 500002], [3, 500003], [4, 500003], [3, 500004], [4, 500004], [4, 500005], [1, 500006], [1, 500007]], 'Lieferungen'), S: RA.rel(['ArtNr'], [[500003], [500004]], 'S'), q: 'Welche Lieferanten liefern mindestens alle Artikel von Lieferant 3?' },
    kunden: { label: 'Bestellungen (Blatt 5.8)', R: RA.rel(['Kunde', 'Produkt'], [['Alice', 'Laptop'], ['Alice', 'Smartphone'], ['Bob', 'Laptop'], ['Bob', 'Tablet'], ['Carol', 'Laptop'], ['Carol', 'Smartphone'], ['Carol', 'Tablet']], 'B'), S: RA.rel(['Produkt'], [['Laptop'], ['Smartphone']], 'P'), q: 'Welche Kunden haben alle Produkte aus P bestellt?' }
  };
  const stepsOf = (data) => {
    const d = RA.divide(data.R, data.S);
    const z = d.Z.join(', ');
    return { d, list: [
      { key: 'A', f: 'A = π_{' + z + '}(R)', x: 'Alle Kandidaten: Die Attribute von R, die nicht in S stehen. Duplikate fallen weg.', res: d.A },
      { key: 'product', f: 'A × S', x: 'Alle geforderten Kombinationen: So müsste R aussehen, wenn jeder Kandidat alles aus S hätte.', res: d.product },
      { key: 'missing', f: '(A × S) − R', x: 'Was gefordert ist, aber in R fehlt. Das sind die Lücken.', res: d.missing },
      { key: 'bad', f: 'π_{' + z + '}((A × S) − R)', x: 'Kandidaten mit mindestens einer Lücke fliegen raus.', res: d.bad },
      { key: 'result', f: 'R ÷ S = A − π_{' + z + '}((A × S) − R)', x: 'Übrig bleibt, wer keine Lücke hat. Das ist das Ergebnis.', res: d.result }
    ] };
  };

  Labs.division = function (host, params, api) {
    const area = h('div', { class: 'stack' });
    let data = DIV_DATA[params.data || 'piloten'];

    const explain = () => {
      const { list } = stepsOf(data);
      const stage = h('div', { class: 'stack' });
      const controls = stepControls(list.length, (i) => {
        const items = [h('div', { class: 'q-text' }, data.q), relGroup([RA.table(data.R, data.R.name || 'R'), RA.table(data.S, data.S.name || 'S')])];
        if (i > 0) {
          const s = list[i - 1];
          let rowClass = () => 'new';
          if (s.key === 'product') {
            const miss = new Set(list[2].res.rows.map((r) => JSON.stringify(r)));
            rowClass = (r) => (i >= 3 && miss.has(JSON.stringify(s.res.rows[r])) ? 'bad' : null);
          }
          items.push(h('div', { class: 'formula fade-in', html: md(s.f) }), relTable(RA.table(s.res, 'Zwischenergebnis ' + i + ' von ' + list.length), { rowClass: s.key === 'result' ? () => 'ok' : rowClass }), caption(s.x, s.key === 'result' ? 'ok' : undefined));
        } else {
          items.push(caption('Fünf Schritte führen zum Ergebnis. Spiele sie ab oder gehe einzeln vor.'));
        }
        stage.replaceChildren(...items);
      }, { interval: 3200 });
      area.replaceChildren(stage, controls.el);
    };

    // Für jeden Schritt tippst du die passenden Zeilen an.
    const practice = (task) => {
      const R = task.R;
      const S = task.S;
      const { list, d } = stepsOf({ R, S });
      const z = d.Z;
      const allZ = d.A.rows;
      const candidates = {
        missing: { attrs: d.product.attrs, rows: d.product.rows },
        bad: { attrs: z, rows: allZ },
        result: { attrs: z, rows: allZ }
      };
      let idx = 0;
      let hits = 0;
      let total = 0;
      const stage = h('div', { class: 'stack' });
      const drawStep = () => {
        if (idx >= list.length) {
          const ratio = total ? hits / total : 1;
          stage.replaceChildren(
            relGroup([RA.table(R, 'R'), RA.table(S, 'S')]),
            relTable(RA.table(d.result, 'R ÷ S'), { rowClass: () => 'ok' }),
            caption('**Geschafft:** ' + hits + ' von ' + total + ' Zwischenergebnissen auf Anhieb richtig.', ratio >= 0.8 ? 'ok' : 'warn'),
            task.fresh ? h('button', { type: 'button', class: 'btn pri full', onclick: () => practice(makeTask()) }, 'Neue Aufgabe') : null);
          if (api && api.done) api.done(ratio);
          return;
        }
        const s = list[idx];
        total++;
        if (s.key === 'product' || s.key === 'A') {
          const isA = s.key === 'A';
          const input = h('input', { type: 'text', inputmode: 'numeric', id: 'div-n-' + Math.random().toString(36).slice(2, 7), 'aria-label': 'Anzahl der Tupel', placeholder: 'Anzahl der Tupel' });
          const fb = h('div');
          stage.replaceChildren(
            relGroup(isA ? [RA.table(R, 'R'), RA.table(S, 'S')] : [RA.table(R, 'R'), RA.table(S, 'S'), RA.table(d.A, 'A')]),
            h('div', { class: 'formula', html: md(s.f) }),
            h('div', { class: 'q-text' }, isA ? 'Wie viele Tupel hat A? Denk an die Duplikate.' : 'Wie viele Tupel hat A × S?'),
            input,
            h('button', { type: 'button', class: 'btn pri full', onclick: (e) => {
              const right = parseInt(input.value, 10) === s.res.rows.length;
              if (right) hits++;
              e.target.remove();
              fb.replaceChildren(caption((right ? '**Richtig:** ' : '**Es sind** ') + (isA ? '' : d.A.rows.length + ' · ' + S.rows.length + ' = ') + s.res.rows.length + ' Tupel.' + (isA ? ' Jeder Wert zählt nur einmal.' : ''), right ? 'ok' : 'bad'), relTable(RA.table(s.res, isA ? 'A' : 'A × S')), h('button', { type: 'button', class: 'btn pri full', onclick: () => { idx++; drawStep(); } }, 'Weiter'));
            } }, 'Prüfen'),
            fb);
          return;
        }
        const cand = candidates[s.key];
        let picked = [];
        const solution = new Set(s.res.rows.map((r) => JSON.stringify(r)));
        let checked = false;
        const tableHost = h('div');
        const fb = h('div');
        const drawTable = () => {
          tableHost.replaceChildren(relTable({ title: 'Tippe alle Tupel an, die zum Ergebnis gehören', head: cand.attrs, rows: cand.rows.map((r) => r.map(RA.cell)) }, {
            rowClass: (i) => {
              const k = JSON.stringify(cand.rows[i]);
              const on = picked.includes(k);
              if (checked) return solution.has(k) ? 'ok' : on ? 'bad' : 'dim';
              return 'pick' + (on ? ' on' : '');
            },
            onRow: (i) => {
              if (checked) return;
              const k = JSON.stringify(cand.rows[i]);
              picked = picked.includes(k) ? picked.filter((x) => x !== k) : picked.concat(k);
              drawTable();
            }
          }));
        };
        drawTable();
        const context = s.key === 'A' ? [RA.table(R, 'R'), RA.table(S, 'S')] : s.key === 'missing' ? [RA.table(R, 'R')] : s.key === 'bad' ? [RA.table(list[2].res, '(A × S) − R')] : [RA.table(d.A, 'A'), RA.table(d.bad, 'Kandidaten mit Lücke')];
        const checkBtn = h('button', { type: 'button', class: 'btn pri full', onclick: () => {
          checked = true;
          const right = picked.length === solution.size && picked.every((k) => solution.has(k));
          if (right) hits++;
          checkBtn.remove();
          drawTable();
          fb.replaceChildren(caption((right ? '**Richtig.** ' : '**Noch nicht.** Grün sind die richtigen Tupel. ') + s.x, right ? 'ok' : 'bad'), h('button', { type: 'button', class: 'btn pri full', onclick: () => { idx++; drawStep(); } }, idx + 1 < list.length ? 'Nächster Schritt' : 'Ergebnis ansehen'));
        } }, 'Prüfen');
        stage.replaceChildren(
          h('div', { class: 'row' }, h('span', { class: 'pill exam num' }, 'Schritt ' + (idx + 1) + ' von ' + list.length), h('span', { class: 'small muted' }, task.q || '')),
          relGroup(context),
          h('div', { class: 'formula', html: md(s.f) }),
          tableHost, checkBtn, fb);
      };
      drawStep();
      area.replaceChildren(stage);
    };
    const makeTask = () => {
      const t = Calc.divisionTask();
      return { R: t.R, S: t.S, fresh: true, q: t.theme.a + ' wie ' + t.target };
    };

    if (params.mode === 'practice') {
      host.append(vizCard('Division selbst durchführen', area));
      practice(params.data ? { R: DIV_DATA[params.data].R, S: DIV_DATA[params.data].S, q: DIV_DATA[params.data].q } : makeTask());
      return;
    }
    const select = h('select', { 'aria-label': 'Beispiel wählen', id: 'div-' + Math.random().toString(36).slice(2, 7), onchange: (e) => { data = DIV_DATA[e.target.value]; explain(); } }, Object.entries(DIV_DATA).map(([id, x]) => h('option', { value: id }, x.label)));
    host.append(vizCard('Labor: Die Division in fünf Schritten', h('div', null, h('div', { class: 'tb-title' }, 'Beispiel'), select), area));
    explain();
    if (params.data) select.value = params.data;
  };

  // ---------------------------------------------------------------------------
  // Operatorbaum: Warum die Selektion nach unten gehört.
  Labs.optree = function (host) {
    const P = 4;
    const V = 8;
    const hit4 = 3;
    const plans = {
      naive: { title: 'Naiver Plan', nodes: [{ id: 'pi', x: 150, y: 24, l: 'π p.name, v.titel', n: 2 }, { id: 'sel', x: 150, y: 88, l: 'σ p.persnr=v.gelesenvon ∧ v.sws=4', n: 2 }, { id: 'x', x: 150, y: 152, l: '×', n: P * V, hot: true }, { id: 'p', x: 70, y: 216, l: 'professoren p', n: P }, { id: 'v', x: 230, y: 216, l: 'vorlesungen v', n: V }], edges: [['pi', 'sel'], ['sel', 'x'], ['x', 'p'], ['x', 'v']], text: 'Das Kreuzprodukt baut zuerst **' + P * V + ' Zeilen** auf, obwohl am Ende nur 2 gebraucht werden.' },
      opt: { title: 'Optimierter Plan', nodes: [{ id: 'pi', x: 150, y: 24, l: 'π p.name, v.titel', n: 2 }, { id: 'join', x: 150, y: 88, l: '⋈ p.persnr=v.gelesenvon', n: 2, hot: true }, { id: 'p', x: 70, y: 216, l: 'professoren p', n: P }, { id: 'sel', x: 230, y: 152, l: 'σ v.sws=4', n: hit4 }, { id: 'v', x: 230, y: 216, l: 'vorlesungen v', n: V }], edges: [['pi', 'join'], ['join', 'p'], ['join', 'sel'], ['sel', 'v']], text: 'Die Selektion läuft zuerst und lässt nur **' + hit4 + ' Vorlesungen** übrig. Der Join verarbeitet dann höchstens ' + P * hit4 + ' Kombinationen statt ' + P * V + '. Das Ergebnis ist gleich.' }
    };
    const fig = h('div', { class: 'dia-scroll' });
    const cap = h('div');
    const draw = (id) => {
      const plan = plans[id];
      const pos = Object.fromEntries(plan.nodes.map((n) => [n.id, n]));
      let s = '<svg viewBox="0 0 300 240" role="img" aria-label="' + plan.title + '" style="max-width:440px;margin:auto">';
      plan.edges.forEach(([a, b]) => { s += '<line class="edge" x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '"/>'; });
      plan.nodes.forEach((n) => {
        const w = Math.max(44, n.l.length * 5.5 + 14);
        s += '<rect class="node-box" x="' + (n.x - w / 2) + '" y="' + (n.y - 13) + '" width="' + w + '" height="26" rx="7"/>';
        if (n.hot) s += '<rect class="node-hit" x="' + (n.x - w / 2) + '" y="' + (n.y - 13) + '" width="' + w + '" height="26" rx="7"/>';
        s += '<text x="' + n.x + '" y="' + (n.y + 4) + '" text-anchor="middle" font-size="10.5">' + n.l + '</text>';
        s += '<text x="' + (n.x + w / 2 + 3) + '" y="' + (n.y - 7) + '" font-size="9.5" font-weight="700" fill="var(--warn)" style="fill:var(--warn)">' + n.n + '</text>';
      });
      fig.innerHTML = s + '</svg>';
      cap.replaceChildren(caption(plan.text + ' Die Zahlen sind Zeilen im Zwischenergebnis (Beispieldaten).'));
    };
    host.append(vizCard('Labor: Selektion nach unten schieben', segmented([{ id: 'naive', label: 'Naiver Plan' }, { id: 'opt', label: 'Optimierter Plan' }], 'naive', draw), fig, cap));
    draw('naive');
  };

  // ---------------------------------------------------------------------------
  // Spielwiese auf der Vorlesungs-Datenbank aus VorlesungenDump.sql.
  Labs.raplay = function (host) {
    const T = window.VORLESUNGEN;
    const tables = Object.keys(T);
    const rel = (n) => RA.rel(T[n].attrs, T[n].rows, n);
    const presets = [
      { label: 'Selektion: Kurse in Raum 1010.4.08', ops: [{ o: 'from', t: 'KURS' }, { o: 'sel', a: 'KURSORT', v: '1010.4.08' }] },
      { label: 'Projektion: Vor- und Nachnamen', ops: [{ o: 'from', t: 'PERSON' }, { o: 'pro', a: ['VORNAME', 'NAME'] }] },
      { label: 'Join: Analysis-Kurse über THEMA', ops: [{ o: 'from', t: 'KURS' }, { o: 'join', t: 'THEMA' }, { o: 'sel', a: 'THEMENGEBIET', v: 'Analysis' }, { o: 'pro', a: ['KURSBEZEICHNUNG', 'KURSORT'] }] },
      { label: 'Join: Wer belegt was?', ops: [{ o: 'from', t: 'BELEGUNG' }, { o: 'join', t: 'PERSON' }, { o: 'join', t: 'KURS' }, { o: 'pro', a: ['NAME', 'KURSBEZEICHNUNG'] }] },
      { label: 'Division: Kurse mit allen Rollen von Kurs 454', ops: [{ o: 'from', t: 'KONTROLLE' }, { o: 'pro', a: ['KNR', 'RNR'] }, { o: 'div454' }] }
    ];
    let ops = [];
    const stage = h('div', { class: 'stack' });
    const evaluate = () => {
      let cur = null;
      let ra = '';
      let sqlFrom = '';
      const where = [];
      let cols = '*';
      for (const op of ops) {
        if (op.o === 'from') { cur = rel(op.t); ra = op.t; sqlFrom = op.t; }
        else if (op.o === 'sel') {
          cur = RA.select(cur, (r) => String(r[op.a]) === String(op.v));
          ra = 'σ_{' + op.a + "='" + op.v + "'}(" + ra + ')';
          where.push(op.a + " = '" + op.v + "'");
        } else if (op.o === 'pro') {
          cur = RA.project(cur, op.a);
          ra = 'π_{' + op.a.join(', ') + '}(' + ra + ')';
          cols = op.a.join(', ');
        } else if (op.o === 'join') {
          const common = cur.attrs.filter((a) => T[op.t].attrs.includes(a));
          cur = RA.natural(cur, rel(op.t));
          ra = '(' + ra + ' ⋈ ' + op.t + ')';
          sqlFrom += ' NATURAL JOIN ' + op.t + ' /* ' + common.join(', ') + ' */';
        } else if (op.o === 'div454') {
          const S = RA.project(RA.select(rel('KONTROLLE'), (r) => r.KNR === '454'), ['RNR']);
          const K = RA.project(rel('KONTROLLE'), ['KNR', 'RNR']);
          cur = RA.divide(K, S).result;
          ra = 'KONTROLLE ÷ π_{RNR}(σ_{KNR=454}(KONTROLLE))';
          sqlFrom = null;
        }
      }
      return { cur, ra, sql: sqlFrom ? 'SELECT ' + cols + ' FROM ' + sqlFrom + (where.length ? ' WHERE ' + where.join(' AND ') : '') : 'In SQL formuliert man Division meist mit doppeltem NOT EXISTS.' };
    };
    const draw = () => {
      const { cur, ra, sql } = evaluate();
      const attrs = cur.attrs;
      const selAttr = h('select', { 'aria-label': 'Attribut', id: 'pl-a-' + stageId }, attrs.map((a) => h('option', { value: a }, a)));
      const selVal = h('select', { 'aria-label': 'Wert', id: 'pl-v-' + stageId });
      const fillVals = () => {
        const i = attrs.indexOf(selAttr.value);
        const vals = Array.from(new Set(cur.rows.map((r) => String(r[i])))).slice(0, 40);
        selVal.replaceChildren(...vals.map((v) => h('option', { value: v }, v)));
      };
      selAttr.addEventListener('change', fillVals);
      fillVals();
      const joinable = tables.filter((t) => T[t].attrs.some((a) => attrs.includes(a)));
      const selJoin = h('select', { 'aria-label': 'Tabelle für den Join', id: 'pl-j-' + stageId }, joinable.map((t) => h('option', { value: t }, t + ' (über ' + T[t].attrs.filter((a) => attrs.includes(a)).join(', ') + ')')));
      const proj = attrs.map((a) => ({ a, on: true }));
      const chips = h('div', { class: 'chips' }, proj.map((p) => {
        const b = h('button', { type: 'button', class: 'chip on', onclick: () => { p.on = !p.on; b.className = 'chip' + (p.on ? ' on' : ''); } }, p.a);
        return b;
      }));
      stage.replaceChildren(
        h('div', { class: 'formula', html: md(ra) }),
        h('div', { class: 'schema' }, sql),
        relTable({ title: cur.rows.length + ' Zeilen', head: attrs, rows: cur.rows.slice(0, 30).map((r) => r.map(RA.cell)) }),
        cur.rows.length > 30 ? h('div', { class: 'small muted' }, 'Es werden die ersten 30 Zeilen gezeigt.') : null,
        h('div', { class: 'stack-s' },
          h('h3', null, 'Nächsten Operator anwenden'),
          h('div', { class: 'lab-grid' },
            h('div', { class: 'stack-s' }, h('b', { class: 'small' }, 'σ Selektion'), selAttr, selVal, h('button', { type: 'button', class: 'btn s', onclick: () => { ops.push({ o: 'sel', a: selAttr.value, v: selVal.value }); draw(); } }, 'Zeilen filtern')),
            h('div', { class: 'stack-s' }, h('b', { class: 'small' }, 'π Projektion'), chips, h('button', { type: 'button', class: 'btn s', onclick: () => { const on = proj.filter((p) => p.on).map((p) => p.a); if (on.length) { ops.push({ o: 'pro', a: on }); draw(); } } }, 'Spalten behalten')),
            joinable.length ? h('div', { class: 'stack-s' }, h('b', { class: 'small' }, '⋈ Natural Join'), selJoin, h('button', { type: 'button', class: 'btn s', onclick: () => { ops.push({ o: 'join', t: selJoin.value }); draw(); } }, 'Tabelle verknüpfen')) : null)));
    };
    const stageId = Math.random().toString(36).slice(2, 7);
    const start = h('select', { 'aria-label': 'Starttabelle', id: 'pl-s-' + stageId, onchange: (e) => { ops = [{ o: 'from', t: e.target.value }]; draw(); } }, tables.map((t) => h('option', { value: t }, t)));
    const preset = h('select', { 'aria-label': 'Beispielanfrage', id: 'pl-p-' + stageId, onchange: (e) => { if (e.target.value !== '') { ops = presets[+e.target.value].ops.map((o) => Object.assign({}, o)); draw(); } } }, h('option', { value: '' }, 'Beispielanfrage wählen …'), presets.map((p, i) => h('option', { value: i }, p.label)));
    ops = presets[2].ops.map((o) => Object.assign({}, o));
    host.append(vizCard('Labor: Algebra auf der Vorlesungs-Datenbank',
      h('div', { class: 'lab-grid' }, h('div', null, h('div', { class: 'tb-title' }, 'Beispiel'), preset), h('div', null, h('div', { class: 'tb-title' }, 'Oder neu starten mit Tabelle'), start)),
      stage));
    draw();
  };
})();
