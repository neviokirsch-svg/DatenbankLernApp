// Bildschirme und Navigation (entspricht Views/LearnViews.swift und Views/PracticeViews.swift).
(function () {
  'use strict';

  const { Calc } = DBEngine;
  const C = window.DB_CONTENT;
  const modules = C.modules.slice().sort((a, b) => a.order - b.order);
  const questionIndex = {};
  modules.forEach((m) => m.questions.forEach((q) => (questionIndex[q.id] = { q, m })));
  C.exams.forEach((e) => e.tasks.forEach((t) => t.questions.forEach((q) => (questionIndex[q.id] = { q, m: null }))));

  const makeQuestion = (id) => {
    if (Calc.has(id)) return Calc.make(id);
    return questionIndex[id] ? questionIndex[id].q : null;
  };
  const buildQuestions = (ids) => ids.map(makeQuestion).filter(Boolean);
  const view = () => document.getElementById('view');
  const go = (hash) => {
    if (location.hash === '#' + hash) route();
    else location.hash = hash;
    window.scrollTo({ top: 0 });
  };
  const moduleOf = (id) => modules.find((m) => m.id === id);
  const taskModules = (no) => modules.filter((m) => m.exam === no);
  const taskMastery = (no) => {
    const list = taskModules(no);
    const total = list.reduce((s, m) => s + (m.weight || 0), 0);
    return total ? list.reduce((s, m) => s + (m.weight || 0) * Store.mastery(m), 0) / total : 0;
  };
  const pct = (v) => Math.round(v * 100) + ' %';
  const title = (eyebrow, text, sub) => h('div', { class: 'title-block' }, eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null, h('h1', null, text), sub ? h('p', { class: 'muted' }, sub) : null);
  const moduleProgress = (m) => h('span', { style: 'position:relative;width:40px;height:40px;flex:none;display:block' },
    h('span', { style: 'position:absolute;inset:0' }, ring(Store.readFraction(m), 40, 'var(--teal)', 4)),
    h('span', { style: 'position:absolute;inset:7px' }, ring(Store.mastery(m), 26, 'var(--good)', 4)));

  let session = null;
  let exam = null;

  // ---------------------------------------------------------------------------
  // Heute
  // ---------------------------------------------------------------------------
  function viewHome() {
    const overall = Store.overall(modules);
    const due = Store.dueIDs();
    const next = modules.find((m) => m.weight > 0 && Store.readFraction(m) < 1) || modules.find((m) => m.weight > 0 && Store.mastery(m) < 0.8);
    const lever = C.course.examTasks.map((t) => ({ t, gain: t.pct * (1 - taskMastery(t.no)) })).sort((a, b) => b.gain - a.gain)[0];
    const leverModule = lever && (taskModules(lever.t.no).find((m) => Store.mastery(m) < 0.8) || taskModules(lever.t.no)[0]);

    const reset = h('div');
    const drawReset = (confirming) => {
      reset.replaceChildren(confirming
        ? h('div', { class: 'row wrap small' }, h('span', { class: 'grow' }, 'Gelesene Abschnitte, Antworten und Klausurergebnisse werden gelöscht.'),
            h('button', { type: 'button', class: 'btn s danger', onclick: () => { Store.reset(); route(); } }, 'Löschen'),
            h('button', { type: 'button', class: 'btn s', onclick: () => drawReset(false) }, 'Abbrechen'))
        : h('button', { type: 'button', class: 'btn s line', onclick: () => drawReset(true) }, 'Lernstand zurücksetzen'));
    };
    drawReset(false);

    const days = Store.lastDays(7);
    const topDay = Math.max(1, ...days.map((d) => d.count));
    const anyActivity = days.some((d) => d.count > 0);

    return [
      title(C.course.subtitle, 'Datenbanken', C.course.tagline),
      h('div', { class: 'card row', style: 'gap:16px' },
        h('span', { style: 'position:relative;width:88px;height:88px;flex:none;display:block' }, ring(overall, 88, 'var(--good)', 10), h('b', { class: 'num', style: 'position:absolute;inset:0;display:grid;place-items:center' }, pct(overall))),
        h('div', { class: 'grow stack-s' },
          h('h3', null, 'Dein Lernstand'),
          h('p', { class: 'small muted' }, Object.keys(Store.data.readSections).length + ' Abschnitte gelesen, ' + Object.keys(Store.data.items).length + ' Aufgaben bearbeitet. Der Wert ist nach Klausuranteil gewichtet.'))),
      h('div', { class: 'tiles' },
        tile(Store.streak, 'Tage in Folge', 'var(--warn)'),
        tile(Store.today, 'Heute', 'var(--good)'),
        tile(due.length, 'Fällig', 'var(--violet)')),
      due.length ? h('button', { type: 'button', class: 'btn pri full', onclick: () => startSession('Wiederholung', buildQuestions(due), 'heute') }, due.length + ' Wiederholungen starten') : null,
      next ? moduleLink('Als Nächstes', next) : null,
      leverModule && leverModule !== next && Object.keys(Store.data.items).length > 0 ? moduleLink('Größter Hebel: Aufgabe ' + lever.t.no + ' zählt ' + lever.t.pct + ' %', leverModule) : null,
      weightChart(),
      anyActivity ? h('div', { class: 'card stack-s' }, h('div', { class: 'eyebrow' }, 'Letzte 7 Tage'),
        h('div', { class: 'days' }, days.map((d) => h('div', null, h('span', { class: 'num' }, d.count || ''), h('i', { style: 'height:' + (d.count / topDay) * 62 + 'px', title: d.label + ': ' + d.count + ' Antworten' }), h('span', null, d.label))))) : null,
      reset
    ];
  }
  function tile(v, label, color) {
    return h('div', { class: 'card tight tile' }, h('b', { style: 'color:' + color }, String(v)), h('span', { class: 'tiny muted' }, label));
  }
  function moduleLink(eyebrow, m) {
    return h('a', { class: 'card', href: '#' + m.id }, h('div', { class: 'stack-s' },
      h('div', { class: 'eyebrow' }, eyebrow),
      h('div', { class: 'row' }, h('span', { class: 'glyph' }, m.glyph), h('div', { class: 'grow' }, h('h3', null, m.title), h('div', { class: 'small muted' }, 'Skript ' + scriptName(m.part) + ', ' + m.pages)), icon2('right'))));
  }
  const icon2 = (n) => { const i = icon(n); i.style.cssText = 'width:18px;height:18px;flex:none;color:var(--muted)'; return i; };

  // Balken ist der geschätzte Klausuranteil; die dunkle Füllung zeigt, wie viel davon schon sitzt.
  function weightChart() {
    const top = Math.max(...C.course.examTasks.map((t) => t.pct));
    return h('div', { class: 'card stack' },
      h('div', { class: 'stack-s' }, h('h2', null, 'So verteilt sich die Klausur'), h('p', { class: 'small muted' }, C.course.weightNote)),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--primary-soft)' }), 'Geschätzter Anteil'), h('span', null, h('i', { style: 'background:var(--primary)' }), 'Davon beherrscht')),
      h('div', { class: 'wchart' }, C.course.examTasks.map((t) => {
        const m = taskMastery(t.no);
        return h('a', { class: 'wrow', href: '#a' + t.no, style: 'color:inherit;text-decoration:none', title: 'Aufgabe ' + t.no + ': ' + t.pct + ' % der Klausur, etwa ' + t.min + ' Minuten, ' + pct(m) + ' beherrscht' },
          h('span', { class: 'lab' }, h('span', null, h('b', null, 'A' + t.no), ' ' + t.title), h('span', { class: 'val' }, t.pct + ' % · ' + t.min + ' Min.')),
          h('span', { class: 'wtrack' }, h('span', { class: 'w', style: 'width:' + (t.pct / top) * 100 + '%' }, h('span', { class: 'm', style: 'width:' + m * 100 + '%' }))));
      })));
  }

  // ---------------------------------------------------------------------------
  // Lernen
  // ---------------------------------------------------------------------------
  function viewLearn(anchor) {
    const groups = C.course.examTasks.map((t) =>
      h('section', { class: 'stack-s', id: 'a' + t.no },
        h('div', { class: 'row', style: 'padding-top:10px' },
          h('h2', { class: 'grow' }, 'Aufgabe ' + t.no + ': ' + t.title),
          h('span', { class: 'pill exam num' }, t.pct + ' %')),
        h('p', { class: 'small muted' }, t.what),
        taskModules(t.no).map(moduleRow)));
    const extra = modules.filter((m) => !m.exam);
    const out = [title(null, 'Lernen', 'Jeder Abschnitt besteht aus Theorie und anschließender Praxis. Die Reihenfolge folgt dem Skript, der Umfang der Klausur.')].concat(groups);
    if (extra.length) {
      out.push(h('section', { class: 'stack-s' }, h('div', { class: 'row', style: 'padding-top:10px' }, h('h2', { class: 'grow' }, 'Ausblick auf das 4. Semester'), h('span', { class: 'pill' }, 'kein Klausurstoff')), extra.map(moduleRow)));
    }
    if (anchor) {
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView();
      }, 30);
    }
    return out;
  }
  function moduleRow(m) {
    const labs = m.sections.reduce((n, s) => n + (s.practice || []).length, 0);
    return h('a', { class: 'card tight', href: '#' + m.id },
      h('div', { class: 'row' },
        h('span', { class: 'glyph' }, m.glyph),
        h('div', { class: 'grow' }, h('h3', null, m.title), h('div', { class: 'small muted' }, m.sections.length + ' Abschnitte · ' + labs + ' Praxisaufgaben')),
        moduleProgress(m)));
  }

  function viewModule(m) {
    const firstOpen = m.sections.findIndex((s) => !Store.isRead(s.id));
    const t = C.course.examTasks.find((x) => x.no === m.exam);
    return [
      h('a', { class: 'backlink', href: m.exam ? '#a' + m.exam : '#lernen' }, 'Zurück zu Lernen'),
      h('div', { class: 'card stack' },
        h('div', { class: 'row' }, h('span', { class: 'glyph big' }, m.glyph),
          h('div', { class: 'grow' }, h('div', { class: 'small muted' }, 'Skript ' + scriptName(m.part) + ', ' + m.pages), h('h2', null, m.title))),
        rich(m.goal, 'prose'),
        t ? h('div', { class: 'row wrap small' }, h('span', { class: 'pill exam' }, 'Klausur Aufgabe ' + t.no), h('span', { class: 'muted' }, t.title + ', zusammen etwa ' + t.pct + ' %')) : null),
      h('div', { class: 'card stack-s' },
        m.sections.map((s, i) => {
          const done = (s.practice || []).filter((id) => Store.state(id)).length;
          const n = (s.practice || []).length;
          return h('a', { href: '#' + s.id, style: 'color:inherit;text-decoration:none;display:block;padding:7px 0' + (i ? ';border-top:1px solid var(--line)' : '') },
            h('div', { class: 'row' },
              h('span', { style: 'width:22px;height:22px;flex:none;color:var(--' + (Store.isRead(s.id) ? 'good' : 'faint') + ')' }, icon(Store.isRead(s.id) ? 'check' : 'circle')),
              h('div', { class: 'grow' }, h('div', { style: 'font-weight:600', html: md(s.title) }), h('div', { class: 'tiny muted' }, 'Theorie' + (n ? ' + ' + n + (n === 1 ? ' Praxisaufgabe' : ' Praxisaufgaben') + (done ? ', ' + done + ' bearbeitet' : '') : ''))),
              icon2('right')));
        })),
      h('a', { class: 'btn pri full', href: '#' + m.sections[Math.max(0, firstOpen)].id, style: 'text-decoration:none' }, firstOpen === -1 ? 'Nochmal lesen' : firstOpen === 0 ? 'Mit Abschnitt 1 starten' : 'Weiter mit Abschnitt ' + (firstOpen + 1)),
      h('button', { type: 'button', class: 'btn line full', onclick: () => startSession(m.title, buildQuestions(Calc.shuffle(m.questions.map((q) => q.id).concat(m.calcs || []))), m.id) }, 'Alle ' + (m.questions.length + (m.calcs || []).length) + ' Aufgaben gemischt üben')
    ];
  }

  function viewSection(m, idx, mode) {
    const s = m.sections[idx];
    const practice = s.practice || [];
    const nextSection = m.sections[idx + 1];
    const toNext = () => (nextSection ? nextSection.id : m.id);
    const nextLabel = nextSection ? 'Weiter: ' + nextSection.title.replace(/\*\*/g, '') : 'Modul abschließen';
    const head = [
      h('a', { class: 'backlink', href: '#' + m.id, html: md(m.title) }),
      h('div', { class: 'stack-s' },
        h('div', { class: 'row small muted' }, h('div', { class: 'grow bar' }, h('i', { style: 'width:' + ((idx + (mode === 'praxis' ? 0.7 : 0.25)) / m.sections.length) * 100 + '%;background:var(--teal)' })), h('span', { class: 'num' }, idx + 1 + ' von ' + m.sections.length)),
        h('h1', { style: 'font-size:1.55rem', html: md(s.title) })),
      practice.length ? segmented([{ id: 'theorie', label: 'Theorie' }, { id: 'praxis', label: 'Praxis (' + practice.length + ')' }], mode, (id) => go(id === 'praxis' ? s.id + '-praxis' : s.id)) : null
    ];
    if (mode === 'praxis' && practice.length) {
      const host = h('div', { class: 'stack' });
      Store.markRead(s.id, m.id);
      const out = head.concat(host);
      setTimeout(() => runSession(host, {
        questions: buildQuestions(practice),
        finish: () => h('div', { class: 'stack-s', style: 'width:100%' },
          h('a', { class: 'btn pri full', href: '#' + toNext(), style: 'text-decoration:none' }, nextLabel),
          h('a', { class: 'btn line full', href: '#' + s.id, style: 'text-decoration:none' }, 'Theorie nochmal lesen'))
      }), 0);
      return out;
    }
    return head.concat(
      renderBlocks(s.blocks),
      practice.length
        ? h('button', { type: 'button', class: 'btn pri full', onclick: () => { Store.markRead(s.id, m.id); go(s.id + '-praxis'); } }, 'Verstanden: zur Praxis (' + practice.length + (practice.length === 1 ? ' Aufgabe)' : ' Aufgaben)'))
        : h('button', { type: 'button', class: 'btn pri full', onclick: () => { Store.markRead(s.id, m.id); go(toNext()); } }, 'Verstanden: ' + nextLabel)
    );
  }

  // ---------------------------------------------------------------------------
  // Sitzungen (Wiederholen, Trainer)
  // ---------------------------------------------------------------------------
  function startSession(name, questions, back) {
    session = { name, questions, back };
    go('sitzung');
  }
  function viewSession() {
    if (!session) return viewHome();
    const host = h('div', { class: 'stack' });
    const s = session;
    setTimeout(() => runSession(host, { questions: s.questions, finish: () => h('a', { class: 'btn pri full', href: '#' + s.back, style: 'text-decoration:none' }, 'Fertig') }), 0);
    return [h('a', { class: 'backlink', href: '#' + s.back }, 'Beenden'), h('h1', { style: 'font-size:1.5rem' }, s.name), host];
  }

  function viewReview() {
    const host = h('div', { class: 'stack' });
    const draw = (tab) => {
      const lists = {
        due: { ids: Store.dueIDs(), head: (n) => (n ? n + ' Aufgaben sind fällig' : 'Alles erledigt'), text: 'Jede Antwort wird gespeichert. Richtige Aufgaben kommen in immer größeren Abständen wieder, falsche schon nach kurzer Zeit.', action: 'Jetzt wiederholen', title: 'Wiederholung' },
        weak: { ids: Store.weakIDs(), head: (n) => (n ? n + ' Schwachstellen' : 'Keine Schwächen gespeichert'), text: 'Aufgaben, die du zuletzt falsch hattest oder noch nicht sicher kannst.', action: 'Schwächen trainieren', title: 'Schwächen trainieren' },
        all: { ids: Store.learnedIDs(), head: (n) => (n ? n + ' bearbeitete Aufgaben' : 'Noch nichts bearbeitet'), text: 'Alles, was du schon geübt hast. Starte in Lernen, dann füllt sich diese Liste.', action: '15 zufällige Aufgaben', title: 'Gemischte Wiederholung', sample: 15 }
      }[tab];
      const ids = lists.ids;
      const start = lists.sample ? Calc.shuffle(ids).slice(0, lists.sample) : ids;
      host.replaceChildren(
        h('div', { class: 'card stack-s' }, h('h2', null, lists.head(ids.length)), h('p', { class: 'small muted' }, lists.text),
          ids.length ? h('button', { type: 'button', class: 'btn pri full', onclick: () => startSession(lists.title, buildQuestions(start), 'wiederholen') }, lists.action) : null),
        ids.slice(0, 60).map((id) => {
          const st = Store.state(id);
          const gen = Calc.list().find((g) => g.id === id);
          const label = gen ? gen.title : questionIndex[id] ? questionIndex[id].q.q.replace(/\*\*/g, '').replace(/`/g, '') : id;
          return h('button', { type: 'button', class: 'card tight', onclick: () => startSession('Einzelaufgabe', buildQuestions([id]), 'wiederholen') },
            h('div', { class: 'row' }, h('span', { style: 'width:20px;height:20px;flex:none;color:var(--' + (st.lastCorrect ? 'good' : 'bad') + ')' }, icon(st.lastCorrect ? 'check' : 'cross')),
              h('div', { class: 'grow' }, h('div', { class: 'small', style: 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' }, label), h('div', { class: 'tiny muted num' }, st.correct + '× richtig, ' + st.wrong + '× falsch'))));
        }));
    };
    draw('due');
    return [title(null, 'Wiederholen'), segmented([{ id: 'due', label: 'Fällig' }, { id: 'weak', label: 'Schwächen' }, { id: 'all', label: 'Gelerntes' }], 'due', draw), host];
  }

  function viewTrainer() {
    const list = Calc.list();
    return [
      title(null, 'Trainer', 'Jede Aufgabe wird neu erzeugt und mit Lösungsweg erklärt. So kannst du Hülle, Überdeckung, Normalformen und Division beliebig oft üben, ohne die Originalklausur zu verbrauchen.'),
      h('button', { type: 'button', class: 'btn pri full', onclick: () => startSession('Trainer-Mix', Calc.shuffle(list).slice(0, 10).map((g) => Calc.make(g.id)), 'trainer') }, '10 gemischte Aufgaben'),
      Calc.groups().map((g) => h('section', { class: 'stack-s' },
        h('h2', { style: 'padding-top:8px' }, g),
        list.filter((x) => x.group === g).map((x) => {
          const st = Store.state(x.id);
          return h('button', { type: 'button', class: 'card tight', onclick: () => startSession(x.title, Array.from({ length: 5 }, () => Calc.make(x.id)), 'trainer') },
            h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h3', null, x.title), h('div', { class: 'small muted', style: 'font-family:var(--math)' }, x.formula)),
              st ? h('span', { style: 'width:20px;height:20px;flex:none;color:var(--' + (st.lastCorrect ? 'good' : 'warn') + ')' }, icon(st.lastCorrect ? 'check' : 'half')) : null, icon2('right')));
        })))
    ];
  }

  // ---------------------------------------------------------------------------
  // Klausur-Simulation
  // ---------------------------------------------------------------------------
  function viewExamHub() {
    const results = Store.data.exams;
    return [
      title(null, 'Klausur', C.course.examIntro),
      exam && exam.stage === 'run' ? h('a', { class: 'btn pri full', href: '#pruefung', style: 'text-decoration:none' }, 'Zurück zur laufenden ' + exam.def.title) : null,
      h('div', { class: 'call ex' }, icon('target'), h('div', { class: 'prose' }, h('span', { class: 'tag' }, 'Originalklausur bleibt frei'), h('span', { html: md(C.course.examNote) }))),
      relTable({ title: 'Aufbau wie in der Klausur 2025 (Anteile geschätzt)', head: ['Aufgabe', 'Thema', 'Min.', 'Anteil'], rows: C.course.examTasks.map((t) => ['A' + t.no, t.title, String(t.min), t.pct + ' %']) }, { data: false }),
      C.exams.map((e) => {
        const best = results.filter((r) => r.examId === e.id).sort((a, b) => b.percent - a.percent)[0];
        return h('div', { class: 'card stack-s' },
          h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h3', null, e.title), h('div', { class: 'small muted' }, e.scenario)), best ? h('span', { class: 'pill ' + (best.percent >= 50 ? 'good' : 'bad') + ' num' }, 'Bestwert ' + Math.round(best.percent) + ' %') : null),
          h('button', { type: 'button', class: 'btn pri', onclick: () => startExam(e) }, e.minutes + ' Minuten starten'));
      }),
      results.length ? h('section', { class: 'stack-s' }, h('h2', null, 'Bisherige Versuche'), results.slice(0, 10).map((r) =>
        h('div', { class: 'card tight row' }, h('div', { class: 'grow' }, h('div', { class: 'small', style: 'font-weight:600' }, r.title), h('div', { class: 'tiny muted' }, new Date(r.date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }))),
          h('b', { class: 'num', style: 'color:var(--' + (r.percent >= 50 ? 'good' : 'bad') + ')' }, Math.round(r.percent) + ' %')))) : null
    ];
  }

  function startExam(e) {
    const drafts = {};
    e.tasks.forEach((t) => t.questions.forEach((q) => (drafts[q.id] = freshDraft(q))));
    exam = { def: e, drafts, stage: 'run', task: 0, left: e.minutes * 60, timer: null };
    exam.timer = setInterval(() => {
      if (!exam || exam.stage !== 'run') return;
      exam.left--;
      const el = document.getElementById('exam-timer');
      if (el) {
        el.textContent = clock(exam.left);
        el.classList.toggle('low', exam.left < 300);
      }
      if (exam.left <= 0) submitExam();
    }, 1000);
    go('pruefung');
  }
  const clock = (s) => String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0') + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

  function submitExam() {
    clearInterval(exam.timer);
    const hasOpen = exam.def.tasks.some((t) => t.questions.some((q) => q.k === 'open'));
    exam.stage = hasOpen ? 'review' : 'result';
    if (!hasOpen) saveExam();
    route();
    window.scrollTo({ top: 0 });
  }
  const examPoints = () => {
    let got = 0;
    let max = 0;
    const perTask = exam.def.tasks.map((t) => {
      let g = 0;
      let m = 0;
      t.questions.forEach((q) => {
        g += scoreDraft(q, exam.drafts[q.id]) * q.pts;
        m += q.pts;
      });
      got += g;
      max += m;
      return { no: t.no, title: t.title, got: g, max: m };
    });
    return { got, max, perTask };
  };
  function saveExam() {
    if (exam.saved) return;
    exam.saved = true;
    const p = examPoints();
    exam.def.tasks.forEach((t) => t.questions.forEach((q) => {
      const s = scoreDraft(q, exam.drafts[q.id]);
      Store.record(q.id, s >= 0.999 ? 'good' : s >= 0.5 ? 'hard' : 'wrong');
    }));
    Store.addExam({ examId: exam.def.id, title: exam.def.title, date: Date.now(), points: p.got, maxPoints: p.max, percent: p.max ? (p.got / p.max) * 100 : 0, minutes: exam.def.minutes, count: p.perTask.length });
  }

  // Zweimal tippen, damit ein versehentlicher Tipp die Klausur nicht beendet.
  function submitButton(cls, style) {
    const b = h('button', { type: 'button', class: cls, style, onclick: () => {
      if (b.dataset.armed) return submitExam();
      b.dataset.armed = '1';
      b.textContent = 'Wirklich abgeben?';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Abgeben'; } }, 4000);
    } }, 'Abgeben');
    return b;
  }

  function viewExamRun() {
    if (!exam) return viewExamHub();
    const e = exam.def;
    if (exam.stage === 'run') {
      const t = e.tasks[exam.task];
      const drawTask = () => t.questions.map((q) =>
        h('div', { class: 'card stack' }, questionHeader(q), q.fig ? renderBlock(q.fig) : null, questionInput(q, exam.drafts[q.id], {})));
      const header = h('div', { class: 'card tight stack-s sticky-top' },
        h('div', { class: 'row' }, h('span', { id: 'exam-timer', class: 'timer' + (exam.left < 300 ? ' low' : '') }, clock(exam.left)), h('span', { class: 'grow small muted' }, e.title),
          submitButton('btn s pri')),
        h('div', { class: 'task-nav' }, e.tasks.map((x, i) => h('button', { type: 'button', class: i === exam.task ? 'on' : undefined, onclick: () => { exam.task = i; route(); window.scrollTo({ top: 0 }); } }, 'A' + x.no))));
      return [
        header,
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, t.no + '. Aufgabe: ' + t.title), h('span', { class: 'pill num' }, t.pts + ' P.')),
        t.intro ? rich(t.intro, 'prose') : null,
        t.fig ? renderBlock(t.fig) : null,
        drawTask(),
        h('div', { class: 'btns' },
          exam.task > 0 ? h('button', { type: 'button', class: 'btn line', style: 'flex:1', onclick: () => { exam.task--; route(); window.scrollTo({ top: 0 }); } }, 'Zurück') : null,
          exam.task < e.tasks.length - 1 ? h('button', { type: 'button', class: 'btn pri', style: 'flex:1', onclick: () => { exam.task++; route(); window.scrollTo({ top: 0 }); } }, 'Weiter') : submitButton('btn pri', 'flex:1'))
      ];
    }
    if (exam.stage === 'review') {
      const open = e.tasks.flatMap((t) => t.questions.filter((q) => q.k === 'open').map((q) => ({ q, t })));
      return [
        title('Abgegeben', 'Offene Aufgaben bewerten', 'Vergleiche deine Antwort oder deine Zeichnung mit der Musterlösung und hake ab, was du hattest.'),
        open.map(({ q, t }) => h('div', { class: 'card stack' }, h('div', { class: 'eyebrow' }, 'Aufgabe ' + t.no), questionHeader(q), q.fig ? renderBlock(q.fig) : null, questionInput(q, exam.drafts[q.id], { locked: true, showSolution: true }), q.sol ? renderBlocks(q.sol) : null)),
        h('button', { type: 'button', class: 'btn pri full', onclick: () => { exam.stage = 'result'; saveExam(); route(); window.scrollTo({ top: 0 }); } }, 'Auswertung anzeigen')
      ];
    }
    const p = examPoints();
    const ratio = p.max ? p.got / p.max : 0;
    return [
      title(e.title, 'Auswertung'),
      h('div', { class: 'card stack', style: 'align-items:center;text-align:center' },
        h('span', { style: 'position:relative;width:128px;height:128px;display:block' }, ring(ratio, 128, ratio >= 0.5 ? 'var(--good)' : 'var(--bad)', 12), h('b', { class: 'num', style: 'position:absolute;inset:0;display:grid;place-items:center;font-size:1.6rem' }, Math.round(ratio * 100) + ' %')),
        h('b', { class: 'num' }, p.got.toFixed(1).replace('.', ',') + ' von ' + p.max + ' Punkten')),
      h('div', { class: 'card wchart' }, p.perTask.map((t) => h('div', { class: 'wrow', style: 'cursor:default' },
        h('span', { class: 'lab' }, h('span', null, h('b', null, 'A' + t.no), ' ' + t.title), h('span', { class: 'val' }, t.got.toFixed(1).replace('.', ',') + ' / ' + t.max)),
        h('span', { class: 'wtrack' }, h('span', { class: 'w', style: 'width:100%' }, h('span', { class: 'm', style: 'width:' + (t.max ? (t.got / t.max) * 100 : 0) + '%' })))))),
      e.tasks.map((t) => [
        h('h2', { style: 'padding-top:6px' }, t.no + '. Aufgabe: ' + t.title),
        t.fig ? renderBlock(t.fig) : null,
        t.questions.map((q) => h('div', { class: 'card stack' }, questionHeader(q), q.fig ? renderBlock(q.fig) : null, questionInput(q, exam.drafts[q.id], { locked: true, showSolution: true }), solutionPanel(q, scoreDraft(q, exam.drafts[q.id]))))
      ]),
      h('a', { class: 'btn pri full', href: '#klausur', style: 'text-decoration:none', onclick: () => { exam = null; } }, 'Zurück zur Übersicht')
    ];
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const TABS = [
    { id: 'heute', label: 'Heute', icon: 'home' },
    { id: 'lernen', label: 'Lernen', icon: 'book' },
    { id: 'wiederholen', label: 'Wiederholen', icon: 'repeat' },
    { id: 'trainer', label: 'Trainer', icon: 'bolt' },
    { id: 'klausur', label: 'Klausur', icon: 'timer' }
  ];
  function drawTabs(active) {
    const due = Store.dueIDs().length;
    const nav = document.getElementById('tabs');
    nav.replaceChildren(
      h('div', { class: 'brand' }, 'Datenbanken', h('span', null, 'Lerntool')),
      ...TABS.map((t) => h('button', { type: 'button', class: t.id === active ? 'on' : undefined, 'aria-current': t.id === active ? 'page' : undefined, onclick: () => go(t.id) }, icon(t.icon), h('span', null, t.label), t.id === 'wiederholen' && due ? h('span', { class: 'badge' }, String(due)) : null)));
  }

  function route() {
    const hash = location.hash.replace('#', '') || 'heute';
    let active = 'lernen';
    let content;
    const sec = /^(m\d+)s(\d+)(-praxis)?$/.exec(hash);
    const mod = /^m\d+$/.exec(hash);
    const task = /^a(\d)$/.exec(hash);
    if (sec && moduleOf(sec[1])) {
      const m = moduleOf(sec[1]);
      const idx = m.sections.findIndex((s) => s.id === sec[1] + 's' + sec[2]);
      content = idx >= 0 ? viewSection(m, idx, sec[3] ? 'praxis' : 'theorie') : viewModule(m);
    } else if (mod && moduleOf(hash)) {
      content = viewModule(moduleOf(hash));
    } else if (task) {
      content = viewLearn('a' + task[1]);
    } else {
      switch (hash) {
        case 'lernen': content = viewLearn(); break;
        case 'wiederholen': active = 'wiederholen'; content = viewReview(); break;
        case 'trainer': active = 'trainer'; content = viewTrainer(); break;
        case 'klausur': active = 'klausur'; content = viewExamHub(); break;
        case 'pruefung': active = 'klausur'; content = viewExamRun(); break;
        case 'sitzung': active = session && session.back === 'trainer' ? 'trainer' : 'wiederholen'; content = viewSession(); break;
        default: active = 'heute'; content = viewHome();
      }
    }
    const v = view();
    v.replaceChildren(...[content].flat(Infinity).filter(Boolean));
    drawTabs(active);
    document.title = 'Datenbanken Lerntool';
  }

  window.addEventListener('hashchange', () => { route(); });
  window.DBApp = { route, modules, makeQuestion, viewOf: { viewHome, viewLearn, viewModule, viewSection, viewReview, viewTrainer, viewExamHub } };
  route();
})();
