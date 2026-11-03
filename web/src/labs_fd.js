// Labore zu funktionalen Abhängigkeiten: Hülle, Schlüssel, kanonische Überdeckung, Synthese, Normalformen, Zerlegung.
(function () {
  'use strict';
  const { FD, RA } = DBEngine;
  const Labs = window.DBLabs;

  // Vorlagen aus Skript und Übungsblättern. Die FD-Menge der Originalklausur ist bewusst nicht dabei.
  const PRESETS = {
    bsp: { label: 'Beispiel R(A,B,C,D,E)', R: 'A,B,C,D,E', F: 'A -> BC; B -> D; AB -> E; E -> A; C -> D' },
    u63: { label: 'Blatt 6.3', R: 'A,B,C,D,E,F', F: 'A -> BC; C -> DA; E -> ABC; F -> CD; CD -> BEF' },
    wein: { label: 'Weingüter (Skript)', R: 'Name,Weingut,Preis,Farbe,Anbaugebiet,Region', F: 'Name, Weingut -> Preis; Name, Weingut -> Weingut; Name, Weingut -> Name; Name -> Farbe; Weingut -> Anbaugebiet, Region; Anbaugebiet -> Region' },
    prof: { label: 'ProfessorenAdr (Skript)', R: 'PersNr,Name,Rang,Raum,Ort,Straße,PLZ,Vorwahl,BLand,EW,Landesregierung', F: 'PersNr -> PersNr, Name, Rang, Raum, PLZ, Ort, Straße, Vorwahl, BLand, EW, Landesregierung; Ort, BLand -> EW, Vorwahl; PLZ -> BLand, Ort, EW; Ort, BLand, Straße -> PLZ; BLand -> Landesregierung; Raum -> PersNr' },
    assi: { label: 'AssiBossDiplomanden (Blatt 6.4)', R: 'PersNr,Name,Fachgebiet,BossPersNr,BossName,MatrNr,SName,Semester,SWohnOrt', F: 'PersNr -> Name, Fachgebiet, BossPersNr; BossPersNr -> BossName; MatrNr -> SName, Semester, SWohnOrt, PersNr' },
    links: { label: 'Linksreduktion üben', R: 'A,B,C,D', F: 'AB -> C; A -> B; C -> D' },
    rechts: { label: 'Rechtsreduktion üben', R: 'A,B,C,D', F: 'A -> BC; B -> C; C -> D; A -> D' }
  };
  const parseR = (s) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

  // Eingabefeld mit Vorlagen, gemeinsam für alle FD-Labore.
  function fdInput(params, onChange) {
    if (params.mode === 'practice' && params.R) {
      const R = parseR(params.R);
      const F = FD.parse(params.F);
      return { el: h('div', { class: 'formula', html: md('R(' + R.join(', ') + ')\nF = ' + FD.setStr(F)) }), read: () => onChange(R, F) };
    }
    const ids = params.presets || ['bsp', 'u63', 'wein'];
    const custom = params.R ? { R: params.R, F: params.F } : null;
    const first = custom || PRESETS[ids[0]];
    const rInput = h('input', { type: 'text', 'aria-label': 'Attribute von R', value: first.R, id: 'fd-r-' + Math.random().toString(36).slice(2, 7) });
    const fInput = h('textarea', { 'aria-label': 'Funktionale Abhängigkeiten', id: 'fd-f-' + Math.random().toString(36).slice(2, 7), style: 'min-height:62px;font-family:var(--mono);font-size:.86rem' }, first.F);
    const err = h('div');
    const read = () => {
      try {
        const F = FD.parse(fInput.value);
        const R = parseR(rInput.value);
        const missing = F.flatMap((f) => f.l.concat(f.r)).filter((a) => !R.includes(a));
        if (missing.length) throw new Error('Diese Attribute fehlen in R: ' + Array.from(new Set(missing)).join(', '));
        err.replaceChildren();
        onChange(R, F);
      } catch (e) {
        err.replaceChildren(caption(e.message, 'bad'));
      }
    };
    rInput.addEventListener('change', read);
    fInput.addEventListener('change', read);
    const select = h('select', { 'aria-label': 'Vorlage wählen', id: 'fd-p-' + Math.random().toString(36).slice(2, 7), onchange: (e) => { const p = PRESETS[e.target.value]; rInput.value = p.R; fInput.value = p.F; read(); } },
      ids.map((id) => h('option', { value: id }, PRESETS[id].label)));
    const el = h('div', { class: 'stack-s' },
      custom ? null : h('div', null, h('div', { class: 'tb-title' }, 'Vorlage'), select),
      h('div', null, h('div', { class: 'tb-title' }, 'Relation R, Attribute mit Komma'), rInput),
      h('div', null, h('div', { class: 'tb-title' }, 'FDs, getrennt durch Semikolon, zum Beispiel AB -> C'), fInput),
      err);
    return { el, read };
  }
  const attrChips = (R, inSet, fresh) => h('div', { class: 'attrs' }, R.map((a) => h('span', { class: 'attr' + (fresh && fresh.includes(a) ? ' new' : inSet.includes(a) ? ' in' : '') }, a)));
  const set = (list, R) => '{' + (R ? FD.sortBy(list, R) : list).join(', ') + '}';

  // ---------------------------------------------------------------------------
  Labs.closure = function (host, params) {
    const out = h('div', { class: 'stack' });
    const pickRow = h('div', { class: 'chips' });
    let R = [];
    let F = [];
    let start = [];
    const run = () => {
      pickRow.replaceChildren(...R.map((a) => h('button', { type: 'button', class: 'chip' + (start.includes(a) ? ' on' : ''), 'aria-pressed': start.includes(a) ? 'true' : 'false', onclick: () => { start = start.includes(a) ? start.filter((x) => x !== a) : start.concat(a); run(); } }, a)));
      out.replaceChildren();
      if (!start.length) {
        out.append(caption('Wähle oben mindestens ein Startattribut.', 'warn'));
        return;
      }
      const res = FD.hull(start, F);
      const lines = h('div', { class: 'stack-s' });
      const stateBox = h('div');
      const steps = res.steps;
      const controls = stepControls(steps.length, (i) => {
        const cur = i === 0 ? null : steps[i - 1];
        const erg = cur ? cur.erg : start;
        lines.replaceChildren(...F.map((f) => {
          const active = cur && cur.fd === f;
          const cls = active ? (cur.added.length ? 'fire' : cur.fires ? 'test' : 'skip') : '';
          const tag = active ? (cur.added.length ? 'feuert: +' + cur.added.join(', ') : cur.fires ? 'nichts Neues' : 'linke Seite fehlt') : '';
          return h('div', { class: 'fd-line ' + cls }, FD.str(f), active ? h('span', { class: 'tag' }, tag) : null);
        }));
        const finished = i === steps.length;
        const isSuper = FD.isSuper(start, R, F);
        stateBox.replaceChildren(
          h('div', { class: 'stack-s' },
            h('div', { class: 'tb-title' }, (cur ? 'Durchlauf ' + cur.round + ': ' : 'Start: ') + 'Erg = ' + set(erg, R)),
            attrChips(R, erg, cur ? cur.added : null),
            finished ? caption('**' + FD.hullName(FD.sortBy(start, R)) + ' = ' + set(res.result, R) + '** Der letzte Durchlauf hat nichts mehr geändert. ' + (isSuper ? 'Die Hülle enthält alle Attribute, also ist ' + FD.attrs(FD.sortBy(start, R)) + ' **Superschlüssel**. ' + (FD.isKey(start, R, F) ? 'Da kein Attribut wegfallen kann, ist es auch **Kandidatenschlüssel**.' : 'Es ist aber **nicht minimal**, also kein Kandidatenschlüssel.') : 'Es fehlen ' + FD.sortBy(R.filter((a) => !res.result.includes(a)), R).join(', ') + ', also ist ' + FD.attrs(FD.sortBy(start, R)) + ' **kein Superschlüssel**.'), isSuper ? 'ok' : 'warn') : null));
      }, { interval: 1300 });
      out.append(stateBox, lines, controls.el);
    };
    const input = fdInput(params, (r, f) => { R = r; F = f; start = params.start && r.includes(params.start[0]) ? params.start.slice() : [r[0]]; run(); });
    host.append(vizCard('Labor: Attributhülle Schritt für Schritt', input.el, h('div', null, h('div', { class: 'tb-title' }, 'Startattribute α'), pickRow), out));
    input.read();
  };

  // ---------------------------------------------------------------------------
  Labs.keys = function (host, params) {
    const out = h('div', { class: 'stack-s' });
    const input = fdInput(params, (R, F) => {
      const c = FD.classify(R, F);
      const keys = FD.keys(R, F);
      const must = c.onlyLeft.concat(c.none);
      const rows = [
        ['Nur links oder gar nicht', must.join(', ') || '–', 'in **jedem** Schlüssel'],
        ['Nur rechts', c.onlyRight.join(', ') || '–', 'in **keinem** Schlüssel'],
        ['Links und rechts', c.both.join(', ') || '–', 'muss man testen']
      ];
      const tested = [];
      const optional = c.both;
      const base = must.length ? [must] : [];
      const sets = base.concat(FD.subsets(optional).map((s) => must.concat(s)));
      for (const X of sets.slice(0, 12)) {
        const hull = FD.closure(X, F);
        const sup = R.every((a) => hull.includes(a));
        const isK = keys.some((k) => k.length === X.length && k.every((a) => X.includes(a)));
        tested.push([FD.attrs(FD.sortBy(X, R)), set(hull, R), isK ? 'Kandidatenschlüssel' : sup ? 'nur Superschlüssel' : 'reicht nicht']);
      }
      out.replaceChildren(
        relTable({ title: 'Schritt 1: Attribute einordnen', head: ['Vorkommen', 'Attribute', 'Folge'], rows }, { data: false }),
        relTable({ title: 'Schritt 2: Hüllen testen, kleinste Mengen zuerst', head: ['α', 'α⁺', 'Ergebnis'], rows: tested },
          { rowClass: (r) => (tested[r][2] === 'Kandidatenschlüssel' ? 'ok' : tested[r][2] === 'nur Superschlüssel' ? 'warn' : null) }),
        caption('**Kandidatenschlüssel: ' + keys.map(FD.attrs).join(' | ') + '**  Schlüsselattribute: ' + R.filter((a) => keys.some((k) => k.includes(a))).join(', '), 'ok'));
    });
    host.append(vizCard('Labor: Alle Kandidatenschlüssel finden', input.el, out));
    input.read();
  };

  // ---------------------------------------------------------------------------
  // Kanonische Überdeckung: im Üben-Modus entscheidest du pro Attribut selbst.
  Labs.canon = function (host, params, api) {
    const area = h('div', { class: 'stack' });
    let practice = params.mode === 'practice';
    let R = [];
    let F0 = [];
    const showF = (F, mark) => h('div', { class: 'stack-s' }, F.map((f, i) => h('div', { class: 'fd-line' + (mark && mark.index === i ? ' test' : '') + (!f.r.length ? ' gone' : '') }, f.r.length ? FD.str(f) : FD.attrs(f.l) + ' → ∅')));

    const buildTimeline = () => {
      const can = FD.canonical(F0);
      const items = [];
      let cur = FD.clone(F0);
      for (const e of can.left.log) {
        const hullText = FD.hullName(e.rest) + ' = ' + set(e.hull, R);
        items.push({ phase: '1. Linksreduktion', F: FD.clone(cur), mark: { index: e.index }, q: 'Ist **' + e.x + '** in **' + FD.str(e.fd) + '** überflüssig?', removed: e.removed, why: hullText + (e.removed ? ' enthält ' + FD.attrs(e.fd.r) + ', also ist ' + e.x + ' überflüssig.' : ' enthält ' + FD.attrs(e.fd.r) + ' nicht, also bleibt ' + e.x + '.'), apply: (G) => { if (e.removed) G[e.index].l = e.rest; } });
        if (e.removed) cur[e.index].l = e.rest;
      }
      for (const e of can.right.log) {
        const hullText = 'Ohne ' + e.x + ': ' + FD.hullName(e.fd.l) + ' = ' + set(e.hull, R);
        items.push({ phase: '2. Rechtsreduktion', F: FD.clone(cur), mark: { index: e.index }, q: 'Ist **' + e.x + '** in **' + FD.str(e.fd) + '** überflüssig?', removed: e.removed, why: hullText + (e.removed ? ' enthält ' + e.x + ' weiterhin, also ist es überflüssig.' : ' enthält ' + e.x + ' nicht, also bleibt es.') });
        if (e.removed) cur[e.index].r = cur[e.index].r.filter((a) => a !== e.x);
      }
      const dropped = cur.filter((f) => !f.r.length);
      items.push({ phase: '3. Leere rechte Seiten streichen', F: FD.clone(cur), info: dropped.length ? 'Gestrichen: ' + dropped.map((f) => FD.attrs(f.l) + ' → ∅').join(', ') : 'Keine FD hat eine leere rechte Seite.' });
      items.push({ phase: '4. Gleiche linke Seiten vereinigen', F: can.Fc, info: 'Ergebnis: **F_{c} = ' + FD.setStr(can.Fc) + '**', final: true });
      return { items, can };
    };

    const drawExplain = () => {
      const { items } = buildTimeline();
      const stage = h('div', { class: 'stack-s' });
      const controls = stepControls(items.length, (i) => {
        if (i === 0) {
          stage.replaceChildren(h('div', { class: 'tb-title' }, 'Start: gegebene FDs'), showF(F0), caption('Die Reduktionen laufen in dieser Reihenfolge: links, rechts, leere weg, vereinigen.'));
          return;
        }
        const it = items[i - 1];
        stage.replaceChildren(
          h('div', { class: 'row' }, h('span', { class: 'pill exam' }, it.phase)),
          showF(it.F, it.mark),
          caption(it.q ? it.q + ' ' + it.why : it.info, it.final ? 'ok' : it.removed ? 'warn' : undefined));
      }, { interval: 2600 });
      area.replaceChildren(stage, controls.el);
    };

    const drawPractice = () => {
      const { items } = buildTimeline();
      const questions = items.filter((x) => x.q);
      let i = 0;
      let hits = 0;
      const stage = h('div', { class: 'stack' });
      const next = () => {
        if (i >= questions.length) {
          const fin = items[items.length - 1];
          stage.replaceChildren(
            h('div', { class: 'tb-title' }, 'Fertig: ' + hits + ' von ' + questions.length + ' Entscheidungen richtig'),
            showF(fin.F),
            caption(fin.info, 'ok'));
          if (api && api.done) api.done(questions.length ? hits / questions.length : 1);
          return;
        }
        const it = questions[i];
        const fb = h('div');
        const buttons = h('div', { class: 'btns' });
        const answer = (val) => {
          const right = val === it.removed;
          if (right) hits++;
          buttons.replaceChildren(h('button', { type: 'button', class: 'btn pri', onclick: () => { i++; next(); } }, 'Nächster Test'));
          fb.replaceChildren(caption((right ? '**Richtig.** ' : '**Nicht ganz.** ') + it.why, right ? 'ok' : 'bad'));
        };
        buttons.append(h('button', { type: 'button', class: 'btn line', style: 'flex:1', onclick: () => answer(true) }, 'Überflüssig'), h('button', { type: 'button', class: 'btn line', style: 'flex:1', onclick: () => answer(false) }, 'Bleibt'));
        stage.replaceChildren(
          h('div', { class: 'row' }, h('span', { class: 'pill exam' }, it.phase), h('span', { class: 'small muted num' }, 'Test ' + (i + 1) + ' von ' + questions.length)),
          showF(it.F, it.mark),
          h('div', { class: 'q-text', html: md(it.q) }),
          buttons, fb);
      };
      next();
      area.replaceChildren(stage);
    };

    const draw = () => (practice ? drawPractice() : drawExplain());
    const input = fdInput(params, (r, f) => { R = r; F0 = f; draw(); });
    const parts = [input.el];
    if (!api || !api.done) {
      parts.push(segmented([{ id: 'x', label: 'Ansehen' }, { id: 'p', label: 'Selbst entscheiden' }], practice ? 'p' : 'x', (id) => { practice = id === 'p'; draw(); }));
    }
    host.append(vizCard('Labor: Kanonische Überdeckung', parts, area));
    input.read();
  };

  // ---------------------------------------------------------------------------
  Labs.synth = function (host, params) {
    const area = h('div', { class: 'stack' });
    const input = fdInput(params, (R, F) => {
      const s = FD.synthesis(R, F);
      const hasKeyText = s.keyAdded ? 'Kein Schema enthält einen Schlüssel. Neues Schema aus dem Schlüssel: (' + FD.attrs(s.keyAdded.attrs) + ').' : 'Schlüssel: ' + s.keys.map(FD.attrs).join(' | ') + '. Mindestens ein Schema enthält einen davon, also ist kein neues Schema nötig.';
      const schemaLine = (attrs, key) => FD.sortBy(attrs, R).map((a) => (key && key.includes(a) ? '<u>' + a + '</u>' : a)).join(', ');
      const stages = [
        { t: '1. Kanonische Überdeckung bestimmen', body: () => h('div', { class: 'stack-s' }, s.Fc.map((f) => h('div', { class: 'fd-line' }, FD.str(f)))) },
        { t: '2. Pro FD ein Schema α ∪ β', body: () => h('div', { class: 'stack-s' }, s.created.slice(0, s.Fc.length).map((a, i) => h('div', { class: 'schema', html: md('R' + (i + 1) + '(' + schemaLine(a, s.Fc[i].l) + ')') }))) },
        { t: '3. Enthält ein Schema einen Kandidatenschlüssel?', body: () => caption(hasKeyText, s.keyAdded ? 'warn' : 'ok') },
        { t: '4. Enthaltene Schemata löschen', body: () => s.removed.length ? h('div', { class: 'stack-s' }, s.removed.map((x) => caption('(' + FD.attrs(x.schema.attrs) + ') steckt komplett in (' + FD.attrs(x.into.attrs) + ') und fällt weg. Die FDs wandern dorthin.'))) : caption('Kein Schema ist in einem anderen enthalten.') },
        { t: 'Ergebnis: verlustlos, abhängigkeitstreu, 3NF', body: () => h('div', { class: 'stack-s' }, s.schemas.map((x, i) => h('div', { class: 'schema', html: md('R' + (i + 1) + '(' + schemaLine(x.attrs, x.key) + ')') }))) }
      ];
      const stage = h('div', { class: 'stack-s' });
      const controls = stepControls(stages.length - 1, (i) => {
        stage.replaceChildren(h('h3', null, stages[i].t), stages[i].body());
      }, { interval: 2800 });
      area.replaceChildren(stage, controls.el);
    });
    host.append(vizCard('Labor: Synthesealgorithmus', input.el, area));
    input.read();
  };

  // ---------------------------------------------------------------------------
  // Normalform prüfen: erst selbst entscheiden, dann die Begründung sehen.
  const NF_CASES = {
    best: { label: 'Bestellpositionen (Blatt 6.6b)', R: 'BestellNr,ArtikelNr,Artikelname,Menge', F: 'BestellNr, ArtikelNr -> Menge; ArtikelNr -> Artikelname' },
    mit: { label: 'Mitarbeiter (Blatt 6.6c)', R: 'MitarbNr,Name,AbtNr,AbtName', F: 'MitarbNr -> Name, AbtNr; AbtNr -> AbtName' },
    leh: { label: 'Lehrkräfte (Blatt 6.6d)', R: 'Schüler,Fach,Lehrkraft', F: 'Schüler, Fach -> Lehrkraft; Lehrkraft -> Fach' },
    lie: { label: 'Lieferung (Skript)', R: 'ReNr,ArtNr,LagerOrt,Anzahl', F: 'ReNr, ArtNr -> Anzahl; ReNr, LagerOrt -> Anzahl; ArtNr -> LagerOrt; LagerOrt -> ArtNr' },
    abc: { label: 'R(A,B,C) mit C → B (Blatt 6.5c)', R: 'A,B,C', F: 'AB -> C; C -> B' },
    voll: { label: 'Autoverleih (Blatt 6.2)', R: 'id,from,to,price,carNo,car,color,custNo,customer,customerTel', F: 'id -> from, to, price, carNo, custNo; carNo -> car, color; custNo -> customer, customerTel' }
  };
  Labs.nf = function (host, params, api) {
    const area = h('div', { class: 'stack' });
    const select = h('select', { 'aria-label': 'Beispiel wählen', id: 'nf-sel-' + Math.random().toString(36).slice(2, 7), onchange: (e) => load(NF_CASES[e.target.value]) }, Object.entries(NF_CASES).map(([id, c]) => h('option', { value: id }, c.label)));
    const load = (c) => {
      const R = parseR(c.R);
      const F = FD.parse(c.F);
      const nf = FD.normalForm(R, F);
      const checks = [
        { name: '2NF', ok: !nf.partial.length, q: 'Hängt jedes Nichtschlüsselattribut voll von jedem Kandidatenschlüssel ab?', yes: 'Kein Nichtschlüsselattribut hängt nur von einem Teil eines Schlüssels ab.', no: nf.partial[0] ? nf.partial[0].attr + ' hängt schon von ' + FD.attrs(nf.partial[0].part) + ' ab, einem echten Teil von ' + FD.attrs(nf.partial[0].key) + '.' : '' },
        { name: '3NF', ok: !nf.nf3viol.length, q: 'Hat jede FD X → A links einen Superschlüssel oder rechts ein Schlüsselattribut?', yes: 'Keine FD verletzt das.', no: nf.nf3viol[0] ? FD.str(nf.nf3viol[0]) + ': ' + FD.attrs(nf.nf3viol[0].l) + ' ist kein Superschlüssel und ' + nf.nf3viol[0].r[0] + ' ist kein Schlüsselattribut.' : '' },
        { name: 'BCNF', ok: !nf.bcnfviol.length, q: 'Ist jede linke Seite ein Superschlüssel?', yes: 'Alle Determinanten sind Superschlüssel.', no: nf.bcnfviol[0] ? FD.str(nf.bcnfviol[0]) + ': ' + FD.attrs(nf.bcnfviol[0].l) + ' ist kein Superschlüssel.' : '' }
      ];
      const decomposition = () => {
        const d = FD.bcnfDecompose(R, F);
        const pres = FD.preserved(d.schemas, F);
        const lost = pres.filter((p) => !p.ok);
        return h('div', { class: 'stack-s' },
          h('div', { class: 'tb-title' }, 'BCNF-Zerlegung'),
          d.schemas.map((s) => h('div', { class: 'schema' }, '(' + s.join(', ') + ')')),
          lost.length ? caption('Verlustlos, aber **nicht abhängigkeitstreu**: ' + lost.map((p) => FD.str(p.fd)).join(', ') + ' lässt sich nicht mehr lokal prüfen.', 'warn') : caption('Verlustlos und abhängigkeitstreu.', 'ok'));
      };
      let i = 0;
      let hits = 0;
      const answers = h('div', { class: 'stack-s' });
      const q = h('div', { class: 'stack-s' });
      const ask = () => {
        if (i >= checks.length) {
          q.replaceChildren(caption('**Höchste erfüllte Normalform: ' + nf.nf + '**', 'ok'), nf.nf !== 'BCNF' ? decomposition() : null);
          if (api && api.done) api.done(hits / checks.length);
          return;
        }
        const c2 = checks[i];
        const reply = (val) => {
          const right = val === c2.ok;
          if (right) hits++;
          answers.append(caption('**' + c2.name + ' ' + (c2.ok ? 'erfüllt' : 'verletzt') + '.** ' + (c2.ok ? c2.yes : c2.no), right ? 'ok' : 'bad'));
          i++;
          ask();
        };
        q.replaceChildren(h('div', { class: 'q-text' }, c2.name + ': ' + c2.q), h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn line', style: 'flex:1', onclick: () => reply(true) }, 'Ja'), h('button', { type: 'button', class: 'btn line', style: 'flex:1', onclick: () => reply(false) }, 'Nein')));
      };
      ask();
      area.replaceChildren(
        h('div', { class: 'stack-s' }, h('div', { class: 'schema' }, 'R(' + R.join(', ') + ')'), F.map((f) => h('div', { class: 'fd-line' }, FD.str(f)))),
        caption('Kandidatenschlüssel: **' + nf.keys.map(FD.attrs).join(' | ') + '**\nSchlüsselattribute: ' + (nf.prime.join(', ') || 'keine') + '\nNichtschlüsselattribute: ' + (nf.nonprime.join(', ') || 'keine')),
        answers, q);
    };
    host.append(vizCard('Labor: Normalform prüfen', params.case ? null : h('div', null, h('div', { class: 'tb-title' }, 'Beispiel'), select), area));
    load(params.case ? NF_CASES[params.case] || params.case : NF_CASES.best);
  };

  // ---------------------------------------------------------------------------
  // Zerlegung: Verbund aus den Teilen bilden und falsche Tupel sichtbar machen.
  const DEC = {
    note: { label: 'Student, Note, Dozent (Skript)', attrs: ['Student', 'Note', 'Dozent'], rows: [['Anna', '1', 'Dr. Hesse'], ['Bernd', '1', 'Dr. Jacobi']], F: 'Student -> Note; Dozent -> Note', r1: ['Student', 'Note'], r2: ['Note', 'Dozent'] },
    eltern: { label: 'Vater, Mutter, Kind (Skript)', attrs: ['Vater', 'Mutter', 'Kind'], rows: [['Johann', 'Martha', 'Else'], ['Johann', 'Maria', 'Theo'], ['Heinz', 'Martha', 'Cleo']], F: 'Kind -> Vater, Mutter', r1: ['Vater', 'Kind'], r2: ['Mutter', 'Kind'] },
    kurs: { label: 'Kurse (Skript)', attrs: ['MatrNr', 'Kursname', 'Dozent'], rows: [['1001', 'Mathe', 'Müller'], ['1002', 'Mathe', 'Müller'], ['1001', 'Physik', 'Schmidt'], ['1003', 'Physik', 'Schmidt'], ['1004', 'Informatik', 'Neuer'], ['1001', 'Informatik', 'Neuer']], F: 'MatrNr, Kursname -> Dozent; Kursname -> Dozent', r1: ['MatrNr', 'Kursname'], r2: ['Kursname', 'Dozent'] },
    sport: { label: 'Sportkurse (klausurnah)', attrs: ['Teilnehmer', 'Sportart', 'Trainer'], rows: [['T1', 'Yoga', 'Kim'], ['T2', 'Yoga', 'Lou'], ['T2', 'Tennis', 'Max'], ['T3', 'Tennis', 'Max'], ['T3', 'Schwimmen', 'Nia'], ['T1', 'Schwimmen', 'Nia']], F: 'Teilnehmer, Sportart -> Trainer; Trainer -> Sportart', r1: ['Teilnehmer', 'Sportart'], r2: ['Sportart', 'Trainer'] }
  };
  Labs.decomp = function (host, params) {
    const area = h('div', { class: 'stack' });
    const pickers = h('div', { class: 'stack-s' });
    let c;
    let r1;
    let r2;
    const draw = () => {
      pickers.replaceChildren(
        pickRow('R₁', r1, (next) => { r1 = next; draw(); }),
        pickRow('R₂', r2, (next) => { r2 = next; draw(); }));
      area.replaceChildren();
      const all = c.attrs.every((a) => r1.includes(a) || r2.includes(a));
      if (!r1.length || !r2.length || !all) {
        area.append(caption('Zusammen müssen R₁ und R₂ alle Attribute abdecken.', 'warn'));
        return;
      }
      const R = RA.rel(c.attrs, c.rows);
      const P1 = RA.project(R, FD.sortBy(r1, c.attrs));
      const P2 = RA.project(R, FD.sortBy(r2, c.attrs));
      const J = RA.natural(P1, P2);
      const JA = RA.project(J, c.attrs);
      const origKeys = new Set(R.rows.map((x) => JSON.stringify(x)));
      const spurious = JA.rows.filter((x) => !origKeys.has(JSON.stringify(x))).length;
      const F = FD.parse(c.F);
      const pres = FD.preserved([r1, r2], F);
      const lost = pres.filter((p) => !p.ok);
      area.append(
        relGroup([RA.table(P1, 'π(R₁): Duplikate fallen weg'), RA.table(P2, 'π(R₂)')]),
        relTable(RA.table(JA, 'R₁ ⋈ R₂'), { rowClass: (i) => (origKeys.has(JSON.stringify(JA.rows[i])) ? null : 'bad') }),
        spurious ? caption('**Nicht verlustlos:** Der Verbund erzeugt ' + spurious + ' Tupel, die es nie gab (rot). Verlustlos ist eine Zerlegung in zwei Teile nur, wenn das gemeinsame Attribut einen der Teile bestimmt.', 'bad') : caption('**Verlustlos:** Der Verbund liefert genau die Ausgangsrelation.', 'ok'),
        lost.length ? caption('**Nicht abhängigkeitstreu:** ' + lost.map((p) => FD.str(p.fd)).join(', ') + ' lässt sich in den Teilen nicht mehr prüfen.', 'warn') : caption('**Abhängigkeitstreu:** Alle FDs bleiben prüfbar.', 'ok'));
    };
    const pickRow = (label, cur, onChange) => h('div', { class: 'row wrap' }, h('b', { class: 'small', style: 'width:26px' }, label),
      h('div', { class: 'chips' }, c.attrs.map((a) => h('button', { type: 'button', class: 'chip' + (cur.includes(a) ? ' on' : ''), 'aria-pressed': cur.includes(a) ? 'true' : 'false', onclick: () => onChange(cur.includes(a) ? cur.filter((x) => x !== a) : cur.concat(a)) }, a))));
    const load = (x) => { c = x; r1 = x.r1.slice(); r2 = x.r2.slice(); draw(); };
    const select = h('select', { 'aria-label': 'Beispiel wählen', id: 'dec-' + Math.random().toString(36).slice(2, 7), onchange: (e) => load(DEC[e.target.value]) }, Object.entries(DEC).map(([id, x]) => h('option', { value: id }, x.label)));
    host.append(vizCard('Labor: Zerlegung prüfen', h('div', null, h('div', { class: 'tb-title' }, 'Ausgangsrelation'), select), pickers, area));
    load(params.case ? DEC[params.case] : DEC.note);
    if (params.case) select.value = params.case;
  };
})();
