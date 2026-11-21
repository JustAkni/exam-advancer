/* =====================================================================
   js/auth.js — экран «Зайти» и проверка входа.

   [ВАЖНО] Это НЕ защита данных. isLoggedIn — обычная запись в localStorage;
   любой может написать localStorage.isLoggedIn='true' в консоли или просто
   открыть файлы data/*.js. Для приватности нужен сервер.

   [БЫЛО В ОРИГИНАЛЕ → ИСПРАВЛЕНО]
   • quiz.html не проверял вход — по прямой ссылке тест открывался без «Зайти».
     Теперь каждая страница вызывает Quiz.auth.guard().
   • auth.js перезаписывал document.body.innerHTML и ломал страницу, если
     подключить его не на главной. Теперь он только отвечает за флаг входа,
     а рисует экран логина home.js.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config');
  var cfg = Quiz.config, KEY = cfg.KEYS.login;

  function isLoggedIn() {
    if (!cfg.AUTH_ENABLED) return true;
    try { return localStorage.getItem(KEY) === 'true'; } catch (e) { return false; }
  }
  function login() { try { localStorage.setItem(KEY, 'true'); } catch (e) { /* ignore */ } }
  function logout() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  /* Вызывайте первой строкой в скрипте любой страницы, кроме index.html:
       if (!Quiz.auth.guard()) return;                                   */
  function guard() {
    if (isLoggedIn()) return true;
    window.location.replace(cfg.HOME_PAGE);
    return false;
  }

  Quiz.auth = { isLoggedIn: isLoggedIn, login: login, logout: logout, guard: guard };
})();
