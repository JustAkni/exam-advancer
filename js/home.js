/* =====================================================================
   js/home.js — главная страница (index.html): вход + список дисциплин.

   Список дисциплин строится АВТОМАТИЧЕСКИ из Quiz.store.all().
   Чтобы добавить дисциплину, НЕ нужно править этот файл или index.html:
   • через admin.html, или
   • положить data/disciplines/<id>.js и добавить id в data/manifest.js.

   [БЫЛО В ОРИГИНАЛЕ] названия разделов были вписаны прямо в auth.js,
   плюс отдельный список в quiz.js и сами вопросы — три места на одну
   дисциплину. Забыли одно — раздел «не открывался».
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme', 'auth');
  var cfg = Quiz.config, T = cfg.T, el = Quiz.u.el, clear = Quiz.u.clear;
  var app = document.getElementById('app');
  if (!app) { console.error('home.js: не найден #app в index.html'); return; }

  function renderLogin() {
    clear(app).appendChild(el('div', { class: 'auth-box' },
      el('h2', { text: T.loginTitle }),
      el('p', { class: 'muted', text: T.loginHint }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: T.loginBtn,
        onclick: function () { Quiz.auth.login(); renderHome(); }
      })
    ));
  }

  function renderHome() {
    clear(app);
    app.appendChild(el('div', { class: 'info-card fade-in' },
      el('div', { style: 'float:right' }, el('span', { class: 'badge', text: T.accessActive })),
      el('h1', { class: 'main-title', text: T.chooseSection }),
      el('p', { class: 'muted', text: T.chooseHint })));

    var holder = el('div', { text: '…', class: 'muted' });
    app.appendChild(holder);

    Quiz.store.load().then(function () {
      var warns = Quiz.store.warnings();
      var list = Quiz.store.all();

      /* [НЕ УДАЛЯТЬ] показ предупреждений: так ошибки данных видны сразу,
         а не «молча» пропадают вопросы. */
      var notice = warns.length ? el('div', { class: 'notice' }, T.dataWarning,
        el('ul', null, warns.map(function (w) { return el('li', { text: w }); }))) : null;

      var content = list.length
        ? el('div', { class: 'categories' }, list.map(function (d) {
            return el('a', { href: 'quiz.html?' + cfg.URL_PARAM + '=' + encodeURIComponent(d.id) },
              d.title, el('small', { text: d.questions.length + ' ' + T.questionsWord }));
          }))
        : el('div', { class: 'info-block', style: 'margin-top:0' },
            el('p', { text: T.noDisciplines }),
            el('a', { class: 'btn btn-primary', href: 'compiler.html', text: '🧩 Создать тест из текста' }),
            cfg.ADMIN_ENABLED ? el('a', { class: 'btn btn-ghost', href: 'admin.html', text: T.openEditor }) : null);

      holder.replaceWith(el('div', null, notice, content));
    });

    app.appendChild(el('div', { class: 'info-block' },
      el('a', { class: 'btn btn-primary', href: 'compiler.html', text: '🧩 Компилятор тестов' }),
      cfg.ADMIN_ENABLED ? el('a', { class: 'btn btn-ghost', href: 'admin.html', text: T.editorLink }) : null,
      cfg.AUTH_ENABLED ? el('button', {
        class: 'btn', type: 'button', text: T.logoutBtn,
        onclick: function () { Quiz.auth.logout(); renderLogin(); }
      }) : null
    ));
  }

  if (Quiz.auth.isLoggedIn()) renderHome(); else renderLogin();
})();
