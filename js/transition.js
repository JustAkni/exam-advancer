/* =====================================================================
   js/transition.js — анимация перехода между страницами.

   Как работает: клик по внутренней ссылке → по экрану наискосок выезжает
   деревянный «занавес» (.curtain) → страница меняется → на новой странице
   занавес уезжает в другую сторону, а панели и записки появляются сами (CSS).

   Новая страница узнаёт, что пришла «через занавес», по флагу sessionStorage 'pt':
   его читает маленький скрипт в <head> каждой страницы и ставит класс
   html.pt-arrive (занавес уже закрывает экран до первой отрисовки — без «вспышки»).

   Отключается само, если в системе включено «уменьшить движение».
   Ссылки с target="_blank", download, якоря и ссылки на другие сайты не трогаются.
   ===================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false, curtain = null;

  function go(url) {
    if (busy) return;
    busy = true;
    curtain = document.createElement('div');
    curtain.className = 'curtain';
    document.body.appendChild(curtain);
    void curtain.offsetWidth;                 // запустить CSS-анимацию
    curtain.classList.add('go');
    try { sessionStorage.setItem('pt', '1'); } catch (e) { /* приватный режим */ }
    setTimeout(function () { window.location.href = url; }, 430);
  }

  document.addEventListener('click', function (e) {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href, window.location.href); } catch (err) { return; }
    if (u.origin !== window.location.origin) return;
    if (u.pathname === window.location.pathname && u.search === window.location.search) return; // тот же адрес / якорь
    e.preventDefault();
    go(u.href);
  });

  /* Возврат кнопкой «Назад»: страница достаётся из кэша вместе с закрытым занавесом — убираем. */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      busy = false;
      if (curtain) { curtain.remove(); curtain = null; }
      document.documentElement.classList.remove('pt-arrive');
    }
  });
})();
