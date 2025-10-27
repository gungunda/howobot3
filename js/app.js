/**
 * js/app.js
 * Главная точка входа в приложение "Лёшин планировщик".
 *
 * Порядок запуска:
 * 1. Настроить хранилище (Storage) — определить, доступен ли Telegram.CloudStorage или работать локально.
 * 2. После инициализации Storage запустить пользовательский интерфейс (UI).
 *
 * Всё приложение работает ТОЛЬКО через Storage:
 * repo.js -> Storage.*() -> либо Telegram CloudStorage, либо localStorage браузера.
 */

import { Storage } from "./infra/telegramEnv.js";
import { initUI } from "./ui/events.js";

async function main() {
  // === 1. Инициализация хранилища ===
  // Storage.init() проверит доступность CloudStorage Телеграма.
  // Если недоступен — автоматически переключится на localStorage.
  await Storage.init();
  console.log("[app] Storage mode =", Storage.getMode && Storage.getMode());

  // === 2. Запуск пользовательского интерфейса ===
  // initUI:
  // - создаёт объект состояния приложения (state)
  // - навешивает обработчики событий
  // - выполняет первый рендер дашборда, календаря и расписания
  await initUI();
}

// Запускаем приложение.
// Важно: top-level await разрешён, потому что index.html подключает этот файл через <script type="module">
await main();