// Läuft nur in der Testvariante: öffnet jede Seite, beantwortet Fragen, klickt Labore und meldet Fehler und Überbreite.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('theme')) document.documentElement.setAttribute('data-theme', params.get('theme'));
  const mode = params.get('mode');
  if (!mode) return;

  const report = { errors: [], overflow: [], routes: 0, questions: 0, checked: 0, solved: 0, labClicks: 0, width: 0 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.addEventListener('error', (e) => report.errors.push(location.hash + ' window: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => report.errors.push(location.hash + ' promise: ' + e.reason));
  const realError = console.error;
  console.error = function () { report.errors.push(location.hash + ' console: ' + Array.from(arguments).join(' ')); realError.apply(console, arguments); };

  const open = (hash) => { history.replaceState(null, '', '#' + hash); window.DBApp.route(); report.routes++; };
  const SCROLLABLE = '.tb-wrap, .dia-scroll, pre, .formula, .schema, .task-nav, svg';
  function checkOverflow(label) {
    const w = document.documentElement.clientWidth;
    report.width = w;
    const offenders = [];
    for (const el of document.querySelectorAll('#view *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > w + 1 && !el.closest(SCROLLABLE)) offenders.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''));
    }
    if (document.documentElement.scrollWidth > w + 1 || offenders.length) {
      report.overflow.push(label + ' (' + document.documentElement.scrollWidth + ' > ' + w + '): ' + Array.from(new Set(offenders)).slice(0, 4).join(', '));
    }
  }

  // Beantwortet die offene Frage richtig, damit auch Lösungswege und Zusammenfassung drankommen.
  function answerCorrectly(q, host) {
    if (q.k === 'mc' || q.k === 'ms') {
      for (const btn of Array.from(host.querySelectorAll('.opt'))) {
        const text = btn.querySelector('span').innerHTML;
        const idx = q.o.findIndex((o) => window.md(o) === text);
        if ((q.a || []).includes(idx)) btn.click();
        report.checked += 0;
      }
    } else if (q.k === 'num') {
      const input = host.querySelector('input');
      input.value = String(q.num);
      input.dispatchEvent(new Event('input'));
    } else if (q.k === 'tf') {
      (q.st || []).forEach((s) => {
        const box = Array.from(host.querySelectorAll('.tf')).find((b) => b.querySelector('.prose').innerHTML === window.md(s.s));
        box.querySelectorAll('.pair button')[s.v ? 0 : 1].click();
      });
    } else if (q.k === 'match') {
      (q.pairs || []).forEach((p) => {
        const row = Array.from(host.querySelectorAll('.match-row')).find((b) => b.querySelector('.prose').innerHTML === window.md(p[0]));
        const sel = row.querySelector('select');
        sel.value = p[1];
        sel.dispatchEvent(new Event('change'));
      });
    }
  }

  async function runPractice(m, s) {
    open(s.id + '-praxis');
    await sleep(5);
    let guard = 0;
    while (guard++ < 60) {
      const view = document.getElementById('view');
      const heading = view.querySelector('.q-text');
      if (!heading) break;
      const primary = Array.from(view.querySelectorAll('.btn.pri.full')).pop();
      if (!primary) break;
      const qText = heading.innerHTML;
      const id = (s.practice || []).find((x) => {
        const q = window.DBApp.makeQuestion(x);
        return q && !x.startsWith('calc.') && window.md(q.q) === qText;
      });
      const q = id ? window.DBApp.makeQuestion(id) : null;
      report.questions++;
      if (q && q.k !== 'lab' && q.k !== 'open' && q.k !== 'ord') {
        answerCorrectly(q, view);
        await sleep(1);
      }
      if (q && q.k === 'lab') {
        // Labor-Aufgaben kurz anklicken und überspringen
        Array.from(view.querySelectorAll('.viz .chip, .viz .opt')).slice(0, 3).forEach((b) => { try { b.click(); report.labClicks++; } catch (e) { report.errors.push('lab ' + q.id + ': ' + e.message); } });
        checkOverflow(s.id + ' lab ' + q.id);
        break;
      }
      let btn = Array.from(view.querySelectorAll('.btn.pri.full')).pop();
      if (!btn || btn.disabled) {
        if (q && q.k !== 'lab') {
          // Calc-Fragen ohne bekannte Lösung: einfach etwas auswählen
          const anyOpt = view.querySelector('.opt');
          if (anyOpt) anyOpt.click();
          const input = view.querySelector('input[type=text]');
          if (input) { input.value = '1'; input.dispatchEvent(new Event('input')); }
          await sleep(1);
          btn = Array.from(view.querySelectorAll('.btn.pri.full')).pop();
        } else {
          const anyOpt = view.querySelector('.opt');
          if (anyOpt) anyOpt.click();
          const input = view.querySelector('input[type=text]');
          if (input) { input.value = '1'; input.dispatchEvent(new Event('input')); }
          await sleep(1);
          btn = Array.from(view.querySelectorAll('.btn.pri.full')).pop();
        }
      }
      if (!btn || btn.disabled) { report.errors.push(s.id + ': Prüfen bleibt gesperrt bei ' + (q ? q.id : 'Zufallsaufgabe')); break; }
      btn.click();
      await sleep(1);
      if (q && q.k !== 'open' && q.k !== 'ord' && q.k !== 'lab') {
        report.checked++;
        const head = view.querySelector('.sol-head');
        if (head && head.classList.contains('ok')) report.solved++;
        else report.errors.push(q.id + ': Lösung wird nicht als richtig erkannt');
      }
      checkOverflow(s.id + ' Antwort ' + (q ? q.id : ''));
      const next = Array.from(view.querySelectorAll('.btn.pri.full')).pop();
      if (!next) break;
      next.click();
      await sleep(1);
    }
    checkOverflow(s.id + ' Ende Praxis');
  }

  // Klickt jede Schaltfläche in den Laboren einer Seite einmal.
  async function pokeLabs(label) {
    const buttons = Array.from(document.querySelectorAll('#view .viz button'));
    for (const b of buttons) {
      if (!b.isConnected || b.disabled) continue;
      try { b.click(); report.labClicks++; } catch (e) { report.errors.push(label + ' Klick: ' + e.message); }
    }
    for (const sel of Array.from(document.querySelectorAll('#view .viz select'))) {
      if (!sel.isConnected || sel.options.length < 2) continue;
      sel.selectedIndex = sel.options.length - 1;
      sel.dispatchEvent(new Event('change'));
      report.labClicks++;
    }
    await sleep(1);
    checkOverflow(label + ' nach Klicks');
  }

  async function runAll() {
    for (const hash of ['heute', 'lernen', 'wiederholen', 'trainer', 'klausur']) {
      open(hash);
      await sleep(1);
      checkOverflow(hash);
    }
    for (const m of window.DBApp.modules) {
      open(m.id);
      checkOverflow(m.id);
      for (const s of m.sections) {
        open(s.id);
        await sleep(1);
        checkOverflow(s.id);
        await pokeLabs(s.id);
        await runPractice(m, s);
      }
    }
    // Trainer: jede Aufgabenart einmal
    for (const g of DBEngine.Calc.list()) {
      const q = DBEngine.Calc.make(g.id);
      const box = document.createElement('div');
      box.append(window.questionHeader(q), q.fig ? window.renderBlock(q.fig) : '', window.questionInput(q, window.freshDraft(q), { showSolution: true, locked: true }), window.solutionPanel(q, 1));
      document.getElementById('view').replaceChildren(box);
      checkOverflow(g.id);
    }
    // Probeklausur einmal durchlaufen
    open('klausur');
    await sleep(1);
    const startBtn = Array.from(document.querySelectorAll('#view .btn.pri')).find((b) => /Minuten starten/.test(b.textContent));
    startBtn.click();
    await sleep(5);
    checkOverflow('Klausur läuft');
    for (let i = 0; i < 7; i++) {
      const nav = document.querySelectorAll('.task-nav button');
      nav[i].click();
      await sleep(1);
      checkOverflow('Klausur A' + (i + 1));
    }
    const sb = Array.from(document.querySelectorAll('#view .btn.pri')).find((b) => b.textContent === 'Abgeben');
    sb.click();
    sb.click();
    await sleep(2);
    checkOverflow('Klausur Bewertung');
    const toResult = Array.from(document.querySelectorAll('#view .btn.pri')).find((b) => /Auswertung/.test(b.textContent));
    if (toResult) { toResult.click(); await sleep(2); checkOverflow('Klausur Auswertung'); } else report.errors.push('Kein Knopf zur Auswertung');
    if (!/Auswertung/.test(document.getElementById('view').textContent)) report.errors.push('Auswertung fehlt');
    localStorage.clear();
  }


  // Spielt die Labore wie ein Mensch fehlerfrei durch und erwartet 100 %.
  const view2 = () => document.getElementById('view');
  const byText = (root, sel, text) => Array.from(root.querySelectorAll(sel)).find((x) => x.textContent.trim() === text);
  async function runLab(name, params, drive) {
    const host = h('div');
    view2().replaceChildren(host);
    let score = null;
    window.DBLabs[name](host, params, { done: (s) => { score = s; } });
    await sleep(1);
    try {
      await drive(host);
    } catch (e) {
      report.errors.push('Labor ' + name + ': ' + e.message);
    }
    await sleep(1);
    checkOverflow('Labor ' + name);
    report.labRuns = (report.labRuns || []).concat(name + '=' + score);
    if (score !== 1) report.errors.push('Labor ' + name + ' meldet ' + score + ' statt 1');
    return host;
  }
  const clickText = (root, text) => {
    const b = byText(root, 'button', text);
    if (!b) throw new Error('Knopf fehlt: ' + text);
    b.click();
  };
  async function driveErBuilder(host, er) {
    for (const e of er.ents) {
      clickText(host, e.n);
      await sleep(0);
    }
    clickText(host, 'Prüfen');
    clickText(host, 'Weiter: Schlüssel festlegen');
    for (const e of er.ents) {
      const raw = e.attrs.map((a) => (typeof a === 'string' ? a : a.n));
      const key = raw.find((a) => a.startsWith('*') || a.startsWith('~')).replace(/^[*~]/, '');
      const box = Array.from(host.querySelectorAll('.stack-s')).find((x) => x.firstChild && x.firstChild.tagName === 'B' && x.firstChild.textContent === e.n);
      clickText(box, key);
    }
    clickText(host, 'Prüfen');
    clickText(host, 'Weiter: Beziehungen');
    er.rels.forEach((r, i) => {
      for (const side of [0, 1]) {
        const row = Array.from(host.querySelectorAll('.stack > .stack-s'))[i];
        const chips = row.querySelectorAll('.chips')[side];
        const want = (side === 0 ? r.ca : r.cb) === '1' ? '1' : 'viele';
        clickText(chips, want);
      }
    });
    clickText(host, 'Prüfen');
    clickText(host, 'Diagramm zeichnen');
  }
  async function driveEr2rm(host, er) {
    const { ERM } = DBEngine;
    for (const r of er.rels) {
      const many = r.ca !== '1' && r.cb !== '1';
      const opts = host.querySelectorAll('.opt');
      const pick = many ? 2 : r.ca === '1' && r.cb !== '1' ? 1 : 0;
      opts[pick].click();
      const next = Array.from(host.querySelectorAll('.btn.pri.full')).pop();
      next.click();
    }
    const lines = Array.from(host.querySelectorAll('.schema')).map((x) => x.textContent);
    const want = ERM.toSchema(er).map((s) => s.line.replace(/<\/?u>/g, ''));
    if (lines.join('|') !== want.join('|')) report.errors.push('Schema im Labor weicht ab: ' + lines.join(' / '));
  }
  async function driveDivision(host) {
    const { RA } = DBEngine;
    const R = RA.rel(['Kunde', 'Produkt'], [['Alice', 'Laptop'], ['Alice', 'Smartphone'], ['Bob', 'Laptop'], ['Bob', 'Tablet'], ['Carol', 'Laptop'], ['Carol', 'Smartphone'], ['Carol', 'Tablet']]);
    const d = RA.divide(R, RA.rel(['Produkt'], [['Laptop'], ['Smartphone']]));
    const number = async (n) => {
      const input = host.querySelector('input[type=text]');
      input.value = String(n);
      clickText(host, 'Prüfen');
      await sleep(0);
      clickText(host, 'Weiter');
      await sleep(0);
    };
    await number(d.A.rows.length);
    await number(d.product.rows.length);
    for (const res of [d.missing, d.bad, d.result]) {
      for (const row of res.rows) {
        const tr = Array.from(host.querySelectorAll('tr.pick')).find((t) => Array.from(t.children).map((c) => c.textContent).join('|') === row.join('|'));
        if (!tr) throw new Error('Zeile fehlt: ' + row);
        tr.click();
      }
      clickText(host, 'Prüfen');
      Array.from(host.querySelectorAll('.btn.pri.full')).pop().click();
      await sleep(0);
    }
  }
  async function driveCanon(host, R, Ftext) {
    const { FD } = DBEngine;
    const can = FD.canonical(FD.parse(Ftext));
    for (const e of can.left.log.concat(can.right.log)) {
      clickText(host, e.removed ? 'Überflüssig' : 'Bleibt');
      clickText(host, 'Nächster Test');
    }
    if (!host.textContent.includes(FD.setStr(can.Fc))) report.errors.push('Labor canon zeigt F_c nicht: ' + FD.setStr(can.Fc));
  }
  async function runLabs() {
    const mods = window.DB_CONTENT.modules;
    const q = (id) => mods.flatMap((m) => m.questions).find((x) => x.id === id);
    await runLab('erbuilder', q('m08q3').params, (h0) => driveErBuilder(h0, q('m08q3').params.er));
    await runLab('erbuilder', q('m08q7').params, (h0) => driveErBuilder(h0, q('m08q7').params.er));
    await runLab('erbuilder', q('m08q9').params, (h0) => driveErBuilder(h0, q('m08q9').params.er));
    await runLab('er2rm', q('m10q13').params, (h0) => driveEr2rm(h0, q('m10q13').params.er));
    await runLab('er2rm', q('m10q14').params, (h0) => driveEr2rm(h0, q('m10q14').params.er));
    await runLab('division', { mode: 'practice', data: 'kunden' }, driveDivision);
    await runLab('canon', q('m16q11').params, (h0) => driveCanon(h0, q('m16q11').params.R, q('m16q11').params.F));
    await runLab('canon', q('m16q12').params, (h0) => driveCanon(h0, q('m16q12').params.R, q('m16q12').params.F));
    await runLab('canon', q('m16q14').params, (h0) => driveCanon(h0, q('m16q14').params.R, q('m16q14').params.F));
    await runLab('nf', { case: 'leh' }, async (h0) => { clickText(h0, 'Ja'); clickText(h0, 'Ja'); clickText(h0, 'Nein'); if (!h0.textContent.includes('3NF')) throw new Error('3NF fehlt'); });
    await runLab('nf', { case: 'voll' }, async (h0) => { clickText(h0, 'Ja'); clickText(h0, 'Nein'); clickText(h0, 'Nein'); });
    await runLab('nf', { case: 'best' }, async (h0) => { clickText(h0, 'Nein'); clickText(h0, 'Nein'); clickText(h0, 'Nein'); });
    // Spielwiese: alle Beispielanfragen und die erwarteten Ergebnisse
    const host = h('div');
    view2().replaceChildren(host);
    window.DBLabs.raplay(host, {}, {});
    const sel = host.querySelectorAll('select')[0];
    const want = { 0: 3, 1: 11, 2: 2, 3: 13, 4: 2 };
    for (let i = 1; i < sel.options.length; i++) {
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('change'));
      await sleep(0);
      const label = Array.from(host.querySelectorAll('.tb-title')).map((x) => x.textContent).find((x) => /Zeilen$/.test(x));
      report.play = (report.play || []).concat(sel.options[i].textContent.slice(0, 40) + ': ' + label);
      if (label !== want[i - 1] + ' Zeilen') report.errors.push('Spielwiese ' + sel.options[i].textContent + ': ' + label + ' statt ' + want[i - 1]);
    }
    report.routes = 1;
    localStorage.clear();
  }

  async function shotState(name) {
    const mods = window.DB_CONTENT.modules;
    const q = (id) => mods.flatMap((m) => m.questions).find((x) => x.id === id);
    const host = h('div', { class: 'stack' });
    view2().replaceChildren(host);
    const pick = (root, sel, text) => { const b = byText(root, sel, text); if (b) b.click(); };
    if (name === 'erb3') {
      const p = q('m08q7').params;
      window.DBLabs.erbuilder(host, p, {});
      for (const e of p.er.ents) { pick(host, 'button', e.n); await sleep(0); }
      pick(host, 'button', 'Prüfen');
      pick(host, 'button', 'Weiter: Schlüssel festlegen');
      for (const e of p.er.ents) {
        const box = Array.from(host.querySelectorAll('.stack-s')).find((x) => x.firstChild && x.firstChild.tagName === 'B' && x.firstChild.textContent === e.n);
        pick(box, 'button', e.attrs[0].replace('*', ''));
      }
      pick(host, 'button', 'Prüfen');
      pick(host, 'button', 'Weiter: Beziehungen');
    } else if (name === 'div') {
      window.DBLabs.division(host, { mode: 'practice', data: 'kunden' }, {});
      for (const n of [3, 6]) {
        host.querySelector('input[type=text]').value = String(n);
        pick(host, 'button', 'Prüfen');
        await sleep(0);
        pick(host, 'button', 'Weiter');
        await sleep(0);
      }
      Array.from(host.querySelectorAll('tr.pick'))[3].click();
    } else if (name === 'canon') {
      window.DBLabs.canon(host, q('m16q12').params, {});
      pick(host, 'button', 'Überflüssig');
    } else if (name === 'decomp') {
      window.DBLabs.decomp(host, { case: 'sport' }, {});
    } else if (name === 'tree') {
      window.DBLabs.optree(host, {}, {});
      pick(host, 'button', 'Optimierter Plan');
    } else if (name === 'cap') {
      window.DBLabs.cap(host, {}, {});
      pick(host, 'button', 'Kabel kappen');
      pick(host, 'button', 'Option A: trotzdem antworten');
    } else if (name === 'exam') {
      open('klausur');
      await sleep(1);
      Array.from(document.querySelectorAll('#view .btn.pri')).find((b) => /Minuten starten/.test(b.textContent)).click();
      await sleep(5);
      document.querySelectorAll('.task-nav button')[4].click();
    }
    await sleep(1);
    window.scrollTo(0, 0);
  }

  function finish() {
    const text = JSON.stringify(report);
    const pre = document.createElement('pre');
    pre.id = 'selftest-report';
    pre.textContent = text;
    document.body.append(pre);
    if (window.parent !== window) window.parent.postMessage({ selftest: text }, '*');
  }

  function gallery(kind) {
    const list = [];
    const walk = (n) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === 'object') {
        if (kind === 'er' && n.t === 'er') list.push({ t: 'er', er: n.er, title: n.title || n.er.title });
        if (kind === 'er' && n.viz && n.params && n.params.er) list.push({ t: 'er', er: n.params.er, title: 'Labor: ' + (n.params.title || '') });
        Object.values(n).forEach(walk);
      }
    };
    walk(window.DB_CONTENT.modules);
    walk(window.DB_CONTENT.exams);
    if (kind === 'slides') {
      const from = +(params.get('from') || 0);
      const names = Object.keys(window.DB_SLIDES).slice(from, from + 36);
      document.getElementById('view').replaceChildren(h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px' }, names.map((n) => h('figure', { style: 'margin:0' }, h('img', { src: window.DB_SLIDES[n], style: 'width:100%;display:block;border:1px solid #888' }), h('figcaption', { style: 'font-size:10px' }, n)))));
      document.getElementById('view').style.maxWidth = 'none';
      return;
    }
    const start = +(params.get('from') || 0);
    document.getElementById('view').replaceChildren(...list.slice(start, start + (+params.get('n') || 8)).map((b) => window.renderBlock(b)));
    document.getElementById('view').style.maxWidth = (params.get('w') || '760') + 'px';
  }

  window.addEventListener('load', async () => {
    try {
      if (mode === 'run') await runAll();
      else if (mode === 'labs') await runLabs();
      else if (mode === 'shot') await shotState(params.get('name'));
      else if (mode === 'gallery') gallery(params.get('kind'));
    } catch (e) {
      report.errors.push('Abbruch: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
    }
    finish();
  });
})();
