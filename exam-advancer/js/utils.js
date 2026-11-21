/* =====================================================================
   js/utils.js — мелкие общие функции без привязки к страницам.
   Подключается ВТОРЫМ (после config.js).
   ===================================================================== */
(function () {
  'use strict';
  Quiz.need('config');

  /* el('div', {class:'a', onclick: fn, dataset:{x:1}}, 'текст', childEl)
     Создаёт элемент БЕЗ innerHTML.
     [НЕ ЗАМЕНЯТЬ НА innerHTML С ПОДСТАВКОЙ ТЕКСТА ВОПРОСОВ]
     В старой версии текст вопроса вставлялся через innerHTML: символы < > &
     в вопросе ломали вёрстку, а импортированный чужой файл мог выполнить
     скрипт (XSS). Здесь всё идёт через textContent — это безопасно. */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'value') node.value = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child === undefined || child === null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* Честное перемешивание Фишера–Йетса.
     [БЫЛО В ОРИГИНАЛЕ] sort(() => Math.random() - 0.5) даёт заметно
     неравномерный порядок — тест «чаще начинался» с одних и тех же вопросов. */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Короткий стабильный хэш строки — для id вопросов, у которых его нет. */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* Название → id для файла (латиница, цифры, - и _).
     Кириллица и казахские буквы транслитерируются. */
  var TR = {
    а:'a',ә:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',і:'i',к:'k',қ:'k',
    л:'l',м:'m',н:'n',ң:'n',о:'o',ө:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ұ:'u',ү:'u',ф:'f',х:'h',һ:'h',
    ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  };
  function slugify(text) {
    var s = String(text || '').toLowerCase().split('').map(function (c) {
      return TR[c] !== undefined ? TR[c] : c;
    }).join('');
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s;
  }

  /* Скачивание текста как файла (для экспорта из редактора). */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    /* [РИСК] Нельзя освобождать blob-ссылку сразу: Chrome начинает скачивание
       асинхронно, и файл может не скачаться. Освобождаем с запасом. */
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 10000);
  }

  /* add(node, a, [b, c], null, 'текст') — добавляет детей, пропуская null/false и разворачивая массивы.
     [НЕ ЗАМЕНЯТЬ на node.append(): он печатает слово «null» и не понимает массивы]. */
  function add(node) {
    for (var i = 1; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  Quiz.u = { add: add, el: el, clear: clear, shuffle: shuffle, hash: hash, slugify: slugify, download: download };
})();
