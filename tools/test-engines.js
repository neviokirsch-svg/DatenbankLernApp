// Prüft die Logik gegen die Beispiele aus Skript und Übungsblättern. Aufruf: node tools/test-engines.js
const assert = require('assert');
const path = require('path');
const { FD, RA, Calc } = require(path.join(__dirname, '..', 'web', 'src', 'engine.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.log('FEHLER: ' + name + '\n  ' + e.message);
    process.exitCode = 1;
  }
}
const set = (a) => a.slice().sort().join(',');
const keysStr = (keys) => keys.map((k) => k.slice().sort().join('')).sort().join(' ');
const sigF = (F) => F.map((f) => f.l.slice().sort().join(',') + '>' + f.r.slice().sort().join(',')).sort().join(';');

// ---- Hülle und Schlüssel ----
test('Blatt 6.3b: A⁺ = R', () => {
  const R = 'ABCDEF'.split('');
  const F = FD.parse('A->BC; C->DA; E->ABC; F->CD; CD->BEF');
  assert.strictEqual(set(FD.closure(['A'], F)), set(R));
});
test('Blatt 6.3c: Kandidatenschlüssel A, C, E, F', () => {
  const R = 'ABCDEF'.split('');
  const F = FD.parse('A->BC; C->DA; E->ABC; F->CD; CD->BEF');
  assert.strictEqual(keysStr(FD.keys(R, F)), 'A C E F');
  assert.strictEqual(set(FD.closure(['B', 'D'], F)), 'B,D');
});
test('Blatt 6.3a: F_c ist äquivalent und reduziert', () => {
  const F = FD.parse('A->BC; C->DA; E->ABC; F->CD; CD->BEF');
  const can = FD.canonical(F);
  assert.ok(FD.equivalent(F, can.Fc));
  assert.strictEqual(sigF(can.Fc), sigF(FD.parse('A->C; C->BEF; E->A; F->CD')));
});

// ---- Kanonische Überdeckung: Beispiele aus dem Skript ----
const WEIN = 'Name, Weingut -> Preis; Name, Weingut -> Weingut; Name, Weingut -> Name; Name -> Farbe; Weingut -> Anbaugebiet, Region; Anbaugebiet -> Region';
test('Skript: Weingüter', () => {
  const can = FD.canonical(FD.parse(WEIN));
  assert.strictEqual(sigF(can.Fc), sigF(FD.parse('Name, Weingut -> Preis; Name -> Farbe; Weingut -> Anbaugebiet; Anbaugebiet -> Region')));
});
test('Skript: Weingüter-Synthese liefert vier Tabellen', () => {
  const R = ['Name', 'Weingut', 'Preis', 'Farbe', 'Anbaugebiet', 'Region'];
  const s = FD.synthesis(R, FD.parse(WEIN));
  assert.strictEqual(s.schemas.length, 4);
  assert.strictEqual(keysStr(s.keys), ['NameWeingut'].join(' '));
});

const PROF_R = ['PersNr', 'Name', 'Rang', 'Raum', 'Ort', 'Straße', 'PLZ', 'Vorwahl', 'BLand', 'EW', 'Landesregierung'];
const PROF = 'PersNr -> PersNr, Name, Rang, Raum, PLZ, Ort, Straße, Vorwahl, BLand, EW, Landesregierung; Ort, BLand -> EW, Vorwahl; PLZ -> BLand, Ort, EW; Ort, BLand, Straße -> PLZ; BLand -> Landesregierung; Raum -> PersNr';
test('Skript: ProfessorenAdr, kanonische Überdeckung wie auf der Folie', () => {
  const can = FD.canonical(FD.parse(PROF));
  assert.strictEqual(sigF(can.Fc), sigF(FD.parse('PersNr -> Name, Rang, Raum, Ort, Straße, BLand; Ort, BLand -> EW, Vorwahl; PLZ -> BLand, Ort; Ort, BLand, Straße -> PLZ; BLand -> Landesregierung; Raum -> PersNr')));
});
test('Skript: ProfessorenAdr, Schlüssel PersNr und Raum', () => {
  assert.strictEqual(keysStr(FD.keys(PROF_R, FD.parse(PROF))), 'PersNr Raum');
});
test('Skript: ProfessorenAdr, Synthese ergibt 4 Schemata', () => {
  const s = FD.synthesis(PROF_R, FD.parse(PROF));
  assert.strictEqual(s.schemas.length, 4);
  assert.strictEqual(s.removed.length, 2);
  assert.strictEqual(s.keyAdded, null);
});

// ---- Blatt 6.4 ----
const ASSI_R = ['PersNr', 'Name', 'Fachgebiet', 'BossPersNr', 'BossName', 'MatrNr', 'SName', 'Semester', 'SWohnOrt'];
const ASSI = 'PersNr -> Name, Fachgebiet, BossPersNr; BossPersNr -> BossName; MatrNr -> SName, Semester, SWohnOrt, PersNr';
test('Blatt 6.4: Schlüssel MatrNr, drei Schemata', () => {
  const F = FD.parse(ASSI);
  assert.strictEqual(keysStr(FD.keys(ASSI_R, F)), 'MatrNr');
  const s = FD.synthesis(ASSI_R, F);
  assert.strictEqual(s.schemas.length, 3);
  assert.strictEqual(s.keyAdded, null);
  assert.strictEqual(sigF(s.Fc), sigF(F));
});
test('Skript Folie 12: D1 ist minimal', () => {
  const s = FD.synthesis(['A', 'B', 'C'], FD.parse('A->B; B->C'));
  assert.strictEqual(s.schemas.length, 2);
});

// ---- Normalformen ----
test('Blatt 6.5b: nur 1NF (A → C verletzt 2NF)', () => {
  const nf = FD.normalForm(['A', 'B', 'C'], FD.parse('AB->C; A->C'));
  assert.strictEqual(nf.nf, '1NF');
});
test('Blatt 6.5c: in 3NF, weil B Schlüsselattribut ist; nicht in BCNF', () => {
  const nf = FD.normalForm(['A', 'B', 'C'], FD.parse('AB->C; C->B'));
  assert.strictEqual(nf.nf, '3NF');
  assert.strictEqual(keysStr(nf.keys), 'AB AC');
});
test('Blatt 6.5d: B → C verletzt BCNF (und schon 2NF)', () => {
  const nf = FD.normalForm(['A', 'B', 'C'], FD.parse('AB->C; B->C'));
  assert.strictEqual(nf.nf, '1NF');
  assert.ok(nf.bcnfviol.length > 0);
});
test('Blatt 6.6b: Bestellpositionen, nur 1NF', () => {
  const nf = FD.normalForm(['BestellNr', 'ArtikelNr', 'Artikelname', 'Menge'], FD.parse('BestellNr, ArtikelNr -> Menge; ArtikelNr -> Artikelname'));
  assert.strictEqual(nf.nf, '1NF');
});
test('Blatt 6.6c: Mitarbeiter, 2NF aber nicht 3NF', () => {
  const nf = FD.normalForm(['MitarbNr', 'Name', 'AbtNr', 'AbtName'], FD.parse('MitarbNr -> Name, AbtNr; AbtNr -> AbtName'));
  assert.strictEqual(nf.nf, '2NF');
  assert.strictEqual(keysStr(nf.keys), 'MitarbNr');
});
test('Blatt 6.6d: Schüler/Fach/Lehrkraft, 3NF aber nicht BCNF', () => {
  const F = FD.parse('Lehrkraft -> Fach; Schüler, Fach -> Lehrkraft');
  const R = ['Schüler', 'Fach', 'Lehrkraft'];
  const nf = FD.normalForm(R, F);
  assert.strictEqual(nf.nf, '3NF');
  assert.strictEqual(nf.keys.length, 2);
  const d = FD.bcnfDecompose(R, F);
  assert.strictEqual(d.schemas.length, 2);
  assert.ok(FD.lossless(d.schemas[0], d.schemas[1], F).ok);
  const pres = FD.preserved(d.schemas, F);
  assert.ok(pres.some((p) => !p.ok), 'Schüler, Fach → Lehrkraft geht verloren');
});
test('Blatt 6.2: Autoverleih verletzt 3NF', () => {
  const R = ['id', 'from', 'to', 'price', 'carNo', 'car', 'color', 'custNo', 'customer', 'customerTel'];
  const F = FD.parse('id -> from, to, price, carNo, custNo; carNo -> car, color; custNo -> customer, customerTel');
  const nf = FD.normalForm(R, F);
  assert.strictEqual(nf.nf, '2NF');
  const s = FD.synthesis(R, F);
  assert.strictEqual(s.schemas.length, 3);
});
test('Skript Folie 21: Lieferung ReNr/ArtNr/LagerOrt, 3NF aber nicht BCNF', () => {
  const R = ['ReNr', 'ArtNr', 'LagerOrt', 'Anzahl'];
  const nf = FD.normalForm(R, FD.parse('ReNr, ArtNr -> Anzahl; ReNr, LagerOrt -> Anzahl; ArtNr -> LagerOrt; LagerOrt -> ArtNr'));
  assert.strictEqual(nf.nf, '3NF');
  assert.strictEqual(nf.keys.length, 2);
});
test('Skript Folie 19: Student/Note/Dozent-Zerlegung ist nicht verlustlos', () => {
  const F = FD.parse('Student -> Note; Dozent -> Note');
  assert.strictEqual(FD.lossless(['Student', 'Note'], ['Note', 'Dozent'], F).ok, false);
});
test('Skript Folie 12: R(A,B,C) mit A→B, B→C ist verlustlos und abhängigkeitstreu zerlegbar', () => {
  const F = FD.parse('A->B; B->C');
  assert.ok(FD.lossless(['A', 'B'], ['B', 'C'], F).ok);
  assert.ok(FD.preserved([['A', 'B'], ['B', 'C']], F).every((p) => p.ok));
});

// ---- Relationale Algebra ----
const piloten = RA.rel(['PILOT', 'FLUGZEUG'], [['Snoopy', '707'], ['Snoopy', '727'], ['Snoopy', '747'], ['Meyer', '707'], ['Meyer', '727'], ['Müller', '707'], ['Müller', '727'], ['Müller', '747'], ['Müller', '777'], ['Lüdenscheid', '727']]);
test('Skript Folie 21: Piloten ÷ R2 = Snoopy, Müller', () => {
  const d = RA.divide(piloten, RA.rel(['FLUGZEUG'], [['707'], ['727'], ['747']]));
  assert.strictEqual(set(d.result.rows.map((r) => r[0])), 'Müller,Snoopy');
});
test('Skript Folie 21: Piloten ÷ R3 = Snoopy, Meyer, Müller', () => {
  const d = RA.divide(piloten, RA.rel(['FLUGZEUG'], [['707']]));
  assert.strictEqual(set(d.result.rows.map((r) => r[0])), 'Meyer,Müller,Snoopy');
});
const lief = RA.rel(['LiefNr', 'ArtNr'], [[5, 500001], [2, 500002], [1, 500002], [3, 500003], [4, 500003], [3, 500004], [4, 500004], [4, 500005], [1, 500006], [1, 500007]]);
test('Skript Folie 22: Lieferungen ÷ Artikel von 3 = {3, 4}, 6 fehlende Tupel', () => {
  const S = RA.project(RA.select(lief, (r) => r.LiefNr === 3), ['ArtNr']);
  const d = RA.divide(lief, S);
  assert.strictEqual(d.A.rows.length, 5);
  assert.strictEqual(d.product.rows.length, 10);
  assert.strictEqual(d.missing.rows.length, 6);
  assert.strictEqual(set(d.bad.rows.map((r) => r[0])), '1,2,5');
  assert.strictEqual(set(d.result.rows.map((r) => r[0])), '3,4');
});
test('Blatt 5.8: B ÷ P = Alice, Carol', () => {
  const B = RA.rel(['Kunde', 'Produkt'], [['Alice', 'Laptop'], ['Alice', 'Smartphone'], ['Bob', 'Laptop'], ['Bob', 'Tablet'], ['Carol', 'Laptop'], ['Carol', 'Smartphone'], ['Carol', 'Tablet']]);
  const P = RA.rel(['Produkt'], [['Laptop'], ['Smartphone']]);
  const d = RA.divide(B, P);
  assert.strictEqual(set(d.result.rows.map((r) => r[0])), 'Alice,Carol');
  assert.strictEqual(d.missing.rows.length, 1);
  assert.deepStrictEqual(d.missing.rows[0], ['Bob', 'Smartphone']);
});
test('Blatt 5.3: R ∩ S = R − (R − S)', () => {
  const R = RA.rel(['A', 'B', 'C'], [[1, 'f', 'III'], [8, 'z', 'XI'], [3, 'd', 'V'], [3, 'o', 'XII'], [1, 'f', 'X']]);
  const S = RA.rel(['A', 'B', 'C'], [[1, 'f', 'X'], [3, 'd', 'V']]);
  assert.ok(RA.equal(RA.minus(R, RA.minus(R, S)), RA.intersect(R, S)));
  assert.strictEqual(RA.intersect(R, S).rows.length, 2);
});
test('Blatt 5.7: Left und Right Outer Join', () => {
  const R = RA.rel(['ID', 'Name'], [[1, 'Alice'], [2, 'Bob'], [3, 'Carol']]);
  const S = RA.rel(['ID', 'Course'], [[1, 'Math'], [2, 'Chemistry'], [4, 'Physics']]);
  assert.deepStrictEqual(RA.leftOuter(R, S).rows.find((r) => r[0] === 3), [3, 'Carol', null]);
  assert.deepStrictEqual(RA.rightOuter(R, S).rows.find((r) => r[0] === 4), [4, null, 'Physics']);
  assert.strictEqual(RA.fullOuter(R, S).rows.length, 4);
});
test('Blatt 5.5: Vorträge in der Soda Hall und mit Vortragendem', () => {
  const T = RA.rel(['subject', 'time', 'place', 'sid', 'units'], [['Relational algebra', '09:00', 'Cory Hall', 1, 3], ['Three-valued logic', '11:30', 'Soda Hall', 4, 2], ['Domain relational calculus', '13:00', 'Cory Hall', 2, 2], ['Tuple relational calculus', '14:30', 'Cory Hall', 1, 2], ['History of SQL', '16:30', 'Cory Hall', 5, 1], ['Constraint query languages', '18:00', 'Soda Hall', 3, 2]]);
  const S = RA.rel(['sid', 'name'], [[1, 'Codd'], [2, 'Lacroix'], [3, 'Kuper'], [4, 'Keen'], [5, 'Chamberlin'], [6, 'Boyce']]);
  assert.strictEqual(RA.project(RA.select(T, (r) => r.place === 'Soda Hall'), ['subject', 'time', 'place']).rows.length, 2);
  const j = RA.project(RA.natural(T, S), ['subject', 'time', 'name']);
  assert.strictEqual(j.rows.length, 6);
  assert.ok(j.rows.some((r) => r[0] === 'Three-valued logic' && r[2] === 'Keen'));
});
test('Skript Folie 18: Natural Join', () => {
  const R = RA.rel(['A', 'B', 'C'], [[1, 'f', 3], [8, 'z', 1], [5, 'a', 2], [2, 'q', 3], [9, 'c', 2], [2, 'c', 1], [1, 'f', 1]]);
  const S = RA.rel(['C', 'D'], [[1, 'abc'], [2, 'qrst'], [3, 'xyz']]);
  assert.strictEqual(RA.natural(R, S).rows.length, 7);
});

// ---- Generatoren: jede Aufgabe muss intern stimmig sein ----
const RESERVED = 'A→C;BD→E;C→D;E→AB';
Calc.seed(20261103);
for (const g of Calc.list()) {
  test('Generator ' + g.id + ' (200 Läufe)', () => {
    for (let i = 0; i < 200; i++) {
      const q = Calc.make(g.id);
      assert.ok(q.q && q.k, 'Frage unvollständig');
      assert.ok(q.steps && q.steps.length, 'Lösungsweg fehlt');
      if (q.k === 'mc' || q.k === 'ms') {
        assert.ok(q.o.length >= 2, 'Zu wenige Optionen');
        assert.strictEqual(new Set(q.o).size, q.o.length, 'Doppelte Option: ' + JSON.stringify(q.o));
        assert.ok(q.a.length >= 1, 'Keine Lösung');
        q.a.forEach((x) => assert.ok(x >= 0 && x < q.o.length, 'Lösungsindex'));
        if (q.k === 'mc') assert.strictEqual(q.a.length, 1);
      }
      if (q.k === 'num') assert.strictEqual(typeof q.num, 'number');
      if (q.fig && q.fig.t === 'f') assert.ok(!q.fig.x.replace(/\s/g, '').includes(RESERVED), 'Klausur-FD erzeugt');
    }
  });
}
test('Generator calc.closure: Lösung stimmt mit der Hülle überein', () => {
  for (let i = 0; i < 100; i++) {
    const q = Calc.make('calc.closure');
    const lines = q.fig.x.split('\n');
    const F = FD.parse(lines[1].replace('F = ', '').replace(/[{}]/g, '').split(',  ').join(';').replace(/ → /g, '->'));
    const X = q.q.match(/\*\*\(?([A-H]+)\)?⁺\*\*/)[1].split('');
    assert.strictEqual(set(q.a.map((j) => q.o[j])), set(FD.closure(X, F)));
  }
});

// ---- Klausurschutz: die Prüfung muss die Klausurmenge auch unter anderen Buchstaben erkennen ----
test('Klausurschutz erkennt Original und umbenannte Varianten', () => {
  assert.ok(FD.isReserved(FD.parse('BD->E; A->C; C->D; E->AB')), 'Original');
  assert.ok(FD.isReserved(FD.parse('BC->D; A->E; E->B; D->AC')), 'umbenannt');
  assert.ok(FD.isReserved(FD.canonical(FD.parse('BC->D; A->E; E->B; D->AC; BC->A')).Fc), 'mit Zusatz-FD');
  assert.ok(!FD.isReserved(FD.parse('A->BC; B->D; AB->E; E->A; C->D')), 'andere Menge');
});

test('engine.js läuft ohne Node-Umgebung (wie in JavaScriptCore)', () => {
  const vm = require('vm');
  const ctx = vm.createContext({});
  vm.runInContext(require('fs').readFileSync(path.join(__dirname, '..', 'web', 'src', 'engine.js'), 'utf8'), ctx);
  const list = JSON.parse(vm.runInContext('JSON.stringify(DBEngine.Calc.list())', ctx));
  assert.ok(list.length >= 11);
  for (const g of list) {
    const q = JSON.parse(vm.runInContext("JSON.stringify(DBEngine.Calc.make('" + g.id + "'))", ctx));
    assert.strictEqual(q.id, g.id);
  }
});

console.log(passed + ' Tests bestanden' + (process.exitCode ? ', es gab Fehler.' : ', keine Fehler.'));
