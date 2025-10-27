import { Storage } from "./infra/telegramEnv.js";
import initUI from "./ui/events.js"; // теперь default import

// Возможные вспомогательные штуки проекта:
// - repo.buildDashboardViewModel вызывается уже внутри events -> refreshDashboard()
// - view-компоненты теперь вызываются из events.js
// - т.е. app.js сейчас делает только стартовую инициализацию среды

async function main() {
  // 1. Инициализируем Storage (локальное или Telegram CloudStorage)
  await Storage.init();
  console.log("[app] Storage mode =", Storage.getMode && Storage.getMode());

  // 2. Инициализируем UI (вешаем обработчики, показываем стартовую вкладку)
  initUI();

  // 3. (опционально) можно сюда добавить любые future hooks
  //    например телеграмм-специфичные штуки типа tg.WebApp.expand()
  //    но сейчас это уже делается внутри telegramEnv.js/init()
}

main().catch(err => {
  console.error("[app] fatal init error", err);
});