// js/app.js
//
// Точка входа приложения.
// ВАЖНО: порядок инициализации такой:
// 1. дождаться DOMContentLoaded
// 2. вызвать await Storage.init()  — настроить режим хранения (local / cloud)
// 3. ВСТАВЛЕНО: дождаться SyncService.pullBootstrap() — подтянуть свежие данные с сервера (Vercel KV)
// 4. initUI() из events.js — отрисовать интерфейс на уже актуальных данных
//
// Это нужно для синхронизации между устройствами:
// если ребёнок правил расписание/прогресс на планшете, а сейчас открыл телефон,
// мы хотим подхватить последние данные ДО того как отрисуем экран.

import { Storage } from "./infra/telegramEnv.js";
import { initUI } from "./ui/events.js";

// новый импорт для синхронизации с сервером
import SyncService from "./sync/syncService.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[app] DOM ready");

  // 1. Инициализация слоя Storage
  // Это важно: repo.js в дальнейшем читает/пишет через Storage.
  await Storage.init();

  console.log("[app] Storage mode =", Storage.getMode && Storage.getMode());

  // 2. ПЕРЕД тем как строить UI — тянем актуальные данные с сервера
  // pullBootstrap():
  // - спросит /api/list
  // - сравнит updatedAt с локальными версиями
  // - подтянет только те override и расписание, которые на сервере свежее
  // - сохранит их через repo в локальное хранилище
  //
  // Важно: если мы не в Telegram.WebApp (обычный браузер) — SyncService сам
  // пропустит сетевую синхронизацию и просто ничего не сделает.
  try {
    await SyncService.pullBootstrap();
  } catch (e) {
    console.warn("[app] pullBootstrap failed (continue offline)", e);
  }

  // 3. Запуск UI-контроллера
  initUI();
});