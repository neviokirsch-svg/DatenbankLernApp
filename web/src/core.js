// Gemeinsame Helfer: DOM-Aufbau, Mini-Markdown, Lernstand (entspricht Models/ProgressStore.swift).
(function () {
  'use strict';

  window.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'style') el.style.cssText = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  // Gleiche Syntax wie RichText in Swift: **fett**, *kursiv*, `Code`, <u>unterstrichen</u>, _{tief}.
  function inline(s) {
    return s
      .replace(/&lt;u&gt;/g, '<u>')
      .replace(/&lt;\/u&gt;/g, '</u>')
      .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(„])\*(?=\S)([^*]+?)\*(?=$|[\s).,;:!?“])/g, '$1<em>$2</em>');
  }
  window.md = function (text) {
    const esc = String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return esc
      .split('`')
      .map((p, i) => (i % 2 ? '<code>' + inline(p) + '</code>' : inline(p)))
      .join('')
      .replace(/\n/g, '<br>');
  };
  window.rich = (text, cls, tag) => h(tag || 'div', { class: cls || undefined, html: md(text) });

  const ICONS = {
    home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
    repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9m0-5v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    timer: '<path d="M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.6.6.8 1.2.8 2.4h6c0-1.2.2-1.8.8-2.4A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 4 3 20h18zM12 10v4M12 17.2v.3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    prev: '<path d="M18 6 9 12l9 6zM6 6v12"/>',
    next: '<path d="m6 6 9 6-9 6zM18 6v12"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5M4 4v4.5h4.5"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/>',
    dot: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    checksq: '<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" stroke="none"/><path d="m8 12 3 3 5-6" stroke="var(--solid)"/>',
    check: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m8 12.3 2.8 2.8L16 9.8" stroke="var(--solid)"/>',
    cross: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m9 9 6 6m0-6-6 6" stroke="var(--solid)"/>',
    half: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>'
  };
  window.icon = function (name) {
    const span = document.createElement('span');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    return span.firstChild;
  };

  window.ring = function (value, size, color, width) {
    const w = width || 5;
    const r = (size - w) / 2;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, value));
    const wrap = document.createElement('span');
    wrap.innerHTML =
      '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="t" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + w + '"/>' +
      '<circle class="v" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + w + '" stroke="' + (color || 'var(--good)') + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - v) + '"/></svg>';
    return wrap.firstChild;
  };

  // ---------------------------------------------------------------------------
  // Lernstand
  // ---------------------------------------------------------------------------
  const KEY = 'dblernapp.v1';
  const empty = () => ({ readSections: {}, items: {}, exams: [], answersPerDay: {}, lastModuleID: null, lastSectionID: null });
  const DAY = 86400000;

  const Store = {
    data: empty(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.data = Object.assign(empty(), JSON.parse(raw));
      } catch (e) {
        this.data = empty();
      }
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        /* ohne Speicher läuft die App für diese Sitzung weiter */
      }
    },
    markRead(sectionID, moduleID) {
      if (!this.data.readSections[sectionID]) this.data.readSections[sectionID] = Date.now();
      this.data.lastModuleID = moduleID;
      this.data.lastSectionID = sectionID;
      this.save();
    },
    isRead(id) {
      return !!this.data.readSections[id];
    },
    readFraction(m) {
      if (!m.sections.length) return 0;
      return m.sections.filter((s) => this.isRead(s.id)).length / m.sections.length;
    },
    state(id) {
      return this.data.items[id];
    },
    record(id, rating) {
      const s = this.data.items[id] || { reps: 0, ease: 2.5, intervalDays: 0, due: Date.now(), correct: 0, wrong: 0, lastCorrect: false, lastAnswered: Date.now() };
      const now = Date.now();
      if (rating === 'wrong') {
        s.wrong++;
        s.reps = 0;
        s.lastCorrect = false;
        s.ease = Math.max(1.3, s.ease - 0.2);
        s.intervalDays = 0;
        s.due = now + 10 * 60000;
      } else {
        s.correct++;
        s.lastCorrect = true;
        s.reps++;
        if (rating === 'hard') s.ease = Math.max(1.3, s.ease - 0.15);
        if (s.reps === 1) s.intervalDays = rating === 'hard' ? 1 : 2;
        else if (s.reps === 2) s.intervalDays = rating === 'hard' ? 3 : 6;
        else s.intervalDays = s.intervalDays * (rating === 'hard' ? 1.2 : s.ease);
        s.due = now + s.intervalDays * DAY;
      }
      s.lastAnswered = now;
      this.data.items[id] = s;
      const k = this.dayKey(now);
      this.data.answersPerDay[k] = (this.data.answersPerDay[k] || 0) + 1;
      this.save();
    },
    dueIDs() {
      const now = Date.now();
      return Object.entries(this.data.items).filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
    },
    weakIDs() {
      return Object.entries(this.data.items).filter(([, s]) => s.wrong > 0 && (!s.lastCorrect || s.reps < 2)).sort((a, b) => b[1].wrong - a[1].wrong).map(([id]) => id);
    },
    learnedIDs() {
      return Object.entries(this.data.items).sort((a, b) => b[1].lastAnswered - a[1].lastAnswered).map(([id]) => id);
    },
    moduleIDs(m) {
      return m.questions.map((q) => q.id).concat(m.calcs || []);
    },
    mastery(m) {
      const ids = this.moduleIDs(m);
      if (!ids.length) return 0;
      let sum = 0;
      for (const id of ids) {
        const s = this.data.items[id];
        if (!s) continue;
        if (s.reps >= 3 && s.lastCorrect) sum += 1;
        else if (s.lastCorrect) sum += 0.5;
      }
      return sum / ids.length;
    },
    answered(m) {
      return this.moduleIDs(m).filter((id) => this.data.items[id]).length;
    },
    // Gewichtet nach Klausuranteil, damit die großen Aufgaben stärker zählen.
    overall(modules) {
      const rel = modules.filter((m) => m.weight > 0);
      const total = rel.reduce((s, m) => s + m.weight, 0);
      if (!total) return 0;
      return rel.reduce((s, m) => s + m.weight * this.mastery(m), 0) / total;
    },
    addExam(r) {
      this.data.exams.unshift(r);
      this.save();
    },
    dayKey(t) {
      const d = new Date(t);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    get today() {
      return this.data.answersPerDay[this.dayKey(Date.now())] || 0;
    },
    get streak() {
      let count = 0;
      let t = Date.now();
      if (!this.data.answersPerDay[this.dayKey(t)]) t -= DAY;
      while (this.data.answersPerDay[this.dayKey(t)]) {
        count++;
        t -= DAY;
      }
      return count;
    },
    lastDays(n) {
      const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const t = Date.now() - i * DAY;
        out.push({ label: names[new Date(t).getDay()], count: this.data.answersPerDay[this.dayKey(t)] || 0 });
      }
      return out;
    },
    reset() {
      this.data = empty();
      this.save();
    }
  };
  Store.load();
  window.Store = Store;

  // Schrittsteuerung für alle Animationen (entspricht StepControls in Swift).
  window.stepControls = function (maxStep, onStep, opts) {
    const interval = (opts && opts.interval) || 2300;
    let step = (opts && opts.start) || 0;
    let timer = null;
    const count = h('span', { class: 'count' });
    const setPlaying = (on) => {
      if (timer) clearInterval(timer);
      timer = null;
      playBtn.replaceChildren(icon(on ? 'pause' : 'play'));
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Abspielen');
      if (on) {
        timer = setInterval(() => {
          if (!el.isConnected) return setPlaying(false);
          if (step < api.max) go(step + 1);
          else setPlaying(false);
        }, interval);
      }
    };
    const go = (s) => {
      step = Math.max(0, Math.min(api.max, s));
      back.disabled = step === 0;
      fwd.disabled = step >= api.max;
      count.textContent = step + '/' + api.max;
      onStep(step);
    };
    const resetBtn = h('button', { type: 'button', 'aria-label': 'Von vorn', onclick: () => { setPlaying(false); go(0); } }, icon('reset'));
    const back = h('button', { type: 'button', 'aria-label': 'Schritt zurück', onclick: () => { setPlaying(false); go(step - 1); } }, icon('prev'));
    const playBtn = h('button', { type: 'button', class: 'play', 'aria-label': 'Abspielen', onclick: () => { if (timer) setPlaying(false); else { if (step >= api.max) go(0); setPlaying(true); } } }, icon('play'));
    const fwd = h('button', { type: 'button', 'aria-label': 'Nächster Schritt', onclick: () => { setPlaying(false); go(step + 1); } }, icon('next'));
    const el = h('div', { class: 'stepper' }, resetBtn, back, playBtn, fwd, count);
    const api = { el, max: maxStep, go, get step() { return step; }, stop: () => setPlaying(false) };
    go(step);
    return api;
  };

  // Eine Relation als Tabelle. opts.rowClass(rowIndex) und opts.cellClass(rowIndex, colIndex) setzen Zustände.
  window.relTable = function (t, opts) {
    const o = opts || {};
    const headCells = t.head.map((c, i) => h('th', { class: o.headClass ? o.headClass(i) : undefined, html: md(c) }));
    const rows = t.rows.map((row, r) => {
      const cls = [o.rowClass ? o.rowClass(r) : null, (t.hl || []).includes(r) ? 'hl' : null, (t.ok || []).includes(r) ? 'ok' : null, (t.bad || []).includes(r) ? 'bad' : null, (t.dim || []).includes(r) ? 'dim' : null].filter(Boolean).join(' ');
      return h('tr', { class: cls || undefined, onclick: o.onRow ? () => o.onRow(r) : undefined },
        row.map((c, i) => {
          const isNull = c === 'NULL';
          const cc = [o.cellClass ? o.cellClass(r, i) : null, isNull ? 'null' : null].filter(Boolean).join(' ');
          return h('td', { class: cc || undefined, html: md(c) });
        }));
    });
    const table = h('table', { class: 'rel' + (o.data === false ? '' : ' data') },
      h('thead', null, h('tr', null, headCells)),
      h('tbody', null, rows));
    return h('div', { class: 'rel-box' },
      t.title ? h('div', { class: 'tb-title', html: md(t.title) }) : null,
      h('div', { class: 'tb-wrap' }, table));
  };
  window.relGroup = (tabs, opts) => h('div', { class: 'rels' }, tabs.map((t) => relTable(t, opts)));

  window.vizCard = (title, ...kids) => h('div', { class: 'viz' }, title ? h('div', { class: 'viz-title' }, icon('lab'), h('span', null, title)) : null, kids);
  window.caption = (text, kind) => h('div', { class: 'caption fade-in' + (kind ? ' ' + kind : ''), html: md(text) });
  window.segmented = function (items, active, onPick) {
    const el = h('div', { class: 'seg', role: 'tablist' });
    const draw = (cur) => {
      el.replaceChildren(...items.map((it) => h('button', { type: 'button', role: 'tab', class: it.id === cur ? 'on' : undefined, 'aria-selected': it.id === cur ? 'true' : 'false', onclick: () => { draw(it.id); onPick(it.id); } }, it.label)));
    };
    draw(active);
    return el;
  };
})();
