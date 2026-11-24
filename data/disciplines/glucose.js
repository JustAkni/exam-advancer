/* Дисциплина: Глюкоза. Создано в compiler.html.
   Положите файл в data/disciplines/glucose.js и добавьте "glucose" в data/manifest.js.
   [НЕ УДАЛЯТЬ] обёртку (window.QUIZ_DATA = …push) — по ней store.js находит дисциплину. */
(window.QUIZ_DATA = window.QUIZ_DATA || []).push({
  id: "glucose",
  title: "Глюкоза",
  description: "Тестовая дисциплина: 10 вопросов, два из них с несколькими правильными ответами.",
  questions: [
    {"id":"h1n3s5p3","question":"Какова молекулярная формула глюкозы?","answers":[{"text":"C6H12O6","correct":true},{"text":"C12H22O11","correct":false},{"text":"C6H10O5","correct":false},{"text":"C2H5OH","correct":false},{"text":"CH3COOH","correct":false}]},
    {"id":"huo1vlw","question":"К какому классу углеводов относится глюкоза?","answers":[{"text":"Моносахариды","correct":true},{"text":"Дисахариды","correct":false},{"text":"Полисахариды","correct":false},{"text":"Липиды","correct":false},{"text":"Белки","correct":false}]},
    {"id":"hnsdg70","question":"Почему глюкозу называют альдегидоспиртом?","answers":[{"text":"Она содержит альдегидную группу и пять гидроксильных групп","correct":true},{"text":"Она содержит кетонную группу и пять гидроксильных групп","correct":false},{"text":"Она содержит карбоксильную группу и пять гидроксильных групп","correct":false},{"text":"Она содержит только гидроксильные группы","correct":false},{"text":"Она содержит аминогруппу и пять гидроксильных групп","correct":false}]},
    {"id":"h1fqdc4w","question":"Какие вещества образуются при спиртовом брожении глюкозы?","answers":[{"text":"Этанол","correct":true},{"text":"Углекислый газ","correct":true},{"text":"Молочная кислота","correct":false},{"text":"Уксусная кислота","correct":false},{"text":"Ацетон","correct":false}]},
    {"id":"h1pdmswn","question":"Что наблюдается при добавлении раствора глюкозы к свежеосаждённому Cu(OH)2 без нагревания?","answers":[{"text":"Образуется ярко-синий раствор","correct":true},{"text":"Выпадает кирпично-красный осадок","correct":false},{"text":"Выпадает чёрный осадок","correct":false},{"text":"Раствор становится бесцветным","correct":false},{"text":"Выделяется бесцветный газ","correct":false}]},
    {"id":"h1ml603z","question":"Какое свойство глюкозы доказывает реакция «серебряного зеркала»?","answers":[{"text":"Наличие альдегидной группы","correct":true},{"text":"Наличие карбоксильной группы","correct":false},{"text":"Наличие аминогруппы","correct":false},{"text":"Наличие двойной связи C=C","correct":false},{"text":"Наличие сложноэфирной группы","correct":false}]},
    {"id":"h1qott1n","question":"В ходе какого процесса растения синтезируют глюкозу из углекислого газа и воды?","answers":[{"text":"Фотосинтез","correct":true},{"text":"Клеточное дыхание","correct":false},{"text":"Спиртовое брожение","correct":false},{"text":"Гидролиз","correct":false},{"text":"Гликолиз","correct":false}]},
    {"id":"hsmpmaq","question":"Каков нормальный уровень глюкозы в крови здорового взрослого человека натощак?","answers":[{"text":"3,3–5,5 ммоль/л","correct":true},{"text":"7,0–9,0 ммоль/л","correct":false},{"text":"1,0–2,0 ммоль/л","correct":false},{"text":"10,0–12,0 ммоль/л","correct":false},{"text":"15,0–20,0 ммоль/л","correct":false}]},
    {"id":"htrixlh","question":"Какой гормон снижает уровень глюкозы в крови?","answers":[{"text":"Инсулин","correct":true},{"text":"Глюкагон","correct":false},{"text":"Адреналин","correct":false},{"text":"Кортизол","correct":false},{"text":"Тироксин","correct":false}]},
    {"id":"hnrvef3","question":"Какие полисахариды построены из остатков глюкозы?","answers":[{"text":"Крахмал","correct":true},{"text":"Целлюлоза","correct":true},{"text":"Гликоген","correct":true},{"text":"Инулин","correct":false},{"text":"Сахароза","correct":false}]}
  ]
});
