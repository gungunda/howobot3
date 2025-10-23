# Патч для стабилизации тестов

Содержимое:
1) 5 перезаписанных файлов usecases-*.test.js (UTF-8, без странных первых символов).
2) tests/setup.init.js — модуль, который вызывает loadSchedule() до запуска тестов,
   чтобы дефолт записался в LocalStorage (ключ planner.schedule).
3) tests/manifest.json — пример со списком тестов через относительные пути ./units/...

Подключение:
- Вставь в `tests/test.html` перед подключением `test-suite.js`:
  <script type="module" src="./setup.init.js"></script>

- Убедись, что `tests/manifest.json` содержит относительные пути.
- Жёстко обнови страницу (Ctrl+F5).

Ожидаемый эффект:
- LocalStorage наполнится сразу после загрузки тестовой страницы.
- Импорты тестов пройдут без "Invalid or unexpected token".
