// js/ui/view-dashboard.js
// Рендер дашборда (экран "Сегодня").
// Мы рисуем две зоны:
//   1) "На завтра" — то, что реально надо сделать к завтрашнему дню.
//   2) "Разгрузка" — подготовка заранее к другим дням.
//
// На вход прилетает объект:
//   {
//     dateKey: "2025-10-24",
//     tasks:        [ { id, title, minutes, donePercent, done, mainWeekday, source: "core" }, ... ],
//     offloadTasks: [ { ...source:"offload"... }, ... ],
//     stats: { totalMinutes, doneMinutes, doneAvg }
//   }
//
// Для каждой задачи мы ставим data-атрибуты на .task-item:
//   data-task-id="..."
//   data-source="core"|"offload"
//   data-main-weekday="monday"|"tuesday"|...
//
// Эти атрибуты читает events.js, чтобы понять,
// в какой override-день писать прогресс при кликах +10%, -10%, чекбоксе done.

import { minutesToStr } from "../utils/format-utils.js";

// Отрисовка одной задачи
function renderTaskRow(t) {
  // t: { id,title,minutes,donePercent,done,mainWeekday,source }

  const row = document.createElement("div");
  row.className = "task-item";
  row.dataset.taskId = String(t.id || "");
  row.dataset.source = t.source || "core";
  row.dataset.mainWeekday = t.mainWeekday || "";

  // левая часть: чекбокс done + заголовок + минуты
  const leftWrap = document.createElement("label");
  leftWrap.className = "task-left";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "task-done";
  cb.checked = !!t.done;

  const titleSpan = document.createElement("span");
  titleSpan.className = "task-title";
  titleSpan.textContent = t.title || "Без названия";

  const minsSpan = document.createElement("span");
  minsSpan.className = "task-minutes muted small";
  minsSpan.textContent = " · " + minutesToStr(t.minutes || 0);

  leftWrap.append(cb, titleSpan, minsSpan);

  // правая часть: -10% [xx%] +10% ✎
  const rightWrap = document.createElement("div");
  rightWrap.className = "task-controls";

  const minusBtn = document.createElement("button");
  minusBtn.className = "task-pct-minus";
  minusBtn.textContent = "-10%";

  const pctLabel = document.createElement("span");
  pctLabel.className = "task-pct-label";
  pctLabel.textContent = (t.donePercent ?? 0) + "%";

  const plusBtn = document.createElement("button");
  plusBtn.className = "task-pct-plus";
  plusBtn.textContent = "+10%";

  const editBtn = document.createElement("button");
  editBtn.className = "task-edit";
  editBtn.textContent = "✎";

  rightWrap.append(minusBtn, pctLabel, plusBtn, editBtn);

  row.append(leftWrap, rightWrap);
  return row;
}

// Отрисовка секции (заголовок + список задач)
function renderTaskList(title, tasksArr) {
  const box = document.createElement("section");
  box.className = "dash-block";

  const h = document.createElement("div");
  h.className = "dash-block-header";

  const hTitle = document.createElement("div");
  hTitle.className = "dash-block-title";
  hTitle.textContent = title;

  h.appendChild(hTitle);
  box.appendChild(h);

  const list = document.createElement("div");
  list.className = "dash-list";

  if (Array.isArray(tasksArr) && tasksArr.length) {
    tasksArr.forEach(t => {
      list.appendChild(renderTaskRow(t));
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "Нет задач";
    list.appendChild(empty);
  }

  box.appendChild(list);
  return box;
}

// Статистика дня (сверху)
function renderStats(statsObj) {
  const wrap = document.createElement("div");
  wrap.className = "dash-stats small";

  const total = Number(statsObj?.totalMinutes || 0);
  const done = Math.round(Number(statsObj?.doneMinutes || 0));
  const avg = Number(statsObj?.doneAvg || 0);

  wrap.textContent =
    "Всего " + total + " мин · " +
    "Готово ~" + done + " мин · " +
    "Средний прогресс " + avg + "%";

  return wrap;
}

// Главная функция рендера дашборда
export function updateDashboardView({ dateKey, tasks, offloadTasks, stats }) {
  const view = document.querySelector('[data-view="dashboard"]');
  if (!view) return;

  const root = view.querySelector("[data-dashboard-root]");
  if (!root) return;

  // Запоминаем текущую дату для обработчиков событий
  root.dataset.dateKey = dateKey;

  // Полностью перерисовываем дашборд
  root.innerHTML = "";

  // Верхняя панель — статистика и кнопки
  const topBar = document.createElement("div");
  topBar.className = "dash-topbar";

  // блок статистики
  topBar.appendChild(renderStats(stats || {}));

  // кнопки "Сбросить день" и "Расписание"
  const btnRow = document.createElement("div");
  btnRow.className = "dash-top-buttons";

  const resetBtn = document.createElement("button");
  resetBtn.setAttribute("data-action", "reset-day");
  resetBtn.textContent = "Сбросить день";

  const schedBtn = document.createElement("button");
  schedBtn.setAttribute("data-action", "open-schedule-editor");
  schedBtn.textContent = "Расписание";

  btnRow.append(resetBtn, schedBtn);
  topBar.appendChild(btnRow);

  root.appendChild(topBar);

  // Блок "На завтра"
  const coreBlock = renderTaskList("На завтра", tasks || []);
  root.appendChild(coreBlock);

  // Блок "Разгрузка"
  const offBlock = renderTaskList("Разгрузка", offloadTasks || []);
  root.appendChild(offBlock);
}
