/* =====================================================================
   js/layout.js — общие элементы страницы:
   • две круглые кнопки в правом верхнем углу: 🕰️/🎸 (дизайн) и 🌙/☀️ (тема);
   • верхняя шапка (hot-bar) с навигацией — её видно ТОЛЬКО в старом дизайне
     (в новом она скрыта через CSS, навигация там — записки на доске).
   Подключается ПОСЛЕ store.js и ДО theme.js: theme.js цепляет обработчики
   к кнопкам #themeToggle и #designToggle, которые создаёт этот файл.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u');
  var cfg = Quiz.config, el = Quiz.u.el;

  function build() {
    if (document.getElementById('themeToggle')) return;
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    function link(href, text) {
      return el('a', { class: 'nav-btn-text' + (page === href ? ' active' : ''), href: href, text: text });
    }
    document.body.insertBefore(el('header', { class: 'hot-bar' },
      el('a', { class: 'logo-area', href: cfg.HOME_PAGE, text: cfg.SITE_TITLE }),
      el('nav', { class: 'top-nav-links' },
        link('index.html', '🏠 Главный экран'),
        link('compiler.html', '🧩 Компилятор тестов'),
        link('admin.html', '✏️ Редактор'))), document.body.firstChild);

    document.body.appendChild(el('button', { id: 'designToggle', class: 'fab fab-design', type: 'button' }));
    document.body.appendChild(el('button', { id: 'themeToggle', class: 'fab', type: 'button', title: 'Сменить тему' }));
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  Quiz.layout = { build: build };
})();
