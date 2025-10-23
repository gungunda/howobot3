// js/ui/render-schedule.js
// Рисуем список задач простыми div-элементами.
// На данном шаге — без редактирования, только вывод.

import { clear } from "./helpers.js";

export function renderSchedule(root, { dateKey, tasks }) {
  // root — это DOM-элемент-контейнер. Если не передали — создадим #schedule внутри #app.
  if (!root) {
    root = document.getElementById("schedule");
    if (!root) {
      const app = document.getElementById("app") || document.body;
      root = document.createElement("div");
      root.id = "schedule";
      app.appendChild(root);
    }
  }

  clear(root);

  const header = document.createElement("div");
  header.className = "schedule-header";
  header.textContent = `Задачи на ${dateKey}`;
  root.appendChild(header);

  const list = document.createElement("div");
  list.className = "task-list";
  root.appendChild(list);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "task-empty";
    empty.textContent = "Нет задач на этот день";
    list.appendChild(empty);
    return root;
  }

  for (const t of tasks) {
    const item = document.createElement("div");
    item.className = "task-item";
    // Читаемый формат: [минуты] Название (✓ если done)
    const done = t.done ? "✓ " : "";
    const minutes = (typeof t.minutes === "number") ? `[${t.minutes} мин] ` : "";
    item.textContent = `${done}${minutes}${t.title || "Без названия"}`;
    list.appendChild(item);
  }

  return root;
}

export default renderSchedule;
