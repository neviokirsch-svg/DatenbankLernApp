// UI-Test mit dem vorhandenen Edge im Headless-Modus. Aufruf: node tools/test-ui.js [Ausgabeordner]
// Prüft bei Handy- und Desktopbreite alle Seiten und schreibt einen kurzen Bericht.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const root = path.join(__dirname, '..');
const dist = path.join(root, 'web', 'dist');
const out = process.argv[2] || path.join(os.tmpdir(), 'dbtest');
fs.mkdirSync(out, { recursive: true });
const profile = path.join(out, 'profile');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/').replace(/ /g, '%20');
const selftest = toUrl(path.join(dist, 'selftest.html'));

function edge(args) {
  return execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + profile, ...args], { encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
}

// Ein Iframe erzwingt die echte Breite, denn Headless-Fenster haben eine Mindestbreite.
function run(width, mode) {
  const wrapper = path.join(dist, 'frame_' + width + '.html');
  fs.writeFileSync(wrapper, '<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe id="f" src="selftest.html?mode=' + (mode || 'run') + '" style="width:' + width + 'px;height:844px;border:0"></iframe><pre id="r"></pre><script>addEventListener("message",function(e){if(e.data&&e.data.selftest)document.getElementById("r").textContent=e.data.selftest;});</script></body>');
  const dom = edge(['--window-size=1300,1000', '--virtual-time-budget=120000', '--dump-dom', toUrl(wrapper)]);
  const m = /<pre id="r">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m || !m[1]) return { errors: ['Kein Bericht erhalten'] };
  const txt = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return JSON.parse(txt);
}

let failed = false;
{
  const r = run(390, 'labs');
  console.log('Abläufe: ' + (r.labRuns || []).join(', '));
  (r.play || []).forEach((x) => console.log('  ' + x));
  (r.errors || []).forEach((e) => { console.log('  FEHLER ' + e); failed = true; });
  (r.overflow || []).forEach((e) => { console.log('  BREITE ' + e); failed = true; });
}
for (const width of [390, 1200]) {
  const r = run(width);
  console.log('Breite ' + r.width + ' px: ' + r.routes + ' Seiten, ' + r.questions + ' Fragen, ' + r.solved + '/' + r.checked + ' richtig erkannt, ' + r.labClicks + ' Labor-Klicks');
  (r.errors || []).slice(0, 40).forEach((e) => { console.log('  FEHLER ' + e); failed = true; });
  (r.overflow || []).slice(0, 40).forEach((e) => { console.log('  BREITE ' + e); failed = true; });
}
{
  const dom = edge(['--window-size=1300,1000', '--virtual-time-budget=60000', '--dump-dom', toUrl(path.join(dist, 'labs_test.html'))]);
  const m = /<pre id="labs-report">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m) { console.log('  FEHLER labs.html liefert keinen Bericht'); failed = true; } else {
    const r = JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
    console.log('labs.html wie in der App: ' + r.rendered + ' Blöcke und Labore dargestellt');
    r.errors.slice(0, 20).forEach((e) => { console.log('  FEHLER ' + e); failed = true; });
  }
}
console.log(failed ? 'Es gibt Auffälligkeiten.' : 'Alles in Ordnung.');
process.exit(failed ? 1 : 0);
