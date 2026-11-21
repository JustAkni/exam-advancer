/* =====================================================================
   js/store.js — ВСЯ работа с данными (дисциплины и вопросы).
   Страницы (index / quiz / admin) НЕ читают файлы и localStorage сами —
   только через Quiz.store. Благодаря этому формат хранения можно менять
   (например, перейти на сервер), не трогая остальной код.

   ОТКУДА БЕРУТСЯ ДАННЫЕ
   1) Файлы:  data/manifest.js  →  список id,
              data/disciplines/<id>.js  →  сами вопросы.
   2) Браузер (localStorage): то, что создано/исправлено в admin.html.
      Если id совпадает с файловой дисциплиной — «правка» перекрывает файл
      (origin = 'override'); новый id — «локальная» (origin = 'local').

   ФОРМАТ ВОПРОСА В ФАЙЛЕ (совместим со старой версией!):
     { question: "Текст", answers: [ {text:"…", correct:true}, {text:"…", correct:false} ],
       explanation: "необязательно", id: "необязательно" }
   Несколько correct:true → вопрос с множественным выбором.

   [НЕ УДАЛЯТЬ] функции normalize… и check… — они «чинят» плохие данные: пустой вариант,
   вопрос без правильного ответа, дубль id. В старой версии один такой вопрос
   ронял весь тест (TypeError на find(a => a.correct).text).
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config', 'u');

  var cfg = Quiz.config, u = Quiz.u;
  var KEY = cfg.KEYS.local;
  var ID_RE = /^[A-Za-z0-9_-]+$/; // id = имя файла, поэтому только безопасные символы

  var fileNorm = {};        // id -> нормализованная дисциплина из файла
  var fileOrder = [];       // порядок из manifest
  var merged = [];          // итог: файлы + локальные правки
  var loadProblems = [];    // проблемы загрузки файлов
  var mergeProblems = [];   // проблемы localStorage
  var loadPromise = null;

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function isValidId(id) { return ID_RE.test(String(id)); }

  /* ---------- проверка и нормализация вопроса ---------- */

  /* Возвращает {errors:[…], question:null|{…}}.
     Для админки errors — подсказки пользователю; при загрузке файлов
     невалидные вопросы просто пропускаются (и попадают в warnings()). */
  function checkQuestion(raw) {
    var errors = [];
    var text = str(raw && raw.question);
    if (!text) errors.push('Пустой текст вопроса.');

    var src = raw && Array.isArray(raw.answers) ? raw.answers : [];
    var answers = src.map(function (a) {
      return { text: str(a && a.text), correct: !!(a && (a.correct === true || a.correct === 'true')) };
    }).filter(function (a) { return a.text; });

    if (answers.length < 2) errors.push('Нужно минимум 2 непустых варианта ответа.');
    if (!answers.some(function (a) { return a.correct; })) errors.push('Отметьте хотя бы один правильный ответ.');
    if (errors.length) return { errors: errors, question: null };

    var correctCount = answers.filter(function (a) { return a.correct; }).length;
    return {
      errors: [],
      question: {
        /* [РИСК] id по хэшу текста меняется, если исправить формулировку.
           Для будущей статистики ошибок используйте явный id (админка
           создаёт его сама и сохраняет в файл). */
        id: str(raw.id) || 'h' + u.hash(text),
        question: text,
        /* id ответа = его позиция. Нужен, чтобы отличать одинаковые по тексту
           варианты (в старой версии выбор искался по тексту → подсвечивались оба). */
        answers: answers.map(function (a, i) { return { id: 'a' + i, text: a.text, correct: a.correct }; }),
        explanation: str(raw.explanation),
        multi: correctCount > 1
      }
    };
  }

  function signature(q) {
    return q.question + '|' + q.answers.map(function (a) { return (a.correct ? '+' : '-') + a.text; }).sort().join('|');
  }

  /* Убирает ТОЧНЫЕ дубли (одинаковый вопрос + одинаковые ответы).
     Вопросы с тем же текстом, но другими вариантами — не трогает. */
  function removeDuplicates(questions) {
    var seen = {};
    return questions.filter(function (q) {
      var s = signature(q);
      if (seen[s]) return false;
      seen[s] = true;
      return true;
    });
  }

  function normalizeDiscipline(raw) {
    var id = str(raw && raw.id);
    if (!isValidId(id)) {
      return { error: 'Некорректный id дисциплины «' + id + '» (разрешены латиница, цифры, - и _).' };
    }
    var list = raw && Array.isArray(raw.questions) ? raw.questions : [];
    var usedIds = {}, qs = [], skipped = [];
    list.forEach(function (r, i) {
      var c = checkQuestion(r);
      if (!c.question) { skipped.push({ index: i + 1, errors: c.errors }); return; }
      var q = c.question;
      if (usedIds[q.id]) { var n = 2; while (usedIds[q.id + '_' + n]) n++; q.id = q.id + '_' + n; }
      usedIds[q.id] = true;
      qs.push(q);
    });
    var sigs = {}, dup = 0;
    qs.forEach(function (q) { var s = signature(q); if (sigs[s]) dup++; else sigs[s] = 1; });
    return {
      discipline: {
        id: id,
        title: str(raw.title) || id,
        description: str(raw.description),
        questions: qs,
        skipped: skipped,   // сколько вопросов отброшено как некорректные
        dupCount: dup       // сколько точных повторов
      }
    };
  }

  /* Упрощённый вид для сохранения (без служебных полей). */
  function toRaw(d) {
    return {
      id: d.id, title: d.title, description: d.description,
      questions: d.questions.map(function (q) {
        var o = { id: q.id, question: q.question, answers: q.answers.map(function (a) { return { text: a.text, correct: a.correct }; }) };
        if (q.explanation) o.explanation = q.explanation;
        return o;
      })
    };
  }

  /* ---------- localStorage ---------- */

  function readLocal() {
    var empty = { version: 1, disciplines: {} };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object' || !p.disciplines || typeof p.disciplines !== 'object') throw new Error('bad shape');
      /* [МОДЕРНИЗАЦИЯ] Меняете формат? Добавьте сюда:
           if (p.version < 2) p = migrateV1toV2(p);
         и ключ KEYS.local → 'quiz.local.v2'. Тогда ничьи данные не потеряются. */
      return p;
    } catch (e) {
      /* Битые данные не должны ронять сайт и не должны молча исчезнуть:
         сохраняем копию под другим ключом, основной очищаем. */
      try {
        localStorage.setItem(KEY + '.corrupt.' + Date.now(), localStorage.getItem(KEY) || '');
        localStorage.removeItem(KEY);
      } catch (_) { /* localStorage недоступен — работаем без него */ }
      mergeProblems.push('Локальные данные редактора повреждены и пропущены (копия сохранена в браузере).');
      return empty;
    }
  }

  function writeLocal(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      /* Лимит localStorage ≈ 5 МБ. Большие банки лучше держать в файлах data/. */
      var quota = e && /quota/i.test(e.name || '');
      return { ok: false, error: quota
        ? 'Память браузера переполнена. Скачайте файл дисциплины и положите его в data/disciplines/.'
        : 'Не удалось сохранить в браузере: ' + (e && e.message) };
    }
  }

  /* ---------- сборка итогового списка ---------- */

  function merge() {
    mergeProblems = [];
    var local = readLocal().disciplines;
    var list = [];
    fileOrder.forEach(function (id) {
      var base = fileNorm[id];
      if (!base) return;
      if (local[id]) {
        var n = normalizeDiscipline(local[id]);
        if (n.discipline) {
          n.discipline.origin = 'override';
          n.discipline.fileCount = base.questions.length;
          list.push(n.discipline);
          return;
        }
        mergeProblems.push('Правка «' + id + '» повреждена — показан файл.');
      }
      base.origin = 'file';
      list.push(base);
    });
    Object.keys(local).forEach(function (id) {
      if (fileNorm[id]) return;
      var n = normalizeDiscipline(local[id]);
      if (n.discipline) { n.discipline.origin = 'local'; list.push(n.discipline); }
      else mergeProblems.push('Локальная дисциплина «' + id + '» повреждена и пропущена.');
    });
    merged = list;
  }

  /* ---------- загрузка файлов ---------- */

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src + '?v=' + encodeURIComponent(cfg.DATA_VERSION);
      s.onload = function () { resolve({ ok: true }); };
      s.onerror = function () { s.remove(); resolve({ ok: false }); };
      document.head.appendChild(s);
    });
  }

  /* Загружает manifest и все файлы дисциплин.
     [НЕ УДАЛЯТЬ] Ошибка одного файла НЕ останавливает остальные — она только
     попадает в warnings() и показывается на главной. Раньше все вопросы лежали
     в одном 650-КБ файле: одна лишняя запятая — и не работал ни один тест. */
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = loadScript(cfg.MANIFEST_FILE).then(function (r) {
      if (!r.ok) loadProblems.push('Не найден ' + cfg.MANIFEST_FILE);
      var ids = Array.isArray(window.QUIZ_FILES) ? window.QUIZ_FILES.map(String) : [];
      var failed = {};
      return Promise.all(ids.map(function (id) {
        if (!isValidId(id)) { loadProblems.push('В manifest неверный id «' + id + '»'); return null; }
        return loadScript(cfg.DATA_DIR + id + '.js').then(function (res) {
          if (!res.ok) { failed[id] = true; loadProblems.push('Не загружен файл ' + cfg.DATA_DIR + id + '.js'); }
        });
      })).then(function () {
        collect(ids);
        /* [НЕ УДАЛЯТЬ] Файл с синтаксической ошибкой (лишняя/пропущенная запятая,
           скобка) браузер считает «загруженным», но дисциплина не регистрируется.
           Без этой проверки она бы просто молча исчезла с главной. */
        ids.forEach(function (id) {
          if (isValidId(id) && !failed[id] && !fileNorm[id]) {
            loadProblems.push('Файл ' + cfg.DATA_DIR + id + '.js загружен, но дисциплина не найдена — вероятно, синтаксическая ошибка в файле (откройте консоль браузера, F12) или другой id внутри.');
          }
        });
        merge();
      });
    });
    return loadPromise;
  }

  /* Файлы дисциплин кладут себя в window.QUIZ_DATA (см. data/disciplines/*.js).
     Они не зависят от порядка загрузки — ни от store.js, ни друг от друга. */
  function collect(manifestIds) {
    var byId = {};
    (window.QUIZ_DATA || []).forEach(function (raw) {
      var n = normalizeDiscipline(raw);
      if (n.error) { loadProblems.push(n.error); return; }
      if (byId[n.discipline.id]) { loadProblems.push('Повтор id «' + n.discipline.id + '» в файлах данных — взят первый.'); return; }
      byId[n.discipline.id] = n.discipline;
    });
    fileNorm = byId;
    fileOrder = manifestIds.filter(function (id) { return byId[id]; });
    Object.keys(byId).forEach(function (id) { if (fileOrder.indexOf(id) < 0) fileOrder.push(id); });
  }

  /* ---------- публичные операции ---------- */

  function all() { return merged.slice(); }
  function get(id) { return merged.filter(function (d) { return d.id === id; })[0] || null; }
  function hasFile(id) { return !!fileNorm[id]; }

  function warnings() {
    var out = loadProblems.concat(mergeProblems);
    merged.forEach(function (d) {
      if (d.skipped.length) {
        out.push('«' + d.title + '»: пропущено некорректных вопросов — ' + d.skipped.length +
                 ' (например №' + d.skipped.slice(0, 5).map(function (s) { return s.index; }).join(', №') + ').');
      }
    });
    return out;
  }

  function uniqueId(base) {
    var id = base || 'discipline', n = 2, candidate = id;
    while (get(candidate)) candidate = id + '-' + n++;
    return candidate;
  }

  /* Сохраняет дисциплину в браузере (создаёт или перекрывает файловую). */
  function saveDiscipline(raw) {
    var n = normalizeDiscipline(raw);
    if (n.error) return { ok: false, error: n.error };
    var data = readLocal();
    data.disciplines[n.discipline.id] = toRaw(n.discipline);
    var w = writeLocal(data);
    if (w.ok) merge();
    return w;
  }

  /* Удаляет локальную дисциплину или локальную правку файловой. */
  function removeLocal(id) {
    var data = readLocal();
    delete data.disciplines[id];
    var w = writeLocal(data);
    if (w.ok) merge();
    return w;
  }

  /* Принимает: резервную копию, одну дисциплину, массив дисциплин
     ИЛИ старый формат { pccontroller: [вопросы], philosophy: [...] }. */
  function toDisciplineList(obj) {
    /* просто массив вопросов [{question, answers}] (его делает компилятор) */
    if (Array.isArray(obj) && obj.length && obj[0] && typeof obj[0] === 'object' && 'question' in obj[0]) {
      return [{ id: '', title: 'Импортированные вопросы', questions: obj }];
    }
    if (Array.isArray(obj)) return obj;
    if (obj && Array.isArray(obj.disciplines)) return obj.disciplines;
    if (obj && Array.isArray(obj.questions)) return [obj];
    if (obj && typeof obj === 'object') {
      return Object.keys(obj).filter(function (k) { return Array.isArray(obj[k]); })
        .map(function (k) { return { id: k, title: k, questions: obj[k] }; });
    }
    return [];
  }

  function importData(obj) {
    var list = toDisciplineList(obj), skipped = [], count = 0;
    var data = readLocal();
    list.forEach(function (raw) {
      var r = Object.assign({}, raw);
      if (!str(r.id)) r.id = u.slugify(r.title) || 'discipline';
      var n = normalizeDiscipline(r);
      if (n.error) { skipped.push(n.error); return; }
      data.disciplines[n.discipline.id] = toRaw(n.discipline);
      count++;
    });
    if (!count) return { ok: false, imported: 0, skipped: skipped, error: 'В файле не найдено дисциплин.' };
    var w = writeLocal(data);
    if (w.ok) merge();
    return { ok: w.ok, imported: count, skipped: skipped, error: w.error };
  }

  function exportAll() {
    return { format: 'quiz-backup', version: 1, exportedAt: new Date().toISOString(), disciplines: merged.map(toRaw) };
  }

  /* Текст файла data/disciplines/<id>.js */
  function serializeFile(d) {
    var r = toRaw(d);
    var safeTitle = String(r.title).replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');
    var lines = r.questions.map(function (q) { return '    ' + JSON.stringify(q); });
    return '/* Дисциплина: ' + safeTitle + '. Создано в admin.html.\n' +
      '   Положите файл в ' + cfg.DATA_DIR + r.id + '.js и добавьте "' + r.id + '" в ' + cfg.MANIFEST_FILE + '.\n' +
      '   [НЕ УДАЛЯТЬ] обёртку (window.QUIZ_DATA = …push) — по ней store.js находит дисциплину. */\n' +
      '(window.QUIZ_DATA = window.QUIZ_DATA || []).push({\n' +
      '  id: ' + JSON.stringify(r.id) + ',\n' +
      '  title: ' + JSON.stringify(r.title) + ',\n' +
      '  description: ' + JSON.stringify(r.description) + ',\n' +
      '  questions: [\n' + lines.join(',\n') + '\n  ]\n});\n';
  }

  /* Текст файла data/manifest.js */
  function serializeManifest() {
    return '/* Список файлов дисциплин. Порядок = порядок на главной странице.\n' +
      '   Для каждого id должен существовать файл ' + cfg.DATA_DIR + '<id>.js */\n' +
      'window.QUIZ_FILES = ' + JSON.stringify(merged.map(function (d) { return d.id; }), null, 2) + ';\n';
  }

  /* ---------- массовый ввод из текста ----------
       ? Текст вопроса
       + правильный ответ
       - неправильный ответ
       ! пояснение (необязательно)
       (пустая строка — следующий вопрос) */
  function parseBulk(text) {
    var questions = [], errors = [], cur = null;
    function flush() {
      if (!cur) return;
      var c = checkQuestion(cur);
      if (c.question) questions.push({ question: cur.question, answers: cur.answers, explanation: cur.explanation });
      else errors.push({ line: cur.line, message: 'Вопрос «' + cur.question.slice(0, 40) + '»: ' + c.errors.join(' ') });
      cur = null;
    }
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var t = line.trim();
      if (!t) { flush(); return; }
      var mark = t.charAt(0), rest = t.slice(1).trim();
      if (mark === '?') { flush(); cur = { line: i + 1, question: rest, answers: [], explanation: '' }; }
      else if ((mark === '+' || mark === '-') && cur) cur.answers.push({ text: rest, correct: mark === '+' });
      else if (mark === '!' && cur) cur.explanation = rest;
      else errors.push({ line: i + 1, message: 'Строка не распознана (нужно начинать с ?, +, - или !): «' + t.slice(0, 40) + '»' });
    });
    flush();
    return { questions: questions, errors: errors };
  }

  /* ---------- сырой текст с тегами → вопросы (компилятор тестов) ----------
       <question> Текст вопроса
       <variant> Вариант 1      ← по умолчанию ПЕРВЫЙ вариант правильный
       <variant> Вариант 2
       <question> Следующий вопрос …
     Теги можно писать и в одну строку, и на отдельных строках; регистр не важен.
     Если после последнего <variant> стоит <question> — начинается новый вопрос.
     opts.firstCorrect — сколько ПЕРВЫХ вариантов считать правильными (по умолчанию 1).
     Тег <right> вместо <variant> явно помечает правильный вариант: если в вопросе
     есть хотя бы один <right>, правилом «первые N» этот вопрос не обрабатывается. */
  function parseTagged(text, opts) {
    var firstCorrect = Math.max(1, parseInt(opts && opts.firstCorrect, 10) || 1);
    var src = String(text || '').replace(/\r\n?/g, '\n').replace(/<\/\s*(question|variant|right)\s*>/gi, '');
    var re = /<\s*(question|variant|right)\s*>/gi, m, marks = [];
    while ((m = re.exec(src))) marks.push({ tag: m[1].toLowerCase(), start: m.index, end: re.lastIndex });

    var questions = [], errors = [], cur = null, qNo = 0;
    function clean(t) { return t.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim(); }

    function flush() {
      if (!cur) return;
      var q = cur; cur = null;
      var label = '№' + q.no + ' «' + q.text.slice(0, 45) + (q.text.length > 45 ? '…' : '') + '»';
      if (!q.text) { errors.push('Вопрос ' + label + ': пустой текст вопроса.'); return; }
      if (q.variants.length < 2) { errors.push('Вопрос ' + label + ': нужно минимум 2 варианта (найдено ' + q.variants.length + ').'); return; }
      var explicit = q.variants.some(function (v) { return v.right; });
      var n = Math.min(firstCorrect, q.variants.length - 1);
      if (!explicit && firstCorrect >= q.variants.length) {
        errors.push('Вопрос ' + label + ': вариантов меньше или поровну с числом правильных (' + firstCorrect + ') — правильным оставлен только первый.');
        n = 1;
      }
      var answers = q.variants.map(function (v, i) {
        return { text: v.text, correct: explicit ? v.right : i < n };
      });
      if (answers.some(function (a) { return !a.text; })) {
        errors.push('Вопрос ' + label + ': есть пустой вариант — он пропущен.');
        answers = answers.filter(function (a) { return a.text; });
        if (answers.length < 2 || !answers.some(function (a) { return a.correct; })) return;
      }
      questions.push({ question: q.text, answers: answers });
    }

    if (marks.length && src.slice(0, marks[0].start).trim()) {
      errors.push('Текст до первого тега проигнорирован: «' + src.slice(0, marks[0].start).trim().slice(0, 40) + '…»');
    }
    marks.forEach(function (mk, i) {
      var body = clean(src.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : src.length));
      if (mk.tag === 'question') { flush(); cur = { no: ++qNo, text: body, variants: [] }; }
      else if (cur) cur.variants.push({ text: body, right: mk.tag === 'right' });
      else errors.push('<' + mk.tag + '> до первого <question> проигнорирован.');
    });
    flush();
    if (!marks.length) errors.push('Не найдено ни одного тега <question> / <variant>.');
    return { questions: questions, errors: errors, total: qNo };
  }

  /* Добавляет вопросы к дисциплине (создаёт её, если id новый). dedupe — убрать точные повторы. */
  function appendQuestions(id, title, questions, dedupe) {
    var base = get(id), raw = base ? toRaw(base) : { id: id, title: title || id, description: '', questions: [] };
    raw.questions = raw.questions.concat(questions);
    if (title && !base) raw.title = title;
    if (dedupe) {
      var n = normalizeDiscipline(raw);
      if (n.discipline) { n.discipline.questions = removeDuplicates(n.discipline.questions); raw = toRaw(n.discipline); }
    }
    return saveDiscipline(raw);
  }

  Quiz.store = {
    parseTagged: parseTagged, appendQuestions: appendQuestions,
    buildDiscipline: function (raw) { var n = normalizeDiscipline(raw); return n.discipline || null; },
    load: load, all: all, get: get, hasFile: hasFile, warnings: warnings, uniqueId: uniqueId,
    isValidId: isValidId, checkQuestion: checkQuestion, removeDuplicates: removeDuplicates,
    saveDiscipline: saveDiscipline, removeLocal: removeLocal,
    importData: importData, exportAll: exportAll,
    serializeFile: serializeFile, serializeManifest: serializeManifest, parseBulk: parseBulk,
    _toRaw: toRaw // для служебных скриптов
  };
})();
