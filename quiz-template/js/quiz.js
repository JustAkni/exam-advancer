/* =====================================================================
   js/quiz.js — ДВИЖОК теста (страница quiz.html).
   Здесь НЕТ вопросов — только логика. Вопросы приходят из Quiz.store.

   Экраны:  выбор количества  →  вопросы  →  результаты (+ разбор ошибок)
   Состояние теста — один объект `state` (ниже). Все экраны рисуются из него.

   [НЕ УДАЛЯТЬ]
   • Quiz.auth.guard() в начале — иначе тест открывается без входа.
   • Ответы выбираются по id ответа (a0, a1…), а не по тексту: в данных
     бывают одинаковые по тексту варианты (в старом finance — 4 случая).
   • Порядок ответов (item.order) перемешивается ОДИН раз при старте теста.
     В старой версии он менялся при каждом возврате к вопросу.

   [МОДЕРНИЗАЦИЯ — куда расширять, не ломая остальное]
   • Таймер / режим «экзамен» (без подсказок до конца): добавьте поле в
     state и ветку в checkAnswer()/showQuestion().
   • Статистика ошибок: у каждого вопроса есть стабильный q.id — копите
     {q.id: ошибок} в localStorage в showResults().
   • Новый тип вопроса (текстовый ввод, сопоставление): добавьте q.type в
     checkQuestion() (store.js), отрисовку в renderAnswers(), проверку в isCorrect().
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme', 'auth');
  if (!Quiz.auth.guard()) return;

  var cfg = Quiz.config, T = cfg.T;
  var el = Quiz.u.el, clear = Quiz.u.clear, shuffle = Quiz.u.shuffle;

  var root = document.getElementById('quiz');
  var titleEl = document.getElementById('categoryTitle');
  if (!root) { console.error('quiz.js: в quiz.html не найден #quiz'); return; }

  /* ---------- состояние ---------- */
  var state = {
    mode: 'setup',          // 'setup' | 'quiz' | 'results'
    discipline: null,
    items: [],              // [{ q, order:[id ответов в показанном порядке] }]
    current: 0,
    answers: new Map()      // индекс вопроса → { selected:Set(id), checked:bool, correct:bool }
  };
  var ui = { question: null, nav: null, grid: null }; // контейнеры экрана вопросов

  /* ---------- запуск ---------- */
  var disciplineId = new URLSearchParams(window.location.search).get(cfg.URL_PARAM);

  /* [БЫЛО В ОРИГИНАЛЕ] при неверной категории делался alert + redirect,
     но код продолжал выполняться и падал на category.toUpperCase().
     Теперь — спокойное сообщение со ссылкой на меню. */
  Quiz.store.load().then(function () {
    var d = disciplineId ? Quiz.store.get(disciplineId) : null;
    if (!d) { showMessage(T.notFound); return; }
    state.discipline = d;
    if (titleEl) titleEl.textContent = d.title;
    document.title = d.title + ' — ' + cfg.SITE_TITLE;
    showSetup();
  });

  function showMessage(text) {
    state.mode = 'setup';
    clear(root).appendChild(el('div', { class: 'question-block' },
      el('p', { text: text }),
      el('p', null, el('a', { class: 'btn btn-primary', href: cfg.HOME_PAGE, text: T.toMenu }))
    ));
  }

  /* ---------- экран 1: количество вопросов ---------- */
  function showSetup() {
    state.mode = 'setup';
    var total = state.discipline.questions.length;
    if (!total) { showMessage(T.emptyDiscipline); return; }

    var btns = cfg.COUNT_PRESETS.filter(function (n) { return n < total; }).map(function (n) {
      return el('button', { class: 'btn btn-ghost', type: 'button', text: n + ' ' + T.questionsWord, onclick: function () { startQuiz(n); } });
    });
    btns.push(el('button', { class: 'btn btn-primary', type: 'button', text: T.allQuestions + ' (' + total + ')', onclick: function () { startQuiz(total); } }));

    var input = el('input', { type: 'number', min: 1, max: total, placeholder: T.customCount });
    var custom = el('div', { class: 'row' }, input,
      el('button', {
        class: 'btn', type: 'button', text: T.start,
        onclick: function () { startQuiz(Math.min(total, Math.max(1, parseInt(input.value, 10) || 1))); }
      }));

    clear(root).appendChild(el('div', { class: 'question-block count-picker' },
      el('h3', { text: T.pickCount }),
      el('div', { class: 'row' }, btns),
      custom
    ));
  }

  /* ---------- старт теста ---------- */
  function startQuiz(count) {
    var all = state.discipline.questions;
    var pool = cfg.SHUFFLE_QUESTIONS ? shuffle(all) : all.slice();
    state.items = pool.slice(0, count).map(function (q) {
      var ids = q.answers.map(function (a) { return a.id; });
      return { q: q, order: cfg.SHUFFLE_ANSWERS ? shuffle(ids) : ids };
    });
    state.current = 0;
    state.answers = new Map();
    state.mode = 'quiz';

    ui.question = el('div');
    ui.nav = el('div', { class: 'navigation-panel' });
    ui.grid = el('div', { class: 'question-grid' });
    clear(root).append(ui.question, ui.nav, ui.grid);
    buildGrid();
    showQuestion(0);
  }

  /* ---------- проверка ---------- */
  /* Засчитывается только ПОЛНОЕ совпадение выбранного с правильными.
     Для обычного вопроса (1 правильный) это обычная проверка. */
  function isCorrect(q, selected) {
    var right = q.answers.filter(function (a) { return a.correct; }).map(function (a) { return a.id; });
    return right.length === selected.size && right.every(function (id) { return selected.has(id); });
  }
  function answerById(q, id) { return q.answers.filter(function (a) { return a.id === id; })[0]; }

  function onPick(i, aid) {
    var q = state.items[i].q;
    var rec = state.answers.get(i) || { selected: new Set(), checked: false, correct: false };
    if (rec.checked) return;                 // уже проверено — менять нельзя
    if (q.multi) {
      if (rec.selected.has(aid)) rec.selected.delete(aid); else rec.selected.add(aid);
      state.answers.set(i, rec);
      showQuestion(i);                        // перерисовать подсветку выбора
    } else {
      rec.selected = new Set([aid]);
      state.answers.set(i, rec);
      checkAnswer(i);                         // обычный вопрос — проверяем сразу, как раньше
    }
  }

  function checkAnswer(i) {
    var rec = state.answers.get(i);
    if (!rec || rec.checked || !rec.selected.size) return;
    rec.checked = true;
    rec.correct = isCorrect(state.items[i].q, rec.selected);
    showQuestion(i);
  }

  /* ---------- экран 2: вопрос ---------- */
  function showQuestion(i) {
    state.current = i;
    var item = state.items[i], q = item.q;
    var rec = state.answers.get(i);
    var checked = !!(rec && rec.checked);

    var answersBox = el('div', { class: 'answers' }, item.order.map(function (aid) {
      var a = answerById(q, aid);
      var sel = !!(rec && rec.selected.has(aid));
      var cls = 'answer' + (q.multi ? ' multi' : '');
      if (checked) { if (a.correct) cls += ' correct'; else if (sel) cls += ' wrong'; }
      else if (sel) cls += ' selected';
      return el('button', {
        type: 'button', class: cls, text: a.text, disabled: checked,
        'aria-pressed': sel ? 'true' : 'false',
        onclick: function () { onPick(i, aid); }
      });
    }));

    clear(ui.question).appendChild(el('div', { class: 'question-block' },
      el('h3', { text: T.question + ' ' + (i + 1) + ' ' + T.of + ' ' + state.items.length }),
      el('div', { class: 'question-text', text: q.question }),
      q.multi ? el('div', { class: 'question-hint', text: T.multiHint }) : null,
      answersBox,
      q.multi && !checked ? el('button', {
        class: 'btn btn-primary', type: 'button', text: T.check, style: 'margin-top:12px',
        disabled: !(rec && rec.selected.size), onclick: function () { checkAnswer(i); }
      }) : null,
      checked && q.explanation ? el('div', { class: 'explanation', text: q.explanation }) : null
    ));

    renderNav();
    updateGrid();
  }

  function renderNav() {
    var i = state.current, last = i === state.items.length - 1;
    clear(ui.nav).append(
      el('button', {
        class: 'btn', type: 'button', text: T.prev, disabled: i === 0,
        onclick: function () { showQuestion(i - 1); }
      }),
      el('button', {
        class: 'btn' + (last ? ' btn-primary finish-btn' : ''), type: 'button',
        text: last ? T.finish : T.next,
        onclick: function () { if (last) showResults(); else showQuestion(i + 1); }
      }),
      el('button', {
        class: 'btn btn-warning', type: 'button', text: T.finishEarly,
        onclick: function () { if (confirm(T.finishConfirm)) showResults(); }
      }),
      el('a', { class: 'btn home-btn', href: cfg.HOME_PAGE, text: T.toMenu })
    );
  }

  /* ---------- сетка номеров ---------- */
  function buildGrid() {
    clear(ui.grid).appendChild(el('div', { class: 'grid' }, state.items.map(function (_, i) {
      return el('button', {
        type: 'button', class: 'grid-question', text: String(i + 1), 'data-index': i,
        onclick: function () { showQuestion(i); }
      });
    })));
  }
  function updateGrid() {
    var nodes = ui.grid.querySelectorAll('.grid-question');
    Array.prototype.forEach.call(nodes, function (btn, i) {
      var cls = 'grid-question';
      if (i === state.current) cls += ' current';
      var rec = state.answers.get(i);
      if (rec && rec.checked) cls += rec.correct ? ' answered-correct' : ' answered-wrong';
      btn.className = cls;
    });
  }

  /* ---------- экран 3: результаты ---------- */
  function showResults() {
    state.mode = 'results';
    var total = state.items.length;
    var checked = Array.from(state.answers.values()).filter(function (r) { return r.checked; });
    var correct = checked.filter(function (r) { return r.correct; }).length;
    var wrong = checked.length - correct;
    var skipped = total - checked.length;
    var percent = total ? Math.round(correct / total * 100) : 0; // [НЕ УДАЛЯТЬ] total ? … : 0 — защита от деления на 0

    function stat(cls, label, value) {
      return el('div', { class: 'stat-item ' + cls }, el('span', { text: label }), el('span', { class: 'stat-value', text: String(value) }));
    }

    clear(root).appendChild(el('div', { class: 'results-container' },
      el('h2', { class: 'results-title', text: T.results }),
      stat('total', T.totalScore, percent + '% (' + correct + ' ' + T.of + ' ' + total + ')'),
      stat('correct', T.correctWord, correct),
      stat('wrong', T.wrongWord, wrong),
      stat('', T.skippedWord, skipped),
      renderReview(),
      el('div', { class: 'results-actions' },
        el('button', { class: 'btn btn-success', type: 'button', text: T.again, onclick: showSetup }),
        el('a', { class: 'btn home-btn', href: cfg.HOME_PAGE, text: T.toMenu })
      )
    ));
  }

  /* Разбор: все вопросы, на которые ответили неверно или пропустили. */
  function renderReview() {
    var rows = [];
    state.items.forEach(function (item, i) {
      var rec = state.answers.get(i);
      if (rec && rec.checked && rec.correct) return;
      var q = item.q;
      var mine = rec && rec.selected.size
        ? q.answers.filter(function (a) { return rec.selected.has(a.id); }).map(function (a) { return a.text; }).join('; ')
        : T.noAnswer;
      var right = q.answers.filter(function (a) { return a.correct; }).map(function (a) { return a.text; }).join('; ');
      rows.push(el('details', null,
        el('summary', { text: (i + 1) + '. ' + q.question }),
        el('div', { class: 'review-body' },
          el('p', { class: 'bad', text: T.yourAnswer + ' ' + mine }),
          el('p', { class: 'ok', text: T.rightAnswer + ' ' + right }),
          q.explanation ? el('p', { class: 'muted', text: q.explanation }) : null)));
    });
    return rows.length ? el('div', { class: 'review' }, el('h3', { text: T.review + ' (' + rows.length + ')' }), rows) : null;
  }

  /* ---------- клавиатура: 1–9 выбрать вариант, ←/→ листать ---------- */
  document.addEventListener('keydown', function (e) {
    if (state.mode !== 'quiz' || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var i = state.current;
    if (e.key >= '1' && e.key <= '9') {
      var aid = state.items[i].order[Number(e.key) - 1];
      if (aid) onPick(i, aid);
    } else if (e.key === 'ArrowRight' && i < state.items.length - 1) showQuestion(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) showQuestion(i - 1);
  });
})();
