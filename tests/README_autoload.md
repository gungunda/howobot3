# Tests auto-discovery

С этого патча тест-раннер умеет подключать тесты автоматически из двух источников:

1) `tests/manifest.json` — JSON-массив путей к тестовым модулям.
   Пример:
   ```json
   [
     "tests/entities.test.js",
     "tests/units/entities.task.test.js",
     "tests/units/usecases.getSchedule.test.js"
   ]
   ```

2) Встроенный в `tests/test.html` блок:
   ```html
   <script type="application/json" id="tests-list">[ "tests/entities.test.js" ]</script>
   ```
   Его можно редактировать на лету, не трогая файлы.

Если оба источника пустые/отсутствуют — будет загружен дефолт `tests/entities.test.js`.

Запуск:
- Локально: открой `tests/test.html` через `http://localhost:...` (лучше через `python -m http.server`).
- На GitHub Pages: `https://<user>.github.io/howobot3/tests/test.html#auto` — запустит сразу.

