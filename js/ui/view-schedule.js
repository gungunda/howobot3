import * as repo from "../data/repo.js";

// Отображаем короткие подписи дней (для оффлоада и меток)
const WEEKDAY_LABEL = {
  monday: "Пн",
  tuesday: "Вт",
  wednesday: "Ср",
  thursday: "Чт",
  friday: "Пт",
  saturday: "Сб",
  sunday: "Вс"
};

// Порядок дней в расписании
const WEEK_ORDER = [
  ["monday", "Понедельник"],
  ["tuesday", "Вторник"],
  ["wednesday", "Среда"],
  ["thursday", "Четверг"],
  ["friday", "Пятница"],
  ["saturday", "Суббота"],
  ["sunday", "Воскресенье"]
];

// Возвращает предыдущий день недели (для дедлайна)
function prevWeekday(dayKey) {
  const order = WEEK_ORDER.map(d => d[0]);
  const idx = order.indexOf(dayKey);
  if (idx === -1) return dayKey;
  const prevIdx = (idx - 1 + order.length) % order.length;
  return order[prevIdx];
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Рендер чекбоксов "разгружать заранее".
 *
 * Бизнес-правило:
 *   День, предшествующий дню задачи (prevWeekday(mainWeekday)),
 *   — это дедлайн. Его нельзя выбирать как день разгрузки.
 *   => этот чекбокс делаем disabled.
 *
 * offloadDaysArr: массив выбранных дней ["monday","wednesday",...]
 * mainWeekday: "monday" | "tuesday" | ...
 */
function renderOffloadCheckboxes(mainWeekday, offloadDaysArr) {
  const chosen = new Set(offloadDaysArr || []);
  const deadlineDay = prevWeekday(mainWeekday); // <-- исправлено

  let out = `
    <div class="week-offload-group">
      <div class="week-offload-label hint small muted">Дни разгрузки:</div>
      <div class="week-offload-list">
  `;

  for (const [wdKey, wdLabelLong] of WEEK_ORDER) {
    const shortLabel = WEEKDAY_LABEL[wdKey] || wdLabelLong || wdKey;
    const checked = chosen.has(wdKey) ? "checked" : "";

    // запрещаем выбирать день дедлайна
    const disabled = (wdKey === deadlineDay) ? "disabled" : "";
    const dimClass = disabled ? "muted" : "";

    out += `
      <label class="week-offload-item ${dimClass}">
        <input
          class="week-offload-checkbox"
          type="checkbox"
          value="${wdKey}"
          ${checked}
          ${disabled}
        />
        <span>${escapeHtml(shortLabel)}</span>
      </label>
    `;
  }

  out += `
      </div>
    </div>
  `;

  return out;
}

/**
 * Просмотр одной задачи (не редактируемой).
 */
function renderTaskViewRow(task) {
  const mins = Number(task.minutes) || 0;

  const offloadInfo = Array.isArray(task.offloadDays) && task.offloadDays.length
    ? task.offloadDays.map(d => WEEKDAY_LABEL[d] || d).join(", ")
    : "—";

  return `
    <div class="task-item"
         data-task-id="${escapeHtml(task.id)}"
         data-offload-days="${escapeHtml(
           Array.isArray(task.offloadDays)
             ? task.offloadDays.join(",")
             : ""
         )}">
      <div class="task-mainline">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-mins">${mins} мин</span>
      </div>

      <div class="task-meta">
        Разгрузка: ${escapeHtml(offloadInfo)}
      </div>

      <div class="task-actions">
        <button class="week-edit" type="button" title="Редактировать">✎</button>
        <button class="week-del"  type="button" title="Удалить">🗑</button>
      </div>
    </div>
  `;
}

/**
 * Редактор задачи (для существующей или новой).
 */
function renderTaskEditRow(mainWeekday, editState, isNew) {
  const titleVal   = editState.title || "";
  const minutesVal = editState.minutes != null ? editState.minutes : 30;
  const offloadArr = Array.isArray(editState.offloadDays)
    ? editState.offloadDays
    : [];

  const offloadBlock = renderOffloadCheckboxes(mainWeekday, offloadArr);

  return `
    <div class="task-item editing ${isNew ? "is-new" : ""}"
         data-task-id="${isNew ? "NEW" : escapeHtml(editState.taskId)}">

      <div class="task-edit-fields">
        <label class="task-edit-field">
          <span class="task-edit-label">Название:</span>
          <input
            class="week-edit-title"
            type="text"
            value="${escapeHtml(titleVal)}"
            placeholder="Новая задача"
          />
        </label>

        <label class="task-edit-field">
          <span class="task-edit-label">Минуты:</span>
          <input
            class="week-edit-minutes"
            type="number"
            min="0"
            value="${Number(minutesVal) || 0}"
          />
        </label>

        ${offloadBlock}
      </div>

      <div class="week-edit-actions">
        <button class="week-save"   type="button">Сохранить</button>
        <button class="week-cancel" type="button">Отмена</button>
      </div>
    </div>
  `;
}

/**
 * Карточка дня недели
 */
function renderDayBlock(weekdayKey, weekdayLabel, tasks, scheduleEdit) {
  let html = `
    <section class="week-day card" data-weekday="${weekdayKey}">
      <h2 class="week-day-title">${escapeHtml(weekdayLabel)}</h2>
      <div class="week-day-tasks">
  `;

  // Новый таск
  if (
    scheduleEdit &&
    scheduleEdit.weekday === weekdayKey &&
    !scheduleEdit.taskId
  ) {
    const draftTask = {
      taskId: null,
      title: scheduleEdit.title || "",
      minutes: scheduleEdit.minutes != null ? scheduleEdit.minutes : 30,
      offloadDays: scheduleEdit.offloadDays || []
    };
    html += renderTaskEditRow(weekdayKey, { ...draftTask, taskId: draftTask.taskId }, true);
  }

  // Существующие задачи
  for (const t of tasks) {
    const isEditing =
      scheduleEdit &&
      scheduleEdit.weekday === weekdayKey &&
      scheduleEdit.taskId === t.id;

    if (isEditing) {
      const currentTaskData = {
        taskId: t.id,
        title: scheduleEdit.title ?? t.title,
        minutes:
          scheduleEdit.minutes != null
            ? scheduleEdit.minutes
            : t.minutes,
        offloadDays:
          Array.isArray(scheduleEdit.offloadDays)
            ? scheduleEdit.offloadDays
            : Array.isArray(t.offloadDays)
              ? t.offloadDays
              : []
      };

      html += renderTaskEditRow(weekdayKey, currentTaskData, false);
    } else {
      html += renderTaskViewRow(t);
    }
  }

  html += `
      </div>
      <div class="week-add-wrap">
        <button class="week-add" type="button" title="Добавить">+ Добавить задачу</button>
      </div>
    </section>
  `;

  return html;
}

/**
 * Главная функция для вкладки "Расписание".
 */
export async function updateScheduleView(state) {
  const rootScheduleView = document.querySelector('[data-view="schedule"]');
  if (!rootScheduleView) {
    console.warn('updateScheduleView: no [data-view="schedule"] root');
    return;
  }

  const sched = await repo.loadSchedule();
  const editingInfo = state && state.scheduleEdit ? state.scheduleEdit : null;

  let html = `
    <div class="week-header">
      <button class="back-btn" data-action="back-to-dashboard">← Назад</button>
      <h1>Расписание недели</h1>
      <p class="hint small">
        Это общий шаблон. "Разгрузка" — дни, когда можно сделать задание заранее.
      </p>
    </div>

    <div class="week-columns" data-week>
  `;

  for (const [wdKey, wdLabel] of WEEK_ORDER) {
    const dayTasks = Array.isArray(sched[wdKey]) ? sched[wdKey] : [];
    html += renderDayBlock(wdKey, wdLabel, dayTasks, editingInfo);
  }

  html += `
    </div>
  `;

  rootScheduleView.innerHTML = html;
}

export default { updateScheduleView };