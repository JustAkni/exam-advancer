/* =====================================================================
   js/assistant.js — маленький помощник 🤖 в углу страницы теста
   (как в старой версии): подбадривает при ошибках, предупреждает о
   времени и позволяет настроить вид: выравнивание, фон, прозрачность.
   Настройки лежат в localStorage (ql_align, ql_bg, ql_opacity — как раньше).
   Если элемента #quiz-wrapper нет — настройки вида просто не применяются.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u');
  var el = Quiz.u.el;

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var st = { align: get('ql_align', 'center'), bg: get('ql_bg', 'box'), opacity: parseInt(get('ql_opacity', '100'), 10) || 100,
             open: false, wrongStreak: 0, timer: null };
  var LINES = ['Не унывай! Ошибки — часть обучения 💪', 'Бывает! Попробуй ещё раз — всё получится 🌟', 'Каждая ошибка делает тебя умнее! 🧠'];
  var popup, controls, bAlign, bBg, bOp;

  function apply() {
    var w = document.getElementById('quiz-wrapper');
    if (w) {
      w.classList.toggle('layout-left', st.align === 'left');
      w.classList.toggle('bg-full', st.bg === 'full');
    }
    document.documentElement.style.setProperty('--box-opacity', String(st.opacity / 100));
    if (bAlign) bAlign.textContent = st.align === 'center' ? '◀ Текст' : '▶ Текст';
    if (bBg) bBg.textContent = st.bg === 'box' ? '▣ Фон' : '▤ Фон';
    if (bOp) bOp.textContent = '◈ ' + st.opacity + '%';
  }

  function say(msg) {
    if (!popup) return;
    popup.textContent = msg;
    popup.classList.remove('hidden');
    clearTimeout(st.timer);
    st.timer = setTimeout(function () { if (!st.open) popup.classList.add('hidden'); }, 5000);
  }

  function init() {
    if (popup) return;
    bAlign = el('button', { class: 'assistant-ctrl-btn', type: 'button', title: 'Выравнивание', onclick: function () {
      st.align = st.align === 'center' ? 'left' : 'center'; set('ql_align', st.align); apply(); } });
    bBg = el('button', { class: 'assistant-ctrl-btn', type: 'button', title: 'Фон', onclick: function () {
      st.bg = st.bg === 'box' ? 'full' : 'box'; set('ql_bg', st.bg); apply(); } });
    bOp = el('button', { class: 'assistant-ctrl-btn', type: 'button', title: 'Прозрачность', onclick: function () {
      st.opacity = st.opacity === 100 ? 75 : st.opacity === 75 ? 50 : 100; set('ql_opacity', String(st.opacity)); apply(); } });
    controls = el('div', { class: 'assistant-controls hidden' }, bAlign, bBg, bOp);
    popup = el('div', { class: 'assistant-popup hidden' });
    document.body.appendChild(el('div', { class: 'assistant-bubble' }, controls, popup,
      el('button', { class: 'assistant-toggle', type: 'button', title: 'Ассистент', text: '🎸', onclick: function () {
        st.open = !st.open;
        controls.classList.toggle('hidden', !st.open);
        popup.classList.toggle('hidden', !st.open);
        if (st.open && !popup.textContent) popup.textContent = 'Удачи на тесте! Читай внимательно 🎯';
      } })));
    apply();
  }

  Quiz.assistant = {
    init: init, say: say,
    onWrong: function () {
      st.wrongStreak++;
      if (st.wrongStreak % (5 + Math.floor(Math.random() * 6)) === 0) say(LINES[Math.floor(Math.random() * LINES.length)]);
    },
    onCorrect: function () { st.wrongStreak = 0; }
  };
})();
