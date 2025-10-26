// js/app.js
// Точка входа приложения.
// 1. инициализируем Storage (подключаемся к Telegram CloudStorage)
// 2. запускаем UI (initUI)

import { Storage } from "./infra/telegramEnv.js";
import { initUI } from "./ui/events.js";

await Storage.init();
initUI();
