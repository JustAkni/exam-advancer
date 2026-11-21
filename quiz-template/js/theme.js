/* =====================================================================
   js/theme.js — светлая/тёмная тема + кнопка 🌙/☀️. Один файл на ВСЕ страницы.

   Как это работает: на <html> ставится атрибут data-theme="dark", а в
   css/style.css цвета берутся из переменных (:root / [data-theme="dark"]).
   Чтобы поменять цвета — правьте переменные в CSS, а не этот файл.

   [БЫЛО В ОРИГИНАЛЕ] тема переключалась классом body.dark-theme, а
   auth.js перерисовывал весь body (innerHTML) — приходилось заново
   «возвращать тему» и дублировать кнопку в каждом HTML. Теперь кнопка
   создаётся здесь один раз, и перерисовка страниц ей не мешает.

   [НЕ УДАЛЯТЬ] маленький скрипт в <head> каждой страницы:
     try{if(localStorage.getItem('theme')==='dark')
         document.documentElement.setAttribute('data-theme','dark')}catch(e){}
   Он применяет тему ДО отрисовки (без «белой вспышки»). Ключ 'theme' должен
   совпадать с Quiz.config.KEYS.theme.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u');
  var KEY = Quiz.config.KEYS.theme;
  var el = Quiz.u.el;

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function updateButton() {
    var b = document.getElementById('themeToggle');
    if (b) {
      b.textContent = isDark() ? '☀️' : '🌙';
      b.setAttribute('aria-label', isDark() ? 'Светлая тема' : 'Тёмная тема');
    }
  }

  function apply(dark) {
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) { /* приватный режим */ }
    updateButton();
  }

  function init() {
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    if (!document.getElementById('themeToggle')) {
      document.body.appendChild(el('button', {
        id: 'themeToggle', class: 'theme-toggle-btn', type: 'button',
        onclick: function () { apply(!isDark()); }
      }));
    }
    updateButton();
  }

  Quiz.theme = { apply: apply, toggle: function () { apply(!isDark()); }, isDark: isDark, init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
