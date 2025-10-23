// js/app.js
// Точка входа: инициализация данных и UI (календарь + список).

import rehydrateApp from "./usecases/rehydrateApp.js";
import initUI from "./ui/events.js";

window.addEventListener("DOMContentLoaded", async () => {
  await rehydrateApp();
  await initUI();
});
