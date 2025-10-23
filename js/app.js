// js/app.js
// Точка входа: инициализация и первый рендер «Дня».

import rehydrateApp from "./usecases/rehydrateApp.js";
import renderDashboard from "./ui/render-dashboard.js";
import { todayKey } from "./ui/helpers.js";

window.addEventListener("DOMContentLoaded", async () => {
  // 1) Подтягиваем данные (schedule) в состояние
  await rehydrateApp();

  // 2) Рендерим «День» на сегодня
  await renderDashboard(todayKey());
});
