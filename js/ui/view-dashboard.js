// js/ui/view-dashboard.js
// -----------------------------------------------------------------------------
// Рисуем главный экран ("День"):
//  - блок "На завтра"
//  - блок "Разгрузка (сделай заранее)"
//  - статистика
//
// ВАЖНО: поддерживаем inline-редактирование.
// Если задача в dashboardEdit и она source="core":
//   -> рендерим форму с полями Название / Минуты / Сохранить / Отмена
//
// Если задача в dashboardEdit и она source="offload":
//   -> рендерим НЕ форму, а подсказку:
//      "Это задача-разгрузка. Правка доступна в расписании соответствующего
//       дня недели или даты..."
// -----------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Обычный (не редактируемый) вид строки задачи
function renderTaskRowView(task) {
  return `
    <div class="task-item"
         data-task-id="${escapeHtml(task.id)}"
         data-source="${escapeHtml(task.source || "core")}"
         data-main-weekday="${escapeHtml(task.mainWeekday || "")}">
      <label class="task-checkline">
        <input class="task-done" type="checkbox" ${task.done ? "checked" : ""}/>
        <span class="task-title">${escapeHtml(task.title)}</span>
      </label>

      <div class="task-mins">${Number(task.minutes) || 0} мин</div>

      <div class="task-progress">
        <button class="task-pct-minus">–10%</button>
        <span class="task-pct-val">${Number(task.donePercent) || 0}%</span>
        <button class="task-pct-plus">+10%</button>
      </div>

      <button class="task-edit" title="Редактировать">✎</button>
    </div>
  `;
}

// Инлайн-форма редактирования ДЛЯ обычной задачи (source="core")
function renderTaskRowEditCore(task) {
  return `
    <div class="task-item editing"
         data-task-id="${escapeHtml(task.id)}"
         data-source="core"
         data-main-weekday="${escapeHtml(task.mainWeekday || "")}">
      <div class="task-edit-fields">
        <label>
          Название:
          <input class="dash-edit-title"
                 type="text"
                 value="${escapeHtml(task.title)}" />
        </label>

        <label>
          Минуты:
          <input class="dash-edit-minutes"
                 type="number"
                 min="0"
                 value="${Number(task.minutes) || 0}" />
        </label>
      </div>

      <div class="dash-edit-actions">
        <button class="dash-save">Сохранить</button>
        <button class="dash-cancel">Отмена</button>
      </div>
    </div>
  `;
}

// "Редактирование" разгрузочной задачи (source="offload"):
// не показываем инпуты, только подсказку
function renderTaskRowEditOffload(task) {
  return `
    <div class="task-item editing offload-hint"
         data-task-id="${escapeHtml(task.id)}"
         data-source="offload"
         data-main-weekday="${escapeHtml(task.mainWeekday || "")}">
      <div class="dash-offload-hint">
        Это задача-разгрузка.
        Правка доступна в расписании соответствующего дня недели или даты.
        Открой вкладку «Расписание» или выбери нужную дату в календаре.
      </div>
      <div class="dash-edit-actions">
        <button class="dash-cancel">Закрыть</button>
      </div>
    </div>
  `;
}

// Рендер одной строки с учётом режима редактирования
function renderTaskRow(task, dashboardEdit) {
  const isEditing = dashboardEdit && dashboardEdit.taskId === task.id;

  if (!isEditing) {
    return renderTaskRowView(task);
  }

  // Если редактируемую строку пометили как core -> форма
  if (dashboardEdit.source === "core") {
    return renderTaskRowEditCore(task);
  }

  // Если редактируемая строка offload -> подсказка
  return renderTaskRowEditOffload(task);
}

// Рендер секции задач: заголовок + список
function renderTaskSection(title, tasks, dashboardEdit) {
  if (!tasks || !tasks.length) {
    return `
      <section class="dash-block">
        <h2>${escapeHtml(title)}</h2>
        <div class="dash-empty">Нет задач</div>
      </section>
    `;
  }

  let html = `
    <section class="dash-block">
      <h2>${escapeHtml(title)}</h2>
      <div class="dash-tasklist">
  `;

  for (const t of tasks) {
    html += renderTaskRow(t, dashboardEdit);
  }

  html += `
      </div>
    </section>
  `;
  return html;
}

// Рендер статистики дня
function renderStats(stats) {
  const total = Number(stats?.totalMinutes || 0);
  const doneM = Number(stats?.doneMinutes || 0);
  const avg   = Number(stats?.doneAvg || 0);

  return `
    <section class="dash-stats">
      <div>Всего минут: ${total}</div>
      <div>Сделано (мин): ${Math.round(doneM)}</div>
      <div>Средний прогресс: ${avg}%</div>
    </section>
  `;
}

// Главная точка отрисовки дашборда
export function updateDashboardView(model) {
  const { dateKey, tasks, offloadTasks, stats, dashboardEdit } = model;

  const root = document.querySelector('[data-view="dashboard"]');
  if (!root) return;

  let out = `
    <div class="dash-header" data-dashboard-root data-date-key="${escapeHtml(dateKey)}">
      <div class="dash-header-main">
        <h1>День ${escapeHtml(dateKey)}</h1>
        <button data-action="reset-day">Сбросить день</button>
        <button data-action="open-schedule-editor">Расписание</button>
      </div>
    </div>
  `;

  out += renderStats(stats);

  // блок "На завтра"
  out += renderTaskSection("На завтра", tasks, dashboardEdit);

  // блок "Разгрузка (сделай заранее)"
  out += renderTaskSection("Разгрузка (сделай заранее)", offloadTasks, dashboardEdit);

  root.innerHTML = out;
}
