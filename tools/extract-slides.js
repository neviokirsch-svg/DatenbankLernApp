// Rendert alle in den Inhalten verwendeten Folien als PNG. Aufruf: node tools/extract-slides.js
// Braucht pdftoppm und pdfinfo (Poppler). Ein Block {"t":"sl","part":3,"page":15,"crop":[l,t,b,h]} schneidet in Prozent der Seite zu.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pdfDir = path.join(root, '..');
const appDir = path.join(root, 'DatenbankenLernApp');
const contentDir = path.join(appDir, 'Resources', 'Content');
const outDir = path.join(appDir, 'Resources', 'Slides');
const PDF = {
  1: 'Datenbanken1Einfuehrung.pdf', 2: 'Datenbanken2Architektur.pdf', 3: 'Datenbanken3ERM.pdf', 4: 'Datenbanken4RM.pdf', 5: 'Datenbanken5RA.pdf',
  6: 'Datenbanken6NormalformenTeil1.pdf', 7: 'Datenbanken6NormalformenTeil2.pdf', 8: 'Datenbanken5Übungen.pdf', 9: 'Datenbanken6Übungen.pdf',
  10: 'Datenbanken4RM_Notation_Tabellenmodell.pdf', 11: 'Datenbanken4RM_Notation_Relationenmodell.pdf'
};
const TARGET_WIDTH = 1050;

function collect(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === 'object') {
    if (node.t === 'sl') out.push(node);
    Object.values(node).forEach((v) => collect(v, out));
  }
}
const blocks = [];
for (const f of fs.readdirSync(contentDir).filter((n) => n.endsWith('.json'))) {
  collect(JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8')), blocks);
}
fs.mkdirSync(outDir, { recursive: true });
const sizes = {};
function pageSize(part) {
  if (sizes[part]) return sizes[part];
  const info = execFileSync('pdfinfo', [path.join(pdfDir, PDF[part])], { encoding: 'utf8' });
  const m = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  sizes[part] = { w: +m[1], h: +m[2] };
  return sizes[part];
}
const seen = new Set();
let count = 0;
let bytes = 0;
for (const b of blocks) {
  const crop = b.crop || [0, 0, 100, 100];
  const name = 's' + b.part + '_' + b.page + (b.crop ? '_' + b.crop.join('_') : '');
  if (seen.has(name)) continue;
  seen.add(name);
  const file = path.join(outDir, name + '.png');
  if (!fs.existsSync(file) || process.argv.includes('--force')) {
    const size = pageSize(b.part);
    const dpi = Math.min(170, Math.round((TARGET_WIDTH / ((size.w / 72) * (crop[2] / 100)))));
    const px = (pt, pct) => Math.round((pt / 72) * dpi * (pct / 100));
    execFileSync('pdftoppm', ['-r', String(dpi), '-png', '-singlefile', '-f', String(b.page), '-l', String(b.page),
      '-x', String(px(size.w, crop[0])), '-y', String(px(size.h, crop[1])), '-W', String(px(size.w, crop[2])), '-H', String(px(size.h, crop[3])),
      path.join(pdfDir, PDF[b.part]), path.join(outDir, name)]);
  }
  bytes += fs.statSync(file).size;
  count++;
}
// Alte, nicht mehr genutzte Folien entfernen.
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.png') && !seen.has(f.replace('.png', ''))) fs.unlinkSync(path.join(outDir, f));
}
console.log(count + ' Folien, ' + (bytes / 1048576).toFixed(1) + ' MB');
