// js/app.js
// Минимальные правки: добавлены слушатели sync:apply:* и запуск SyncService.startPolling.
// Остальное — стандартная инициализация приложения без архитектурных изменений.

import { Storage } from "./infra/telegramEnv.js";
import SyncService from "./sync/syncService.js";
import * as repo from "./data/repo.js";
import {
  initUI,
  getState,
  refreshDashboard,
  refreshScheduleEditor
} from "./ui/events.js";
import { ensure as ensureDeviceId } from "./js/infra/deviceId.js";
ensureDeviceId(); 

// Простой прокси к логгеру UI, чтобы не плодить разные логгеры
function log(level, scope, msg, obj) {
  if (window.__UILOG) window.__UILOG(level, scope, msg, obj);
  else console.log(level, `[${scope}] ${msg}`, obj || "");
}

document.addEventListener("DOMContentLoaded", async () => {
  log("INF", "app", "DOM ready");

  // ВАЖНО: Storage.init() строго до любых обращений к repo
  await Storage.init();
  log("INF", "app", `Storage mode = ${Storage.getMode && Storage.getMode()}`);

  // Инициализация UI (как было у тебя)
  await initUI();

  // === КЛЕЙ ДЛЯ СИНХРОНИЗАЦИИ ===
  // Когда сервер сообщает о новом расписании — сохраняем и перерисовываем нужный экран
  window.addEventListener("sync:apply:schedule", async (ev) => {
    try {
      const { schedule, meta } = ev.detail || {};
      if (!schedule) return;
      await repo.saveSchedule(schedule);

      const state = getState && getState();
      if (state?.activeView === "schedule") {
        await refreshScheduleEditor();
      } else if (state?.activeView === "dashboard") {
        await refreshDashboard(state.selectedDateKey);
      }
      log("LOG", "app", "schedule applied from server", meta || {});
    } catch (e) {
      log("WRN", "app", "failed to apply schedule from server", { error: String(e) });
    }
  });

  // Когда сервер сообщает о новом override для конкретной даты
  window.addEventListener("sync:apply:override", async (ev) => {
    try {
      const { dateKey, override, meta } = ev.detail || {};
      if (!dateKey || !override) return;
      await repo.saveDayOverride(override);

      const state = getState && getState();
      if (state?.activeView === "dashboard" && state?.selectedDateKey === dateKey) {
        await refreshDashboard(state.selectedDateKey);
      }
      log("LOG", "app", `override applied for ${dateKey}`, meta || {});
    } catch (e) {
      log("WRN", "app", "failed to apply override from server", { error: String(e) });
    }
  });

  // Запускаем фоновый пулинг синхронизации (каждые 30 секунд)
  SyncService.startPolling(30_000);
});

