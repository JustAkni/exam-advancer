/* =====================================================================
   js/layout.js — верхняя шапка (hot-bar) на всех страницах.
   Один файл вместо копирования HTML шапки в каждую страницу.
   Подключается ПОСЛЕ store.js и ДО theme.js (theme.js цепляет обработчик
   к кнопке #themeToggle, которую создаёт этот файл).
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u');
  var cfg = Quiz.config, el = Quiz.u.el;

  function build() {
    if (document.querySelector('.hot-bar')) return;
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

    function link(href, text) {
      return el('a', { class: 'nav-btn-text' + (page === href ? ' active' : ''), href: href, text: text });
    }
    var bar = el('header', { class: 'hot-bar' },
      el('a', { class: 'logo-area', href: cfg.HOME_PAGE, text: cfg.SITE_TITLE }),
      el('nav', { class: 'top-nav-links' },
        link('index.html', '🏠 Главный экран'),
        link('compiler.html', '🧩 Компилятор тестов'),
        cfg.ADMIN_ENABLED ? link('admin.html', '✏️ Редактор') : null),
      el('div', { class: 'nav-actions' },
        el('button', { id: 'themeToggle', class: 'nav-btn', type: 'button', title: 'Сменить тему' })));
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  Quiz.layout = { build: build };
})();
