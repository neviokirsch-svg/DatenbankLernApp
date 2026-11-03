// Labore zu Grundlagen und Modellierung: Anomalien, Drei-Ebenen, Modelle, CAP, Vektorsuche, Kardinalitäten, ER-Builder, ER → Relationen, Löschregeln.
(function () {
  'use strict';
  const { Calc, ERM } = DBEngine;
  const Labs = window.DBLabs;

  // ---------------------------------------------------------------------------
  Labs.anomalies = function (host) {
    const HEAD = ['Projekt', 'Projektleiter', 'Mitarbeiter', 'Abteilung', 'Telefon'];
    const BASE = [
      ['Portal-Relaunch', 'Meier, Anna', 'Schmidt, Jan', 'IT', '0711-123'],
      ['Portal-Relaunch', 'Meier, Anna', 'Weber, Lea', 'Vertrieb', '0711-456'],
      ['CRM-Einführung', 'Weber, Lea', 'Weber, Lea', 'Vertrieb', '0711-456'],
      ['Datenmigration', 'Meier, Anna', 'Schmidt, Jan', 'IT', '0711-123']
    ];
    const stage = h('div', { class: 'stack' });
    const show = (rows, rowClass, cellClass, text, kind) => stage.replaceChildren(relTable({ title: 'Excel-Liste „Projekte“', head: HEAD, rows }, { rowClass, cellClass }), caption(text, kind));
    const cases = {
      start: () => show(BASE, null, null, 'Eine einzige Tabelle: Jede Zeile mischt Projekt- und Mitarbeiterdaten. Wähle oben einen Fall aus dem Tagesgeschäft.'),
      insert: () => show(BASE.concat([['NULL', 'NULL', 'Aydin, Can', 'IT', '0711-789']]), (r) => (r === 4 ? 'bad new' : null), null, '**Einfügeanomalie:** Can Aydin ist neu und noch in keinem Projekt. Ohne Projektangaben lässt er sich nicht sauber erfassen, die Zeile bleibt halb leer oder braucht ein erfundenes Projekt.', 'bad'),
      update: () => {
        const rows = BASE.map((r) => r.slice());
        rows[0][4] = '0711-999';
        show(rows, (r) => (r === 0 || r === 3 ? 'warn' : null), (r, c) => (c === 4 && (r === 0 || r === 3) ? 'hl' : null), '**Änderungsanomalie:** Jan Schmidt hat eine neue Nummer. Die Änderung traf nur Zeile 1, Zeile 4 zeigt noch die alte. Jetzt widersprechen sich die Daten.', 'bad');
      },
      remove: () => {
        const rows = BASE.filter((r) => r[2] !== 'Weber, Lea');
        show(rows, () => 'new', null, '**Löschanomalie:** Lea Weber verlässt das Unternehmen, also werden ihre Zeilen gelöscht. Damit verschwindet auch das Projekt **CRM-Einführung** und die Information über die Abteilung **Vertrieb**, obwohl beides unabhängig von ihr existiert.', 'bad');
      },
      split: () => stage.replaceChildren(
        relGroup([
          { title: 'Projekt', head: ['<u>PNr</u>', 'Name', 'LeiterNr'], rows: [['1', 'Portal-Relaunch', '10'], ['2', 'CRM-Einführung', '12'], ['3', 'Datenmigration', '10']] },
          { title: 'Mitarbeiter', head: ['<u>MNr</u>', 'Name', 'Abteilung', 'Telefon'], rows: [['10', 'Meier, Anna', 'IT', '0711-100'], ['11', 'Schmidt, Jan', 'IT', '0711-123'], ['12', 'Weber, Lea', 'Vertrieb', '0711-456'], ['13', 'Aydin, Can', 'IT', '0711-789']] },
          { title: 'Zuordnung', head: ['<u>PNr</u>', '<u>MNr</u>'], rows: [['1', '11'], ['1', '12'], ['2', '12'], ['3', '11']] }
        ]),
        caption('**Mehrere verknüpfte Tabellen:** Jede Information steht genau einmal. Can Aydin lässt sich ohne Projekt anlegen, eine neue Telefonnummer ändert genau eine Zelle, und das Projekt überlebt, wenn Lea Weber geht. Beziehungen laufen über Schlüssel.', 'ok'))
    };
    host.append(vizCard('Labor: Drei Anomalien im Tagesgeschäft',
      h('div', { class: 'btns' },
        h('button', { type: 'button', class: 'btn s', onclick: cases.insert }, 'Neuer Mitarbeiter ohne Projekt'),
        h('button', { type: 'button', class: 'btn s', onclick: cases.update }, 'Telefonnummer ändert sich'),
        h('button', { type: 'button', class: 'btn s', onclick: cases.remove }, 'Mitarbeiterin verlässt die Firma'),
        h('button', { type: 'button', class: 'btn s pri', onclick: cases.split }, 'Lösung: drei Tabellen')),
      stage));
    cases.start();
  };

  // ---------------------------------------------------------------------------
  Labs.threelevel = function (host) {
    const tiers = {
      ext: h('div', { class: 'tier' }, h('b', null, 'Externe Ebene'), h('span', null, 'View Vertrieb · View Buchhaltung · View Webshop')),
      kon: h('div', { class: 'tier' }, h('b', null, 'Konzeptuelle Ebene'), h('span', null, 'Gesamtschema: Objekttypen und Relationen, definiert mit DDL')),
      int: h('div', { class: 'tier' }, h('b', null, 'Interne Ebene'), h('span', null, 'Physische Speicherung, Indexstrukturen, Aufbau der Datensätze'))
    };
    const logi = h('div', { class: 'conn' }, 'logische Datenunabhängigkeit');
    const phys = h('div', { class: 'conn' }, 'physische Datenunabhängigkeit');
    const cap = h('div');
    const scenarios = [
      { label: 'Neuer Index auf KURS.KNR', hit: 'int', safe: ['kon', 'ext'], conn: phys, text: 'Nur die **interne Ebene** ändert sich. Schema und Views merken nichts: **physische Datenunabhängigkeit**.' },
      { label: 'Daten ziehen auf eine SSD um', hit: 'int', safe: ['kon', 'ext'], conn: phys, text: 'Die Speicherung ändert sich, alle Programme laufen unverändert weiter: **physische Datenunabhängigkeit**.' },
      { label: 'Neue View für die Buchhaltung', hit: 'ext', safe: ['kon', 'int'], conn: logi, text: 'Eine neue Sicht entsteht auf der **externen Ebene**. Das Gesamtschema bleibt gleich: **logische Datenunabhängigkeit**.' },
      { label: 'Neue Spalte in Tabelle KUNDE', hit: 'kon', safe: ['ext'], conn: logi, text: 'Das **konzeptuelle Schema** wird erweitert. Bestehende Views und ihre Anwendungen laufen weiter: **logische Datenunabhängigkeit**.' }
    ];
    const pick = (s) => {
      Object.values(tiers).forEach((t) => (t.className = 'tier'));
      tiers[s.hit].className = 'tier hit';
      s.safe.forEach((k) => (tiers[k].className = 'tier safe'));
      logi.className = 'conn' + (s.conn === logi ? ' on' : '');
      phys.className = 'conn' + (s.conn === phys ? ' on' : '');
      cap.replaceChildren(caption(s.text));
    };
    host.append(vizCard('Labor: Was ändert sich wo?',
      h('div', { class: 'btns' }, scenarios.map((s) => h('button', { type: 'button', class: 'btn s', onclick: () => pick(s) }, s.label))),
      h('div', { class: 'stack-s', style: 'gap:2px' }, tiers.ext, logi, tiers.kon, phys, tiers.int),
      cap));
    pick(scenarios[0]);
  };

  // ---------------------------------------------------------------------------
  const net = (nodes, edges, H) => {
    const W = 320;
    const nodeOf = Object.fromEntries(nodes.map((n) => [n[0], n]));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Skizze des Datenmodells" style="max-width:380px;margin:auto">';
    edges.forEach(([a, b, l]) => {
      const A = nodeOf[a];
      const B = nodeOf[b];
      s += '<line class="edge" x1="' + A[2] + '" y1="' + A[3] + '" x2="' + B[2] + '" y2="' + B[3] + '"/>';
      if (l) s += '<text x="' + (A[2] + B[2]) / 2 + '" y="' + ((A[3] + B[3]) / 2 - 4) + '" font-size="9" text-anchor="middle" opacity=".75">' + l + '</text>';
    });
    nodes.forEach((n) => {
      const w = Math.max(40, n[1].length * 6.2 + 10);
      s += '<rect class="node-box" x="' + (n[2] - w / 2) + '" y="' + (n[3] - 11) + '" width="' + w + '" height="22" rx="' + (n[4] ? 11 : 5) + '"/><text x="' + n[2] + '" y="' + (n[3] + 3.5) + '" font-size="10.5" text-anchor="middle">' + n[1] + '</text>';
    });
    return s + '</svg>';
  };
  const MODELS = [
    { id: 'hier', n: 'Hierarchisch', pic: net([['k', 'Kunde', 160, 18], ['r1', 'Rechnung 1', 70, 66], ['r2', 'Rechnung 2', 250, 66], ['a1', 'Art1', 30, 114], ['a2', 'Art2', 110, 114], ['a3', 'Art1', 210, 114], ['a4', 'Art3', 290, 114]], [['k', 'r1'], ['k', 'r2'], ['r1', 'a1'], ['r1', 'a2'], ['r2', 'a3'], ['r2', 'a4']], 130), str: 'Baum, 1:n vom Vater zum Kind', pro: 'Sehr schnelle Navigation, einfach', con: 'Keine n:m-Beziehungen, starr', sys: 'IMS, Windows-Registry', when: 'feste Baumstruktur, Altsysteme' },
    { id: 'netz', n: 'Netzwerk', pic: net([['k1', 'Kunde 1', 90, 18], ['k2', 'Kunde 2', 230, 18], ['b1', 'Auftrag 1', 50, 66], ['b2', 'Auftrag 2', 160, 66], ['b3', 'Auftrag 3', 270, 66], ['a1', 'Artikel 1', 90, 114], ['a2', 'Artikel 2', 230, 114]], [['k1', 'b1'], ['k1', 'b2'], ['k2', 'b2'], ['k2', 'b3'], ['b1', 'a1'], ['b2', 'a1'], ['b2', 'a2'], ['b3', 'a2']], 130), str: 'Netz aus verketteten Sätzen', pro: 'n:m möglich, mehrere Zugriffswege', con: 'Unübersichtlich, navigierender Zugriff', sys: 'IDMS, UDS', when: 'Altsysteme (CODASYL)' },
    { id: 'rel', n: 'Relational', pic: net([['p', 'PERSON (PNR, RNR)', 90, 40], ['r', 'ROLLE (RNR, ...)', 240, 40], ['b', 'BELEGUNG (PNR, KNR)', 90, 96], ['k', 'KURS (KNR, TNR)', 240, 96]], [['p', 'r', 'FK RNR'], ['b', 'p', 'FK PNR'], ['b', 'k', 'FK KNR']], 124), str: 'Tabellen (Relationen), Schlüssel', pro: 'Standard SQL, Konsistenz, ausgereift', con: 'Starres Schema, Joins bei vielen Ebenen', sys: 'Oracle, PostgreSQL, MySQL', when: 'Transaktionen, Integrität, Buchhaltung' },
    { id: 'oo', n: 'Objektorientiert', pic: net([['c', 'Objektklasse', 160, 18], ['o1', 'Objekt 1', 70, 66], ['o2', 'Objekt 2', 250, 66], ['m1', 'Methode 1', 70, 114], ['m2', 'Methode 2', 250, 114]], [['c', 'o1'], ['c', 'o2'], ['o1', 'm1'], ['o2', 'm2']], 130), str: 'Objekte mit Methoden und Vererbung', pro: 'Nahe an der Programmierung', con: 'Kaum Verbreitung, wenig Standard', sys: 'db4o, ObjectDB', when: 'komplexe Objekte, CAD' },
    { id: 'doc', n: 'Dokumentenorientiert', pic: net([['c', 'Collection', 50, 66], ['d1', '{ kundennr, name }', 200, 22], ['d2', '{ name, adresse: {...} }', 200, 66], ['d3', '{ name, bestellungen: [...] }', 200, 110]], [['c', 'd1'], ['c', 'd2'], ['c', 'd3']], 130), str: 'Dokumente (JSON/BSON) in Collections', pro: 'Flexibles Schema, gut verschachtelbar', con: 'Redundanz, schwache Integritätsprüfung', sys: 'MongoDB, CouchDB', when: 'unterschiedliche Felder je Objekt' },
    { id: 'graph', n: 'Graph', pic: net([['k', 'Meier', 60, 66, 1], ['a', 'Maus', 170, 22, 1], ['b', 'Tastatur', 170, 110, 1], ['m', 'Marke X', 285, 66, 1]], [['k', 'a', 'HAT_BESTELLT'], ['k', 'b', 'HAT_BESTELLT'], ['a', 'm', 'HAS_BRAND'], ['b', 'm', 'HAS_BRAND']], 130), str: 'Knoten, Kanten, Properties', pro: 'Beziehungsabfragen sehr schnell', con: 'Kein SQL-Standard, Sharding schwierig', sys: 'Neo4j, Neptune', when: 'Netzwerke, Empfehlungen, Wege' },
    { id: 'kv', n: 'Key-Value', pic: net([['k1', 'session:42', 70, 24], ['v1', '{ warenkorb: [...] }', 225, 24], ['k2', 'zähler:home', 70, 66], ['v2', '1834', 225, 66], ['k3', 'user:7', 70, 108], ['v3', '[Byte-Array]', 225, 108]], [['k1', 'v1'], ['k2', 'v2'], ['k3', 'v3']], 130), str: 'Schlüssel → Wert', pro: 'Sehr schnelle Zugriffe', con: 'Keine Suche über Werte', sys: 'Redis, DynamoDB', when: 'Sessions, Caches, Warenkörbe' },
    { id: 'col', n: 'Wide Column', pic: net([['r1', 'Zeile a', 40, 28], ['c1', 'temp', 120, 28], ['c2', 'druck', 190, 28], ['r2', 'Zeile b', 40, 74], ['c3', 'temp', 120, 74], ['c4', 'akku', 190, 74], ['c5', 'gps', 260, 74], ['r3', 'Zeile c', 40, 118], ['c6', 'druck', 120, 118]], [], 136), str: 'Zeilen mit Spaltenfamilien', pro: 'Lineare Skalierung, Analytik', con: 'Abfragen müssen vorab bedacht werden', sys: 'Cassandra, HBase, Bigtable', when: 'Zeitreihen, Logs, Sensordaten' },
    { id: 'vec', n: 'Vektor', pic: net([['q', 'Anfrage', 160, 66, 1], ['a', 'Rucksack', 80, 26, 1], ['b', 'Tagesrucksack', 250, 28, 1], ['c', 'Wanderschuh', 70, 112, 1], ['d', 'Zelt', 250, 108, 1]], [['q', 'a', '0,91'], ['q', 'b', '0,88'], ['q', 'c', '0,62'], ['q', 'd', '0,59']], 130), str: 'Embeddings als Zahlenvektoren', pro: 'Ähnlichkeitssuche, KI/RAG', con: 'Approximative Treffer, ressourcenhungrig', sys: 'Milvus, Qdrant, pgvector', when: 'semantische Suche, Empfehlungen' }
  ];
  Labs.models = function (host) {
    const stage = h('div', { class: 'stack' });
    const draw = (id) => {
      const m = MODELS.find((x) => x.id === id);
      stage.replaceChildren(
        h('div', { class: 'dia-scroll', html: m.pic }),
        relTable({ head: ['Merkmal', m.n], rows: [['Struktur', m.str], ['Stärke', m.pro], ['Schwäche', m.con], ['Systeme', m.sys], ['Passt für', m.when]] }, { data: false }));
    };
    const sel = h('select', { 'aria-label': 'Datenmodell wählen', id: 'mod-' + Math.random().toString(36).slice(2, 7), onchange: (e) => draw(e.target.value) }, MODELS.map((m) => h('option', { value: m.id }, m.n)));
    host.append(vizCard('Labor: Neun Datenmodelle im Vergleich', sel, stage));
    draw(MODELS[0].id);
  };

  // ---------------------------------------------------------------------------
  // CAP am Beispiel aus dem Skript: das letzte Stück im Lager.
  Labs.cap = function (host) {
    const fig = h('div', { class: 'dia-scroll' });
    const cap = h('div');
    const btns = h('div', { class: 'btns' });
    const draw = (st) => {
      const broken = st.broken;
      const col = (v) => (v < 0 ? 'var(--bad)' : 'currentColor');
      const box = (x, name, stock, note, hl) =>
        '<rect class="' + (hl === 'bad' ? 'node-bad' : hl === 'good' ? 'node-good' : 'node-box') + '" x="' + x + '" y="24" width="122" height="84" rx="10"/>' +
        '<text x="' + (x + 61) + '" y="46" font-size="12" font-weight="700" text-anchor="middle">' + name + '</text>' +
        '<text x="' + (x + 61) + '" y="72" font-size="19" font-weight="700" text-anchor="middle" style="fill:' + col(stock) + '">' + stock + '</text>' +
        '<text x="' + (x + 61) + '" y="97" font-size="10.5" text-anchor="middle" opacity=".85">' + note + '</text>';
      fig.innerHTML = '<svg viewBox="0 0 360 132" role="img" aria-label="Zwei Rechenzentren mit Kopie des Lagerbestands" style="max-width:480px;margin:auto">' +
        box(8, 'Stuttgart', st.s, st.sNote || 'Bestand', st.sHl) + box(230, 'Hamburg', st.h, st.hNote || 'Bestand', st.hHl) +
        '<line class="' + (broken ? 'edge-gone' : 'edge') + '" x1="130" y1="66" x2="230" y2="66"/>' +
        (broken ? '<text x="180" y="58" font-size="11" text-anchor="middle" font-weight="700" style="fill:var(--bad)">Kabel gerissen</text>' : '<text x="180" y="58" font-size="11" text-anchor="middle" opacity=".7">synchron</text>') +
        '</svg>';
      cap.replaceChildren(caption(st.text, st.kind));
      btns.replaceChildren(...(st.actions || []).map((a) => h('button', { type: 'button', class: 'btn s' + (a.pri ? ' pri' : ''), onclick: a.go }, a.label)));
    };
    const start = () => draw({ s: 1, h: 1, text: 'Von einem Artikel ist genau **1 Stück** auf Lager. Beide Rechenzentren halten eine Kopie des Bestands, das Netz ist intakt.', actions: [{ label: 'Kabel kappen', pri: true, go: cut }] });
    const cut = () => draw({ s: 1, h: 1, broken: true, text: 'Eine **Partition** ist passiert: Die Knoten erreichen sich nicht mehr. Ein Kunde will in Hamburg kaufen. Was soll Hamburg tun?', kind: 'warn', actions: [{ label: 'Option A: trotzdem antworten', go: ap }, { label: 'Option B: verweigern', go: cp }] });
    const ap = () => draw({ s: 0, h: 0, broken: true, sNote: 'verkauft!', hNote: 'verkauft!', sHl: 'bad', hHl: 'bad', text: '**AP, Availability vor Consistency:** Hamburg verkauft, ohne Stuttgart zu fragen. Stuttgart verkauft im selben Moment dasselbe Stück. Zwei Kunden, ein Artikel. Die Kopien widersprechen sich.', kind: 'bad', actions: [{ label: 'Kabel reparieren', pri: true, go: () => draw({ s: 0, h: 0, sHl: 'good', hHl: 'good', text: '**BASE, eventually consistent:** Nach der Reparatur führt das System die Kopien zusammen und ein Kunde bekommt eine Absage. Der Zustand war vorübergehend abweichend.', kind: 'ok', actions: [{ label: 'Von vorn', go: start }] }) }] });
    const cp = () => draw({ s: 1, h: 1, broken: true, hNote: 'nicht möglich', hHl: 'bad', text: '**CP, Consistency vor Availability:** Hamburg antwortet „gerade nicht möglich“. Es gibt keine falschen Daten, aber der Shop ist nicht benutzbar, solange Stuttgart nicht erreichbar ist.', kind: 'warn', actions: [{ label: 'Kabel reparieren', pri: true, go: () => draw({ s: 1, h: 1, text: 'Das Netz ist wieder intakt, das System antwortet konsistent **und** verfügbar. Der Kompromiss greift nur im Fehlerfall. Ohne Verteilung (CA) gäbe es diese Wahl nicht, dann ist es die klassische relationale Datenbank auf einem Knoten.', kind: 'ok', actions: [{ label: 'Von vorn', go: start }] }) }] });
    host.append(vizCard('Labor: Das letzte Stück im Lager', fig, cap, btns));
    start();
  };

  // ---------------------------------------------------------------------------
  // Ähnlichkeitssuche im Embedding-Raum, stark vereinfacht auf zwei Dimensionen.
  Labs.vector = function (host) {
    const P = [['Tagesrucksack', 0.62, 0.84], ['Wanderrucksack', 0.72, 0.8], ['Trekkingrucksack', 0.8, 0.86], ['Schlafsack', 0.86, 0.66], ['Zelt', 0.93, 0.56], ['Wanderschuh', 0.58, 0.62], ['Laufschuh', 0.42, 0.68], ['Sandale', 0.3, 0.74], ['Wälzlager', 0.86, 0.12], ['Rollenlager', 0.75, 0.2], ['Kugellager', 0.93, 0.24], ['Hammer', 0.48, 0.2], ['Akkuschrauber', 0.36, 0.3], ['Bohrer', 0.27, 0.2], ['Espresso', 0.14, 0.56], ['Filterkaffee', 0.08, 0.46], ['Tee', 0.16, 0.38]];
    let q = { x: 0.66, y: 0.74 };
    let k = 3;
    let metric = 'euclid';
    const W = 340;
    const H = 260;
    const fig = h('div', { class: 'dia-scroll', style: 'touch-action:none' });
    const cap = h('div');
    const near = () => P.map((p) => {
      const dx = p[1] - q.x;
      const dy = p[2] - q.y;
      const dist = metric === 'euclid' ? Math.hypot(dx, dy) : 1 - (p[1] * q.x + p[2] * q.y) / (Math.hypot(p[1], p[2]) * Math.hypot(q.x, q.y) || 1);
      return { p, dist };
    }).sort((a, b) => a.dist - b.dist);
    const X = (v) => 12 + v * (W - 24);
    const Y = (v) => H - 12 - v * (H - 24);
    const draw = () => {
      const res = near();
      const top = res.slice(0, k);
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Punkte im Vektorraum und die nächsten Nachbarn der Anfrage" style="cursor:crosshair">';
      s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="10" fill="none" stroke="currentColor" opacity=".2"/>';
      top.forEach((t) => { s += '<line class="edge-hit" x1="' + X(q.x) + '" y1="' + Y(q.y) + '" x2="' + X(t.p[1]) + '" y2="' + Y(t.p[2]) + '"/>'; });
      P.forEach((p) => {
        const on = top.some((t) => t.p === p);
        s += '<circle class="' + (on ? 'dot-c' : 'dot-b') + '" cx="' + X(p[1]) + '" cy="' + Y(p[2]) + '" r="' + (on ? 6 : 4.5) + '"/>';
        s += '<text x="' + X(p[1]) + '" y="' + (Y(p[2]) - 8) + '" font-size="9.5" text-anchor="middle"' + (on ? ' font-weight="700"' : ' opacity=".7"') + '>' + p[0] + '</text>';
      });
      s += '<circle class="dot-q" cx="' + X(q.x) + '" cy="' + Y(q.y) + '" r="8"/></svg>';
      fig.innerHTML = s;
      cap.replaceChildren(caption('**Treffer:** ' + top.map((t) => t.p[0] + ' (' + t.dist.toFixed(3).replace('.', ',') + ')').join(', ') + '\nDie Linien sind das Ergebnis der kNN-Suche zur Laufzeit. Anders als im Graphmodell sind sie **nicht gespeichert**.'));
    };
    const move = (e) => {
      const svg = fig.querySelector('svg');
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const py = ((e.clientY - r.top) / r.height) * H;
      q = { x: Math.max(0.01, Math.min(0.99, (px - 12) / (W - 24))), y: Math.max(0.01, Math.min(0.99, (H - 12 - py) / (H - 24))) };
      draw();
    };
    let dragging = false;
    fig.addEventListener('pointerdown', (e) => { dragging = true; move(e); });
    fig.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
    const kLabel = h('b', { class: 'num' }, String(k));
    const slider = h('input', { type: 'range', min: 1, max: 6, value: k, id: 'vec-k-' + Math.random().toString(36).slice(2, 7), 'aria-label': 'Anzahl k der nächsten Nachbarn', style: 'flex:1;min-height:0;padding:0', oninput: (e) => { k = +e.target.value; kLabel.textContent = String(k); draw(); } });
    host.append(vizCard('Labor: Anfrage ziehen, nächste Nachbarn finden',
      segmented([{ id: 'euclid', label: 'Euklidisch' }, { id: 'cos', label: 'Kosinus' }], 'euclid', (id) => { metric = id; draw(); }),
      fig,
      h('div', { class: 'row small' }, h('span', null, 'k ='), kLabel, slider),
      cap));
    draw();
  };

  // ---------------------------------------------------------------------------
  Labs.cardinality = function (host) {
    const TYPES = {
      '11': { label: '1:1', a: 'Fahrer', b: 'Führerschein', rel: 'besitzt', la: ['Ali', 'Bea', 'Cem'], lb: ['F-1', 'F-2'], links: [[0, 0], [1, 1]], maxA: 1, maxB: 1, mm: 'Fahrer (0,1) · Führerschein (1,1)', text: 'Jeder Fahrer hat höchstens einen Führerschein, jeder Führerschein gehört genau einem Fahrer. Cem hat keinen, das ist erlaubt (min 0).' },
      '1n': { label: '1:N', a: 'Fahrer', b: 'Knöllchen', rel: 'erhält', la: ['Ali', 'Bea', 'Cem'], lb: ['K-1', 'K-2', 'K-3'], links: [[0, 0], [0, 1], [1, 2]], maxA: Infinity, maxB: 1, mm: 'Fahrer (0,∗) · Knöllchen (1,1)', text: 'Ein Fahrer kann viele Knöllchen bekommen, jedes Knöllchen gehört genau einem Fahrer. Das N steht bei Knöllchen.' },
      nm: { label: 'N:M', a: 'Fahrer', b: 'Fahrweg', rel: 'nutzt', la: ['Ali', 'Bea', 'Cem'], lb: ['A8', 'B10', 'B27'], links: [[0, 0], [0, 1], [1, 0], [2, 2]], maxA: Infinity, maxB: Infinity, mm: 'Fahrer (1,∗) · Fahrweg (0,∗)', text: 'Auf beiden Seiten sind mehrere Partner erlaubt. Diese Beziehung braucht später eine eigene Verknüpfungstabelle.' }
    };
    let t = TYPES['11'];
    let links = t.links.slice();
    let selected = null;
    const fig = h('div', { class: 'dia-scroll' });
    const cap = h('div');
    const W = 320;
    const rowY = (i) => 30 + i * 46;
    const draw = (msg, kind) => {
      let s = '<svg viewBox="0 0 ' + W + ' 170" style="max-width:420px;margin:auto" role="img" aria-label="Verbindungen zwischen ' + t.a + ' und ' + t.b + '">';
      s += '<text x="48" y="14" text-anchor="middle" font-size="12" font-weight="700">' + t.a + '</text><text x="272" y="14" text-anchor="middle" font-size="12" font-weight="700">' + t.b + '</text><text x="160" y="14" text-anchor="middle" font-size="11" opacity=".7">' + t.rel + '</text>';
      links.forEach(([a, b]) => { s += '<line class="edge-hit" x1="86" y1="' + rowY(a) + '" x2="234" y2="' + rowY(b) + '"/>'; });
      t.la.forEach((n, i) => { s += '<g data-a="' + i + '" style="cursor:pointer"><rect class="' + (selected === i ? 'node-hit' : 'node-box') + '" x="10" y="' + (rowY(i) - 15) + '" width="76" height="30" rx="8"/><text x="48" y="' + (rowY(i) + 4) + '" text-anchor="middle" font-size="12">' + n + '</text></g>'; });
      t.lb.forEach((n, i) => { s += '<g data-b="' + i + '" style="cursor:pointer"><rect class="node-box" x="234" y="' + (rowY(i) - 15) + '" width="76" height="30" rx="8"/><text x="272" y="' + (rowY(i) + 4) + '" text-anchor="middle" font-size="12">' + n + '</text></g>'; });
      fig.innerHTML = s + '</svg>';
      fig.querySelectorAll('[data-a]').forEach((g) => g.addEventListener('click', () => { selected = +g.dataset.a; draw(); }));
      fig.querySelectorAll('[data-b]').forEach((g) => g.addEventListener('click', () => {
        if (selected === null) return draw('Tippe zuerst links auf einen ' + t.a + '.', 'warn');
        const b = +g.dataset.b;
        const has = links.some((l) => l[0] === selected && l[1] === b);
        if (has) {
          links = links.filter((l) => !(l[0] === selected && l[1] === b));
          selected = null;
          return draw('Verbindung entfernt.');
        }
        const countB = links.filter((l) => l[1] === b).length;
        const countA = links.filter((l) => l[0] === selected).length;
        if (countB >= t.maxB) return draw('**Verboten:** ' + t.lb[b] + ' hat schon einen ' + t.a + '. Bei ' + t.label + ' ist auf dieser Seite nur ein Partner erlaubt.', 'bad');
        if (countA >= t.maxA) return draw('**Verboten:** ' + t.la[selected] + ' hat schon einen Partner. Bei ' + t.label + ' ist auch auf dieser Seite nur einer erlaubt.', 'bad');
        links = links.concat([[selected, b]]);
        selected = null;
        draw('Verbindung erlaubt.', 'ok');
      }));
      cap.replaceChildren(caption((msg ? msg + '\n' : '') + t.text + '\n(min, max): ' + t.mm, kind));
    };
    host.append(vizCard('Labor: Kardinalität ausprobieren',
      segmented(Object.entries(TYPES).map(([id, x]) => ({ id, label: x.label })), '11', (id) => { t = TYPES[id]; links = t.links.slice(); selected = null; draw(); }),
      h('div', { class: 'small muted' }, 'Tippe links auf einen Eintrag und dann rechts auf einen Partner.'),
      fig, cap));
    draw();
  };

  // ---------------------------------------------------------------------------
  // Geführte Modellierung in den drei Schritten des Skripts, am Ende das fertige Chen-Diagramm.
  Labs.erbuilder = function (host, params, api) {
    const sc = params;
    const er = sc.er;
    const entities = er.ents.map((e) => e.n);
    const area = h('div', { class: 'stack' });
    const scores = [];
    const textBox = () => h('div', { class: 'caption' }, h('div', { html: md(sc.text) }));

    const stepEntities = () => {
      const all = Calc.shuffle(entities.concat(sc.distract || []));
      let picked = [];
      const chips = h('div', { class: 'chips' });
      const fb = h('div');
      const drawChips = (checked) => chips.replaceChildren(...all.map((n) => {
        const on = picked.includes(n);
        const isEnt = entities.includes(n);
        const cls = checked ? (isEnt ? ' ok' : on ? ' bad' : '') : on ? ' on' : '';
        return h('button', { type: 'button', class: 'chip' + cls, disabled: checked, 'aria-pressed': on ? 'true' : 'false', onclick: () => { picked = on ? picked.filter((x) => x !== n) : picked.concat(n); drawChips(false); } }, n);
      }));
      drawChips(false);
      const btn = h('button', { type: 'button', class: 'btn pri full', onclick: () => {
        const hits = picked.filter((n) => entities.includes(n)).length;
        const wrong = picked.length - hits;
        scores.push(Math.max(0, (hits - wrong) / entities.length));
        drawChips(true);
        btn.remove();
        fb.replaceChildren(caption(wrong || hits < entities.length ? 'Grün sind die Entitätstypen. ' + (sc.distractWhy || 'Die anderen Begriffe sind Attribute oder gehören nicht zum Modell.') : '**Alle Entitätstypen richtig.**', wrong || hits < entities.length ? 'warn' : 'ok'), h('button', { type: 'button', class: 'btn pri full', onclick: stepKeys }, 'Weiter: Schlüssel festlegen'));
      } }, 'Prüfen');
      area.replaceChildren(h('span', { class: 'pill exam' }, 'Schritt 1 von 3: Entitätstypen'), textBox(), h('p', null, 'Welche Begriffe sind Entitätstypen, also eigenständige Objekte mit eigenen Eigenschaften?'), chips, btn, fb);
    };

    const stepKeys = () => {
      const picks = {};
      const list = h('div', { class: 'stack-s' });
      const fb = h('div');
      const attrName = (a) => ERM.clean(ERM.raw(a));
      const keyOf = (e) => attrName(e.attrs.find((a) => /^[*~]/.test(ERM.raw(a))));
      const draw = (checked) => list.replaceChildren(...er.ents.map((e) => h('div', { class: 'stack-s', style: 'padding:8px 0;border-top:1px solid var(--line)' },
        h('b', { class: 'small' }, e.n),
        h('div', { class: 'chips' }, e.attrs.map(attrName).map((n) => {
          const on = picks[e.n] === n;
          const isKey = keyOf(e) === n;
          const cls = checked ? (isKey ? ' ok' : on ? ' bad' : '') : on ? ' on' : '';
          return h('button', { type: 'button', class: 'chip' + cls, disabled: checked, 'aria-pressed': on ? 'true' : 'false', onclick: () => { picks[e.n] = n; draw(false); } }, n);
        })))));
      draw(false);
      const btn = h('button', { type: 'button', class: 'btn pri full', onclick: () => {
        const hits = er.ents.filter((e) => picks[e.n] === keyOf(e)).length;
        scores.push(hits / er.ents.length);
        draw(true);
        btn.remove();
        fb.replaceChildren(caption(hits === er.ents.length ? '**Alle Schlüssel richtig.** Im Diagramm werden sie unterstrichen.' : 'Namen, Daten und Status sind selten eindeutig. Ergänze deshalb eine künstliche ID, das erlaubt die Aufgabe ausdrücklich. Im Diagramm wird sie unterstrichen.', hits === er.ents.length ? 'ok' : 'warn'), h('button', { type: 'button', class: 'btn pri full', onclick: stepCards }, 'Weiter: Beziehungen'));
      } }, 'Prüfen');
      area.replaceChildren(h('span', { class: 'pill exam' }, 'Schritt 2 von 3: Schlüsselattribute'), h('p', null, 'Welches Attribut identifiziert jede Entität eindeutig?'), list, btn, fb);
    };

    const stepCards = () => {
      const ans = {};
      const list = h('div', { class: 'stack' });
      const fb = h('div');
      const right = (r) => [r.ca === '1' ? '1' : 'N', r.cb === '1' ? '1' : 'N'];
      const draw = (checked) => list.replaceChildren(...er.rels.map((r, i) => {
        ans[i] = ans[i] || [null, null];
        const seg = (side) => {
          const sol = right(r)[side];
          return h('div', { class: 'chips' }, ['1', 'N'].map((v) => {
            const on = ans[i][side] === v;
            const cls = checked ? (sol === v ? ' ok' : on ? ' bad' : '') : on ? ' on' : '';
            return h('button', { type: 'button', class: 'chip' + cls, disabled: checked, 'aria-pressed': on ? 'true' : 'false', onclick: () => { ans[i][side] = v; draw(false); } }, v === 'N' ? 'viele' : '1');
          }));
        };
        return h('div', { class: 'stack-s', style: 'padding:9px 0;border-top:1px solid var(--line)' },
          rich(r.text, 'prose small'),
          h('div', { class: 'row wrap', style: 'gap:6px 12px' },
            h('b', { class: 'small' }, r.a), seg(0),
            h('span', { class: 'small muted', style: 'font-style:italic' }, r.n),
            seg(1), h('b', { class: 'small' }, r.b)));
      }));
      draw(false);
      const btn = h('button', { type: 'button', class: 'btn pri full', onclick: () => {
        let hits = 0;
        er.rels.forEach((r, i) => { if (ans[i][0] === right(r)[0] && ans[i][1] === right(r)[1]) hits++; });
        scores.push(hits / er.rels.length);
        draw(true);
        btn.remove();
        fb.replaceChildren(caption(hits === er.rels.length ? '**Alle Kardinalitäten richtig.**' : 'Lies jeden Satz von beiden Seiten: „Wie viele B hat ein A?“ und „Wie viele A hat ein B?“. Die Zahl steht in Chen-Notation an der gegenüberliegenden Entität. Beispiel: Eine Sorte hat viele Chargen, also steht das N bei Charge.', hits === er.rels.length ? 'ok' : 'warn'), h('button', { type: 'button', class: 'btn pri full', onclick: finish }, 'Diagramm zeichnen'));
      } }, 'Prüfen');
      area.replaceChildren(h('span', { class: 'pill exam' }, 'Schritt 3 von 3: Beziehungen und Kardinalitäten'), h('p', null, 'Wie viele Partner hat jede Seite? Zwei Mal „viele“ ergibt N:M.'), list, btn, fb);
    };

    const finish = () => {
      const total = scores.reduce((s, x) => s + x, 0) / scores.length;
      area.replaceChildren(
        caption('Dein Ergebnis: **' + Math.round(total * 100) + ' %**. So sieht das fertige Diagramm aus. Zeichne es jetzt einmal von Hand, denn in der Klausur brauchst du es auf Papier.', total >= 0.8 ? 'ok' : 'warn'),
        ER.block({ er, anim: true, title: 'Musterlösung in Chen-Notation' }));
      if (api && api.done) api.done(total);
    };
    host.append(vizCard(sc.title ? 'ER-Modell: ' + sc.title : 'ER-Modell', area));
    stepEntities();
  };

  // ---------------------------------------------------------------------------
  // ER → Relationen: für jede Beziehung entscheiden, wo der Fremdschlüssel hinkommt.
  Labs.er2rm = function (host, params, api) {
    const er = params.er;
    const area = h('div', { class: 'stack' });
    const schema = ERM.toSchema(er);
    let i = 0;
    let hits = 0;
    const linkName = (r) => r.table || r.a + '_' + r.b;
    const next = () => {
      if (i >= er.rels.length) {
        const score = er.rels.length ? hits / er.rels.length : 1;
        area.replaceChildren(
          caption(hits + ' von ' + er.rels.length + ' Entscheidungen richtig. So sieht das vollständige Schema in der Notation der Vorlesung aus:', score >= 0.8 ? 'ok' : 'warn'),
          h('div', { class: 'stack-s' }, schema.map((s) => h('div', { class: 'schema fade-in', html: md(s.line) }))),
          caption('Primärschlüssel unterstrichen, Fremdschlüssel vollqualifiziert, Datentypen angegeben. Genau das verlangt die Klausur.'));
        if (api && api.done) api.done(score);
        return;
      }
      const r = er.rels[i];
      const many = r.ca !== '1' && r.cb !== '1';
      const oneOne = r.ca === '1' && r.cb === '1';
      const options = [
        { id: 'a', label: 'Fremdschlüssel in ' + r.a, ok: oneOne || (r.ca !== '1' && r.cb === '1') },
        { id: 'b', label: 'Fremdschlüssel in ' + r.b, ok: oneOne || (r.ca === '1' && r.cb !== '1') },
        { id: 'c', label: 'Eigene Tabelle ' + linkName(r), ok: many }
      ];
      const why = many ? 'N:M braucht eine **Verknüpfungstabelle**. Ihr Primärschlüssel besteht aus beiden Fremdschlüsseln, so kann jedes Paar nur einmal vorkommen.' : oneOne ? 'Bei 1:1 darf der Fremdschlüssel auf einer der beiden Seiten stehen, zusätzlich **UNIQUE**. So kann jeder Wert nur einmal vorkommen.' : 'Der Fremdschlüssel steht auf der Seite mit **„viele“**. Stünde er auf der anderen Seite, müsste man Zeilen verdoppeln.';
      const fb = h('div');
      const buttons = h('div', { class: 'stack-s' });
      const drawButtons = (picked) => buttons.replaceChildren(...options.map((o) => {
        let cls = 'opt';
        if (picked) cls += o.ok ? ' ok' : o === picked ? ' bad' : '';
        return h('button', { type: 'button', class: cls, disabled: !!picked, onclick: () => {
          if (o.ok) hits++;
          drawButtons(o);
          fb.replaceChildren(caption((o.ok ? '**Richtig.** ' : '**Nicht ganz.** ') + why, o.ok ? 'ok' : 'bad'), h('button', { type: 'button', class: 'btn pri full', onclick: () => { i++; next(); } }, i + 1 < er.rels.length ? 'Nächste Beziehung' : 'Fertiges Schema zeigen'));
        } }, icon(picked ? (o.ok ? 'check' : o === picked ? 'cross' : 'circle') : 'circle'), h('span', null, o.label));
      }));
      drawButtons(null);
      area.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'pill exam num' }, 'Beziehung ' + (i + 1) + ' von ' + er.rels.length)),
        h('div', { class: 'formula' }, r.a + '  ' + r.ca + ' — ' + r.n + ' — ' + r.cb + '  ' + r.b),
        h('p', null, 'Wie bildest du diese Beziehung ab?'),
        buttons, fb);
    };
    host.append(vizCard(params.title ? 'Schema: ' + params.title : 'Vom ER-Diagramm zum Schema', ER.figure(er), area));
    next();
  };

  // ---------------------------------------------------------------------------
  Labs.fkrules = function (host) {
    const K0 = [['1', 'Huber'], ['2', 'Müller'], ['3', 'Pohl']];
    const Q0 = [['101', '1', '80,00'], ['102', '2', '400,00'], ['103', '2', '310,00'], ['104', '3', '80,00']];
    const stage = h('div', { class: 'stack' });
    const RULES = {
      restrict: { label: 'RESTRICT', sql: 'ON DELETE RESTRICT' },
      cascade: { label: 'CASCADE', sql: 'ON DELETE CASCADE' },
      setnull: { label: 'SET NULL', sql: 'ON DELETE SET NULL' }
    };
    let rule = 'restrict';
    const tables = (k, q, opts) => relGroup([
      { title: 'Vaterrelation Kunde', head: ['<u>KundenNr</u>', 'Name'], rows: k, bad: opts && opts.badK },
      { title: 'Abhängige Relation Rechnung', head: ['<u>ReNr</u>', 'KundenNr', 'Betrag'], rows: q, hl: opts && opts.hlQ, bad: opts && opts.badQ }
    ]);
    const initial = () => stage.replaceChildren(tables(K0, Q0, { hlQ: [1, 2] }), caption('Kunde 2 (Müller) hat zwei Rechnungen. Was passiert beim Löschen? Das entscheidet die Regel beim Fremdschlüssel.\n`FOREIGN KEY (KundenNr) REFERENCES Kunde(KundenNr) ' + RULES[rule].sql + '`'),
      h('button', { type: 'button', class: 'btn pri full', onclick: del }, 'DELETE FROM Kunde WHERE KundenNr = 2'));
    const del = () => {
      let body;
      if (rule === 'restrict') body = [tables(K0, Q0, { badQ: [1, 2], badK: [1] }), caption('**Abgelehnt.** Solange ein Fremdschlüssel auf das Tupel verweist, kann der Kunde nicht gelöscht werden.', 'bad')];
      else if (rule === 'cascade') body = [tables(K0.filter((r) => r[0] !== '2'), Q0.filter((r) => r[1] !== '2')), caption('**Mitgelöscht.** Mit dem Kunden verschwinden auch seine Rechnungen.', 'warn')];
      else body = [tables(K0.filter((r) => r[0] !== '2'), Q0.map((r) => (r[1] === '2' ? [r[0], 'NULL', r[2]] : r)), { hlQ: [1, 2] }), caption('**Auf NULL gesetzt.** Die Rechnungen bleiben erhalten, aber ohne Kunde. Das geht nur, wenn die Spalte NULL erlaubt. SET DEFAULT setzt stattdessen einen festgelegten Standardwert.', 'warn')];
      stage.replaceChildren(...body, h('button', { type: 'button', class: 'btn line full', onclick: initial }, 'Zurücksetzen'));
    };
    host.append(vizCard('Labor: Löschregeln beim Fremdschlüssel',
      segmented(Object.entries(RULES).map(([id, r]) => ({ id, label: r.label })), rule, (id) => { rule = id; initial(); }), stage));
    initial();
  };
})();
