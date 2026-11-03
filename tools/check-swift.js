// Ersatzprüfung für Rechner ohne Xcode. Aufruf: node tools/check-swift.js
// 1. Simuliert Codable: Alle JSON-Inhalte und Generator-Aufgaben müssen zu den Swift-Modellen passen.
// 2. Prüft alle Swift-Dateien auf ausgeglichene Klammern und Verweise auf bekannte Typen.
// Das ersetzt keinen Compiler, findet aber die Fehler, die sonst erst auf dem iPhone auffallen.
const fs = require('fs');
const path = require('path');
const { Calc } = require(path.join(__dirname, '..', 'web', 'src', 'engine.js'));

const appDir = path.join(__dirname, '..', 'DatenbankenLernApp');
const errors = [];
const unknownKeys = new Set();

// ---- Swift-Modelle einlesen ----
const models = fs.readFileSync(path.join(appDir, 'Models', 'ContentModels.swift'), 'utf8');
const structs = {};
const structRe = /struct (\w+)[^{\n]*\{([\s\S]*?)\n\}/g;
let m;
while ((m = structRe.exec(models))) {
  const fields = {};
  for (const line of m[2].split('\n')) {
    const f = /^    (let|var) (\w+): ([^={]+?)(\s*=.*)?$/.exec(line);
    if (f) fields[f[2]] = { type: f[3].trim(), hasDefault: !!f[4] || f[1] === 'var' && f[3].trim().endsWith('?') };
  }
  structs[m[1]] = fields;
}
const enums = { QuestionKind: (/enum QuestionKind[^{]*\{\s*case ([^\n]+)/.exec(models)[1]).split(',').map((s) => s.trim()) };

function check(value, type, where) {
  if (type.endsWith('?')) {
    if (value === undefined || value === null) return;
    return check(value, type.slice(0, -1), where);
  }
  if (value === undefined || value === null) return errors.push(where + ': Pflichtfeld vom Typ ' + type + ' fehlt');
  const arr = /^\[(.+)\]$/.exec(type);
  if (arr && !arr[1].includes(':')) {
    if (!Array.isArray(value)) return errors.push(where + ': erwartet Array');
    value.forEach((v, i) => check(v, arr[1], where + '[' + i + ']'));
    return;
  }
  switch (type) {
    case 'String': if (typeof value !== 'string') errors.push(where + ': erwartet String, ist ' + typeof value); return;
    case 'Int': if (!Number.isInteger(value)) errors.push(where + ': erwartet Int, ist ' + value); return;
    case 'Double': if (typeof value !== 'number') errors.push(where + ': erwartet Double'); return;
    case 'Bool': if (typeof value !== 'boolean') errors.push(where + ': erwartet Bool'); return;
    case 'JSONValue': return;
    default:
  }
  if (enums[type]) {
    if (!enums[type].includes(value)) errors.push(where + ': unbekannter Wert ' + value + ' für ' + type);
    return;
  }
  const def = structs[type];
  if (!def) return errors.push(where + ': unbekannter Swift-Typ ' + type);
  if (typeof value !== 'object' || Array.isArray(value)) return errors.push(where + ': erwartet Objekt ' + type);
  for (const [name, f] of Object.entries(def)) check(value[name], f.type, where + '.' + name);
  // Unbekannte Schlüssel ignoriert Codable still, die Daten wären in der App einfach weg.
  for (const key of Object.keys(value)) if (!def[key]) unknownKeys.add(type + '.' + key);
}

const contentDir = path.join(appDir, 'Resources', 'Content');
let files = 0;
for (const f of fs.readdirSync(contentDir)) {
  const data = JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8'));
  files++;
  if (f.startsWith('module_')) check(data, 'LearningModule', f);
  else if (f === 'course.json') check(data, 'Course', f);
  else if (f === 'exams.json') check(data, '[ExamDefinition]', f);
}
let generated = 0;
for (const g of Calc.list()) {
  for (let i = 0; i < 30; i++) {
    check(JSON.parse(JSON.stringify(Calc.make(g.id))), 'Question', g.id);
    generated++;
  }
}
// Unbedenkliche Schlüssel: nur für die Web-Bausteine in params oder nur in engine-Metadaten
const IGNORE = new Set(['Question.autoDone']);
for (const k of unknownKeys) if (!IGNORE.has(k)) errors.push('Schlüssel fehlt im Swift-Modell: ' + k);

// ---- Swift-Dateien: Klammern, Dateien, Typen ----
function stripSwift(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('//', i)) { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (code.startsWith('/*', i)) { i = code.indexOf('*/', i) + 2; continue; }
    if (code[i] === '"') {
      i++;
      let depth = 0;
      while (i < code.length) {
        if (depth === 0 && code[i] === '\\' && code[i + 1] === '(') { depth = 1; i += 2; continue; }
        if (depth > 0) {
          if (code[i] === '(') depth++;
          if (code[i] === ')') depth--;
          i++;
          continue;
        }
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '"') { i++; break; }
        i++;
      }
      out += '""';
      continue;
    }
    out += code[i++];
  }
  return out;
}
const swiftFiles = [];
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.swift')) swiftFiles.push(p);
  }
})(appDir);
const allCode = swiftFiles.map((f) => stripSwift(fs.readFileSync(f, 'utf8'))).join('\n');
for (const f of swiftFiles) {
  const code = stripSwift(fs.readFileSync(f, 'utf8'));
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of code) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (pairs[ch] && stack.pop() !== pairs[ch]) { errors.push(path.basename(f) + ': Klammern passen nicht'); break; }
  }
  if (stack.length) errors.push(path.basename(f) + ': ' + stack.length + ' offene Klammern');
}
// Selbst definierte Typen, die irgendwo als Konstruktor genutzt werden, müssen existieren.
const declared = new Set((allCode.match(/\b(?:struct|class|enum|typealias)\s+(\w+)/g) || []).map((s) => s.split(/\s+/)[1]));
const known = new Set(('View Text VStack HStack ZStack LazyVStack ScrollView Button Label Image Spacer Circle Capsule Rectangle RoundedRectangle Path Color Font Group GeometryReader ForEach NavigationStack NavigationLink TabView ProgressView Picker Menu TextField Divider Grid GridRow Canvas TimelineView ToolbarItem Task Date Data String Int UInt64 Double CGFloat CGPoint CGSize Bool Array Set UUID Calendar DateFormatter NumberFormatter Locale NSNumber NSCache NSString UIImage PDFDocument PDFView WKWebView WKWebViewConfiguration WKUserContentController JSContext JSONEncoder JSONDecoder FileManager Bundle Binding State Animation StrokeStyle AttributedString WindowGroup ContentUnavailableView Theme Environment Published StateObject EnvironmentObject Slider Toggle Link Shape Scene App Decoder Encoder Character LinearGradient ContainerRelativeShape Section List Form EmptyView AnyView Gradient Angle').split(' '));
const usedCtors = new Set((allCode.match(/(?<![.\w])[A-Z]\w+(?=\()/g) || []));
const missing = [...usedCtors].filter((t) => !declared.has(t) && !known.has(t));
missing.forEach((t) => errors.push('Unbekannter Typ im Swift-Code: ' + t));

// ---- Ressourcen, die der Code erwartet ----
const res = path.join(appDir, 'Resources');
const need = ['Web/labs.html', 'Web/engine_js.txt', 'Content/course.json', 'Content/exams.json'];
for (let i = 1; i <= 11; i++) need.push('PDF/skript_teil' + i + '.pdf');
need.forEach((n) => { if (!fs.existsSync(path.join(res, n))) errors.push('Ressource fehlt: ' + n); });
if (!fs.existsSync(path.join(appDir, 'Assets.xcassets/AppIcon.appiconset/AppIcon.png'))) errors.push('AppIcon.png fehlt');
// Dateinamen müssen eindeutig sein, weil Xcode alle Ressourcen flach in die App legt.
const names = new Map();
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (names.has(n)) errors.push('Dateiname doppelt: ' + n);
    else names.set(n, p);
  }
})(res);

// Das Projekt darf nur bekannte Objekt-IDs referenzieren.
const pbx = fs.readFileSync(path.join(__dirname, '..', 'DatenbankenLernApp.xcodeproj', 'project.pbxproj'), 'utf8');
const defined = new Set((pbx.match(/^\t\t([A-F0-9]{24})\b/gm) || []).map((s) => s.trim()));
for (const ref of pbx.match(/\b[A-F0-9]{24}\b/g) || []) if (!defined.has(ref)) errors.push('Xcode-Projekt: unbekannte ID ' + ref);
const open = (pbx.match(/\{/g) || []).length;
const close = (pbx.match(/\}/g) || []).length;
if (open !== close) errors.push('Xcode-Projekt: Klammern passen nicht');

console.log('Geprüft: ' + files + ' JSON-Dateien gegen ' + Object.keys(structs).length + ' Swift-Modelle, ' + generated + ' erzeugte Aufgaben, ' + swiftFiles.length + ' Swift-Dateien, ' + names.size + ' Ressourcen');
errors.slice(0, 40).forEach((e) => console.log('FEHLER: ' + e));
console.log(errors.length ? errors.length + ' Fehler gefunden.' : 'Keine Fehler gefunden.');
process.exit(errors.length ? 1 : 0);
