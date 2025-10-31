# План «фикса ID» — выполненная версия (минимальные изменения)

ЭТО МЫ ДЕЛАЕМ (строго по утверждённому плану):
1) **Создаём `js/infra/deviceId.js`** с `ensure()` и `get()` — единственная точка правды.
2) **В `js/sync/syncService.js`** больше нет своих генераторов — мы импортируем `getDeviceId()` из `js/infra/deviceId.js`.
3) **`js/domain/id.js`** помечаем как **DEPRECATED** и делаем реэкспорт с инфраструктурного слоя (чтобы старые импорты не упали).
4) **Вставка в `js/app.js` (вручную):** *перед* `Storage.init()` вызвать `ensure()`:
   ```js
   import { ensure as ensureDeviceId } from "./js/infra/deviceId.js";
   ensureDeviceId(); // <- ДО Storage.init()
   // затем: await Storage.init(); и всё остальное
   ```

НИЧЕГО БОЛЬШЕ НЕ МЕНЯЛИ — чтобы не нарушить архитектуру и ваш текущий код.

---

## Проверка
- После старта приложения в `localStorage` должен появиться ключ `planner.deviceId` (не "0").
- В логах запросов `pushSchedule`/`pushOverride` в `clientMeta.deviceId` должен уходить тот же ID.
- На втором устройстве ID будет другой — это и позволит маяку отличать источник.

Если нужно — потом обновим `public-api.json`, зафиксировав публичный API: `js/infra/deviceId.js:get`.
