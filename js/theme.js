/* =====================================================================
   js/theme.js — светлая/тёмная тема (кнопка 🌙/☀️) и переключатель ДИЗАЙНА
   (кнопка рядом: 🕰️ — включить старый красно-белый дизайн, 🪵 — вернуть новый).
   Один файл на ВСЕ страницы. Дизайн — это атрибут <html data-design="classic">;
   страницы и функции те же, меняется только CSS (блок «КЛАССИЧЕСКИЙ ДИЗАЙН» в style.css).

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
  var KEY = Quiz.config.KEYS.theme, DKEY = Quiz.config.KEYS.design;
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

  function isClassic() { return document.documentElement.getAttribute('data-design') === 'classic'; }
  function updateDesignButton() {
    var b = document.getElementById('designToggle');
    if (!b) return;
    b.textContent = isClassic() ? '🪵' : '🕰️';
    b.title = isClassic() ? 'Вернуть новый дизайн' : 'Старый дизайн (красно-белый)';
    b.setAttribute('aria-label', b.title);
  }
  function applyDesign(classic) {
    if (classic) document.documentElement.setAttribute('data-design', 'classic');
    else document.documentElement.removeAttribute('data-design');
    try { localStorage.setItem(DKEY, classic ? 'classic' : 'new'); } catch (e) { /* приватный режим */ }
    updateDesignButton();
  }

  function init() {
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    var btn = document.getElementById('themeToggle');
    if (!btn) {
      /* запасной вариант: шапки (layout.js) нет — рисуем плавающую кнопку */
      btn = el('button', { id: 'themeToggle', class: 'nav-btn', type: 'button',
        style: 'position:fixed;right:16px;bottom:16px;z-index:9999;background:var(--card);box-shadow:var(--shadow)' });
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', function () { apply(!isDark()); });
    updateButton();

    var db = document.getElementById('designToggle');
    if (db) db.addEventListener('click', function () { applyDesign(!isClassic()); });
    updateDesignButton();
  }

  Quiz.theme = { applyDesign: applyDesign, isClassic: isClassic, apply: apply, toggle: function () { apply(!isDark()); }, isDark: isDark, init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
