// Reine Logik ohne DOM: läuft im Browser, in Node (Tests) und in JavaScriptCore (iOS-App).
// FD = funktionale Abhängigkeiten, RA = relationale Algebra, Calc = Aufgaben-Generatoren.
(function (root) {
  'use strict';

  const uniq = (a) => Array.from(new Set(a));
  const hasAll = (big, small) => small.every((x) => big.includes(x));
  const without = (a, b) => a.filter((x) => !b.includes(x));
  const sameSet = (a, b) => a.length === b.length && hasAll(a, b);

  // ---------------------------------------------------------------------------
  // Funktionale Abhängigkeiten
  // ---------------------------------------------------------------------------
  const FD = {};

  FD.make = (l, r) => ({ l: uniq(l), r: uniq(r) });
  FD.clone = (F) => F.map((f) => FD.make(f.l, f.r));

  // Liest "AB->C; C->D" oder "Name, Weingut -> Preis". Einzelbuchstaben dürfen ohne Komma stehen.
  FD.parse = function (text) {
    const lines = String(text).split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    const pairs = lines.map((line) => {
      const m = line.split(/\s*(?:->|→|=>)\s*/);
      if (m.length !== 2) throw new Error('Keine FD: "' + line + '". Schreibe zum Beispiel AB -> C.');
      return m;
    });
    const hasSeparator = pairs.some((p) => /[,\s]/.test(p[0].trim()) || /[,\s]/.test(p[1].trim()));
    const letterMode = !hasSeparator && pairs.every((p) => /^[A-Z]+$/.test(p[0]) && /^[A-Z]*$/.test(p[1]));
    const side = (s) => {
      const t = s.trim();
      if (!t) return [];
      if (letterMode) return t.split('');
      return t.split(/[,\s]+/).filter(Boolean);
    };
    return pairs.map((p) => FD.make(side(p[0]), side(p[1])));
  };

  FD.attrs = function (list) {
    if (!list.length) return '∅';
    return list.every((a) => a.length === 1) ? list.join('') : list.join(', ');
  };
  FD.str = (f) => FD.attrs(f.l) + ' → ' + FD.attrs(f.r);
  FD.setStr = (F) => '{ ' + F.map(FD.str).join(',  ') + ' }';
  FD.sortBy = (list, order) => list.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  FD.hullName = (X) => (X.length === 1 ? X[0] : '(' + FD.attrs(X) + ')') + '⁺';

  // Attributhülle nach dem Merkblatt: wiederholt alle FDs prüfen, bis sich Erg nicht mehr ändert.
  FD.hull = function (X, F) {
    let erg = uniq(X);
    const steps = [];
    let round = 0;
    let changed = true;
    while (changed) {
      changed = false;
      round++;
      for (const f of F) {
        const fires = hasAll(erg, f.l);
        const added = fires ? without(f.r, erg) : [];
        if (added.length) {
          erg = erg.concat(added);
          changed = true;
        }
        steps.push({ round, fd: f, fires, added, erg: erg.slice() });
      }
    }
    return { result: erg, steps, rounds: round };
  };
  FD.closure = (X, F) => FD.hull(X, F).result;

  FD.isSuper = (X, R, F) => hasAll(FD.closure(X, F), R);
  FD.isKey = (X, R, F) => FD.isSuper(X, R, F) && X.every((a) => !FD.isSuper(without(X, [a]), R, F));

  function subsets(list) {
    const out = [];
    const n = list.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const s = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(list[i]);
      out.push(s);
    }
    return out.sort((a, b) => a.length - b.length);
  }
  FD.subsets = subsets;

  // Alle Kandidatenschlüssel. Attribute, die rechts nie vorkommen, gehören in jeden Schlüssel.
  FD.keys = function (R, F) {
    const onRight = uniq(F.flatMap((f) => without(f.r, f.l)));
    const must = without(R, onRight);
    const optional = without(R, must);
    const found = [];
    const check = (X) => {
      if (found.some((k) => hasAll(X, k))) return;
      if (FD.isSuper(X, R, F)) found.push(FD.sortBy(X, R));
    };
    check(must);
    for (const s of subsets(optional)) check(must.concat(s));
    return found;
  };

  // Attribute nach ihrer Rolle für die Schlüsselsuche einordnen.
  FD.classify = function (R, F) {
    const left = uniq(F.flatMap((f) => f.l));
    const right = uniq(F.flatMap((f) => without(f.r, f.l)));
    return {
      onlyLeft: R.filter((a) => left.includes(a) && !right.includes(a)),
      onlyRight: R.filter((a) => right.includes(a) && !left.includes(a)),
      both: R.filter((a) => left.includes(a) && right.includes(a)),
      none: R.filter((a) => !left.includes(a) && !right.includes(a))
    };
  };

  // Schritt 1 der kanonischen Überdeckung. x ∈ α ist überflüssig, wenn β ⊆ AH(F, α \ {x}).
  FD.leftReduce = function (F0) {
    const F = FD.clone(F0);
    const log = [];
    for (let i = 0; i < F.length; i++) {
      for (const x of F[i].l.slice()) {
        const before = FD.make(F[i].l, F[i].r);
        if (F[i].l.length < 2) {
          continue;
        }
        const rest = without(F[i].l, [x]);
        const h = FD.closure(rest, F);
        const removed = hasAll(h, F[i].r);
        log.push({ index: i, fd: before, x, rest, hull: h, removed });
        if (removed) F[i].l = rest;
      }
    }
    return { F, log };
  };

  // Schritt 2. x ∈ β ist überflüssig, wenn x ∈ AH((F \ {α→β}) ∪ {α→(β \ {x})}, α).
  FD.rightReduce = function (F0) {
    const F = FD.clone(F0);
    const log = [];
    for (let i = 0; i < F.length; i++) {
      for (const x of F[i].r.slice()) {
        const before = FD.make(F[i].l, F[i].r);
        const candidate = F.map((f, j) => (j === i ? FD.make(f.l, without(f.r, [x])) : f));
        const h = FD.closure(F[i].l, candidate);
        const removed = h.includes(x);
        log.push({ index: i, fd: before, x, hull: h, removed, test: candidate });
        if (removed) F[i].r = without(F[i].r, [x]);
      }
    }
    return { F, log };
  };

  FD.dropEmpty = (F) => F.filter((f) => f.r.length > 0);

  FD.unify = function (F) {
    const out = [];
    for (const f of F) {
      const same = out.find((g) => sameSet(g.l, f.l));
      if (same) same.r = uniq(same.r.concat(f.r));
      else out.push(FD.make(f.l, f.r));
    }
    return out;
  };

  FD.canonical = function (F) {
    const left = FD.leftReduce(F);
    const right = FD.rightReduce(left.F);
    const noEmpty = FD.dropEmpty(right.F);
    const Fc = FD.unify(noEmpty);
    return { left, right, noEmpty, Fc };
  };

  FD.equivalent = function (F, G) {
    const covers = (A, B) => B.every((f) => hasAll(FD.closure(f.l, A), f.r));
    return covers(F, G) && covers(G, F);
  };

  // Projektion von F auf ein Teilschema, reduziert auf minimale linke Seiten.
  FD.project = function (Ri, F) {
    const out = [];
    for (const X of subsets(Ri)) {
      if (X.length === Ri.length) continue;
      const added = without(FD.closure(X, F).filter((a) => Ri.includes(a)), X);
      const remaining = added.filter((a) => !out.some((g) => hasAll(X, g.l) && g.r.includes(a)));
      if (remaining.length) out.push(FD.make(X, FD.sortBy(remaining, Ri)));
    }
    return out;
  };

  // Synthesealgorithmus nach dem Merkblatt (vier Schritte).
  FD.synthesis = function (R, F) {
    const can = FD.canonical(F);
    const schemas = can.Fc.map((f) => ({ attrs: FD.sortBy(uniq(f.l.concat(f.r)), R), fds: [f], key: f.l }));
    const keys = FD.keys(R, F);
    const hasKey = schemas.some((s) => keys.some((k) => hasAll(s.attrs, k)));
    let added = null;
    if (!hasKey) {
      added = { attrs: keys[0].slice(), fds: [], key: keys[0].slice(), keyOnly: true };
      schemas.push(added);
    }
    const removed = [];
    const kept = [];
    schemas.forEach((s, i) => {
      const host = schemas.find((o, j) => j !== i && hasAll(o.attrs, s.attrs) && (o.attrs.length > s.attrs.length || j < i));
      if (host) {
        host.fds = host.fds.concat(s.fds);
        removed.push({ schema: s, into: host });
      } else {
        kept.push(s);
      }
    });
    return { Fc: can.Fc, canonical: can, keys, created: schemas.map((s) => s.attrs), keyAdded: added, removed, schemas: kept };
  };

  FD.lossless = function (R1, R2, F) {
    const common = R1.filter((a) => R2.includes(a));
    if (!common.length) return { ok: false, common };
    const h = FD.closure(common, F);
    return { ok: hasAll(h, R1) || hasAll(h, R2), common, hull: h };
  };

  // Abhängigkeitstreue: lässt sich jede FD aus den Teilschemata ohne Join herleiten?
  FD.preserved = function (schemas, F) {
    return F.map((f) => {
      let res = f.l.slice();
      let changed = true;
      while (changed) {
        changed = false;
        for (const Ri of schemas) {
          const t = FD.closure(res.filter((a) => Ri.includes(a)), F).filter((a) => Ri.includes(a));
          const fresh = without(t, res);
          if (fresh.length) {
            res = res.concat(fresh);
            changed = true;
          }
        }
      }
      const ok = hasAll(res, f.r);
      const local = schemas.some((Ri) => hasAll(Ri, f.l) && hasAll(Ri, f.r));
      return { fd: f, ok, local };
    });
  };

  // Höchste erfüllte Normalform (1NF wird vorausgesetzt) mit allen Begründungen.
  FD.normalForm = function (R, F) {
    const keys = FD.keys(R, F);
    const prime = R.filter((a) => keys.some((k) => k.includes(a)));
    const nonprime = without(R, prime);
    const split = F.flatMap((f) => without(f.r, f.l).map((a) => FD.make(f.l, [a])));

    const partial = [];
    for (const k of keys) {
      if (k.length < 2) continue;
      for (const part of subsets(k)) {
        if (part.length === k.length) continue;
        const dep = FD.closure(part, F).filter((a) => nonprime.includes(a) && !part.includes(a));
        for (const a of dep) {
          if (!partial.some((p) => sameSet(p.part, part) && p.attr === a)) partial.push({ part, key: k, attr: a });
        }
      }
    }
    const nf3viol = split.filter((f) => !FD.isSuper(f.l, R, F) && !prime.includes(f.r[0]));
    const bcnfviol = split.filter((f) => !FD.isSuper(f.l, R, F));
    let nf = 'BCNF';
    if (partial.length) nf = '1NF';
    else if (nf3viol.length) nf = '2NF';
    else if (bcnfviol.length) nf = '3NF';
    return { nf, keys, prime, nonprime, partial, nf3viol, bcnfviol };
  };

  // Eine BCNF-Zerlegung Schritt für Schritt: verletzende FD X → Y abspalten.
  FD.bcnfDecompose = function (R, F) {
    const result = [];
    const log = [];
    const walk = (Ri) => {
      const G = FD.project(Ri, F);
      const bad = G.find((f) => !FD.isSuper(f.l, Ri, G));
      if (!bad) {
        result.push(Ri);
        return;
      }
      const hullOfBad = FD.closure(bad.l, G).filter((a) => Ri.includes(a));
      const R1 = FD.sortBy(hullOfBad, Ri);
      const R2 = FD.sortBy(uniq(bad.l.concat(without(Ri, hullOfBad))), Ri);
      log.push({ from: Ri, fd: bad, R1, R2 });
      walk(R1);
      walk(R2);
    };
    walk(R);
    return { schemas: result, log };
  };

  // ---------------------------------------------------------------------------
  // Relationale Algebra (Mengensemantik, Zeilen als Arrays)
  // ---------------------------------------------------------------------------
  const RA = {};
  const rowKey = (row) => JSON.stringify(row);

  RA.rel = function (attrs, rows, name) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const k = rowKey(r);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
    return { name: name || '', attrs: attrs.slice(), rows: out };
  };
  RA.col = (R, a) => {
    const i = R.attrs.indexOf(a);
    if (i < 0) throw new Error('Attribut ' + a + ' fehlt in ' + (R.name || 'der Relation'));
    return i;
  };
  RA.select = (R, pred) => RA.rel(R.attrs, R.rows.filter((row) => pred(Object.fromEntries(R.attrs.map((a, i) => [a, row[i]])))));
  RA.project = function (R, attrs) {
    const idx = attrs.map((a) => RA.col(R, a));
    return RA.rel(attrs, R.rows.map((row) => idx.map((i) => row[i])));
  };
  RA.rename = function (R, map) {
    return RA.rel(R.attrs.map((a) => map[a] || a), R.rows, R.name);
  };
  RA.cross = function (R, S) {
    const attrs = R.attrs.concat(S.attrs);
    const rows = [];
    for (const a of R.rows) for (const b of S.rows) rows.push(a.concat(b));
    return RA.rel(attrs, rows);
  };
  const alignTo = (S, attrs) => RA.project(S, attrs);
  RA.union = function (R, S) {
    const T = S.attrs.every((a) => R.attrs.includes(a)) ? alignTo(S, R.attrs) : S;
    return RA.rel(R.attrs, R.rows.concat(T.rows));
  };
  RA.minus = function (R, S) {
    const T = S.attrs.every((a) => R.attrs.includes(a)) ? alignTo(S, R.attrs) : S;
    const keys = new Set(T.rows.map(rowKey));
    return RA.rel(R.attrs, R.rows.filter((r) => !keys.has(rowKey(r))));
  };
  RA.intersect = function (R, S) {
    const T = S.attrs.every((a) => R.attrs.includes(a)) ? alignTo(S, R.attrs) : S;
    const keys = new Set(T.rows.map(rowKey));
    return RA.rel(R.attrs, R.rows.filter((r) => keys.has(rowKey(r))));
  };
  RA.natural = function (R, S) {
    const common = R.attrs.filter((a) => S.attrs.includes(a));
    const restS = without(S.attrs, common);
    const attrs = R.attrs.concat(restS);
    const ci = common.map((a) => [RA.col(R, a), RA.col(S, a)]);
    const ri = restS.map((a) => RA.col(S, a));
    const rows = [];
    for (const a of R.rows) {
      for (const b of S.rows) {
        if (ci.every(([x, y]) => a[x] === b[y])) rows.push(a.concat(ri.map((i) => b[i])));
      }
    }
    return RA.rel(attrs, rows);
  };
  RA.theta = function (R, S, pred) {
    const attrs = R.attrs.concat(S.attrs);
    const rows = [];
    for (const a of R.rows) {
      for (const b of S.rows) {
        const env = {};
        R.attrs.forEach((n, i) => (env['l.' + n] = a[i]));
        S.attrs.forEach((n, i) => (env['r.' + n] = b[i]));
        if (pred(env)) rows.push(a.concat(b));
      }
    }
    return RA.rel(attrs, rows);
  };
  // Outer Joins über die gleichnamigen Attribute (fehlende Partner werden NULL).
  RA.leftOuter = function (R, S) {
    const J = RA.natural(R, S);
    const matched = RA.project(J, R.attrs);
    const missing = RA.minus(R, matched);
    const restS = without(S.attrs, R.attrs);
    return RA.rel(J.attrs, J.rows.concat(missing.rows.map((r) => r.concat(restS.map(() => null)))));
  };
  RA.rightOuter = function (R, S) {
    const J = RA.natural(R, S);
    const matched = RA.project(J, S.attrs);
    const missing = RA.minus(S, matched);
    const rows = J.rows.slice();
    for (const m of missing.rows) {
      rows.push(J.attrs.map((a) => (S.attrs.includes(a) ? m[S.attrs.indexOf(a)] : null)));
    }
    return RA.rel(J.attrs, rows);
  };
  RA.fullOuter = (R, S) => {
    const L = RA.leftOuter(R, S);
    const Q = RA.rightOuter(R, S);
    return RA.rel(L.attrs, L.rows.concat(Q.rows));
  };
  // Division über die Formel aus dem Skript: π_A(R) − π_A((π_A(R) × S) − R).
  RA.divide = function (R, S) {
    const Z = without(R.attrs, S.attrs);
    const A = RA.project(R, Z);
    const product = RA.cross(A, S);
    const missing = RA.minus(product, R);
    const bad = RA.project(missing, Z);
    const result = RA.minus(A, bad);
    return { Z, A, product, missing, bad, result };
  };
  RA.equal = function (R, S) {
    if (!sameSet(R.attrs, S.attrs)) return false;
    const T = alignTo(S, R.attrs);
    const a = R.rows.map(rowKey).sort();
    const b = T.rows.map(rowKey).sort();
    return a.length === b.length && a.every((k, i) => k === b[i]);
  };
  RA.cell = (v) => (v === null || v === undefined ? 'NULL' : String(v));
  RA.table = (R, title) => ({ title: title || R.name || undefined, head: R.attrs.slice(), rows: R.rows.map((r) => r.map(RA.cell)) });

  // ---------------------------------------------------------------------------
  // ER-Modell in ein relationales Schema überführen (Regeln aus Kapitel 4)
  // ---------------------------------------------------------------------------
  const ERM = {};
  ERM.type = function (name) {
    if (/(ID|Nr|Nummer)$/.test(name) || /^(Menge|Anzahl|Etage|Kapazität|Baujahr|Jahr|Titelanzahl|Sitzplätze|Stockwerk|Plätze|Dauer|Länge)$/.test(name)) return 'integer';
    if (/(datum|Datum)$/.test(name) || name === 'Datum') return 'date';
    if (/(Preis|Note|Betrag|Größe|Gewicht)$/.test(name)) return 'decimal';
    if (/Uhrzeit$/.test(name)) return 'time';
    return 'string';
  };
  ERM.clean = (a) => a.replace(/^[*~/]/, '').replace(/^{|}$/g, '');
  ERM.raw = (a) => (typeof a === 'string' ? a : a.n);
  ERM.toSchema = function (er) {
    const tables = er.ents.map((e) => ({
      name: e.n,
      attrs: (e.attrs || []).map(ERM.raw).map((a) => ({ n: ERM.clean(a), ty: ERM.type(ERM.clean(a)), pk: a.startsWith('*') || a.startsWith('~') })),
      fks: [],
      uniq: []
    }));
    const find = (n) => tables.find((t) => t.name === n);
    const keyAttrs = (n) => find(n).attrs.filter((a) => a.pk);
    for (const r of er.rels || []) {
      const many = (c) => c !== '1';
      const relAttrs = (r.attrs || []).map((a) => ({ n: ERM.clean(a), ty: ERM.type(ERM.clean(a)) }));
      if (many(r.ca) && many(r.cb)) {
        const name = r.table || r.a + '_' + r.b;
        const t = { name, attrs: [], fks: [], uniq: [], link: true };
        for (const side of [r.a, r.b]) {
          for (const k of keyAttrs(side)) {
            t.attrs.push({ n: k.n, ty: k.ty, pk: true });
            t.fks.push(name + '.' + k.n + ' → ' + side + '.' + k.n);
          }
        }
        t.attrs = t.attrs.concat(relAttrs);
        tables.push(t);
      } else {
        // FK auf die viele-Seite, bei 1:1 auf die Seite b (mit UNIQUE).
        const host = many(r.ca) ? r.a : r.fkIn || r.b;
        const other = host === r.a ? r.b : r.a;
        const t = find(host);
        for (const k of keyAttrs(other)) {
          t.attrs.push({ n: k.n, ty: k.ty, fk: true });
          t.fks.push(host + '.' + k.n + ' → ' + other + '.' + k.n);
          if (!many(r.ca) && !many(r.cb)) t.uniq.push(k.n);
        }
        t.attrs = t.attrs.concat(relAttrs);
      }
    }
    return tables.map((t) => {
      const inner = t.attrs.map((a) => (a.pk ? '<u>' + a.n + ': ' + a.ty + '</u>' : a.n + ': ' + a.ty)).join(', ');
      const fk = t.fks.length ? ', FK: ' + t.fks.join(', ') : '';
      const uq = t.uniq.length ? ', UNIQUE(' + t.uniq.join(', ') + ')' : '';
      return { name: t.name, attrs: t.attrs, fks: t.fks, uniq: t.uniq, link: !!t.link, line: t.name + ' (' + inner + ')' + fk + uq };
    });
  };

  // ---------------------------------------------------------------------------
  // Aufgaben-Generatoren für den Trainer. make() liefert eine Frage im Format der module_*.json.
  // ---------------------------------------------------------------------------
  const Calc = {};
  let rng = Math.random;
  Calc.seed = function (s) {
    // Kleiner LCG, nur für reproduzierbare Tests.
    let x = s >>> 0;
    rng = function () {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return x / 4294967296;
    };
  };
  const rnd = (n) => Math.floor(rng() * n);
  const pick = (a) => a[rnd(a.length)];
  const shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const letters = (n) => 'ABCDEFGH'.slice(0, n).split('');
  const braces = (list) => '{ ' + list.join(', ') + ' }';

  // Die Originalklausur soll unverbraucht bleiben: diese FD-Menge wird nie erzeugt.
  const RESERVED_F = [['BD', 'E'], ['A', 'C'], ['C', 'D'], ['E', 'AB']];
  const signature = (F) => F.map((f) => f.l.slice().sort().join('') + '→' + f.r.slice().sort().join('')).sort().join(';');
  function permutations(a) {
    if (a.length < 2) return [a];
    return a.flatMap((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p)));
  }
  const RESERVED_SET = new Set(permutations('ABCDE'.split('')).map((perm) => {
    const map = (s) => s.split('').map((c) => perm['ABCDE'.indexOf(c)]);
    return signature(RESERVED_F.map(([l, r]) => ({ l: map(l), r: map(r) })));
  }));
  // Prüft F und die vereinigte Form: gleiche Struktur mit anderen Buchstaben zählt mit.
  FD.isReserved = (F) => RESERVED_SET.has(signature(F)) || RESERVED_SET.has(signature(FD.unify(F)));
  const RESERVED_FD = 'reserviert';
  const fdSignature = (F) => (FD.isReserved(F) || FD.isReserved(FD.canonical(F).Fc) ? RESERVED_FD : signature(F));

  function randomF(R, count, composite) {
    const F = [];
    for (let i = 0; i < count; i++) {
      const lsize = i === 0 && composite ? 2 : rng() < 0.3 ? 2 : 1;
      const l = FD.sortBy(sample(R, lsize), R);
      const r = FD.sortBy(sample(without(R, l), rng() < 0.3 ? 2 : 1), R);
      if (!F.some((f) => sameSet(f.l, l) && sameSet(f.r, r))) F.push(FD.make(l, r));
    }
    return F;
  }
  const figF = (R, F) => ({ t: 'f', x: 'R(' + R.join(', ') + ')\nF = ' + FD.setStr(F) });

  function hullSteps(X, F, R) {
    const h = FD.hull(X, F);
    const steps = ['Start: Erg = ' + braces(X)];
    for (const s of h.steps) {
      if (s.added.length) steps.push('**' + FD.str(s.fd) + '**: linke Seite in Erg, also dazu: ' + s.added.join(', ') + ' → Erg = ' + braces(FD.sortBy(s.erg, R)));
    }
    steps.push('Ein Durchlauf ohne Änderung, also fertig: **' + FD.hullName(X) + ' = ' + braces(FD.sortBy(h.result, R)) + '**');
    return steps;
  }

  const gens = [];
  const gen = (id, title, group, icon, formula, ref, lvl, pts, make) => gens.push({ id, title, group, icon, formula, ref, lvl, pts, make });
  const base = (id, k, q, extra) => {
    const g = gens.find((x) => x.id === id);
    return Object.assign({ id, k, lvl: g.lvl, pts: g.pts, q, ref: g.ref, src: 'trainer' }, extra);
  };

  gen('calc.closure', 'Attributhülle berechnen', 'Attributhülle & Schlüssel', 'plus.circle', 'Erg := α; Erg ∪= β, wenn α\' ⊆ Erg', 'T6 S.6', 2, 3, () => {
    for (;;) {
      const R = letters(rng() < 0.5 ? 5 : 6);
      const F = randomF(R, 4 + rnd(2));
      if (fdSignature(F) === RESERVED_FD) continue;
      const X = FD.sortBy(sample(R, 1 + rnd(2)), R);
      const h = FD.hull(X, F);
      if (h.result.length < X.length + 2) continue;
      return base('calc.closure', 'ms', 'Berechne die Attributhülle **' + FD.hullName(X) + '**. Wähle alle Attribute der Hülle.', {
        o: R,
        a: R.map((a, i) => (h.result.includes(a) ? i : -1)).filter((i) => i >= 0),
        steps: hullSteps(X, F, R),
        fig: figF(R, F),
        keep: true
      });
    }
  });

  gen('calc.iskey', 'Ist X Kandidatenschlüssel?', 'Attributhülle & Schlüssel', 'key', 'X⁺ = R und X minimal', 'T6 S.14', 2, 3, () => {
    for (;;) {
      const R = letters(5);
      const F = randomF(R, 4 + rnd(2));
      if (fdSignature(F) === RESERVED_FD) continue;
      const keys = FD.keys(R, F);
      const small = keys.filter((k) => k.length <= 2);
      if (!small.length) continue;
      const kind = rnd(3);
      let X;
      if (kind === 0) X = pick(small);
      else if (kind === 1) {
        const others = without(R, pick(small));
        if (!others.length) continue;
        X = FD.sortBy(pick(small).concat(pick(others)), R);
        X = uniq(X);
        if (FD.isKey(X, R, F) || !FD.isSuper(X, R, F)) continue;
      } else {
        const cands = FD.subsets(R).filter((s) => s.length <= 2 && !FD.isSuper(s, R, F));
        if (!cands.length) continue;
        X = pick(cands);
      }
      const name = FD.attrs(X);
      const steps = hullSteps(X, F, R);
      const superOk = FD.isSuper(X, R, F);
      if (!superOk) {
        steps.push('Es fehlen ' + without(R, FD.closure(X, F)).join(', ') + ', also ist ' + name + ' **kein Superschlüssel**.');
      } else if (X.length === 1) {
        steps.push('Hülle = R, und ein einzelnes Attribut ist immer minimal: **Kandidatenschlüssel**.');
      } else {
        for (const a of X) {
          const rest = without(X, [a]);
          steps.push('Minimalität: ' + FD.hullName(rest) + ' = ' + braces(FD.sortBy(FD.closure(rest, F), R)) + (FD.isSuper(rest, R, F) ? ', also reicht ' + FD.attrs(rest) + ' schon aus.' : ', das reicht nicht.'));
        }
      }
      const opts = ['Ja, ' + name + ' ist Kandidatenschlüssel.', 'Nein, ' + FD.hullName(X) + ' enthält nicht alle Attribute.', 'Nein, ' + name + ' ist nur Superschlüssel (nicht minimal).'];
      const correct = kind === 0 ? 0 : kind === 1 ? 2 : 1;
      return base('calc.iskey', 'mc', 'Ist **' + name + '** Kandidatenschlüssel von R? Weise es algorithmisch nach.', { o: opts, a: [correct], steps, fig: figF(R, F) });
    }
  });

  gen('calc.keys', 'Alle Kandidatenschlüssel finden', 'Attributhülle & Schlüssel', 'key.horizontal', 'nur links: immer im Schlüssel', 'T6 S.14', 3, 4, () => {
    for (;;) {
      const R = letters(5);
      const F = randomF(R, 4);
      if (fdSignature(F) === RESERVED_FD) continue;
      const keys = FD.keys(R, F);
      if (keys.length < 1 || keys.some((k) => k.length > 3)) continue;
      const pool = FD.subsets(R).filter((s) => s.length <= 3 && !keys.some((k) => sameSet(k, s)));
      const distract = sample(pool, Math.max(2, 5 - keys.length));
      const items = shuffle(keys.concat(distract));
      const c = FD.classify(R, F);
      const steps = [
        'Nur links oder gar nicht in F (immer Teil jedes Schlüssels): ' + (c.onlyLeft.concat(c.none).join(', ') || 'keine'),
        'Nur rechts (nie Teil eines Schlüssels): ' + (c.onlyRight.join(', ') || 'keine')
      ];
      keys.forEach((k) => steps.push(FD.hullName(k) + ' = ' + braces(FD.sortBy(FD.closure(k, F), R)) + ' = R, und keine echte Teilmenge schafft das.'));
      steps.push('**Kandidatenschlüssel: ' + keys.map(FD.attrs).join(', ') + '**');
      return base('calc.keys', 'ms', 'Welche dieser Attributmengen sind **Kandidatenschlüssel** von R?', {
        o: items.map(FD.attrs),
        a: items.map((s, i) => (keys.some((k) => sameSet(k, s)) ? i : -1)).filter((i) => i >= 0),
        steps,
        fig: figF(R, F)
      });
    }
  });

  // Prüft, ob die Reduktion eindeutig ist: In anderer Reihenfolge muss dasselbe herauskommen.
  const leftRemovals = (log) => log.filter((e) => e.removed).map((e) => FD.attrs(e.fd.l) + ':' + e.x).sort().join('|');
  function rightUnique(F) {
    const forward = FD.rightReduce(F);
    const reversed = FD.rightReduce(F.slice().reverse().map((f) => FD.make(f.l, f.r.slice().reverse())));
    const sig = (G) => G.map((f) => f.l.join('') + '→' + f.r.slice().sort().join('')).sort().join(';');
    return sig(forward.F) === sig(reversed.F);
  }

  gen('calc.left', 'Linksreduktion', 'Kanonische Überdeckung', 'arrow.left.to.line', 'x überflüssig, wenn β ⊆ AH(F, α∖{x})', 'T7 S.23', 3, 4, () => {
    for (;;) {
      const R = letters(5);
      const F = randomF(R, 4, true);
      if (fdSignature(F) === RESERVED_FD) continue;
      const res = FD.leftReduce(F);
      if (!res.log.length) continue;
      const fwd = leftRemovals(res.log);
      const rev = leftRemovals(FD.leftReduce(F.slice().reverse().map((f) => FD.make(f.l.slice().reverse(), f.r))).log);
      if (fwd !== rev) continue;
      if (!res.log.some((e) => e.removed) && rng() < 0.6) continue;
      const options = res.log.map((e) => '**' + e.x + '** in ' + FD.str(e.fd));
      const none = 'Nichts ist überflüssig.';
      const steps = res.log.map((e) => 'Teste ' + e.x + ' in ' + FD.str(e.fd) + ': ' + FD.hullName(e.rest) + ' = ' + braces(FD.sortBy(e.hull, R)) + (e.removed ? ' enthält ' + FD.attrs(e.fd.r) + ', also ist **' + e.x + ' überflüssig**.' : ' enthält ' + FD.attrs(e.fd.r) + ' nicht, also bleibt ' + e.x + '.'));
      const removed = res.log.map((e, i) => (e.removed ? i : -1)).filter((i) => i >= 0);
      return base('calc.left', 'ms', 'Führe die **Linksreduktion** durch. Welche Attribute der linken Seiten sind überflüssig?', {
        o: options.concat(none),
        a: removed.length ? removed : [options.length],
        steps: steps.concat('Ergebnis: ' + FD.setStr(res.F)),
        fig: figF(R, F),
        keep: true
      });
    }
  });

  gen('calc.right', 'Rechtsreduktion', 'Kanonische Überdeckung', 'arrow.right.to.line', 'x überflüssig, wenn x ∈ AH(F′, α)', 'T7 S.23', 3, 4, () => {
    for (;;) {
      const R = letters(5);
      const F = FD.unify(FD.leftReduce(randomF(R, 4)).F);
      if (fdSignature(F) === RESERVED_FD) continue;
      if (!rightUnique(F)) continue;
      const res = FD.rightReduce(F);
      if (res.log.length > 7) continue;
      if (!res.log.some((e) => e.removed) && rng() < 0.6) continue;
      const options = res.log.map((e) => '**' + e.x + '** in ' + FD.str(e.fd));
      const none = 'Nichts ist überflüssig.';
      const steps = res.log.map((e) => 'Teste ' + e.x + ' in ' + FD.str(e.fd) + ': ohne ' + e.x + ' ist ' + FD.hullName(e.fd.l) + ' = ' + braces(FD.sortBy(e.hull, R)) + (e.removed ? ', ' + e.x + ' ist weiter enthalten, also **überflüssig**.' : ', ' + e.x + ' fehlt, also bleibt es.'));
      const removed = res.log.map((e, i) => (e.removed ? i : -1)).filter((i) => i >= 0);
      return base('calc.right', 'ms', 'Die Linksreduktion ist erledigt. Führe die **Rechtsreduktion** durch. Welche Attribute der rechten Seiten sind überflüssig?', {
        o: options.concat(none),
        a: removed.length ? removed : [options.length],
        steps: steps.concat('Ergebnis: ' + FD.setStr(FD.dropEmpty(res.F))),
        fig: figF(R, F),
        keep: true
      });
    }
  });

  gen('calc.canon', 'Kanonische Überdeckung', 'Kanonische Überdeckung', 'checklist', 'links, rechts, leere weg, vereinigen', 'T7 S.23', 3, 5, () => {
    for (;;) {
      const R = letters(5);
      const F = randomF(R, 4 + rnd(2), rng() < 0.7);
      if (fdSignature(F) === RESERVED_FD) continue;
      const leftOnly = FD.leftReduce(F);
      if (leftRemovals(leftOnly.log) !== leftRemovals(FD.leftReduce(F.slice().reverse()).log)) continue;
      if (!rightUnique(leftOnly.F)) continue;
      const can = FD.canonical(F);
      if (fdSignature(can.Fc) === fdSignature(F) && rng() < 0.7) continue;
      const correct = FD.setStr(can.Fc);
      const alt = [FD.setStr(FD.unify(F)), FD.setStr(FD.unify(leftOnly.F))];
      const wrong = can.Fc.map((f, i) => FD.make(f.l, i === 0 ? f.r.slice(0, 1).concat(without(R, f.r.concat(f.l)).slice(0, 1)) : f.r));
      alt.push(FD.setStr(wrong));
      alt.push(FD.setStr(can.Fc.slice(1)));
      const options = uniq([correct].concat(alt)).slice(0, 4);
      if (options.length < 3) continue;
      const steps = [];
      can.left.log.filter((e) => e.removed).forEach((e) => steps.push('Links: **' + e.x + '** in ' + FD.str(e.fd) + ' ist überflüssig.'));
      can.right.log.filter((e) => e.removed).forEach((e) => steps.push('Rechts: **' + e.x + '** in ' + FD.str(e.fd) + ' ist überflüssig.'));
      if (!steps.length) steps.push('Weder links noch rechts ist etwas überflüssig.');
      steps.push('FDs mit leerer rechter Seite streichen, gleiche linke Seiten vereinigen.');
      steps.push('**F_{c} = ' + correct + '**');
      return base('calc.canon', 'mc', 'Welche Menge ist die **kanonische Überdeckung** von F?', { o: options, a: [0], steps, fig: figF(R, F) });
    }
  });

  gen('calc.nf', 'Höchste Normalform bestimmen', 'Normalformen', 'stairs', '2NF: Teilschlüssel, 3NF: Nichtschlüssel, BCNF: Superschlüssel', 'T7 S.9', 3, 4, () => {
    const target = pick(['1NF', '2NF', '3NF', 'BCNF']);
    for (;;) {
      const R = letters(rng() < 0.6 ? 4 : 5);
      const F = randomF(R, 2 + rnd(3));
      if (fdSignature(F) === RESERVED_FD) continue;
      const nf = FD.normalForm(R, F);
      if (nf.nf !== target || nf.keys.some((k) => k.length > 3)) continue;
      const steps = [
        'Kandidatenschlüssel: **' + nf.keys.map(FD.attrs).join(', ') + '**',
        'Schlüsselattribute: ' + (nf.prime.join(', ') || 'keine') + '. Nichtschlüsselattribute: ' + (nf.nonprime.join(', ') || 'keine')
      ];
      if (nf.partial.length) {
        const p = nf.partial[0];
        steps.push('2NF verletzt: ' + p.attr + ' hängt nur vom Teilschlüssel ' + FD.attrs(p.part) + ' ab (Schlüssel ' + FD.attrs(p.key) + ').');
      } else {
        steps.push('2NF erfüllt: Kein Nichtschlüsselattribut hängt von einem echten Teil eines Schlüssels ab.');
        if (nf.nf3viol.length) {
          const f = nf.nf3viol[0];
          steps.push('3NF verletzt: ' + FD.str(f) + ', denn ' + FD.attrs(f.l) + ' ist kein Superschlüssel und ' + f.r[0] + ' kein Schlüsselattribut.');
        } else {
          steps.push('3NF erfüllt: Jede FD hat links einen Superschlüssel oder rechts ein Schlüsselattribut.');
          if (nf.bcnfviol.length) steps.push('BCNF verletzt: ' + FD.str(nf.bcnfviol[0]) + ', denn ' + FD.attrs(nf.bcnfviol[0].l) + ' ist kein Superschlüssel.');
          else steps.push('BCNF erfüllt: Jede linke Seite ist ein Superschlüssel.');
        }
      }
      steps.push('**Höchste erfüllte Normalform: ' + nf.nf + '**');
      return base('calc.nf', 'mc', 'Alle Werte sind atomar (1NF). Welche **höchste Normalform** erfüllt R?', {
        o: ['1NF', '2NF', '3NF', 'BCNF'],
        a: [['1NF', '2NF', '3NF', 'BCNF'].indexOf(nf.nf)],
        steps,
        fig: figF(R, F),
        keep: true
      });
    }
  });

  const DIV_THEMES = [
    { rel: 'Fahrerlaubnis', a: 'Fahrer', b: 'Klasse', people: ['Aydin', 'Berger', 'Conti', 'Dogan', 'Esser'], items: ['A', 'BE', 'C1', 'D', 'T'], verb: 'dürfen alle Klassen fahren, die auch' },
    { rel: 'Schulung', a: 'Mitarbeiter', b: 'Thema', people: ['Noether', 'Gauß', 'Lovelace', 'Hopper', 'Knuth'], items: ['SQL', 'Git', 'Scrum', 'Docker', 'Java'], verb: 'haben alle Schulungen besucht, die auch' },
    { rel: 'Rezept', a: 'Gericht', b: 'Zutat', people: ['Risotto', 'Pizza', 'Quiche', 'Lasagne', 'Curry'], items: ['Käse', 'Zwiebel', 'Reis', 'Tomate', 'Ei'], verb: 'enthalten alle Zutaten, die auch' },
    { rel: 'Besetzung', a: 'Musiker', b: 'Instrument', people: ['Holst', 'Elgar', 'Ravel', 'Satie', 'Bizet'], items: ['Cello', 'Horn', 'Oboe', 'Harfe', 'Pauke'], verb: 'spielen alle Instrumente, die auch' },
    { rel: 'Angebot', a: 'Werkstatt', b: 'Leistung', people: ['Nord', 'Süd', 'West', 'Ost', 'Mitte'], items: ['Ölwechsel', 'TÜV', 'Reifen', 'Lack', 'Klima'], verb: 'bieten alle Leistungen an, die auch' }
  ];

  Calc.divisionTask = function () {
    for (;;) {
      const t = pick(DIV_THEMES);
      const people = sample(t.people, 4);
      const items = sample(t.items, 4);
      const target = people[3];
      const need = sample(items, 2 + rnd(2));
      const rows = [];
      for (const p of people) {
        const owned = p === target ? need : items.filter(() => rng() < 0.55);
        owned.forEach((i) => rows.push([p, i]));
      }
      const R = RA.rel([t.a, t.b], rows, t.rel);
      const S = RA.rel([t.b], need.map((i) => [i]), 'S');
      const d = RA.divide(R, S);
      const others = d.result.rows.map((r) => r[0]).filter((p) => p !== target);
      if (d.A.rows.length !== 4 || others.length < 1 || d.bad.rows.length < 1) continue;
      R.rows = R.rows.slice().sort((a, b) => people.indexOf(a[0]) - people.indexOf(b[0]));
      return { theme: t, people, target, R, S, d };
    }
  };

  gen('calc.division', 'Division mit Zwischenergebnissen', 'Relationale Algebra', 'divide', 'π_{A}(R) − π_{A}((π_{A}(R) × S) − R)', 'T5 S.21', 3, 5, () => {
    const task = Calc.divisionTask();
    const { theme: t, target, R, S, d, people } = task;
    const list = (rel) => rel.rows.map((r) => r.join(' / ')).join(', ') || '∅';
    const steps = [
      'S = π_{' + t.b + '}(σ_{' + t.a + '=' + target + '}(R)) = {' + list(S) + '}',
      'A = π_{' + t.a + '}(R) = {' + list(d.A) + '}',
      'A × S hat ' + d.product.rows.length + ' Tupel: ' + list(d.product),
      '(A × S) − R, die fehlenden Kombinationen: ' + list(d.missing),
      'π_{' + t.a + '}((A × S) − R), die Kandidaten mit Lücke: {' + list(d.bad) + '}',
      '**R ÷ S = A − {' + list(d.bad) + '} = {' + list(d.result) + '}**',
      target + ' selbst erfüllt die Bedingung trivial und steht deshalb auch im Ergebnis.'
    ];
    return base('calc.division', 'ms', 'Welche **' + t.a + '**-Werte ' + t.verb + ' **' + target + '**? Bestimme **R ÷ S** mit S = π_{' + t.b + '}(σ_{' + t.a + '=' + target + '}(R)).', {
      o: people,
      a: people.map((p, i) => (d.result.rows.some((r) => r[0] === p) ? i : -1)).filter((i) => i >= 0),
      steps,
      fig: { t: 'rels', tabs: [RA.table(R, 'Relation R = ' + t.rel)] },
      keep: true
    });
  });

  gen('calc.rows', 'Wie viele Zeilen hat das Ergebnis?', 'Relationale Algebra', 'tablecells', '|R × S| = |R| · |S|', 'T5 S.8', 1, 2, () => {
    const kind = pick(['cross', 'project', 'union', 'minus', 'natural']);
    const rowsR = 3 + rnd(3);
    const rowsS = 2 + rnd(3);
    const vals = ['a', 'b', 'c', 'd'];
    const R = RA.rel(['A', 'B'], Array.from({ length: rowsR }, () => [1 + rnd(3), pick(vals)]));
    const S = kind === 'natural'
      ? RA.rel(['B', 'C'], Array.from({ length: rowsS }, () => [pick(vals), 10 + rnd(3)]))
      : RA.rel(['A', 'B'], Array.from({ length: rowsS }, () => [1 + rnd(3), pick(vals)]));
    const fig = { t: 'rels', tabs: [RA.table(R, 'R'), RA.table(S, 'S')] };
    const nR = R.rows.length;
    const nS = S.rows.length;
    let expr, res, steps;
    if (kind === 'cross') {
      expr = 'R × S';
      res = RA.cross(R, S);
      steps = ['Jede Zeile von R mit jeder Zeile von S kombinieren: ' + nR + ' · ' + nS + ' = **' + res.rows.length + '**'];
    } else if (kind === 'project') {
      expr = 'π_B(R)';
      res = RA.project(R, ['B']);
      steps = ['Nur Spalte B behalten: ' + R.rows.map((r) => r[1]).join(', '), 'Duplikate fallen in der Algebra weg: **' + res.rows.length + '** verschiedene Werte'];
    } else if (kind === 'union') {
      expr = 'R ∪ S';
      res = RA.union(R, S);
      steps = [nR + ' + ' + nS + ' Zeilen, gemeinsame Zeilen zählen nur einmal: **' + res.rows.length + '**'];
    } else if (kind === 'minus') {
      expr = 'R − S';
      res = RA.minus(R, S);
      steps = ['Alle Zeilen aus R, die nicht in S stehen: **' + res.rows.length + '**'];
    } else {
      expr = 'R ⋈ S';
      res = RA.natural(R, S);
      steps = ['Verbund über das gemeinsame Attribut B: Zeilen mit gleichem B kombinieren: **' + res.rows.length + '**'];
    }
    return base('calc.rows', 'num', 'Wie viele Zeilen hat **' + expr + '**?', { num: res.rows.length, tol: 0.01, unit: 'Zeilen', steps, fig });
  });

  const CARD_SENTENCES = [
    ['Jede Mannschaft hat genau einen Kapitän. Jeder Kapitän führt genau eine Mannschaft.', 'Mannschaft', 'Kapitän', '1:1'],
    ['Eine Filiale beschäftigt viele Angestellte. Jeder Angestellte arbeitet in genau einer Filiale.', 'Filiale', 'Angestellter', '1:N'],
    ['Ein Student belegt mehrere Kurse. Ein Kurs wird von vielen Studenten belegt.', 'Student', 'Kurs', 'N:M'],
    ['Ein Land hat genau eine Hauptstadt. Eine Hauptstadt gehört zu genau einem Land.', 'Land', 'Hauptstadt', '1:1'],
    ['Ein Regisseur dreht viele Filme. Jeder Film hat hier genau einen Regisseur.', 'Regisseur', 'Film', '1:N'],
    ['Ein Rezept enthält mehrere Zutaten. Eine Zutat kommt in vielen Rezepten vor.', 'Rezept', 'Zutat', 'N:M'],
    ['Jeder Hörsaal liegt in genau einem Gebäude. Ein Gebäude hat viele Hörsäle.', 'Gebäude', 'Hörsaal', '1:N'],
    ['Ein Arzt behandelt viele Patienten. Ein Patient wird von mehreren Ärzten behandelt.', 'Arzt', 'Patient', 'N:M'],
    ['Eine Rechnung gehört zu genau einem Auftrag. Ein Auftrag hat genau eine Rechnung.', 'Auftrag', 'Rechnung', '1:1'],
    ['Ein Verlag veröffentlicht viele Bücher. Jedes Buch erscheint bei genau einem Verlag.', 'Verlag', 'Buch', '1:N']
  ];

  gen('calc.card', 'Kardinalität aus dem Text ablesen', 'ER & Relationen', 'link', '1:1, 1:N, N:M', 'T3 S.15', 1, 2, () => {
    const [text, a, b, card] = pick(CARD_SENTENCES);
    const opts = ['1:1', '1:N', 'N:M'];
    const why = {
      '1:1': 'Beide Sätze sagen „genau ein“.',
      '1:N': 'Eine Seite hat viele Partner, die andere genau einen. Das N steht auf der Seite, von der es viele gibt.',
      'N:M': 'Beide Seiten können mehrere Partner haben.'
    };
    return base('calc.card', 'mc', text + '\nWelche Kardinalität hat die Beziehung **' + a + ' – ' + b + '**?', { o: opts, a: [opts.indexOf(card)], steps: [why[card]] });
  });

  gen('calc.fk', 'Wohin kommt der Fremdschlüssel?', 'ER & Relationen', 'arrow.triangle.branch', 'FK auf die „viele“-Seite', 'T4 S.17', 2, 2, () => {
    const [text, a, b, card] = pick(CARD_SENTENCES);
    const n = card === '1:N' ? b : null;
    const opts = ['In ' + a + ' (Verweis auf ' + b + ')', 'In ' + b + ' (Verweis auf ' + a + ')', 'Eigene Verknüpfungstabelle mit beiden Schlüsseln', 'In einer der beiden Tabellen, zusätzlich UNIQUE'];
    let correct, why;
    if (card === 'N:M') {
      correct = 2;
      why = 'Bei N:M gibt es auf beiden Seiten viele Partner, ein Fremdschlüssel in einer Tabelle würde Zeilen verdoppeln. Der zusammengesetzte Primärschlüssel der Verknüpfungstabelle verhindert doppelte Paare.';
    } else if (card === '1:1') {
      correct = 3;
      why = 'Bei 1:1 darf der Fremdschlüssel in einer der beiden Relationen stehen. UNIQUE stellt sicher, dass jeder Wert nur einmal vorkommt.';
    } else {
      correct = 1;
      why = 'Der Fremdschlüssel steht auf der Seite mit „viele“, hier also in ' + n + '.';
    }
    return base('calc.fk', 'mc', text + '\nWo steht der **Fremdschlüssel**?', { o: opts, a: [correct], steps: [why] });
  });

  Calc.list = () => gens.map(({ id, title, group, icon, formula, ref, lvl, pts }) => ({ id, title, group, icon, formula, ref, lvl, pts }));
  Calc.groups = () => uniq(gens.map((g) => g.group));
  Calc.has = (id) => gens.some((g) => g.id === id);
  Calc.make = function (id) {
    const g = gens.find((x) => x.id === id);
    if (!g) throw new Error('Unbekannter Aufgabentyp ' + id);
    return g.make();
  };
  Calc.pick = pick;
  Calc.shuffle = shuffle;

  root.DBEngine = { FD, RA, ERM, Calc };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DBEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
