/* =====================================================================
   js/quiz.js — ДВИЖОК теста (страница quiz.html).
   Здесь НЕТ вопросов — только логика. Вопросы приходят из Quiz.store.

   Экраны:  настройка (кол-во, таймер, «Настоящий экзамен»)  →  вопросы  →  результаты

   РЕЖИМЫ
   • Обычный: на вопрос с ОДНИМ правильным ответом проверка происходит сразу
     после клика по варианту. Если правильных несколько (multi) — отмечаете
     варианты и жмёте «Подтвердить ответ». После проверки ответ менять нельзя.
   • «Настоящий экзамен» (state.exam): правильные/неправильные ответы НЕ
     показываются, ответы можно менять сколько угодно, пока не завершите тест.
     Итоги и разбор (где верно, где нет) — только в конце.
   • Таймер (необязательно): считает по часам (Date.now), поэтому не «уплывает»,
     если вкладка была в фоне. В обычном режиме по окончании ответы блокируются,
     в экзамене тест завершается сам.

   [НЕ УДАЛЯТЬ]
   • Quiz.auth.guard() в начале — иначе тест открывается без входа.
   • Ответы выбираются по id ответа (a0, a1…), а не по тексту.
   • Порядок ответов (item.order) перемешивается ОДИН раз при старте теста.
   • total ? … : 0 в результатах — защита от деления на 0.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme', 'auth');
  if (!Quiz.auth.guard()) return;

  var cfg = Quiz.config, T = cfg.T;
  var el = Quiz.u.el, clear = Quiz.u.clear, shuffle = Quiz.u.shuffle, add = Quiz.u.add;
  var bot = Quiz.assistant || { init: function () {}, say: function () {}, onWrong: function () {}, onCorrect: function () {} };

  var root = document.getElementById('quiz');
  var titleEl = document.getElementById('categoryTitle');
  if (!root) { console.error('quiz.js: в quiz.html не найден #quiz'); return; }

  /* ---------- состояние ---------- */
  var state = {
    mode: 'setup',          // 'setup' | 'quiz' | 'results'
    discipline: null,
    items: [],              // [{ q, order:[id ответов в показанном порядке] }]
    current: 0,
    answers: new Map(),     // индекс вопроса → { selected:Set(id), checked:bool, correct:bool }
    exam: false,
    startedAt: 0, endedAt: 0,
    timer: { on: false, minutes: 0, endAt: 0, id: null, expired: false, warned: {} }
  };
  /* выбор на экране настройки (сохраняется между попытками) */
  var setup = { size: 0, timerOn: false, minutes: cfg.TIMER_DEFAULT, exam: false };
  var ui = { bar: null, left: null, note: null, question: null, nav: null, grid: null };

  var disciplineId = new URLSearchParams(window.location.search).get(cfg.URL_PARAM);

  Quiz.store.load().then(function () {
    var d = disciplineId ? Quiz.store.get(disciplineId) : null;
    if (!d) { showMessage(T.notFound); return; }
    state.discipline = d;
    if (titleEl) titleEl.textContent = d.title;
    document.title = d.title + ' — ' + cfg.SITE_TITLE;
    bot.init();
    showSetup();
  });

  function showMessage(text) {
    state.mode = 'setup';
    clear(root).appendChild(el('div', { class: 'question-block' },
      el('p', { text: text }),
      el('p', null, el('a', { class: 'btn btn-primary', href: cfg.HOME_PAGE, text: T.toMenu }))
    ));
  }

  /* ---------- утилиты времени ---------- */
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function timerMax(count) { return count >= cfg.BIG_TEST ? cfg.TIMER_MAX_BIG : cfg.TIMER_MAX; }

  /* =====================================================================
     ЭКРАН 1: настройка теста
     ===================================================================== */
  function showSetup() {
    stopTimer();
    state.mode = 'setup';
    var total = state.discipline.questions.length;
    if (!total) { showMessage(T.emptyDiscipline); return; }
    if (!setup.size || setup.size > total) setup.size = total;

    var sizeBtns = [], startArea = el('div', { class: 'setup-start' });
    var range, timeVal, timeBox, customInput, hintEl = el('p', { class: 'hint' });

    function refreshStart() {
      clear(startArea).appendChild(el('button', {
        class: 'btn btn-primary btn-big', type: 'button', text: T.startBtn,
        onclick: function () { startQuiz(setup.size); }
      }));
    }
    function markSize() {
      sizeBtns.forEach(function (b) { b.classList.toggle('active', Number(b.dataset.n) === setup.size && !customInput.value); });
    }
    function syncRange() {
      var max = timerMax(setup.size);
      range.max = max;
      if (setup.minutes > max) setup.minutes = max;
      range.value = setup.minutes;
      timeVal.textContent = setup.minutes + ' ' + T.minWord;
      hintEl.textContent = T.timerHint + ' (' + cfg.TIMER_MIN + '–' + max + ' ' + T.minWord + '):';
      Array.prototype.forEach.call(timeBox.querySelectorAll('.setup-time-btn'), function (b) {
        b.classList.toggle('active', Number(b.dataset.m) === setup.minutes);
        b.disabled = Number(b.dataset.m) > max;
        b.style.opacity = b.disabled ? '0.4' : '';
      });
    }
    function pickSize(n) { setup.size = n; customInput.value = ''; markSize(); syncRange(); }

    var sizes = cfg.COUNT_PRESETS.filter(function (n) { return n < total; });
    sizes.push(total);
    sizes.forEach(function (n) {
      sizeBtns.push(el('button', {
        class: 'setup-size-btn', type: 'button', dataset: { n: n },
        text: n === total ? '📋 ' + T.allQuestions + ' (' + n + ')' : n + ' ' + T.questionsWord,
        onclick: function () { pickSize(n); }
      }));
    });

    customInput = el('input', { type: 'number', min: 1, max: total, placeholder: T.customCount,
      oninput: function () {
        var v = parseInt(customInput.value, 10);
        if (v >= 1) { setup.size = Math.min(total, v); markSize(); syncRange(); }
      } });

    range = el('input', { type: 'range', min: cfg.TIMER_MIN, max: timerMax(setup.size), step: cfg.TIMER_STEP,
      oninput: function () { setup.minutes = parseInt(range.value, 10); syncRange(); } });
    timeVal = el('span', { class: 'time-value' });
    timeBox = el('div', { class: 'setup-sub' + (setup.timerOn ? '' : ' hidden') },
      hintEl,
      el('div', { class: 'setup-row' }, range, timeVal),
      el('div', { class: 'setup-row', style: 'margin-top:10px' }, cfg.TIMER_PRESETS.map(function (m) {
        return el('button', { class: 'setup-time-btn', type: 'button', text: m + ' ' + T.minWord, dataset: { m: m },
          onclick: function () { setup.minutes = Math.min(m, timerMax(setup.size)); syncRange(); } });
      })));

    var timerCheck = el('input', { type: 'checkbox', onchange: function () {
      setup.timerOn = timerCheck.checked; timeBox.classList.toggle('hidden', !setup.timerOn); syncRange();
    } });
    timerCheck.checked = setup.timerOn;
    var examCheck = el('input', { type: 'checkbox', id: 'exam-check', onchange: function () { setup.exam = examCheck.checked; } });
    examCheck.checked = setup.exam;

    clear(root).appendChild(el('div', { class: 'question-block fade-in' },
      el('h3', { class: 'setup-title', text: T.setupTitle }),
      el('p', { class: 'setup-label', text: T.pickCount }),
      el('div', { class: 'setup-row' }, sizeBtns),
      el('div', { class: 'setup-row setup-custom', style: 'margin-top:12px' }, customInput),

      el('div', { class: 'setup-section' },
        el('p', { class: 'setup-label', text: T.timerTitle }),
        el('label', { class: 'setup-check' }, timerCheck, el('span', { text: T.timerOn })),
        timeBox),

      el('div', { class: 'setup-section' },
        el('p', { class: 'setup-label', text: T.examTitle }),
        el('div', { class: 'exam-box' },
          el('label', { class: 'setup-check' }, examCheck,
            el('span', null, T.examOn, el('small', { text: T.examHelp }))))),

      startArea));

    markSize(); syncRange(); refreshStart();
  }

  /* =====================================================================
     старт теста
     ===================================================================== */
  function startQuiz(count) {
    var all = state.discipline.questions;
    var pool = cfg.SHUFFLE_QUESTIONS ? shuffle(all) : all.slice();
    state.items = pool.slice(0, count).map(function (q) {
      var ids = q.answers.map(function (a) { return a.id; });
      return { q: q, order: cfg.SHUFFLE_ANSWERS ? shuffle(ids) : ids };
    });
    state.current = 0;
    state.answers = new Map();
    state.exam = !!setup.exam;
    state.startedAt = Date.now();
    state.endedAt = 0;
    state.mode = 'quiz';

    var t = state.timer;
    stopTimer();
    t.on = !!setup.timerOn;
    t.minutes = t.on ? Math.min(setup.minutes, timerMax(count)) : 0;
    t.expired = false;
    t.warned = {};
    t.endAt = t.on ? Date.now() + t.minutes * 60000 : 0;

    ui.question = el('div');
    ui.nav = el('div', { class: 'navigation-panel' });
    ui.grid = el('div', { class: 'question-grid' });
    ui.bar = (t.on || state.exam) ? buildBar() : null;
    clear(root);
    if (ui.bar) root.appendChild(ui.bar);
    add(root, ui.question, ui.nav, ui.grid);
    buildGrid();
    showQuestion(0);
    if (t.on) { tick(); t.id = setInterval(tick, 500); }
  }

  /* ---------- таймер ---------- */
  function buildBar() {
    var t = state.timer;
    ui.left = el('span', { class: 'timer-left', text: t.on ? fmt(t.minutes * 60) : '' });
    ui.note = el('span', { class: 'timer-note' });
    var bar = el('div', { class: 'timer-bar' },
      state.exam ? el('span', { class: 'mode-badge', text: T.examBadge }) : null,
      t.on ? el('span', { class: 'timer-total', text: fmt(t.minutes * 60) }) : null,
      t.on ? el('span', { class: 'timer-sep', text: '|' }) : null,
      t.on ? ui.left : null,
      ui.note);
    return bar;
  }
  function updateNote() {
    if (!ui.note) return;
    if (state.exam) {
      var n = 0;
      state.answers.forEach(function (r) { if (r.selected.size) n++; });
      ui.note.textContent = T.answeredWord + ' ' + n + ' ' + T.of + ' ' + state.items.length;
    }
  }
  function stopTimer() {
    if (state.timer.id) { clearInterval(state.timer.id); state.timer.id = null; }
  }
  function tick() {
    var t = state.timer;
    if (!t.on || t.expired || state.mode !== 'quiz') return;
    var left = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
    if (ui.left) {
      ui.left.textContent = fmt(left);
      ui.left.classList.toggle('danger', left <= 300 && t.minutes * 60 > 300);
      ui.left.classList.toggle('warn', left > 300 && left <= 600 && t.minutes * 60 > 600);
    }
    [600, 300, 60].forEach(function (s) {
      if (left <= s && left > 0 && t.minutes * 60 > s && !t.warned[s]) {
        t.warned[s] = true;
        bot.say(s >= 120 ? '⏰ Осталось ' + (s / 60) + ' минут!' : '🚨 Осталась 1 минута!');
      }
    });
    if (left <= 0) expire();
  }
  function expire() {
    var t = state.timer;
    t.expired = true;
    stopTimer();
    if (ui.bar) ui.bar.classList.add('expired');
    bot.say(T.timeOut);
    if (state.exam) showResults();       // экзамен завершается сам
    else showQuestion(state.current);    // обычный: блокируем ответы, остаётся «Завершить тест»
  }

  /* =====================================================================
     проверка
     ===================================================================== */
  /* Засчитывается только ПОЛНОЕ совпадение выбранного с правильными. */
  function isCorrect(q, selected) {
    var right = q.answers.filter(function (a) { return a.correct; }).map(function (a) { return a.id; });
    return right.length === selected.size && right.every(function (id) { return selected.has(id); });
  }
  function answerById(q, id) { return q.answers.filter(function (a) { return a.id === id; })[0]; }
  function getRec(i) {
    var rec = state.answers.get(i);
    if (!rec) { rec = { selected: new Set(), checked: false, correct: false }; state.answers.set(i, rec); }
    return rec;
  }

  function onPick(i, aid) {
    if (state.timer.expired) return;
    var q = state.items[i].q, rec = getRec(i);

    if (state.exam) {
      /* Экзамен: просто запоминаем выбор; менять можно сколько угодно. */
      if (q.multi) { if (rec.selected.has(aid)) rec.selected.delete(aid); else rec.selected.add(aid); }
      else if (rec.selected.has(aid)) rec.selected.clear();   // повторный клик — снять ответ
      else rec.selected = new Set([aid]);
      showQuestion(i);
      return;
    }

    if (rec.checked) return;                    // обычный режим: проверенный ответ менять нельзя
    if (q.multi) {                              // несколько правильных — выбор + «Подтвердить ответ»
      if (rec.selected.has(aid)) rec.selected.delete(aid); else rec.selected.add(aid);
      showQuestion(i);
    } else {                                    // один правильный — проверка сразу после клика
      rec.selected = new Set([aid]);
      checkAnswer(i);
    }
  }

  function checkAnswer(i) {
    var rec = state.answers.get(i);
    if (!rec || rec.checked || !rec.selected.size || state.timer.expired) return;
    rec.checked = true;
    rec.correct = isCorrect(state.items[i].q, rec.selected);
    if (rec.correct) bot.onCorrect(); else bot.onWrong();
    showQuestion(i);
  }

  /* =====================================================================
     ЭКРАН 2: вопрос
     ===================================================================== */
  function showQuestion(i) {
    state.current = i;
    var item = state.items[i], q = item.q;
    var rec = state.answers.get(i);
    var checked = !!(rec && rec.checked) && !state.exam;
    var expired = state.timer.expired;
    var locked = checked || expired;

    var answersBox = el('div', { class: 'answers' }, item.order.map(function (aid) {
      var a = answerById(q, aid);
      var sel = !!(rec && rec.selected.has(aid));
      var cls = 'answer' + (q.multi ? ' multi' : '');
      if (checked) { if (a.correct) cls += ' correct'; else if (sel) cls += ' wrong'; }
      else if (sel) cls += ' selected';
      if (expired && !checked) cls += ' locked';
      return el('button', {
        type: 'button', class: cls, text: a.text, disabled: locked,
        'aria-pressed': sel ? 'true' : 'false',
        onclick: function () { onPick(i, aid); }
      });
    }));

    var showConfirm = q.multi && !state.exam && !locked;
    var showClear = state.exam && !expired && rec && rec.selected.size > 0;

    clear(ui.question).appendChild(el('div', { class: 'question-block' },
      el('h3', { text: T.question + ' ' + (i + 1) + ' ' + T.of + ' ' + state.items.length }),
      el('div', { class: 'question-text', text: q.question }),
      q.multi ? el('div', { class: 'question-hint', text: T.multiHint }) : null,
      answersBox,
      showConfirm ? el('div', { class: 'confirm-row' }, el('button', {
        class: 'btn btn-primary', type: 'button', text: T.check,
        disabled: !(rec && rec.selected.size), onclick: function () { checkAnswer(i); }
      })) : null,
      showClear ? el('div', { class: 'confirm-row' }, el('button', {
        class: 'btn btn-ghost btn-small', type: 'button', text: T.clearAnswer,
        onclick: function () { rec.selected.clear(); showQuestion(i); }
      })) : null,
      checked && q.explanation ? el('div', { class: 'explanation', text: q.explanation }) : null
    ));

    renderNav();
    updateGrid();
    updateNote();
  }

  function renderNav() {
    var i = state.current, last = i === state.items.length - 1;
    var expired = state.timer.expired;
    var btns = [
      el('button', { class: 'btn', type: 'button', text: T.prev, disabled: i === 0,
        onclick: function () { showQuestion(i - 1); } })
    ];
    if (!last) {
      btns.push(el('button', { class: 'btn', type: 'button', text: T.next, onclick: function () { showQuestion(i + 1); } }));
    } else if (!state.exam) {
      btns.push(el('button', { class: 'btn btn-primary finish-btn', type: 'button', text: T.finish, onclick: showResults }));
    } else {
      btns.push(el('button', { class: 'btn', type: 'button', text: T.next, disabled: true }));
    }
    if (state.exam) {
      btns.push(el('button', { class: 'btn btn-primary finish-btn', type: 'button', text: T.finishExam, onclick: finishExam }));
    } else if (!expired && !last) {
      btns.push(el('button', { class: 'btn btn-warning', type: 'button', text: T.finishEarly,
        onclick: function () { if (confirm(T.finishConfirm)) showResults(); } }));
    } else if (expired && !last) {
      btns.push(el('button', { class: 'btn btn-primary finish-btn', type: 'button', text: T.finish, onclick: showResults }));
    }
    btns.push(el('a', { class: 'btn home-btn', href: cfg.HOME_PAGE, text: T.toMenu }));
    add(clear(ui.nav), btns);
  }

  function finishExam() {
    var left = 0;
    state.items.forEach(function (_, i) { var r = state.answers.get(i); if (!r || !r.selected.size) left++; });
    var msg = left ? T.finishExamConfirm + left + T.finishExamConfirm2 : T.finishExamConfirm2.replace(/^\.\s*/, '');
    if (confirm(msg)) showResults();
  }

  /* ---------- сетка номеров ---------- */
  function buildGrid() {
    add(clear(ui.grid),
      el('div', { class: 'question-grid-label', text: T.navLabel }),
      el('div', { class: 'grid' }, state.items.map(function (_, i) {
        return el('button', { type: 'button', class: 'grid-question', text: String(i + 1),
          onclick: function () { showQuestion(i); } });
      })));
  }
  function updateGrid() {
    var nodes = ui.grid.querySelectorAll('.grid-question');
    Array.prototype.forEach.call(nodes, function (btn, i) {
      var cls = 'grid-question';
      var rec = state.answers.get(i);
      if (state.exam) { if (rec && rec.selected.size) cls += ' answered'; }
      else if (rec && rec.checked) cls += rec.correct ? ' answered-correct' : ' answered-wrong';
      if (i === state.current) cls += ' current';
      btn.className = cls;
    });
  }

  /* =====================================================================
     ЭКРАН 3: результаты
     ===================================================================== */
  /* 'ok' | 'bad' | 'skip' для вопроса i */
  function verdict(i) {
    var rec = state.answers.get(i), q = state.items[i].q;
    if (state.exam) {
      if (!rec || !rec.selected.size) return 'skip';
      return isCorrect(q, rec.selected) ? 'ok' : 'bad';
    }
    if (!rec || !rec.checked) return 'skip';
    return rec.correct ? 'ok' : 'bad';
  }

  function showResults() {
    stopTimer();
    state.mode = 'results';
    state.endedAt = Date.now();
    var total = state.items.length;
    var v = state.items.map(function (_, i) { return verdict(i); });
    var correct = v.filter(function (x) { return x === 'ok'; }).length;
    var wrong = v.filter(function (x) { return x === 'bad'; }).length;
    var skipped = total - correct - wrong;
    var percent = total ? Math.round(correct / total * 100) : 0;   // [НЕ УДАЛЯТЬ] total ? … : 0
    var used = Math.round((state.endedAt - state.startedAt) / 1000);
    var t = state.timer;
    if (t.on) used = Math.min(used, t.minutes * 60);

    function stat(cls, label, value) {
      return el('div', { class: 'stat-item ' + cls }, el('span', { text: label }), el('span', { class: 'stat-value', text: String(value) }));
    }

    var reviewBox = el('div', { class: 'review' });
    var filter = state.exam ? 'all' : 'bad';
    function drawReview() { renderReview(reviewBox, v, filter, function (f) { filter = f; drawReview(); }); }
    drawReview();

    var gridEl = el('div', { class: 'question-grid review-grid' }, el('div', { class: 'grid' }, v.map(function (x, i) {
      return el('button', { type: 'button', class: 'grid-question ' + (x === 'ok' ? 'answered-correct' : x === 'bad' ? 'answered-wrong' : 'skipped'), text: String(i + 1),
        title: x === 'ok' ? T.okWord : x === 'bad' ? T.badWord : T.skipWord,
        onclick: function () {
          if (filter === 'bad' && x === 'ok') { filter = 'all'; drawReview(); }
          var d = document.getElementById('rv-' + i);
          if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } });
    })));

    clear(root).appendChild(el('div', { class: 'results-container fade-in' },
      el('div', { class: 'results-emoji', text: percent >= 80 ? '🏆' : percent >= 50 ? '👍' : '📚' }),
      el('h2', { class: 'results-title', text: state.exam ? T.examResult : T.results }),
      t.expired ? el('p', { class: 'results-alert', text: T.timeOut }) : null,
      el('div', { class: 'results-percent', text: percent + '%' }),
      stat('total', T.totalScore, correct + ' ' + T.of + ' ' + total),
      stat('correct', '✅ ' + T.correctWord, correct),
      stat('wrong', '❌ ' + T.wrongWord, wrong),
      stat('skipped', '⏭️ ' + T.skippedWord, skipped),
      stat('', T.usedTime, fmt(used)),
      t.on ? stat('', T.chosenTime, fmt(t.minutes * 60)) : null,
      t.on ? stat('', T.timeLeftEnd, fmt(Math.max(0, t.minutes * 60 - used))) : null,
      gridEl,
      reviewBox,
      el('div', { class: 'results-actions' },
        el('button', { class: 'btn btn-success', type: 'button', text: T.again, onclick: showSetup }),
        el('a', { class: 'btn home-btn', href: cfg.HOME_PAGE, text: T.toMenu }))
    ));
    window.scrollTo({ top: 0 });
  }

  /* Разбор: по каждому вопросу — все варианты, правильные зелёным, ваши ошибки красным. */
  function renderReview(box, v, filter, setFilter) {
    var list = [];
    state.items.forEach(function (item, i) {
      if (filter === 'bad' && v[i] === 'ok') return;
      var q = item.q, rec = state.answers.get(i);
      var sel = rec ? rec.selected : new Set();
      var icon = v[i] === 'ok' ? '✅' : v[i] === 'bad' ? '❌' : '⬜';
      var lis = item.order.map(function (aid) {
        var a = answerById(q, aid), mine = sel.has(aid);
        var cls = a.correct ? 'rv-right' : mine ? 'rv-bad' : '';
        return el('li', { class: cls, text: (a.correct ? '✔ ' : mine ? '✖ ' : '• ') + a.text + (mine ? '   ← ваш ответ' : '') });
      });
      list.push(el('details', { id: 'rv-' + i, class: 'is-' + v[i], open: v[i] !== 'ok' && filter === 'bad' },
        el('summary', { text: icon + ' ' + (i + 1) + '. ' + q.question }),
        el('div', { class: 'review-body' },
          el('ul', { class: 'rv' }, lis),
          v[i] === 'skip' ? el('p', { class: 'rv-note', text: T.noAnswer }) : null,
          q.explanation ? el('p', { class: 'rv-note', text: q.explanation }) : null)));
    });
    add(clear(box),
      el('div', { class: 'review-head' },
        el('h3', { text: T.reviewTitle + ' (' + list.length + ')' }),
        el('div', { class: 'review-filter' },
          el('button', { class: 'btn ' + (filter === 'all' ? 'btn-primary' : 'btn-ghost'), type: 'button', text: T.reviewAll, onclick: function () { setFilter('all'); } }),
          el('button', { class: 'btn ' + (filter === 'bad' ? 'btn-primary' : 'btn-ghost'), type: 'button', text: T.reviewWrong, onclick: function () { setFilter('bad'); } }))),
      list);
  }

  /* ---------- клавиатура: 1–9 выбрать вариант, Enter — подтвердить, ←/→ листать ---------- */
  document.addEventListener('keydown', function (e) {
    if (state.mode !== 'quiz' || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var i = state.current;
    if (e.key >= '1' && e.key <= '9') {
      var aid = state.items[i].order[Number(e.key) - 1];
      if (aid) onPick(i, aid);
    } else if (e.key === 'Enter' && !state.exam && state.items[i].q.multi) {
      checkAnswer(i);
    } else if (e.key === 'ArrowRight' && i < state.items.length - 1) showQuestion(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) showQuestion(i - 1);
  });
})();
