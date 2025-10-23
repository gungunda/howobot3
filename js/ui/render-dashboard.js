// js/ui/render-dashboard.js
// Получаем задачи на дату и рисуем их с помощью renderSchedule.

import { todayKey, el } from "./helpers.js";
import renderSchedule from "./render-schedule.js";

export default async function renderDashboard(dateKey = todayKey()) {
  // ленивый импорт use case, чтобы не тащить его в бандл UI без нужды
  const mod = await import("../usecases/getTasksForDate.js").catch(() => ({}));
  const getTasksForDate = mod.default || mod.getTasksForDate || mod.run;

  const key = dateKey || todayKey();
  const tasks = typeof getTasksForDate === "function"
    ? await getTasksForDate({ dateKey: key })
    : [];

  // Корневой контейнер #app — если нет, создадим
  let app = el("#app") || document.getElementById("app");
  if (!app) {
    app = document.createElement("div");
    app.id = "app";
    document.body.appendChild(app);
  }

  // Внутри рисуем расписание
  renderSchedule(null, { dateKey: key, tasks });
}
