/* =====================================================================
   js/admin.js — редактор дисциплин и вопросов (страница admin.html).

   ЧТО УМЕЕТ
   • создать дисциплину; добавить / изменить / удалить вопрос;
   • у вопроса любое число вариантов; галочками отмечаются ПРАВИЛЬНЫЕ
     (одна галочка — обычный вопрос, несколько — множественный выбор);
   • массовое добавление из текста (формат ? + - !);
   • резервная копия и импорт JSON (понимает и старый формат вопросов);
   • скачать файл дисциплины и manifest.js для публикации на сайт.

   ГДЕ ХРАНИТСЯ ТО, ЧТО ВЫ СДЕЛАЛИ В РЕДАКТОРЕ
   Только в localStorage ЭТОГО браузера. Другие пользователи этого не видят,
   пока вы не опубликуете файлы (скачать → положить в data/ → загрузить на сайт).
   Очистка данных браузера = потеря несохранённого → делайте резервную копию.

   [НЕ УДАЛЯТЬ]
   • Всё чтение/запись — только через Quiz.store. Не обращайтесь к
     localStorage напрямую: ломается формат и миграции.
   • Quiz.auth.guard() и проверка ADMIN_ENABLED — чтобы редактор не был
     доступен там, где вы его отключили (это не защита, см. config.js).
   • Перерисовка делается целиком (render()). Не вешайте состояние на DOM —
     держите его в `state`, иначе оно пропадёт при следующей перерисовке.

   [РИСК] Правка файловой дисциплины создаёт ПОЛНУЮ копию в браузере
   (override). Если потом заменить файл в data/ — ваша копия всё равно
   перекроет его, пока не нажать «Сбросить правки».
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme', 'auth');
  if (!Quiz.auth.guard()) return;

  var cfg = Quiz.config, store = Quiz.store, u = Quiz.u;
  var el = u.el, clear = u.clear;

  if (!cfg.ADMIN_ENABLED) { window.location.replace(cfg.HOME_PAGE); return; }
  var app = document.getElementById('admin');
  if (!app) { console.error('admin.js: в admin.html не найден #admin'); return; }

  var PAGE = 50; // сколько вопросов показывать в списке за раз
  var state = { currentId: null, editing: null, filter: '', shown: PAGE }; // editing: null | -1 (новый) | индекс

  var EXAMPLE = '? Столица Казахстана?\n+ Астана\n- Алматы\n- Шымкент\n! Пояснение (необязательно)\n\n' +
                '? Какие числа простые? (несколько правильных)\n+ 2\n+ 3\n- 4\n- 6';

  Quiz.store.load().then(function () {
    var list = store.all();
    state.currentId = list.length ? list[0].id : null;
    render();
  });

  /* ---------- общие помощники ---------- */
  var toastTimer;
  function toast(msg, kind) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = el('div', { class: 'toast ' + (kind || ''), text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, kind === 'error' ? 6000 : 3000);
  }
  function newQuestionId() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function current() { return state.currentId ? store.get(state.currentId) : null; }

  /* Сохранить дисциплину целиком; возвращает true при успехе. */
  function commit(d, questions, okMsg) {
    var res = store.saveDiscipline({ id: d.id, title: d.title, description: d.description, questions: questions });
    if (!res.ok) { toast(res.error || 'Ошибка сохранения', 'error'); return false; }
    if (okMsg) toast(okMsg, 'ok');
    return true;
  }

  var ORIGIN = {
    file: ['из файла', 'badge badge-gray'],
    override: ['файл + ваши правки', 'badge badge-orange'],
    local: ['только в этом браузере', 'badge badge-blue']
  };

  /* ---------- каркас страницы ---------- */
  function render() {
    var d = current();
    /* [РИСК] Нативный Element.append(null) вставит в страницу слово «null».
       Поэтому пустые блоки отфильтровываем; в остальных местах используем el(),
       который сам пропускает null/false. */
    clear(app);
    [renderTop(), renderWarnings(),
     el('div', { class: 'admin-layout' }, renderSidebar(), d ? renderDiscipline(d) : renderEmpty())
    ].forEach(function (node) { if (node) app.appendChild(node); });
  }

  function renderTop() {
    var fileInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (f) importFile(f);
      fileInput.value = '';
    });
    return el('div', null,
      el('h1', { text: '✏️ Редактор дисциплин' }),
      el('div', { class: 'toolbar' },
        el('a', { class: 'btn btn-ghost', href: cfg.HOME_PAGE, text: '← На главную' }),
        el('button', {
          class: 'btn btn-ghost', type: 'button', text: '⬇ Резервная копия (JSON)',
          onclick: function () { u.download('quiz-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(store.exportAll(), null, 2), 'application/json'); }
        }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: '⬆ Импорт JSON', onclick: function () { fileInput.click(); } }),
        el('button', {
          class: 'btn btn-ghost', type: 'button', text: '⬇ manifest.js',
          onclick: function () { u.download('manifest.js', store.serializeManifest(), 'text/javascript'); }
        }),
        fileInput
      ),
      el('details', { class: 'panel' },
        el('summary', { text: 'Как опубликовать для всех пользователей' }),
        el('ol', { style: 'margin-left:20px' },
          el('li', { text: 'Всё, что вы делаете здесь, хранится только в вашем браузере.' }),
          el('li', { text: 'Выберите дисциплину → «Скачать файл дисциплины» → положите файл в ' + cfg.DATA_DIR }),
          el('li', { text: 'Нажмите «⬇ manifest.js» и замените им ' + cfg.MANIFEST_FILE }),
          el('li', { text: 'Загрузите папку на хостинг и увеличьте DATA_VERSION в js/config.js (иначе браузеры покажут старый кэш).' }),
          el('li', { text: 'Затем у себя можно нажать «Сбросить правки» — версия из файла станет основной.' })
        )
      )
    );
  }

  function renderWarnings() {
    var w = store.warnings();
    return w.length ? el('div', { class: 'notice' }, cfg.T.dataWarning, el('ul', null, w.map(function (x) { return el('li', { text: x }); }))) : null;
  }

  function renderEmpty() {
    return el('div', { class: 'panel' }, el('p', { class: 'muted', text: 'Создайте дисциплину слева или импортируйте JSON.' }));
  }

  /* ---------- левая колонка: список и создание ---------- */
  function renderSidebar() {
    var items = store.all().map(function (d) {
      return el('button', {
        type: 'button', class: 'disc-item' + (d.id === state.currentId ? ' active' : ''),
        onclick: function () { state.currentId = d.id; state.editing = null; state.filter = ''; state.shown = PAGE; render(); }
      }, d.title, el('small', { text: d.questions.length + ' ' + cfg.T.questionsWord + ' · ' + ORIGIN[d.origin][0] }));
    });

    var titleIn = el('input', { type: 'text', placeholder: 'Название, например: Философия' });
    var idIn = el('input', { type: 'text', placeholder: 'id (латиница), заполнится само' });
    var touched = false, err = el('div', { class: 'form-errors' });
    idIn.addEventListener('input', function () { touched = true; });
    titleIn.addEventListener('input', function () { if (!touched) idIn.value = u.slugify(titleIn.value); });

    function create() {
      var title = titleIn.value.trim(), id = idIn.value.trim() || u.slugify(title);
      err.textContent = '';
      if (!title) { err.textContent = 'Введите название.'; return; }
      if (!store.isValidId(id)) { err.textContent = 'id: только латиница, цифры, - и _.'; return; }
      if (store.get(id)) { err.textContent = 'Дисциплина с таким id уже есть.'; return; }
      if (!commitNew({ id: id, title: title, description: '', questions: [] })) return;
      state.currentId = id; state.editing = -1; state.filter = ''; state.shown = PAGE;
      render();
    }
    function commitNew(raw) {
      var res = store.saveDiscipline(raw);
      if (!res.ok) { toast(res.error, 'error'); return false; }
      return true;
    }

    return el('div', null,
      el('div', { class: 'panel' }, el('h3', { text: 'Дисциплины' }), items.length ? items : el('p', { class: 'muted', text: 'Пока пусто.' })),
      el('div', { class: 'panel' },
        el('h3', { text: '➕ Новая дисциплина' }),
        el('label', { class: 'field' }, 'Название', titleIn),
        el('label', { class: 'field' }, 'id (имя файла)', idIn),
        err,
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Создать', onclick: create })
      )
    );
  }

  /* ---------- правая колонка: выбранная дисциплина ---------- */
  function renderDiscipline(d) {
    return el('div', null, renderHeader(d), state.editing !== null ? renderEditor(d) : null, renderBulk(d), renderList(d));
  }

  function renderHeader(d) {
    var titleIn = el('input', { type: 'text', value: d.title });
    var descIn = el('input', { type: 'text', value: d.description, placeholder: 'Описание (необязательно)' });
    var badge = el('span', { class: ORIGIN[d.origin][1], text: ORIGIN[d.origin][0] });

    function saveMeta() {
      var title = titleIn.value.trim();
      if (!title) { toast('Название не может быть пустым', 'error'); return; }
      if (commit({ id: d.id, title: title, description: descIn.value.trim() }, d.questions, 'Сохранено')) render();
    }

    var actions = [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: '⬇ Скачать файл дисциплины',
        onclick: function () { u.download(d.id + '.js', store.serializeFile(d), 'text/javascript'); }
      })
    ];
    if (d.dupCount > 0) {
      actions.push(el('button', {
        class: 'btn btn-warning', type: 'button', text: 'Удалить точные повторы (' + d.dupCount + ')',
        onclick: function () {
          if (confirm('Будут удалены вопросы, полностью совпадающие с более ранними (текст и все ответы). Продолжить?')) {
            if (commit(d, store.removeDuplicates(d.questions), 'Повторы удалены')) render();
          }
        }
      }));
    }
    if (d.origin === 'local') {
      actions.push(el('button', {
        class: 'btn btn-danger', type: 'button', text: '🗑 Удалить дисциплину',
        onclick: function () {
          if (!confirm('Удалить «' + d.title + '» из браузера? Если вы не скачали файл или копию — вернуть будет нельзя.')) return;
          var r = store.removeLocal(d.id);
          if (!r.ok) { toast(r.error, 'error'); return; }
          var rest = store.all(); state.currentId = rest.length ? rest[0].id : null; state.editing = null; render();
        }
      }));
    } else if (d.origin === 'override') {
      actions.push(el('button', {
        class: 'btn btn-danger', type: 'button', text: '↺ Сбросить правки',
        onclick: function () {
          if (!confirm('Вернуть версию из файла (' + d.fileCount + ' вопросов)? Ваши правки в браузере будут удалены.')) return;
          var r = store.removeLocal(d.id);
          if (!r.ok) { toast(r.error, 'error'); return; }
          state.editing = null; render();
        }
      }));
    }

    return el('div', { class: 'panel' },
      el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px' },
        el('strong', { text: 'id: ' + d.id }), badge,
        el('span', { class: 'muted', text: d.questions.length + ' ' + cfg.T.questionsWord })),
      el('label', { class: 'field' }, 'Название', titleIn),
      el('label', { class: 'field' }, 'Описание', descIn),
      el('div', { class: 'toolbar' },
        el('button', { class: 'btn btn-success', type: 'button', text: 'Сохранить название', onclick: saveMeta }),
        actions),
      d.origin === 'file' ? el('p', { class: 'hint', text: 'Любое изменение создаст копию в вашем браузере. Убрать дисциплину совсем: удалите её файл и id из ' + cfg.MANIFEST_FILE + '.' }) : null
    );
  }

  /* ---------- форма вопроса ---------- */
  function renderEditor(d) {
    var isNew = state.editing === -1;
    var src = isNew ? null : d.questions[state.editing];
    if (!isNew && !src) { state.editing = null; return null; }

    var qIn = el('textarea', { rows: 3, placeholder: 'Текст вопроса' });
    qIn.value = src ? src.question : '';
    var expIn = el('textarea', { rows: 2, placeholder: 'Пояснение после ответа (необязательно)' });
    expIn.value = src && src.explanation ? src.explanation : '';
    var rowsBox = el('div');
    var err = el('div', { class: 'form-errors' });

    function addRow(text, correct) {
      var cb = el('input', { type: 'checkbox', title: 'Правильный ответ', 'aria-label': 'Правильный ответ' });
      cb.checked = !!correct;
      var tx = el('input', { type: 'text', placeholder: 'Вариант ответа' });
      tx.value = text || '';
      var row = el('div', { class: 'answer-row' }, cb, tx,
        el('button', { class: 'btn btn-ghost btn-icon', type: 'button', title: 'Удалить вариант', text: '✕', onclick: function () { row.remove(); } }));
      rowsBox.appendChild(row);
      return tx;
    }
    if (src) src.answers.forEach(function (a) { addRow(a.text, a.correct); });
    else for (var k = 0; k < 4; k++) addRow('', false);

    function collect() {
      return {
        id: src ? src.id : newQuestionId(),
        question: qIn.value,
        explanation: expIn.value,
        answers: Array.prototype.map.call(rowsBox.querySelectorAll('.answer-row'), function (r) {
          return { text: r.querySelector('input[type=text]').value, correct: r.querySelector('input[type=checkbox]').checked };
        })
      };
    }

    function save() {
      var c = store.checkQuestion(collect());
      if (!c.question) { err.textContent = c.errors.join(' '); return; }
      err.textContent = '';
      var list = d.questions.slice();
      if (isNew) list.push(c.question); else list[state.editing] = c.question;
      if (!commit(d, list, isNew ? 'Вопрос добавлен (' + list.length + ')' : 'Вопрос сохранён')) return;
      state.editing = isNew ? -1 : null;   // после добавления форма остаётся пустой — быстро вводить подряд
      render();
      if (isNew) { var t = app.querySelector('.editor textarea'); if (t) t.focus(); }
    }

    return el('div', { class: 'panel editor' },
      el('h3', { text: isNew ? '➕ Новый вопрос' : '✎ Изменение вопроса №' + (state.editing + 1) }),
      el('label', { class: 'field' }, 'Вопрос', qIn),
      el('div', { class: 'hint', text: 'Поставьте галочку у ПРАВИЛЬНЫХ ответов. Одна галочка — обычный вопрос, несколько — выбор нескольких ответов.' }),
      rowsBox,
      el('button', { class: 'btn btn-ghost btn-small', type: 'button', text: '+ вариант', onclick: function () { addRow('', false).focus(); } }),
      el('label', { class: 'field', style: 'margin-top:12px' }, 'Пояснение', expIn),
      err,
      el('div', { class: 'toolbar' },
        el('button', { class: 'btn btn-success', type: 'button', text: isNew ? 'Добавить вопрос' : 'Сохранить', onclick: save }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Закрыть', onclick: function () { state.editing = null; render(); } }))
    );
  }

  /* ---------- массовое добавление ---------- */
  function renderBulk(d) {
    var ta = el('textarea', { class: 'mono', placeholder: EXAMPLE });
    var out = el('div', { class: 'form-errors' });
    function add() {
      var r = store.parseBulk(ta.value);
      if (r.errors.length) {
        clear(out).append(el('div', { text: 'Ничего не добавлено — исправьте строки:' }),
          el('ul', { style: 'margin-left:20px' }, r.errors.slice(0, 15).map(function (e) { return el('li', { text: 'строка ' + e.line + ': ' + e.message }); })));
        return;
      }
      if (!r.questions.length) { out.textContent = 'Не найдено ни одного вопроса.'; return; }
      var list = d.questions.slice().concat(r.questions.map(function (q) { q.id = newQuestionId(); return q; }));
      if (commit(d, list, 'Добавлено вопросов: ' + r.questions.length)) render();
    }
    return el('details', { class: 'panel' },
      el('summary', { text: '📋 Добавить много вопросов текстом' }),
      el('p', { class: 'hint', text: '? вопрос · + правильный ответ · - неправильный · ! пояснение · пустая строка между вопросами. Можно несколько «+».' }),
      ta, out,
      el('div', { class: 'toolbar', style: 'margin-top:10px' },
        el('button', { class: 'btn btn-success', type: 'button', text: 'Добавить в «' + d.title + '»', onclick: add }))
    );
  }

  /* ---------- список вопросов ---------- */
  function renderList(d) {
    var listBox = el('div');
    var search = el('input', { type: 'text', placeholder: 'Поиск по тексту вопроса…' });
    search.value = state.filter;
    search.addEventListener('input', function () { state.filter = search.value; state.shown = PAGE; fill(); });

    function fill() {
      clear(listBox);
      var f = state.filter.trim().toLowerCase(), rows = [];
      d.questions.forEach(function (q, i) { if (!f || q.question.toLowerCase().indexOf(f) >= 0) rows.push(i); });
      if (!rows.length) { listBox.appendChild(el('p', { class: 'muted', text: d.questions.length ? 'Ничего не найдено.' : 'Вопросов пока нет — добавьте первый.' })); return; }
      rows.slice(0, state.shown).forEach(function (i) {
        var q = d.questions[i];
        listBox.appendChild(el('div', { class: 'q-item' },
          el('span', { class: 'q-num', text: String(i + 1) }),
          el('details', null,
            el('summary', { text: q.question + (q.multi ? '  [несколько ответов]' : '') }),
            el('ul', null, q.answers.map(function (a) { return el('li', { class: a.correct ? 'is-correct' : '', text: (a.correct ? '✓ ' : '') + a.text }); }))),
          el('button', {
            class: 'btn btn-ghost btn-small', type: 'button', title: 'Изменить', text: '✎',
            onclick: function () { state.editing = i; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
          }),
          el('button', {
            class: 'btn btn-danger btn-small', type: 'button', title: 'Удалить', text: '🗑',
            onclick: function () {
              if (!confirm('Удалить вопрос №' + (i + 1) + '?')) return;
              var list = d.questions.slice(); list.splice(i, 1);
              if (commit(d, list, 'Вопрос удалён')) { state.editing = null; render(); }
            }
          })));
      });
      if (rows.length > state.shown) {
        listBox.appendChild(el('button', {
          class: 'btn btn-ghost', type: 'button', style: 'margin-top:10px',
          text: 'Показать ещё (' + (rows.length - state.shown) + ')',
          onclick: function () { state.shown += PAGE; fill(); }
        }));
      }
    }
    fill();
    return el('div', { class: 'panel' }, el('h3', { text: 'Вопросы (' + d.questions.length + ')' }), search, el('div', { style: 'margin-top:10px' }, listBox));
  }

  /* ---------- импорт файла ---------- */
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var obj;
      try { obj = JSON.parse(String(reader.result)); }
      catch (e) { toast('Файл не похож на JSON: ' + e.message, 'error'); return; }
      if (!confirm('Дисциплины с теми же id будут заменены копиями из файла (в этом браузере). Продолжить?')) return;
      var r = store.importData(obj);
      if (!r.ok) { toast(r.error || 'Импорт не удался', 'error'); return; }
      toast('Импортировано дисциплин: ' + r.imported + (r.skipped.length ? ' · пропущено: ' + r.skipped.length : ''), 'ok');
      if (!current() && store.all().length) state.currentId = store.all()[0].id;
      state.editing = null; render();
    };
    reader.onerror = function () { toast('Не удалось прочитать файл', 'error'); };
    reader.readAsText(file);
  }
})();
