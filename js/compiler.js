/* =====================================================================
   js/compiler.js — КОМПИЛЯТОР тестов (страница compiler.html).

   Берёт «сырой» текст с тегами и превращает его в готовый тест:

       <question> Текст вопроса
       <variant> Правильный ответ      ← ПЕРВЫЙ вариант считается правильным
       <variant> Неправильный
       <variant> Неправильный
       <question> Следующий вопрос …

   • Источник: вставленный текст, файл .txt или .docx (Word читается прямо в браузере,
     без библиотек и интернета).
   • Если после последнего <variant> идёт <question> — это уже новый вопрос.
   • «Правильных первых вариантов» (по умолчанию 1): поставьте 2 — и первые два
     варианта каждого вопроса станут правильными (вопрос с выбором нескольких ответов).
   • Тег <right> вместо <variant> явно отмечает правильный вариант.

   Результат:
   • «Добавить на сайт» — сохраняет в этом браузере (работает сразу, без сервера);
   • «.json»  — готовый файл с вопросами;
   • «.js»    — файл для папки data/disciplines/ (чтобы тест увидели все посетители).

   [НЕ УДАЛЯТЬ] Весь разбор текста — в Quiz.store.parseTagged (store.js);
   здесь только интерфейс. Вывод текста — через el()/textContent, не innerHTML.
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u', 'store', 'theme');

  var cfg = Quiz.config, store = Quiz.store, u = Quiz.u;
  var el = u.el, clear = u.clear, add = u.add;
  var app = document.getElementById('compiler');
  if (!app) { console.error('compiler.js: в compiler.html не найден #compiler'); return; }

  var EXAMPLE = '<question>Столица Казахстана?\n<variant>Астана\n<variant>Алматы\n<variant>Шымкент\n<variant>Караганда\n' +
                '<question>Какая планета ближе всех к Солнцу?\n<variant>Меркурий\n<variant>Венера\n<variant>Марс\n<variant>Юпитер';

  var S = { title: '', id: '', idTouched: false, first: 1, target: '__new__', dedupe: true, result: null };
  var refs = {};

  /* ---------- чтение .docx без библиотек ----------
     .docx — это zip. Находим word/document.xml, распаковываем средствами браузера
     (DecompressionStream) и склеиваем текст абзацев. */
  function readDocx(buf) {
    var dv = new DataView(buf), bytes = new Uint8Array(buf);
    var eocd = -1, i;
    for (i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('Это не .docx (не найден zip-каталог).'));
    var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), entry = null;
    for (i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
      if (name === 'word/document.xml') { entry = { method: method, csize: csize, lho: lho }; break; }
      p += 46 + nlen + xlen + clen;
    }
    if (!entry) return Promise.reject(new Error('В файле нет word/document.xml — это не документ Word.'));
    var ds = entry.lho + 30 + dv.getUint16(entry.lho + 26, true) + dv.getUint16(entry.lho + 28, true);
    var raw = bytes.subarray(ds, ds + entry.csize);
    var xmlP;
    if (entry.method === 0) xmlP = Promise.resolve(new TextDecoder().decode(raw));
    else if (entry.method === 8 && typeof DecompressionStream === 'function') {
      var stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      xmlP = new Response(stream).arrayBuffer().then(function (b) { return new TextDecoder().decode(b); });
    } else return Promise.reject(new Error('Браузер не умеет распаковывать .docx. Сохраните документ как .txt или вставьте текст.'));

    return xmlP.then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml');
      var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      var out = [];
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'p'), function (para) {
        var line = '';
        (function walk(n) {
          Array.prototype.forEach.call(n.childNodes, function (c) {
            if (c.nodeType !== 1) return;
            if (c.namespaceURI === W && c.localName === 't') line += c.textContent;
            else if (c.namespaceURI === W && (c.localName === 'tab')) line += ' ';
            else if (c.namespaceURI === W && (c.localName === 'br')) line += ' ';
            else walk(c);
          });
        })(para);
        out.push(line);
      });
      return out.join('\n');
    });
  }

  function readFile(file) {
    var name = file.name || '';
    if (/\.docx$/i.test(name)) return file.arrayBuffer().then(readDocx);
    if (/\.doc$/i.test(name)) return Promise.reject(new Error('Старый формат .doc не поддерживается — сохраните как .docx или .txt.'));
    return file.text();
  }

  function loadFile(file) {
    if (!file) return;
    readFile(file).then(function (text) {
      refs.text.value = text;
      if (!S.title) {
        S.title = file.name.replace(/\.[^.]+$/, '');
        refs.title.value = S.title;
        if (!S.idTouched) { S.id = u.slugify(S.title); refs.id.value = S.id; }
      }
      toast('Файл «' + file.name + '» загружен', 'ok');
      compile();
    }).catch(function (e) { toast(e.message || String(e), 'error'); });
  }

  /* ---------- уведомления ---------- */
  var toastTimer;
  function toast(msg, kind) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = el('div', { class: 'toast ' + (kind || ''), text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, kind === 'error' ? 6000 : 3000);
  }

  /* ---------- компиляция ---------- */
  var timer;
  function scheduleCompile() { clearTimeout(timer); timer = setTimeout(compile, 200); }

  function effectiveIdTitle() {
    if (S.target !== '__new__') {
      var d = store.get(S.target);
      return { id: S.target, title: d ? d.title : S.target };
    }
    var id = S.id || u.slugify(S.title) || 'discipline';
    return { id: id, title: S.title || id };
  }

  /* Итоговая дисциплина (существующие вопросы + новые) в «сыром» виде. */
  function buildRaw() {
    var r = S.result, it = effectiveIdTitle();
    var base = S.target !== '__new__' && store.get(S.target) ? store._toRaw(store.get(S.target)) : { id: it.id, title: it.title, description: '', questions: [] };
    base.questions = base.questions.concat(r.questions);
    var d = store.buildDiscipline(base);
    if (d && S.dedupe) d.questions = store.removeDuplicates(d.questions);
    return d;
  }

  function compile() {
    S.result = store.parseTagged(refs.text.value, { firstCorrect: S.first });
    var r = S.result, multi = r.questions.filter(function (q) { return q.answers.filter(function (a) { return a.correct; }).length > 1; }).length;

    add(clear(refs.stats),
      el('span', { class: 'badge', text: 'Вопросов: ' + r.questions.length }),
      el('span', { class: 'badge badge-blue', text: 'С несколькими ответами: ' + multi }),
      r.errors.length ? el('span', { class: 'badge badge-orange', text: 'Замечаний: ' + r.errors.length }) : null);

    clear(refs.errors);
    if (r.errors.length) add(refs.errors, 'Нужно проверить:', el('ul', null, r.errors.slice(0, 30).map(function (e) { return el('li', { text: e }); })),
      r.errors.length > 30 ? el('p', { text: '… и ещё ' + (r.errors.length - 30) }) : null);

    clear(refs.preview);
    if (!r.questions.length) {
      refs.preview.appendChild(el('p', { class: 'muted', text: refs.text.value.trim() ? 'Вопросов не найдено — проверьте теги.' : 'Вставьте текст слева или загрузите файл.' }));
    } else {
      r.questions.slice(0, 200).forEach(function (q, i) {
        refs.preview.appendChild(el('div', { class: 'q-item' },
          el('span', { class: 'q-num', text: (i + 1) + '.' }),
          el('details', null, el('summary', { text: q.question }),
            el('ul', null, q.answers.map(function (a) { return el('li', { class: a.correct ? 'is-correct' : '', text: (a.correct ? '✔ ' : '') + a.text }); })))));
      });
      if (r.questions.length > 200) refs.preview.appendChild(el('p', { class: 'muted', text: 'Показаны первые 200 из ' + r.questions.length + '.' }));
    }
    var has = r.questions.length > 0;
    ['btnSite', 'btnJs'].forEach(function (k) { refs[k].disabled = !has; });
  }

  /* ---------- действия ---------- */
  function fileBase() { return effectiveIdTitle().id; }

  function toSite() {
    var it = effectiveIdTitle(), id = it.id;
    if (!store.isValidId(id)) { toast('Некорректный id: только латиница, цифры, - и _', 'error'); return; }
    if (S.target === '__new__' && store.get(id)) { id = store.uniqueId(id); }
    var w = store.appendQuestions(id, it.title, S.result.questions, S.dedupe);
    if (!w.ok) { toast(w.error || 'Не удалось сохранить', 'error'); return; }
    var d = store.get(id);
    fillTargets();
    add(clear(refs.done), el('div', { class: 'notice', style: 'background:var(--correct-bg);color:var(--correct-text);border-color:#28a745' },
      '✅ Сохранено: «' + (d ? d.title : id) + '» — всего вопросов ' + (d ? d.questions.length : '?') + '. ',
      el('a', { href: 'quiz.html?' + cfg.URL_PARAM + '=' + encodeURIComponent(id), text: 'Открыть тест →' }), ' · ',
      el('a', { href: cfg.HOME_PAGE, text: 'На главную' })));
  }

  function downloadJs() {
    var d = buildRaw();
    if (!d) { toast('Некорректный id дисциплины', 'error'); return; }
    u.download(d.id + '.js', store.serializeFile(d), 'text/javascript');
    toast('Положите файл в ' + cfg.DATA_DIR + ' и добавьте "' + d.id + '" в ' + cfg.MANIFEST_FILE, 'ok');
  }

  /* ---------- интерфейс ---------- */
  function fillTargets() {
    clear(refs.target).appendChild(el('option', { value: '__new__', text: '➕ Новая дисциплина' }));
    store.all().forEach(function (d) {
      refs.target.appendChild(el('option', { value: d.id, text: 'Добавить к: ' + d.title + ' (' + d.questions.length + ')' }));
    });
    refs.target.value = store.get(S.target) ? S.target : '__new__';
    S.target = refs.target.value;
  }

  function render() {
    refs.text = el('textarea', { class: 'mono', style: 'min-height:340px', placeholder: '<question> Вопрос\n<variant> Правильный ответ\n<variant> Неправильный\n…',
      oninput: scheduleCompile });
    refs.title = el('input', { type: 'text', placeholder: 'Например: Психодиагностика',
      oninput: function () {
        S.title = refs.title.value;
        if (!S.idTouched) { S.id = u.slugify(S.title); refs.id.value = S.id; }
        scheduleCompile();
      } });
    refs.id = el('input', { type: 'text', placeholder: 'psychodiagnostics',
      oninput: function () { S.idTouched = true; S.id = refs.id.value.trim(); scheduleCompile(); } });
    refs.first = el('input', { type: 'number', min: 1, max: 20, value: 1,
      oninput: function () { S.first = Math.max(1, parseInt(refs.first.value, 10) || 1); scheduleCompile(); } });
    refs.target = el('select', { onchange: function () {
      S.target = refs.target.value;
      refs.newFields.classList.toggle('hidden', S.target !== '__new__');
      scheduleCompile();
    } });
    fillTargets();
    refs.dedupe = el('input', { type: 'checkbox', checked: true, onchange: function () { S.dedupe = refs.dedupe.checked; } });
    refs.dedupe.checked = true;

    refs.stats = el('div', { class: 'stat-line' });
    refs.errors = el('div', { class: 'errors-box' });
    refs.preview = el('div', { class: 'preview-list' });
    refs.done = el('div');
    refs.btnSite = el('button', { class: 'btn btn-primary', type: 'button', text: '💾 Добавить на сайт', onclick: toSite });
    refs.btnJs = el('button', { class: 'btn btn-ghost', type: 'button', text: '⬇ Скачать дисциплину (.js)', onclick: downloadJs });
    refs.file = el('input', { type: 'file', accept: '.txt,.docx,text/plain', class: 'hidden', onchange: function () { loadFile(refs.file.files[0]); refs.file.value = ''; } });

    var drop = el('div', { class: 'dropzone' },
      'Перетащите сюда .txt или .docx ', el('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'или выберите файл', onclick: function () { refs.file.click(); } }), refs.file);
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { loadFile(e.dataTransfer && e.dataTransfer.files[0]); });

    refs.newFields = el('div', { class: 'row-fields' },
      el('label', { class: 'field' }, 'Название дисциплины', refs.title),
      el('label', { class: 'field' }, 'id (имя файла, латиницей)', refs.id));

    add(clear(app),
      el('div', { class: 'info-card' },
        el('h1', { text: '🧩 Компилятор тестов' }),
        el('p', { class: 'muted', text: 'Вставьте сырой текст с тегами — получите готовый тест. Первый <variant> в каждом вопросе — правильный.' }),
        el('div', { class: 'toolbar', style: 'margin:12px 0 0' }, el('a', { class: 'btn btn-ghost btn-small', href: cfg.HOME_PAGE, text: '← В меню' }))),

      el('div', { class: 'compiler-grid' },
        el('div', { class: 'panel' },
          el('h3', { text: '1. Исходный текст' }),
          drop, el('div', { style: 'height:10px' }),
          refs.text,
          el('div', { class: 'toolbar', style: 'margin-top:10px' },
            el('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Вставить пример',
              onclick: function () { refs.text.value = EXAMPLE; compile(); } }),
            el('button', { class: 'btn btn-ghost btn-small', type: 'button', text: 'Очистить',
              onclick: function () { refs.text.value = ''; compile(); } })),
          el('h3', { style: 'margin-top:14px', text: '2. Параметры' }),
          el('label', { class: 'field' }, 'Куда сохранить', refs.target),
          refs.newFields,
          el('label', { class: 'field' }, 'Сколько первых вариантов считать правильными', refs.first),
          el('p', { class: 'hint' }, 'По умолчанию 1. Поставьте 2 и более — вопросы станут «с несколькими ответами». ',
            'Для отдельного вопроса используйте тег ', el('code', { text: '<right>' }), ' вместо ', el('code', { text: '<variant>' }), ' у каждого правильного варианта.'),
          el('label', { class: 'setup-check' }, refs.dedupe, el('span', { text: 'Убирать точные повторы вопросов' }))),

        el('div', { class: 'panel' },
          el('h3', { text: '3. Результат' }),
          refs.stats, refs.errors, refs.preview,
          el('div', { class: 'toolbar', style: 'margin-top:14px' }, refs.btnSite, refs.btnJs),
          refs.done,
          el('p', { class: 'hint' }, '«Добавить на сайт» сохраняет тест в этом браузере — он сразу появится на главной. ',
            '.js — файл ОДНОЙ дисциплины: отправьте его другу или положите в data/disciplines/ (и впишите id в data/manifest.js). ',
            'Все дисциплины сразу (.json) и импорт чужих файлов — в ', el('a', { href: 'admin.html', text: 'редакторе' }), '.'))));

    compile();
  }

  store.load().then(render);
})();
