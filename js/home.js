/* =====================================================================
   js/home.js — главная страница (index.html): меню в стиле K-On! PSP.

   Фон — images/classroom1.png. Внизу (или сверху / сбоку — на выбор) стоит
   наклонная деревянная доска-пробка, на ней приколоты записки: по одной на
   каждую дисциплину + «Компилятор тестов» + «Редактор» + «Вид меню».

   Положение панели меняется кнопкой «Вид меню»: сторона (низ / верх / слева /
   справа), направление кнопок (ряд / колонка) и наклон (0°, 10°, 16°, 20°).
   Настройки хранятся в localStorage (ключ Quiz.config.KEYS.dock).

   Список дисциплин строится АВТОМАТИЧЕСКИ из Quiz.store.all(): добавить
   дисциплину можно через compiler.html или положив файл в data/ (см. README).
   Записки дисциплин, сохранённых в браузере, можно удалить крестиком ✕.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme');
  var cfg = Quiz.config, T = cfg.T, el = Quiz.u.el, clear = Quiz.u.clear, add = Quiz.u.add;
  var app = document.getElementById('app');
  if (!app) { console.error('home.js: не найден #app в index.html'); return; }

  /* ---------- настройки положения панели ---------- */
  var SIDES = [['bottom', 'Снизу'], ['top', 'Сверху'], ['left', 'Слева'], ['right', 'Справа']];
  var FLOWS = [['row', 'Горизонтально'], ['column', 'Вертикально']];
  var ANGLES = [[0, 'Ровно'], [10, '10°'], [16, '16°'], [20, '20°']];

  function defFlow(side) { return side === 'left' || side === 'right' ? 'column' : 'row'; }
  function loadView() {
    var v = { side: 'bottom', flow: 'row', angle: 16 };
    try {
      var p = JSON.parse(localStorage.getItem(cfg.KEYS.dock) || 'null');
      if (p && SIDES.some(function (s) { return s[0] === p.side; })) v.side = p.side;
      v.flow = p && (p.flow === 'row' || p.flow === 'column') ? p.flow : defFlow(v.side);
      if (p && ANGLES.some(function (a) { return a[0] === p.angle; })) v.angle = p.angle;
    } catch (e) { /* битые данные — берём значения по умолчанию */ }
    return v;
  }
  function saveView() { try { localStorage.setItem(cfg.KEYS.dock, JSON.stringify(view)); } catch (e) { /* ignore */ } }
  var view = loadView();

  function applyView() {
    app.dataset.side = view.side;
    if (dock) {
      dock.dataset.side = view.side;
      dock.dataset.flow = view.flow;
      dock.style.setProperty('--angle-n', String(-view.angle));
    }
  }

  /* ---------- окно «Вид меню» ---------- */
  function openSheet() {
    var back = el('div', { class: 'sheet-back', onclick: function (e) { if (e.target === back) back.remove(); } });
    function group(title, items, current, onPick) {
      var chips = el('div', { class: 'chips' });
      items.forEach(function (it) {
        chips.appendChild(el('button', {
          type: 'button', class: 'chip' + (it[0] === current ? ' on' : ''), text: it[1],
          onclick: function () { onPick(it[0]); redraw(); }
        }));
      });
      return el('div', { class: 'group' }, el('b', { text: title }), chips);
    }
    function redraw() {
      applyView(); saveView();
      clear(back).appendChild(el('div', { class: 'sheet framed' },
        el('h3', { text: T.viewTitle }),
        group(T.viewSide, SIDES, view.side, function (v) { view.side = v; view.flow = defFlow(v); }),
        group(T.viewFlow, FLOWS, view.flow, function (v) { view.flow = v; }),
        group(T.viewAngle, ANGLES, view.angle, function (v) { view.angle = v; }),
        el('div', { class: 'toolbar', style: 'margin:6px 0 0' },
          el('button', { class: 'btn btn-ghost', type: 'button', text: T.viewReset,
            onclick: function () { view = { side: 'bottom', flow: 'row', angle: 16 }; redraw(); } }),
          el('button', { class: 'btn', type: 'button', text: T.close, onclick: function () { back.remove(); } }))));
    }
    redraw();
    document.body.appendChild(back);
  }

  /* 1 вопрос, 2 вопроса, 5 вопросов */
  function plural(n) {
    var m10 = n % 10, m100 = n % 100;
    return n + ' ' + (m10 === 1 && m100 !== 11 ? 'вопрос' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'вопроса' : 'вопросов');
  }

  /* ---------- записки ---------- */
  var ROT = [-2.2, 1.6, -1, 2.4, -1.8, 1.1, -2.6, 0.8];
  var TINT = ['', 't2', 't3', 't4'];
  var dock = null;

  function noteFor(d, i) {
    var link = el('a', { class: 'note-link', href: 'quiz.html?' + cfg.URL_PARAM + '=' + encodeURIComponent(d.id) },
      el('span', { class: 'note-title', text: d.title }),
      el('span', { class: 'note-sub', text: plural(d.questions.length) }));
    var del = d.origin === 'file' ? null : el('button', {
      class: 'note-del', type: 'button', title: 'Удалить', 'aria-label': 'Удалить', text: '✕',
      onclick: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (confirm(T.deleteConfirm + '\n«' + d.title + '»')) { Quiz.store.removeLocal(d.id); render(); }
      }
    });
    return el('div', { class: 'note ' + TINT[i % TINT.length], style: '--r:' + ROT[i % ROT.length] + 'deg;--i:' + i }, link, del);
  }

  function render() {
    var list = Quiz.store.all(), warns = Quiz.store.warnings();
    var notes = list.map(noteFor);
    var n = list.length;

    if (!n) notes.push(el('div', { class: 'note t4', style: '--r:1.2deg;--i:0;cursor:default' },
      el('span', { class: 'note-title', text: T.noDisciplines }),
      el('span', { class: 'note-sub', text: '→' })));

    notes.push(el('a', { class: 'note t3', style: '--r:-1.4deg;--i:' + (n + 1), href: 'compiler.html' },
      el('span', { class: 'note-ico', text: '🧩' }),
      el('span', { class: 'note-title', text: T.compilerNote }),
      el('span', { class: 'note-sub', text: T.compilerSub })));
    notes.push(el('a', { class: 'note t4', style: '--r:1.1deg;--i:' + (n + 2), href: 'admin.html' },
      el('span', { class: 'note-ico', text: '✏️' }),
      el('span', { class: 'note-title', text: T.editorNote }),
      el('span', { class: 'note-sub', text: T.editorSub })));
    notes.push(el('button', { class: 'note note-view t2', type: 'button', style: '--r:1.8deg;--i:' + (n + 3), onclick: openSheet },
      el('span', { class: 'note-ico', text: '🎛' }),
      el('span', { class: 'note-title', text: T.viewNote }),
      el('span', { class: 'note-sub', text: T.viewSub })));

    var oldDock = dock;
    dock = el('nav', { class: 'dock', 'aria-label': T.chooseSub },
      el('div', { class: 'board-frame' }, el('div', { class: 'cork' }, notes)));
    applyView();
    /* колесо мыши листает ряд записок вбок */
    var cork = dock.querySelector('.cork');
    cork.addEventListener('wheel', function (e) {
      if (dock.dataset.flow === 'row' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { cork.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });

    clear(app).append(
      el('header', { class: 'game-title' }, el('h1', { text: T.chooseSection }), el('p', { text: T.chooseSub })),
      warns.length ? el('div', { class: 'game-notice' }, T.dataWarning, el('ul', null, warns.map(function (w) { return el('li', { text: w }); }))) : document.createComment(''),
      dock);
    if (oldDock) { /* повторная отрисовка (после удаления) — без повторной анимации входа */
      dock.querySelector('.board-frame').style.animation = 'none';
      Array.prototype.forEach.call(dock.querySelectorAll('.note'), function (nn) { nn.style.animation = 'none'; });
    }
  }

  applyView();
  Quiz.store.load().then(render);
})();
