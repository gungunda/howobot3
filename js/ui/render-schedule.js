// js/ui/render-schedule.js
// Список задач с чекбоксом done, процентными кнопками и кнопкой "Сбросить день".

import { clear } from "./helpers.js";

export function renderSchedule(root, { dateKey, tasks }) {
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
  header.innerHTML = `
    <div class="schedule-title">Задачи на ${dateKey}</div>
    <div class="schedule-actions">
      <button id="reset-day-btn" type="button">Сбросить день</button>
    </div>
  `;
  root.appendChild(header);

  const list = document.createElement("div");
  list.className = "task-list";
  root.appendChild(list);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "task-empty";
    empty.textContent = "Нет задач на этот день";
    list.appendChild(empty);
    root.dataset.dateKey = dateKey;
    return root;
  }

  for (const t of tasks) {
    const item = document.createElement("div");
    item.className = "task-item";
    item.dataset.taskId = t.id ?? "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-done";
    checkbox.checked = !!t.done || (t.donePercent >= 100);

    const title = document.createElement("span");
    title.className = "task-title";
    const pct = typeof t.donePercent === "number" ? `(${t.donePercent}%) ` : "";
    title.textContent = `${pct}${t.title || "Без названия"}`;

    const controls = document.createElement("span");
    controls.className = "task-controls";
    const minus = document.createElement("button");
    minus.className = "task-pct-minus";
    minus.type = "button";
    minus.textContent = "−10%";
    const plus = document.createElement("button");
    plus.className = "task-pct-plus";
    plus.type = "button";
    plus.textContent = "+10%";
    const editBtn = document.createElement("button");
    editBtn.className = "task-edit";
    editBtn.type = "button";
    editBtn.textContent = "✎";

    controls.appendChild(minus);
    controls.appendChild(plus);
    controls.appendChild(editBtn);

    item.appendChild(checkbox);
    item.appendChild(title);
    item.appendChild(controls);
    list.appendChild(item);
  }

  root.dataset.dateKey = dateKey;
  return root;
}

export default renderSchedule;
