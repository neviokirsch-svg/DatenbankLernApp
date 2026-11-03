// Prüft alle Lerninhalte. Aufruf: node tools/validate-content.js
// Sichert unter anderem: Alle Übungsaufgaben sind enthalten, nichts aus der Klausur 2025 ist kopiert,
// jede FD-Aufgabe wird nachgerechnet und alle Schemas passen zu ihren ER-Modellen.
const fs = require('fs');
const path = require('path');
const { FD, RA, ERM, Calc } = require(path.join(__dirname, '..', 'web', 'src', 'engine.js'));

const dir = path.join(__dirname, '..', 'DatenbankenLernApp', 'Resources', 'Content');
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(where + ': ' + msg);

const BLOCKS = new Set(['p', 'h', 'b', 'k', 'w', 'ex', 'f', 's', 'code', 'tb', 'rels', 'sl', 'st', 'er', 'net', 'bars', 'x']);
const KINDS = new Set(['mc', 'ms', 'tf', 'num', 'ord', 'match', 'open', 'lab']);
const labsSource = ['labs_fd.js', 'labs_ra.js', 'labs_er.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'web', 'src', f), 'utf8')).join('\n');
const LABS = new Set((labsSource.match(/Labs\.([a-z0-9]+) = function/g) || []).map((s) => s.match(/Labs\.([a-z0-9]+)/)[1]));
const PAGES = { 1: 15, 2: 46, 3: 35, 4: 25, 5: 32, 6: 17, 7: 14, 8: 3, 9: 4, 10: 1, 11: 1 };

function checkText(where, text) {
  if (typeof text !== 'string') return;
  if ((text.match(/\*\*/g) || []).length % 2) err(where, 'ungerade Anzahl ** in: ' + text.slice(0, 50));
  if ((text.match(/`/g) || []).length % 2) err(where, 'ungerade Anzahl ` in: ' + text.slice(0, 50));
  const stripped = text.replace(/\*\*/g, '');
  if (/\(\d,\s*\*\)/.test(stripped)) err(where, 'Sternchen in (min, max): nimm ∗');
  if (/<(?!\/?u>)[a-zA-Z/]/.test(text)) err(where, 'HTML außer <u> in: ' + text.slice(0, 50));
}

function checkTable(where, t) {
  if (!Array.isArray(t.head) || !Array.isArray(t.rows)) return err(where, 'Tabelle ohne head/rows');
  t.rows.forEach((r, i) => {
    if (r.length !== t.head.length) err(where, 'Zeile ' + i + ' hat ' + r.length + ' statt ' + t.head.length + ' Spalten');
    r.forEach((c) => checkText(where, c));
  });
  for (const key of ['hl', 'ok', 'bad', 'dim']) for (const i of t[key] || []) if (!t.rows[i]) err(where, key + '-Index ' + i + ' außerhalb');
}

function checkER(where, d) {
  const er = d.er || d;
  const names = new Set(er.ents.map((e) => e.id || e.n));
  if (names.size !== er.ents.length) err(where, 'Entitäten doppelt');
  for (const r of er.rels || []) {
    const ends = r.ends || [{ e: r.a }, { e: r.b }];
    ends.forEach((x) => { if (!names.has(x.e)) err(where, 'Beziehung ' + r.n + ': unbekannte Entität ' + x.e); });
  }
  for (const g of er.isa || []) {
    if (!names.has(g.sup)) err(where, 'is-a: unbekannter Obertyp ' + g.sup);
    g.subs.forEach((s) => { if (!names.has(s)) err(where, 'is-a: unbekannter Untertyp ' + s); });
  }
  if (!er.w || !er.h) err(where, 'ER ohne w/h');
  // Formen müssen in die Zeichenfläche passen
  for (const e of er.ents) if (e.x < 20 || e.x > er.w - 20 || e.y < 10 || e.y > er.h - 10) err(where, 'Entität ' + e.n + ' außerhalb der Zeichenfläche');
}

function checkBlock(where, b) {
  if (!BLOCKS.has(b.t)) return err(where, 'unbekannter Blocktyp ' + b.t);
  checkText(where, b.x);
  checkText(where, b.title);
  (b.i || []).forEach((x) => checkText(where, x));
  switch (b.t) {
    case 'tb': checkTable(where, b); break;
    case 'rels': (b.tabs || []).forEach((t) => checkTable(where, t)); break;
    case 'sl':
      if (!PAGES[b.part] || !(b.page >= 1 && b.page <= PAGES[b.part])) err(where, 'ungültige Folie ' + b.part + '/' + b.page);
      if (b.crop && (b.crop.length !== 4 || b.crop[0] + b.crop[2] > 100 || b.crop[1] + b.crop[3] > 100)) err(where, 'Zuschnitt ragt über die Seite: ' + b.part + '/' + b.page);
      if (!b.x) err(where, 'Folie ohne Bildunterschrift');
      break;
    case 'st':
      if (!b.steps || b.steps.length < 2) err(where, 'st braucht mindestens zwei Schritte');
      (b.steps || []).forEach((s) => { if (typeof s.x !== 'string') err(where, 'Schritt ohne x'); checkText(where, s.x); checkText(where, s.f); (s.tabs || []).forEach((t) => checkTable(where, t)); });
      break;
    case 'er': checkER(where, b); break;
    case 'x': if (!LABS.has(b.viz)) err(where, 'Labor fehlt: ' + b.viz); break;
    case 'net': {
      const ids = new Set(b.nodes.map((n) => n.id));
      (b.edges || []).forEach((e) => { if (!ids.has(e.a) || !ids.has(e.b)) err(where, 'Kante unbekannt'); });
      (b.steps || []).forEach((s) => (s.hn || []).forEach((n) => { if (!ids.has(n)) err(where, 'Knoten unbekannt: ' + n); }));
      break;
    }
    default:
  }
}

function checkQuestion(where, q) {
  for (const key of ['id', 'k', 'lvl', 'pts', 'q']) if (q[key] === undefined) err(where, 'fehlt ' + key);
  if (!KINDS.has(q.k)) err(where, 'unbekannter Fragetyp ' + q.k);
  checkText(where, q.q);
  checkText(where, q.e);
  (q.steps || []).forEach((x) => checkText(where, x));
  (q.model || []).forEach((x) => checkText(where, x));
  (q.o || []).forEach((x) => checkText(where, x));
  if (q.fig) checkBlock(where + ' fig', q.fig);
  (q.sol || []).forEach((b) => checkBlock(where + ' sol', b));
  if (q.ref && !/^T\d+ S\.\d+(-\d+)?$/.test(q.ref)) err(where, 'Referenz ungültig: ' + q.ref);
  if (q.k === 'mc' && (!q.o || !q.a || q.a.length !== 1)) err(where, 'mc braucht genau eine Lösung');
  if (q.k === 'ms' && (!q.o || !q.a || !q.a.length)) err(where, 'ms braucht Lösungen');
  if ((q.k === 'mc' || q.k === 'ms') && q.o) {
    (q.a || []).forEach((i) => { if (!(i >= 0 && i < q.o.length)) err(where, 'Lösungsindex ' + i); });
    if (new Set(q.o).size !== q.o.length) err(where, 'doppelte Antwortoption');
  }
  if (q.k === 'tf' && (!q.st || q.st.some((s) => typeof s.v !== 'boolean'))) err(where, 'tf ungültig');
  if (q.k === 'num' && (typeof q.num !== 'number' || !q.steps)) err(where, 'num ohne Wert oder Weg');
  if (q.k === 'ord' && (!q.seq || new Set(q.seq).size !== q.seq.length)) err(where, 'ord ungültig');
  if (q.k === 'match' && (!q.pairs || q.pairs.some((p) => p.length < 2))) err(where, 'match ungültig');
  if (q.k === 'open' && !(q.model && q.model.length)) err(where, 'open ohne Musterlösung');
  if (q.k === 'lab' && !LABS.has(q.viz)) err(where, 'Labor fehlt: ' + q.viz);
  if (q.k === 'lab' && q.params && q.params.er) checkER(where, q.params.er);
}

const modules = fs.readdirSync(dir).filter((f) => /^module_\d+\.json$/.test(f)).sort().map((f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch (e) {
    err(f, 'kein gültiges JSON: ' + e.message);
    return null;
  }
}).filter(Boolean);
const course = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
const exams = JSON.parse(fs.readFileSync(path.join(dir, 'exams.json'), 'utf8'));

const seen = new Set();
let nq = 0;
let nsec = 0;
let nslides = 0;
const usedLabs = new Set();
for (const m of modules) {
  const ids = new Set(m.questions.map((q) => q.id));
  for (const key of ['id', 'part', 'order', 'title', 'pages', 'icon', 'goal', 'sections', 'questions', 'glyph']) if (m[key] === undefined) err(m.id, 'fehlt ' + key);
  const inPractice = new Set();
  for (const s of m.sections) {
    nsec++;
    if (seen.has(s.id)) err(m.id, 'ID doppelt: ' + s.id);
    seen.add(s.id);
    if (!s.id.startsWith(m.id)) err(m.id, 'Abschnitt ' + s.id + ' passt nicht');
    s.blocks.forEach((b) => {
      checkBlock(s.id, b);
      if (b.t === 'sl') nslides++;
      if (b.t === 'x') usedLabs.add(b.viz);
    });
    if (!s.practice || !s.practice.length) err(s.id, 'Abschnitt ohne Praxis');
    (s.practice || []).forEach((id) => {
      if (id.startsWith('calc.')) { if (!Calc.has(id)) err(s.id, 'Generator fehlt: ' + id); } else if (!ids.has(id)) err(s.id, 'Praxisaufgabe fehlt: ' + id);
      inPractice.add(id);
    });
  }
  for (const q of m.questions) {
    nq++;
    if (seen.has(q.id)) err(m.id, 'ID doppelt: ' + q.id);
    seen.add(q.id);
    checkQuestion(q.id, q);
    if (q.k === 'lab') usedLabs.add(q.viz);
    if (!inPractice.has(q.id)) err(m.id, 'Frage in keinem Abschnitt: ' + q.id);
  }
  (m.calcs || []).forEach((id) => { if (!Calc.has(id)) err(m.id, 'Generator fehlt: ' + id); });
}
for (const lab of LABS) if (!usedLabs.has(lab)) warnings.push('Labor nicht verwendet: ' + lab);

// ---- Klausurgewichte ----
const totalPct = course.examTasks.reduce((s, t) => s + t.pct, 0);
const totalMin = course.examTasks.reduce((s, t) => s + t.min, 0);
if (totalPct !== 100) err('course', 'Anteile ergeben ' + totalPct + ' %');
if (totalMin !== 60) err('course', 'Minuten ergeben ' + totalMin);
for (const t of course.examTasks) {
  const w = modules.filter((m) => m.exam === t.no).reduce((s, m) => s + m.weight, 0);
  if (w !== t.pct) err('course', 'Aufgabe ' + t.no + ': Modulgewichte ' + w + ' statt ' + t.pct);
}

// ---- Probeklausuren ----
let examQuestions = 0;
for (const e of exams) {
  const nos = e.tasks.map((t) => t.no).join(',');
  if (nos !== '1,2,3,4,5,6,7') err(e.id, 'Aufgaben: ' + nos);
  let pts = 0;
  for (const t of e.tasks) {
    const sum = t.questions.reduce((s, q) => s + q.pts, 0);
    if (sum !== t.pts) err(e.id, 'Aufgabe ' + t.no + ': Punkte ' + sum + ' statt ' + t.pts);
    const should = course.examTasks.find((x) => x.no === t.no).min;
    if (t.pts !== should) err(e.id, 'Aufgabe ' + t.no + ': ' + t.pts + ' Punkte, Gewichtung sagt ' + should);
    pts += t.pts;
    if (t.fig) checkBlock(e.id, t.fig);
    checkText(e.id, t.intro);
    t.questions.forEach((q) => {
      examQuestions++;
      if (seen.has(q.id)) err(e.id, 'ID doppelt: ' + q.id);
      seen.add(q.id);
      checkQuestion(q.id, q);
    });
  }
  if (pts !== 60) err(e.id, 'Punkte gesamt ' + pts);
}

// ---- Alle Aufgaben der Übungsblätter müssen vorkommen ----
const allQ = modules.flatMap((m) => m.questions);
const srcText = allQ.map((q) => q.src || '').join(' | ');
const REQUIRED = {
  'Blatt 1': ['1.1', '1.2', '1.3', '1.4', '1.5 a', '1.5 b', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11 a', '1.11 c', '1.12 a', '1.12 b', '1.13 a', '1.13 b', '1.14 a', '1.14 c', '1.15 a', '1.15 b', '1.15 c', '1.16', '1.17'],
  'Blatt 5': ['5.1', '5.2', '5.3', '5.4', '5.5 a', '5.5 b', '5.6', '5.7 a', '5.7 b', '5.8'],
  'Blatt 6': ['6.1', '6.2', '6.3 a', '6.3 b', '6.3 c', '6.4 a', '6.4 b', '6.4 c', '6.4 d', '6.5 a', '6.5 b', '6.5 c', '6.5 d', '6.6 a', '6.6 b', '6.6 c', '6.6 d'],
  'ERM-Folie': ['33', '36']
};
for (const [sheet, list] of Object.entries(REQUIRED)) {
  for (const item of list) {
    const re = new RegExp(sheet + '[^|]*' + item.replace('.', '\\.') + '(?![0-9])');
    if (!re.test(srcText)) err('Übungsblätter', 'Aufgabe fehlt: ' + sheet + ' ' + item);
  }
}

// ---- Nichts aus der Klausur 2025 übernehmen ----
const allText = JSON.stringify({ modules, exams });
const BANNED = ['Turing', 'Automobilwerk', 'Montageauftrag', 'Fahrzeugklasse', 'Projektzuordnung', 'KI-Systeme', 'Datascience', 'IoT-Analyseplattform', 'Multimedia-Streamingdienst', 'internationale Bank', 'Euler', 'Hesse,'];
for (const w of BANNED) if (allText.includes(w)) err('Klausurschutz', 'Begriff aus der Klausur gefunden: ' + w);

// Jede FD-Menge in den Inhalten, auch unter anderen Buchstaben, darf nicht der Klausurmenge entsprechen.
function fdSetsIn(text) {
  const found = [];
  const re = /F = \{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text))) found.push(m[1]);
  return found;
}
let checkedSets = 0;
for (const raw of fdSetsIn(allText)) {
  const clean = raw.replace(/\\n/g, ' ').split(/,\s{1,2}/).map((s) => s.trim()).filter((s) => /^[A-Z]+ → [A-Z]+$/.test(s));
  if (clean.length < 2) continue;
  const F = FD.parse(clean.join('; ').replace(/ → /g, ' -> '));
  checkedSets++;
  if (FD.isReserved(F) || FD.isReserved(FD.canonical(F).Fc)) err('Klausurschutz', 'FD-Menge entspricht der Klausur: ' + raw);
}

// ---- FD-Aufgaben nachrechnen ----
function expect(name, cond) { if (!cond) err('Nachrechnen', name); }
const Fset = (s) => FD.parse(s);
const sig = (F) => F.map((f) => f.l.slice().sort().join('') + '>' + f.r.slice().sort().join('')).sort().join(';');
const L5 = 'ABCDE'.split('');
{
  const T1 = Fset('A->BC; B->D; AB->E; E->A; C->D');
  expect('T1 Schlüssel', FD.keys(L5, T1).map((k) => k.join('')).sort().join() === 'A,E');
  expect('T1 F_c', sig(FD.canonical(T1).Fc) === sig(Fset('A->BCE; B->D; E->A; C->D')));
  const T2 = Fset('C->AB; A->D; CD->E; B->D; E->C');
  expect('T2 Schlüssel', FD.keys(L5, T2).map((k) => k.join('')).sort().join() === 'C,E');
  expect('T2 F_c', sig(FD.canonical(T2).Fc) === sig(Fset('C->ABE; A->D; B->D; E->C')));
  const T3 = Fset('AD->B; A->C; C->D; B->AE; A->D');
  expect('T3 Schlüssel', FD.keys(L5, T3).map((k) => k.join('')).sort().join() === 'A,B');
  expect('T3 F_c', sig(FD.canonical(T3).Fc) === sig(Fset('A->BC; C->D; B->AE')));
  expect('T3 E ist kein Schlüssel', FD.closure(['E'], T3).join('') === 'E');
  const T4 = Fset('A->BC; B->C; C->D; A->D');
  expect('T4 F_c', sig(FD.canonical(T4).Fc) === sig(Fset('A->B; B->C; C->D')));
  const T5 = Fset('AB->C; A->B; C->D');
  expect('T5 links', sig(FD.leftReduce(T5).F) === sig(Fset('A->C; A->B; C->D')));
  const T6 = Fset('ABC->D; A->B');
  expect('T6 links', sig(FD.leftReduce(T6).F) === sig(Fset('AC->D; A->B')));
  const T7 = Fset('AB->C; C->D; D->A');
  expect('T7 Schlüssel', FD.keys('ABCD'.split(''), T7).map((k) => k.join('')).sort().join() === 'AB,BC,BD');
  expect('T7 keine Linksreduktion', !FD.leftReduce(T7).log.some((e) => e.removed));
  const T8 = Fset('ABD->C; C->DE; D->E; E->A; AB->E');
  expect('T8 BD ist Schlüssel', FD.isKey(['B', 'D'], L5, T8));
  expect('T8 F_c', sig(FD.canonical(T8).Fc) === sig(Fset('BD->C; C->D; D->E; E->A; AB->E')));
  const PA = Fset('AC->D; D->B; B->E; E->A; AC->B; BD->E');
  expect('PA CE ist Schlüssel', FD.isKey(['C', 'E'], L5, PA));
  expect('PA links', FD.leftReduce(PA).log.filter((e) => e.removed).map((e) => e.x + FD.attrs(e.fd.l)).join() === 'BBD');
  expect('PA F_c', sig(FD.canonical(PA).Fc) === sig(Fset('AC->D; D->B; B->E; E->A')));
  const PB = Fset('B->CD; C->E; BC->A; A->B; E->D');
  expect('PB D ist kein Schlüssel', FD.closure(['D'], PB).join('') === 'D');
  expect('PB F_c', sig(FD.canonical(PB).Fc) === sig(Fset('B->AC; C->E; A->B; E->D')));
  const PC = Fset('AB->C; AB->D; C->E; D->E; E->B');
  expect('PC AE ist Schlüssel', FD.isKey(['A', 'E'], L5, PC));
  expect('PC keine Reduktion', !FD.leftReduce(PC).log.some((e) => e.removed) && !FD.rightReduce(PC).log.some((e) => e.removed));
  expect('PC F_c', sig(FD.canonical(PC).Fc) === sig(Fset('AB->CD; C->E; D->E; E->B')));
  // Aufgabe 7 der Probeklausuren und das Training
  for (const [R, F, nf] of [
    [['Teilnehmer', 'Sportart', 'Trainer'], 'Teilnehmer, Sportart -> Trainer; Trainer -> Sportart', '3NF'],
    [['Fahrzeug', 'Arbeit', 'Mechaniker'], 'Fahrzeug, Arbeit -> Mechaniker; Mechaniker -> Arbeit', '3NF'],
    [['Student', 'Labor', 'Betreuer'], 'Student, Labor -> Betreuer; Betreuer -> Labor', '3NF'],
    [['Pflegekraft', 'Station', 'Leitung'], 'Pflegekraft, Station -> Leitung; Leitung -> Station', '3NF'],
    [['Fahrer', 'Route', 'Disponent', 'DispoTel'], 'Fahrer, Route -> Disponent; Disponent -> DispoTel', '2NF'],
    [['KursNr', 'Titel', 'RaumNr', 'Stockwerk'], 'KursNr -> Titel, RaumNr; RaumNr -> Stockwerk', '2NF']
  ]) expect('Normalform ' + R.join(), FD.normalForm(R, Fset(F)).nf === nf);
  // Divisionen der Probeklausuren
  const div = (R, S) => RA.divide(RA.rel(R[0], R[1]), RA.rel(S[0], S[1])).result.rows.map((r) => r[0]).sort().join();
  expect('PA Division', div([['MID', 'Thema'], [[1, 'SQL'], [1, 'Git'], [2, 'SQL'], [3, 'SQL'], [3, 'Git'], [3, 'Docker'], [4, 'Git'], [4, 'SQL']]], [['Thema'], [['Git'], ['SQL']]]) === '1,3,4');
  expect('PB Division', div([['FID', 'Klasse'], [[1, 'BE'], [2, 'BE'], [2, 'C1'], [2, 'T'], [3, 'C1'], [4, 'BE'], [4, 'C1']]], [['Klasse'], [['BE'], ['C1']]]) === '2,4');
  expect('PC Division', div([['KID', 'Gericht'], [[1, 'Pizza'], [1, 'Pasta'], [1, 'Risotto'], [2, 'Pizza'], [3, 'Pasta'], [3, 'Risotto'], [4, 'Pasta'], [4, 'Risotto'], [4, 'Curry']]], [['Gericht'], [['Pasta'], ['Risotto']]]) === '1,3,4');
}

// ---- Musterlösungen von Aufgabe 4 müssen zu den ER-Modellen aus Aufgabe 3 passen ----
for (const e of exams) {
  const er = e.tasks.find((t) => t.no === 3).questions[0].sol[0].er;
  const schema = ERM.toSchema(er).map((s) => s.line).sort();
  const model = e.tasks.find((t) => t.no === 4).questions[0].model.slice().sort();
  if (schema.join('\n') !== model.join('\n')) {
    err(e.id, 'Schema passt nicht zum ER-Modell:\n  berechnet: ' + schema.join('\n             ') + '\n  Lösung:    ' + model.join('\n             '));
  }
}

console.log('Module: ' + modules.length + ', Abschnitte: ' + nsec + ', Fragen: ' + nq + ', Klausurfragen: ' + examQuestions + ', Folien: ' + nslides + ', Labore: ' + LABS.size + ', Generatoren: ' + Calc.list().length + ', geprüfte FD-Mengen: ' + checkedSets);
const counts = {};
allQ.forEach((q) => (counts[q.k] = (counts[q.k] || 0) + 1));
console.log('Fragetypen: ' + JSON.stringify(counts));
const perTask = course.examTasks.map((t) => {
  const qs = modules.filter((m) => m.exam === t.no).flatMap((m) => m.questions).length;
  return 'A' + t.no + ' ' + t.pct + '% → ' + qs;
}).join(', ');
console.log('Aufgaben je Klausurteil: ' + perTask);
warnings.forEach((w) => console.log('Hinweis: ' + w));
errors.forEach((e) => console.log('FEHLER: ' + e));
console.log(errors.length ? errors.length + ' Fehler gefunden.' : 'Keine Fehler gefunden.');
process.exit(errors.length ? 1 : 0);
