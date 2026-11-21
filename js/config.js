/* =====================================================================
   js/config.js — ЕДИНСТВЕННОЕ место настроек и текстов интерфейса.
   Подключается ПЕРВЫМ на каждой странице.

   ПОРЯДОК ПОДКЛЮЧЕНИЯ СКРИПТОВ (менять нельзя — каждый следующий
   файл использует предыдущие):
       config.js → utils.js → store.js → theme.js → auth.js → <скрипт страницы>
   Если порядок нарушить, в консоли появится понятная ошибка от Quiz.need().
   ===================================================================== */
(function () {
  'use strict';

  window.Quiz = window.Quiz || {};

  /* [РИСК] Если скрипт подключён не в том порядке, без этой проверки
     ошибка будет невнятной ("Cannot read properties of undefined").
     Quiz.need('config','store') — быстро падаем с понятным сообщением. */
  Quiz.need = function () {
    var missing = Array.prototype.filter.call(arguments, function (n) { return !Quiz[n]; });
    if (missing.length) {
      var msg = 'Quiz: не загружены модули: ' + missing.join(', ') +
                '. Проверьте порядок <script> (см. js/config.js).';
      console.error(msg);
      throw new Error(msg);
    }
  };

  Quiz.config = {
    SITE_TITLE: 'Тесттер',

    /* Вход по кнопке «Зайти».
       [ВАЖНО] Это НЕ защита: флаг лежит в localStorage, а файлы с вопросами
       открыты всем, у кого есть ссылка. Это просто «экран-заглушка».
       Настоящая защита возможна только на сервере (пароль + выдача данных
       после проверки). false — войти без кнопки. */
    AUTH_ENABLED: true,

    /* Включает страницу admin.html и ссылку на неё. Для публичной версии
       поставьте false (или просто не выкладывайте admin.html / admin.js).
       Это тоже не защита — лишь скрывает редактор. */
    ADMIN_ENABLED: true,

    /* Папка с файлами дисциплин и версия данных.
       [РИСК] Браузер кэширует .js. После замены файлов в data/ увеличьте
       DATA_VERSION (например '2'), иначе пользователи увидят старые вопросы. */
    DATA_DIR: 'data/disciplines/',
    MANIFEST_FILE: 'data/manifest.js',
    DATA_VERSION: '1',

    /* Тест */
    COUNT_PRESETS: [10, 30, 50, 100], // кнопки «выбрать количество вопросов»
    SHUFFLE_QUESTIONS: true,
    SHUFFLE_ANSWERS: true,

    /* [НЕ МЕНЯТЬ без миграции] Ключи localStorage.
       'isLoggedIn' и 'theme' — те же, что были в старой версии, поэтому
       у пользователей сохраняются вход и тема.
       'quiz.local.v1' — вопросы, созданные в редакторе. Если поменять
       формат хранения — создайте v2 и напишите перенос из v1 (см. store.js). */
    KEYS: { login: 'isLoggedIn', theme: 'theme', local: 'quiz.local.v1' },

    /* Имя параметра в ссылке quiz.html?category=<id>. Оставлено как было,
       чтобы старые закладки продолжали работать. */
    URL_PARAM: 'category',
    HOME_PAGE: 'index.html',

    /* Все тексты интерфейса. Хотите другой язык — правьте только здесь. */
    T: {
      chooseSection: 'Тест бөлімін таңда',
      chooseHint: 'Выберите нужный раздел для начала тестирования.',
      loginTitle: '🔐 Доступ к тестам',
      loginHint: 'Нажмите кнопку, чтобы войти',
      loginBtn: 'Зайти',
      logoutBtn: 'Выйти',
      accessActive: 'Доступ активен ✅',
      questionsWord: 'вопросов',
      noDisciplines: 'Пока нет ни одной дисциплины.',
      openEditor: 'Открыть редактор',
      editorLink: '✏️ Редактор дисциплин',
      dataWarning: '⚠ Не удалось загрузить файлы данных: ',

      pickCount: 'Выберите количество вопросов:',
      allQuestions: 'Все вопросы',
      customCount: 'Своё число',
      start: 'Начать',
      emptyDiscipline: 'В этой дисциплине пока нет вопросов.',
      notFound: 'Такой дисциплины нет или она не выбрана.',
      question: 'Вопрос',
      of: 'из',
      multiHint: 'Выберите все правильные ответы',
      check: 'Проверить',
      prev: '← Предыдущий',
      next: 'Следующий →',
      finish: 'Завершить тест',
      finishEarly: 'Завершить досрочно',
      finishConfirm: 'Вы уверены? Неотвеченные вопросы будут засчитаны как неправильные.',
      toMenu: 'В меню',
      results: 'Результаты теста',
      totalScore: 'Итоговый счет:',
      correctWord: 'Верно:',
      wrongWord: 'Ошибки:',
      skippedWord: 'Пропущено:',
      again: 'Пройти заново',
      review: 'Разбор ошибок',
      yourAnswer: 'Ваш ответ:',
      rightAnswer: 'Правильно:',
      noAnswer: '— нет ответа —'
    }
  };
})();
