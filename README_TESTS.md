# Howobot3 — Tests Patch (Steps 1–3)

Этот патч добавляет *неинвазивные* (ничего не перетирают) тестовые файлы.
Ты можешь запускать их прямо в браузере, открывая сами файлы как модули,
например: `http://localhost/.../js/tests/entities.test.js` или на GitHub Pages.

## Что добавлено
- `js/tests/entities.test.js` — smoke-тест сущностей (Entities).
- `js/tests/repos.test.js` — smoke-тест локальных репозиториев (LocalStorage).
- `js/tests/usecases.test.js` — smoke-тест для `getSchedule` и `addTaskToSchedule`.
- `js/tests/seed.js` — вспомогательный сидер LocalStorage для экспериментов.

## Как запускать
1) Открой страницу `js/tests/entities.test.js` прямо в браузере (как модуль).
   - Открой DevTools → Console. Ищи сообщения `[entities.test] OK/FAIL`.
2) Аналогично запусти `js/tests/repos.test.js` и `js/tests/usecases.test.js`.
3) При необходимости запусти `js/tests/seed.js` для подготовки данных в LocalStorage.

> Если хочешь, я сделаю патч `index.html`, чтобы тесты подключались автоматически при загрузке главной страницы.
