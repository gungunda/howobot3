function esc(str){
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// Одна строка задачи
function renderTaskRowView(task, opts){
  const {
    source,
    mainWeekday,
    isEditing,
    editingTaskId
  } = opts;

  const editingThis = isEditing && (editingTaskId === task.id);

  // режим редактирования (только для обычной задачи)
  if (editingThis && source === "core") {
    return `
      <div class="task-item editing"
           data-task-id="${esc(task.id)}"
           data-source="${esc(source)}"
           data-main-weekday="${esc(mainWeekday||"")}">

        <div class="task-edit-block">
          <div class="task-edit-field">
            <label>Название</label>
            <input class="dash-edit-title" type="text" value="${esc(task.title)}">
          </div>

          <div class="task-edit-field">
            <label>Минуты</label>
            <input class="dash-edit-minutes" type="number" min="0" value="${esc(task.minutes)}">
          </div>

          <div class="task-edit-actions">
            <button class="dash-save">Сохранить</button>
            <button class="dash-cancel">Отмена</button>
          </div>
        </div>
      </div>
    `;
  }

  // режим просмотра
  const pct = Math.max(0, Math.min(100, Math.round(Number(task.donePercent)||0)));

  return `
    <div class="task-item"
         data-task-id="${esc(task.id)}"
         data-source="${esc(source)}"
         data-main-weekday="${esc(mainWeekday||"")}">

      <label class="task-checkline">
        <input class="task-done" type="checkbox" ${pct>=100 ? "checked" : ""}>
        <span class="task-title">${esc(task.title)}</span>
      </label>

      <div class="task-mins">${esc(task.minutes)} мин</div>

      <div class="task-progress">
        <button class="task-pct-minus">–10%</button>
        <span class="task-pct-val">${pct}%</span>
        <button class="task-pct-plus">+10%</button>
      </div>

      <button class="task-edit" title="Редактировать">✎</button>
    </div>
  `;
}

// Блок с задачами
function renderTaskSection(label, list, dashboardEdit, forceSource){
  const arr = Array.isArray(list) ? list : [];
  const isEditing = !!dashboardEdit;
  const editingTaskId = dashboardEdit?.taskId || "";

  const rows = arr.map(t => {
    const src = forceSource || t.source || "core";
    const weekday = t.mainWeekday || dashboardEdit?.mainWeekday || "";
    return renderTaskRowView(t, {
      source: src,
      mainWeekday: weekday,
      isEditing,
      editingTaskId
    });
  }).join("");

  return `
    <section class="dash-section">
      <h2>${esc(label)}</h2>
      <div class="task-list">
        ${rows || `<div class="task-empty">Нет задач</div>`}
      </div>
    </section>
  `;
}

// Статистика
function renderStats(stats){
  if(!stats || typeof stats !== "object") return "";
  const totalMin = stats.totalMinutes ?? 0;
  const doneMin  = stats.doneMinutes ?? 0;
  const doneAvg  = Math.round(Number(stats.doneAvg)||0);

  return `
    <section class="dash-stats">
      <div class="stat-item">
        <div class="stat-label">Всего минут</div>
        <div class="stat-value">${esc(totalMin)}</div>
      </div>

      <div class="stat-item">
        <div class="stat-label">Сделано (мин)</div>
        <div class="stat-value">${esc(doneMin)}</div>
      </div>

      <div class="stat-item">
        <div class="stat-label">Готово (%)</div>
        <div class="stat-value">${esc(doneAvg)}%</div>
      </div>
    </section>
  `;
}

// Главная функция
export function updateDashboardView(model){
  const {
    dateKey,
    tasks,
    offloadTasks,
    stats,
    dashboardEdit
  } = model || {};

  const rootSection = document.querySelector('[data-view="dashboard"]');
  if(!rootSection) return;

  const htmlHeader = `
    <div class="dash-header"
         data-dashboard-root
         data-date-key="${esc(dateKey)}">

      <div class="dash-header-main">
        <h1>День ${esc(dateKey)}</h1>
        <button data-action="reset-day">Сбросить день</button>
        <button data-action="open-schedule-editor">Расписание</button>
      </div>
    </div>
  `;

  const htmlStats = renderStats(stats);
  // ✅ Явно указываем тип блока: core / offload
  const htmlTasksMain = renderTaskSection("На завтра", tasks, dashboardEdit, "core");
  const htmlTasksOff  = renderTaskSection("Разгрузка (сделай заранее)", offloadTasks, dashboardEdit, "offload");

  rootSection.innerHTML = htmlHeader + htmlStats + htmlTasksMain + htmlTasksOff;
}

export default { updateDashboardView };