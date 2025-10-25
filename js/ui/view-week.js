// js/ui/view-week.js
// ------------------------------------------------------------
// Отрисовка вкладки "Расписание недели".
// Мы показываем карточки дней недели и список задач.
// Поддерживаем два режима:
//   1) обычный просмотр задач дня;
//   2) инлайн-редактор задачи (в том числе для новой задачи).
//
// state.scheduleEdit = { weekday, taskId }
//   - если taskId === "__new__", значит добавление новой задачи инлайном.
//   - иначе редактирование существующей задачи с данным taskId.
//
// Каждая задача:
//   { id, title, minutes, offloadDays: ['monday','wednesday', ...] }
//
// offloadDays — массив дней, когда задачу можно "разгружать" заранее.
// Бизнес-правило: нельзя разгружать на день, который идёт ПЕРЕД
// основным днём задачи. То есть если задача назначена на среду,
// во вторник это будет "обычное" задание, а не разгрузка.
// Поэтому вторник нельзя включить как offload.
// ------------------------------------------------------------

// Маппинг weekday -> короткий лейбл
const WEEKDAY_LABEL = {
  monday: "Пн",
  tuesday: "Вт",
  wednesday: "Ср",
  thursday: "Чт",
  friday: "Пт",
  saturday: "Сб",
  sunday: "Вс"
};

// Порядок дней
const WEEK_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

// prevWeekdayKey("monday") -> "sunday" и т.д.
// Нужна для правила: нельзя разгружать на предыдущий день.
function prevWeekdayKey(dayKey) {
  const prevMap = {
    monday: "sunday",
    tuesday: "monday",
    wednesday: "tuesday",
    thursday: "wednesday",
    friday: "thursday",
    saturday: "friday",
    sunday: "saturday"
  };
  return prevMap[dayKey] || "saturday";
}

// Экранируем опасные символы, чтобы не сломать HTML
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Рисуем чекбоксы "разгружать в дни"
function renderOffloadCheckboxes(mainWeekday, offloadDaysArr) {
  const disallowDay = prevWeekdayKey(mainWeekday); // на этот день разгружать нельзя
  const allDays = WEEK_ORDER;

  let out = '<div class="week-offload-group">';
  out += '<div class="week-offload-label">Разгружать в дни:</div>';
  out += '<div class="week-offload-list">';

  for (const d of allDays) {
    const label = WEEKDAY_LABEL[d] || d;
    const checked = offloadDaysArr.includes(d) ? "checked" : "";
    const disabled = (d === disallowDay) ? "disabled" : "";

    out += `
      <label class="week-offload-item">
        <input
          class="week-offload-chk"
          type="checkbox"
          value="${d}"
          ${checked}
          ${disabled}
        />
        <span>${label}</span>
      </label>
    `;
  }

  out += "</div></div>";
  return out;
}

// Нормальный (не редактируемый) вид задачи
function renderTaskViewRow(task) {
  const offloadInfo = Array.isArray(task.offloadDays) && task.offloadDays.length
    ? `Разгрузка: ${task.offloadDays.map(d => WEEKDAY_LABEL[d] || d).join(", ")}`
    : "Разгрузка: —";

  return `
    <div class="task-item" data-task-id="${task.id}">
      <div class="task-mainline">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-mins">${Number(task.minutes) || 0} мин</span>
      </div>
      <div class="task-meta">${offloadInfo}</div>
      <div class="task-actions">
        <button class="week-edit" title="Редактировать">✎</button>
        <button class="week-del" title="Удалить">🗑</button>
      </div>
    </div>
  `;
}

// Редактор задачи (и для новой, и для существующей)
function renderTaskEditRow(mainWeekday, task, isNew) {
  // task: { id, title, minutes, offloadDays[] }
  // isNew: true для новой задачи
  const titleVal = task.title || "";
  const minutesVal = task.minutes != null ? task.minutes : 30;
  const offloadDaysArr = Array.isArray(task.offloadDays) ? task.offloadDays : [];

  const offloadBlock = renderOffloadCheckboxes(mainWeekday, offloadDaysArr);

  return `
    <div
      class="task-item editing ${isNew ? "is-new" : ""}"
      data-task-id="${isNew ? "__new__" : escapeHtml(task.id)}"
    >
      <div class="task-edit-fields">
        <label>
          Название:
          <input
            class="week-edit-title"
            type="text"
            value="${escapeHtml(titleVal)}"
            placeholder="Новая задача"
          />
        </label>

        <label>
          Минуты:
          <input
            class="week-edit-minutes"
            type="number"
            min="0"
            value="${minutesVal}"
          />
        </label>

        ${offloadBlock}
      </div>

      <div class="week-edit-actions">
        <button class="week-save">Сохранить</button>
        <button class="week-cancel">Отмена</button>
      </div>
    </div>
  `;
}

// Карточка дня недели: заголовок + список задач + кнопка "+"
function renderDayCard(weekday, tasks, editingInfo) {
  let html = `
    <section class="week-day" data-weekday="${weekday}">
      <h2 class="week-day-title">${WEEKDAY_LABEL[weekday] || weekday}</h2>
      <div class="week-day-tasks">
  `;

  // Если мы добавляем новую задачу в этот день:
  if (
    editingInfo &&
    editingInfo.weekday === weekday &&
    editingInfo.taskId === "__new__"
  ) {
    // Пустой драфт
    const draftTask = {
      id: "__new__",
      title: "",
      minutes: 30,
      offloadDays: []
    };
    html += renderTaskEditRow(weekday, draftTask, true);
  }

  // Рисуем задачи
  for (const task of tasks) {
    const isEditing =
      editingInfo &&
      editingInfo.weekday === weekday &&
      editingInfo.taskId === String(task.id);

    if (isEditing) {
      html += renderTaskEditRow(weekday, task, false);
    } else {
      html += renderTaskViewRow(task);
    }
  }

  html += `
      </div>
      <div class="week-add-wrap">
        <button class="week-add">+ Добавить задачу</button>
      </div>
    </section>
  `;

  return html;
}

// Главная функция, которую зовёт events.js -> refreshScheduleEditor()
export function updateWeekView(schedule, state) {
  const root = document.querySelector('[data-view="schedule"]');
  if (!root) return;

  const editingInfo = state && state.scheduleEdit ? state.scheduleEdit : null;

  let out = `
    <div class="week-header">
      <button class="back-btn" data-action="back-to-dashboard">← Назад</button>
      <h1>Расписание недели</h1>
      <p class="hint">
        Здесь ты задаёшь шаблон. Разгрузка = дни, когда можно работать заранее.
      </p>
    </div>
    <div class="week-columns">
  `;

  for (const weekday of WEEK_ORDER) {
    const tasks = Array.isArray(schedule?.[weekday]) ? schedule[weekday] : [];
    out += renderDayCard(weekday, tasks, editingInfo);
  }

  out += `
    </div>
  `;

  root.innerHTML = out;
}
