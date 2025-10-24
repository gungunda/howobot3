// js/ui/view-week.js
// Расписание недели + инлайн-редактор задачи расписания с днями разгрузки.
//
// Новое в этой версии:
//  - у задачи в расписании есть поле offloadDays: массив строк дней недели
//    (например ["tuesday","thursday"])
//  - у задачи в override это поле всегда null, но override тут не редактируется
//  - в инлайн-редакторе мы показываем чекбоксы для всех дней недели,
//    НО запрещаем выбирать "предыдущий день" относительно основного дня.
//    Пример: редактируем среду -> вторник отключён.
//    Это правило из доменной логики: за день до основного дня
//    предмет и так попадает как обычная D+1 задача, это не считается разгрузкой.

import { minutesToStr } from "../utils/format-utils.js";

const WEEK_ORDER = [
  ["monday","Понедельник"],
  ["tuesday","Вторник"],
  ["wednesday","Среда"],
  ["thursday","Четверг"],
  ["friday","Пятница"],
  ["saturday","Суббота"],
  ["sunday","Воскресенье"],
];

const WEEK_SHORT = [
  ["monday","Пн"],
  ["tuesday","Вт"],
  ["wednesday","Ср"],
  ["thursday","Чт"],
  ["friday","Пт"],
  ["saturday","Сб"],
  ["sunday","Вс"],
];

function prevWeekday(dayKey){
  // Возвращаем день недели, который идёт "накануне" данного dayKey.
  // monday -> sunday
  // tuesday -> monday
  // ...
  const order = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const idx = order.indexOf(dayKey);
  if(idx === -1) return null;
  const prevIdx = (idx + 6) % 7;
  return order[prevIdx];
}

function renderReadonlyRow(t){
  const row = document.createElement("div");
  row.className = "task-item";
  row.dataset.taskId = t.id ?? "";

  const rowWrap = document.createElement("div");
  rowWrap.className = "week-row";

  const tt = document.createElement("span");
  tt.className = "task-title";
  tt.textContent = t.title || "Без названия";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = minutesToStr(t.minutes || 0);

  const editBtn = document.createElement("button");
  editBtn.className = "week-edit";
  editBtn.textContent = "✎";

  const delBtn = document.createElement("button");
  delBtn.className = "week-del";
  delBtn.textContent = "🗑";

  const right = document.createElement("span");
  right.className = "week-row-right";
  right.append(badge, editBtn, delBtn);

  rowWrap.append(tt, right);
  row.appendChild(rowWrap);
  return row;
}

// weekdayKey — это день расписания, который мы сейчас редактируем (например "wednesday").
// Мы его используем, чтобы запретить отмечать предыдущий день как разгрузочный.
function renderEditRow(t, weekdayKey){
  const row = document.createElement("div");
  row.className = "task-item editing";
  row.dataset.taskId = t.id ?? "";

  const formWrap = document.createElement("div");
  formWrap.className = "week-edit-form";

  const titleLabel = document.createElement("div");
  titleLabel.className = "small muted";
  titleLabel.textContent = "Название";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "week-edit-title";
  titleInput.value = t.title || "";

  const minLabel = document.createElement("div");
  minLabel.className = "small muted";
  minLabel.textContent = "Минуты";

  const minInput = document.createElement("input");
  minInput.type = "number";
  minInput.className = "week-edit-minutes";
  minInput.value = String(t.minutes || 0);

  const offLabel = document.createElement("div");
  offLabel.className = "small muted";
  offLabel.textContent = "Разгрузка по дням";

  const offWrap = document.createElement("div");
  offWrap.className = "week-offload-grid";

  const offSet = Array.isArray(t.offloadDays) ? t.offloadDays : [];
  const blockedDay = prevWeekday(weekdayKey); // этот день нельзя выбирать

  for(const [wdKey, wdShort] of WEEK_SHORT){
    const lbl = document.createElement("label");
    lbl.className = "offload-choice";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "week-offload-chk";
    cb.value = wdKey;

    // чекнут, если был в offSet
    cb.checked = offSet.includes(wdKey);

    // если это запрещённый "предыдущий день", то делаем недоступным и снимаем галочку
    if (wdKey === blockedDay) {
      cb.checked = false;
      cb.disabled = true;
    }

    const span = document.createElement("span");
    span.textContent = wdShort;

    lbl.append(cb, span);
    offWrap.appendChild(lbl);
  }

  const btnRow = document.createElement("div");
  btnRow.className = "week-edit-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.className = "week-save";
  saveBtn.textContent = "Сохранить";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "week-cancel";
  cancelBtn.textContent = "Отмена";

  btnRow.append(saveBtn, cancelBtn);

  formWrap.append(
    titleLabel,
    titleInput,
    minLabel,
    minInput,
    offLabel,
    offWrap,
    btnRow
  );

  row.appendChild(formWrap);
  return row;
}

function renderDayCard(weekdayKey, weekdayTitle, tasksForDay, uiState){
  const card = document.createElement("div");
  card.className = "week-day card";
  card.dataset.weekday = weekdayKey;

  const head = document.createElement("div");
  head.className = "week-day-header";

  const titleEl = document.createElement("div");
  titleEl.className = "week-day-title";
  titleEl.textContent = weekdayTitle;

  const addBtn = document.createElement("button");
  addBtn.className = "week-add";
  addBtn.textContent = "+";

  head.append(titleEl, addBtn);
  card.appendChild(head);

  const list = document.createElement("div");
  list.className = "week-day-list";

  if(Array.isArray(tasksForDay) && tasksForDay.length){
    for(const t of tasksForDay){
      const isEditing =
        uiState.scheduleEdit &&
        uiState.scheduleEdit.weekday === weekdayKey &&
        uiState.scheduleEdit.taskId === t.id;

      const row = isEditing
        ? renderEditRow(t, weekdayKey) // <--- пробрасываем weekdayKey
        : renderReadonlyRow(t);

      list.appendChild(row);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "Нет предметов";
    list.appendChild(empty);
  }

  card.appendChild(list);
  return card;
}

export function updateWeekView(schedule, uiState){
  const view = document.querySelector('[data-view="schedule"]');
  if(!view) return;
  const container = view.querySelector("[data-week]");
  if(!container) return;

  container.innerHTML = "";

  for(const [weekdayKey, weekdayTitle] of WEEK_ORDER){
    const dayTasks = Array.isArray(schedule?.[weekdayKey]) ? schedule[weekdayKey] : [];
    const card     = renderDayCard(weekdayKey, weekdayTitle, dayTasks, uiState);
    container.appendChild(card);
  }
}
