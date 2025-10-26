// js/ui/render-schedule.js

import * as repo from "../data/repo.js";

const WEEK_ORDER = [
  ["monday", "Понедельник"],
  ["tuesday", "Вторник"],
  ["wednesday", "Среда"],
  ["thursday", "Четверг"],
  ["friday", "Пятница"],
  ["saturday", "Суббота"],
  ["sunday", "Воскресенье"]
];

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// обычный просмотр задачи (без редактирования)
function renderTaskRowView(task) {
  const offloadStr = Array.isArray(task.offloadDays)
    ? task.offloadDays.join(", ")
    : "";

  return `
    <div class="task-item"
         data-task-id="${escapeHtml(task.id)}"
         data-offload-days="${escapeHtml(offloadStr)}">
      <div class="task-line">
        <div class="task-line-main">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <span class="task-minutes">${Number(task.minutes) || 0} мин</span>
        </div>
        <div class="task-line-actions">
          <button class="week-edit" type="button" title="Редактировать">✎</button>
          <button class="week-del"  type="button" title="Удалить">🗑</button>
        </div>
      </div>
      <div class="task-offload">
        ${offloadStr ? `Разгрузка: ${escapeHtml(offloadStr)}` : ""}
      </div>
    </div>
  `;
}

// режим редактирования / добавления
function renderTaskRowEdit(editState) {
  // editState = { weekday, taskId, title, minutes, offloadDays }
  const isNew = !editState.taskId;
  const offSet = new Set(editState.offloadDays || []);

  // чекбоксы выбора дней разгрузки
  const checkboxesHtml = WEEK_ORDER.map(([wdKey, wdLabel]) => {
    const checked = offSet.has(wdKey) ? "checked" : "";
    return `
      <label class="offload-opt">
        <input class="week-offload-checkbox"
               type="checkbox"
               value="${wdKey}"
               ${checked}/>
        ${wdLabel}
      </label>
    `;
  }).join("");

  return `
    <div class="task-item editing"
         data-task-id="${isNew ? "NEW" : escapeHtml(editState.taskId)}">
      <div class="task-edit-block">
        <div class="task-edit-main">
          <input class="week-edit-title"
                 type="text"
                 value="${escapeHtml(editState.title)}"
                 placeholder="Название предмета"/>
          <input class="week-edit-minutes"
                 type="number"
                 min="0"
                 value="${Number(editState.minutes) || 0}"
                 style="width:4em"/>
        </div>

        <div class="task-edit-actions">
          <button class="week-save"   type="button">Сохранить</button>
          <button class="week-cancel" type="button">Отмена</button>
        </div>
      </div>

      <div class="task-offload-editor">
        <div class="hint small muted">Дни разгрузки:</div>
        <div class="offload-list">
          ${checkboxesHtml}
        </div>
      </div>
    </div>
  `;
}

// один день недели целиком
function renderDayBlock(weekdayKey, weekdayLabel, tasks, scheduleEdit) {
  // tasks — массив задач для этого дня (из расписания)
  // scheduleEdit — state.scheduleEdit или null

  let rowsHtml = "";

  for (const t of tasks) {
    if (
      scheduleEdit &&
      scheduleEdit.weekday === weekdayKey &&
      scheduleEdit.taskId === t.id
    ) {
      // редактируем именно эту задачу
      rowsHtml += renderTaskRowEdit(scheduleEdit);
    } else {
      rowsHtml += renderTaskRowView(t);
    }
  }

  // если добавляем новую задачу (taskId === null),
  // и этот день совпадает с scheduleEdit.weekday — рисуем форму внизу
  if (
    scheduleEdit &&
    scheduleEdit.weekday === weekdayKey &&
    !scheduleEdit.taskId
  ) {
    rowsHtml += renderTaskRowEdit(scheduleEdit);
  }

  return `
    <div class="week-day card" data-weekday="${weekdayKey}">
      <div class="week-day-head">
        <div class="week-day-title">${escapeHtml(weekdayLabel)}</div>
        <button class="week-add" type="button" title="Добавить">＋</button>
      </div>

      <div class="week-day-tasks">
        ${
          rowsHtml ||
          `<div class="week-day-empty muted small">Нет задач</div>`
        }
      </div>
    </div>
  `;
}

export async function updateScheduleView(state) {
  // ищем контейнер, куда надо рендерить список дней недели
  const root = document.querySelector('[data-view="schedule"] [data-week]')
    || document.querySelector('[data-view="schedule"] .week-grid');

  if (!root) {
    console.warn("updateScheduleView: no [data-week] container");
    return;
  }

  // подгружаем текущее расписание недели
  const sched = await repo.loadSchedule();

  // собираем карточки Пн..Вс
  let fullHtml = "";
  for (const [wdKey, wdLabel] of WEEK_ORDER) {
    const dayTasks = Array.isArray(sched[wdKey]) ? sched[wdKey] : [];
    fullHtml += renderDayBlock(wdKey, wdLabel, dayTasks, state.scheduleEdit);
  }

  root.innerHTML = fullHtml;
}

export default { updateScheduleView };
