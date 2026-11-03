// Baut die HTML-Version aus den gemeinsamen Inhalten. Aufruf: node tools/build.js
// Ergebnis: ../Datenbanken_Lerntool.html (eine Datei, offline lauffähig) und die Web-Bausteine für die iOS-App.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'web', 'src');
const appDir = path.join(root, 'DatenbankenLernApp');
const res = path.join(appDir, 'Resources');
const contentDir = path.join(res, 'Content');
const read = (p) => fs.readFileSync(p, 'utf8');
const script = (code) => '<script>' + code.replace(/<\/script>/g, '<\\/script>') + '</script>';

// Die Vorlesungs-Datenbank aus dem SQL-Dump als Daten für die Spielwiese.
function parseDump(file) {
  const sql = read(file);
  const out = {};
  const re = /INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*([\s\S]*?);/g;
  let m;
  while ((m = re.exec(sql))) {
    const attrs = m[2].split(',').map((s) => s.trim().replace(/`/g, ''));
    const rows = [];
    const rowRe = /\(([^()]*)\)/g;
    let r;
    while ((r = rowRe.exec(m[3]))) {
      const vals = r[1].match(/'(?:[^'])*'|NULL/g).map((v) => (v === 'NULL' ? null : v.slice(1, -1)));
      rows.push(attrs.map((a, i) => (a === 'DATUM' && vals[i] ? vals[i].slice(0, 10) : vals[i])));
    }
    out[m[1]] = { attrs, rows };
  }
  return out;
}

const modules = fs.readdirSync(contentDir).filter((f) => /^module_.*\.json$/.test(f)).sort().map((f) => JSON.parse(read(path.join(contentDir, f))));
const course = JSON.parse(read(path.join(contentDir, 'course.json')));
const exams = JSON.parse(read(path.join(contentDir, 'exams.json')));
const vorlesungen = parseDump(path.join(root, '..', 'VorlesungenDump.sql'));

function usedSlides() {
  const names = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.t === 'sl') names.add('s' + n.part + '_' + n.page + (n.crop ? '_' + n.crop.join('_') : ''));
      Object.values(n).forEach(walk);
    }
  };
  walk(modules);
  walk(exams);
  return names;
}
const slideMap = {};
const slideDir = path.join(res, 'Slides');
for (const name of usedSlides()) {
  const f = path.join(slideDir, name + '.png');
  if (fs.existsSync(f)) slideMap[name] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  else console.log('Hinweis: Folie fehlt: ' + name + ' (node tools/extract-slides.js ausführen)');
}

const engine = read(path.join(src, 'engine.js'));
const LABS = ['core.js', 'er.js', 'blocks.js', 'labs_fd.js', 'labs_ra.js', 'labs_er.js'];
const labCode = LABS.map((f) => read(path.join(src, f))).join('\n');
const css = read(path.join(src, 'style.css'));
const HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="claude:viewport-fit-sides" content="cover">';
const vorlesungenJS = 'window.VORLESUNGEN=' + JSON.stringify(vorlesungen) + ';';

const html = '<!doctype html><html lang="de"><head>' + HEAD + '<title>Datenbanken Lerntool</title><style>' + css + '</style></head><body>' +
  '<div id="bg" aria-hidden="true"><i></i><i></i><i></i></div><div id="shell"><nav id="tabs" aria-label="Hauptnavigation"></nav><main id="view"></main></div>' +
  script(vorlesungenJS) +
  script('window.DB_SLIDES=' + JSON.stringify(slideMap) + ';') +
  script('window.DB_CONTENT=' + JSON.stringify({ course, modules, exams }) + ';') +
  script(engine) + script(labCode) + script(read(path.join(src, 'questions.js'))) + script(read(path.join(src, 'app.js'))) +
  '</body></html>';
const outFile = path.join(root, '..', 'Datenbanken_Lerntool.html');
fs.writeFileSync(outFile, html);

// Bausteine für die App: JavaScriptCore rechnet mit engine.js, WKWebView zeigt die Labore mit labs.html.
const webDir = path.join(res, 'Web');
fs.mkdirSync(webDir, { recursive: true });
// Als .txt, weil Xcode .js-Dateien sonst dem Kompilieren zuordnet.
fs.writeFileSync(path.join(webDir, 'engine_js.txt'), engine);
const pdfDir = path.join(res, 'PDF');
fs.mkdirSync(pdfDir, { recursive: true });
const PDFS = ['Datenbanken1Einfuehrung.pdf', 'Datenbanken2Architektur.pdf', 'Datenbanken3ERM.pdf', 'Datenbanken4RM.pdf', 'Datenbanken5RA.pdf', 'Datenbanken6NormalformenTeil1.pdf', 'Datenbanken6NormalformenTeil2.pdf', 'Datenbanken5Übungen.pdf', 'Datenbanken6Übungen.pdf', 'Datenbanken4RM_Notation_Tabellenmodell.pdf', 'Datenbanken4RM_Notation_Relationenmodell.pdf'];
PDFS.forEach((f, i) => {
  const target = path.join(pdfDir, 'skript_teil' + (i + 1) + '.pdf');
  if (!fs.existsSync(target)) fs.copyFileSync(path.join(root, '..', f), target);
});
fs.writeFileSync(path.join(webDir, 'labs.html'),
  '<!doctype html><html lang="de"><head>' + HEAD + '<title>Labor</title><style>' + css + 'body{background:transparent}#bg{display:none}#host{padding:0}</style></head><body><div id="host"></div>' +
  script(vorlesungenJS) + script(engine) + script(labCode) + script(read(path.join(src, 'questions.js'))) + script(read(path.join(src, 'bridge.js'))) + '</body></html>');

// Testvariante mit Selbsttest (nur für tools/test-ui.js, wird nicht ausgeliefert).
if (process.argv.includes('--test')) {
  const testDir = path.join(root, 'web', 'dist');
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, 'selftest.html'), html.replace('</body></html>', script(read(path.join(root, 'tools', 'selftest.js'))) + '</body></html>'));
  const labsPage = read(path.join(webDir, 'labs.html'));
  fs.writeFileSync(path.join(testDir, 'labs_test.html'), labsPage.replace('</body></html>', script('window.TEST_CONTENT=' + JSON.stringify({ modules, exams }) + ';') + script(read(path.join(root, 'tools', 'labs-test.js'))) + '</body></html>'));
}
console.log('Gebaut: ' + path.basename(outFile) + ' (' + (html.length / 1048576).toFixed(1) + ' MB), ' + modules.length + ' Module, ' + Object.keys(slideMap).length + ' Folien');
