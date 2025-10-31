# Строгий фикс deviceId (исправление нулей/пустых значений)

1) Вставь в `js/app.js` ПЕРЕД `await Storage.init()`:
```js
import { ensure as ensureDeviceId } from "./js/infra/deviceId.js";
ensureDeviceId();
```
2) Файлы в этом архиве:
- `js/infra/deviceId.js` — ensure()/get()/isBad()
- `js/sync/syncService.js` — берёт deviceId только из infra
- `js/domain/id.js` — DEPRECATED-реэкспорт

Проверка: в localStorage ключ `planner.deviceId` НЕ равен "0", пустоте и т.п., а вида `dev_<...>`.
