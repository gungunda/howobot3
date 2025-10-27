/**
 * Рендер дашборда (экран "Сегодня").
 *
 * Очень важно:
 * - Здесь показываются две группы задач:
 *   1) Основные задачи дня (model.tasks)
 *   2) Разгрузка (model.offloadTasks) — это задачи из будущих дней,
 *      которые можно сделать заранее.
 *
 * - Есть inline-редактирование:
 *   * для обычной задачи дня (source="core") — можно менять title/minutes
 *   * для задачи разгрузки (source="offload") — нельзя менять.
 *     Вместо формы показываем текстовую подсказку, что это задача из разгрузки.
 *
 * model = {
 *   dateKey: "2025-10-27",
 *   tasks: [ { id, title, minutes, donePercent, done, source, mainWeekday, deadlineWeekday, ... }, ... ],
 *   offloadTasks: [... те же поля ...],
 *   stats: { totalMinutes, doneMinutes, doneAvg },
 *   dashboardEdit: {
 *     dateKey: "...",
 *     taskId: "...",
 *   } | null
 * }
 */

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Рисуем одну задачу в "обычном" режиме (не редактирование)
 */
function renderTaskRowRead(task, isOffload) {
  // Чекбокс "сделано" и кнопки + / - доступны всегда,
  // потому что процент выполнения можно ставить даже на разгрузке.
  return `
    <div class="task-main">
      <div class="task-left">
        <input
          type="checkbox"
          class="task-done"
          ${task.done ? "checked" : ""}
        />
      </div>

      <div class="task-mid">
        <div class="task-title">${esc(task.title || "Без названия")}</div>
        <div class="task-meta small muted">
          ${task.minutes ? esc(task.minutes) + " мин" : "0 мин"}
          &nbsp;·&nbsp;
          ${task.donePercent || 0}%
          ${
            isOffload
              ? `&nbsp;·&nbsp;<span class="offload-label">разгрузка</span>`
              : ""
          }
        </div>
      </div>

      <div class="task-right">
        <button class="task-pct-minus" type="button">–10%</button>
        <button class="task-pct-plus" type="button">+10%</button>
        <button class="task-edit" type="button">✎</button>
      </div>
    </div>
  `;
}

/**
 * Если задача сейчас в режиме редактирования на дашборде.
 *
 * ВАЖНО:
 * - Если это обычная задача (source="core"), показываем настоящую форму редактирования.
 * - Если это задача из разгрузки (source="offload"), НЕЛЬЗЯ менять title/minutes.
 *   Вместо формы показываем заметку-подсказку.
 */
function renderTaskRowEdit(task, isOffload) {
  if (isOffload) {
    // режим редактирования для разгрузочной задачи:
    // вместо формы — сообщение
    return `
      <div class="task-edit-block offload-edit-note">
        <div class="offload-note-text small muted" style="margin-bottom:8px;">
          Это задача из блока «Разгрузка». Её текст и длительность
          можно менять в расписании недели (вкладка «Расписание»)
          или в дне с дедлайном.
        </div>

        <div class="task-edit-actions">
          <button class="dash-cancel" type="button">OK</button>
        </div>
      </div>
    `;
  }

  // обычная задача (source="core") → показываем полноценную форму
  return `
    <div class="task-edit-block">
      <div class="task-field">
        <label class="small muted">Предмет / задание</label>
        <input
          class="dash-edit-title"
          type="text"
          value="${esc(task.title || "")}"
        />
      </div>

      <div class="task-field">
        <label class="small muted">Минут</label>
        <input
          class="dash-edit-minutes"
          type="number"
          min="0"
          step="5"
          value="${Number(task.minutes) || 0}"
        />
      </div>

      <div class="task-edit-actions">
        <button class="dash-save" type="button">Сохранить</button>
        <button class="dash-cancel" type="button">Отмена</button>
      </div>
    </div>
  `;
}

/**
 * Рендер одной строки задачи дня или разгрузки.
 *
 * Мы кладём в data-* важные атрибуты:
 *   data-task-id
 *   data-source="core" | "offload"
 *   data-main-weekday="friday"
 *   data-deadline-weekday="thursday"
 *
 * Эти data-* потом использует events.js, чтобы понять:
 * - куда писать прогресс (в какой день делать override)
 * - как обрабатывать редактирование
 */
function renderTaskRow(task, dashboardEdit) {
  const isEditing =
    dashboardEdit &&
    dashboardEdit.taskId === task.id;

  const isOffload = task.source === "offload";

  return `
    <div
      class="task-item ${isEditing ? "editing" : ""} ${isOffload ? "is-offload" : ""}"
      data-task-id="${esc(task.id)}"
      data-source="${esc(task.source || "core")}"
      data-main-weekday="${esc(task.mainWeekday || "")}"
      data-deadline-weekday="${esc(task.deadlineWeekday || "")}"
    >
      ${
        isEditing
          ? renderTaskRowEdit(task, isOffload)
          : renderTaskRowRead(task, isOffload)
      }
    </div>
  `;
}

/**
 * Рендерит список задач (обычные задачи дня).
 */
function renderMainTasks(tasks, dashboardEdit) {
  if (!tasks || !tasks.length) {
    return `<div class="muted small">Нет задач на сегодня</div>`;
  }
  return tasks
    .map(task => renderTaskRow(task, dashboardEdit))
    .join("");
}

/**
 * Рендерит блок «Разгрузка» (offloadTasks).
 * Если нет разгрузочных задач — секция будет скрыта извне по стилю.
 */
function renderOffloadTasks(offloadTasks, dashboardEdit) {
  if (!offloadTasks || !offloadTasks.length) {
    return "";
  }
  return offloadTasks
    .map(task => renderTaskRow(task, dashboardEdit))
    .join("");
}

/**
 * Основная функция — вставляем всё в DOM.
 * На странице должен быть контейнер с атрибутом data-dashboard-root.
 */
export function updateDashboardView(model) {
  const root = document.querySelector("[data-dashboard-root]");
  if (!root) return;

  const {
    dateKey,
    tasks,
    offloadTasks,
    stats,
    dashboardEdit,
  } = model;

  // Заполняем шапку дня (дата, метки и т.д.)
  const dayLabelEl = root.querySelector("[data-day-label]");
  if (dayLabelEl) {
    dayLabelEl.textContent = formatDateLabel(dateKey);
  }

  // Статистика
  if (stats) {
    const plannedEl = root.querySelector('[data-stat="planned"]');
    const doneEl = root.querySelector('[data-stat="done"]');
    const leftEl = root.querySelector('[data-stat="left"]');
    const etaEl = root.querySelector('[data-stat="eta"]');

    if (plannedEl) plannedEl.textContent = `${stats.totalMinutes} мин`;
    if (doneEl) doneEl.textContent = `${stats.doneMinutes} мин (${stats.doneAvg}%)`;

    const left = Math.max(stats.totalMinutes - stats.doneMinutes, 0);
    if (leftEl) leftEl.textContent = `${left} мин`;

    // ETA = "сколько осталось минут" условно, можно улучшить позже
    if (etaEl) etaEl.textContent = `${left} мин`;
  }

  // Основные задачи дня
  const tasksWrap = root.querySelector("[data-tasks]");
  const emptyEl = root.querySelector("[data-empty]");

  if (tasksWrap) {
    tasksWrap.innerHTML = renderMainTasks(tasks, dashboardEdit);
  }

  if (emptyEl) {
    emptyEl.style.display = tasks && tasks.length ? "none" : "";
  }

  // Разгрузка
  const offloadWrapper = root.querySelector("[data-offload-wrapper]");
  const offloadList = root.querySelector("[data-offload]");

  if (offloadList) {
    offloadList.innerHTML = renderOffloadTasks(offloadTasks, dashboardEdit);
  }

  if (offloadWrapper) {
    offloadWrapper.style.display =
      offloadTasks && offloadTasks.length ? "" : "none";
  }
}

/**
 * Удобная подпись даты для заголовка дашборда.
 * Например "27.10.2025 (пн)".
 */
function formatDateLabel(dateKey) {
  if (!dateKey) return "—";

  // dateKey: "2025-10-27"
  const [yyyy, mm, dd] = dateKey.split("-");
  const dayNum = Number(dd);
  const monNum = Number(mm);
  const yearNum = Number(yyyy);

  if (
    Number.isNaN(dayNum) ||
    Number.isNaN(monNum) ||
    Number.isNaN(yearNum)
  ) {
    return dateKey;
  }

  const weekdayNamesShort = {
    monday: "пн",
    tuesday: "вт",
    wednesday: "ср",
    thursday: "чт",
    friday: "пт",
    saturday: "сб",
    sunday: "вс",
  };

  const date = new Date(`${dateKey}T00:00:00`);
  // weekdayIndex: 0=вс,1=пн,... в JS
  const jsIndex = date.getDay(); // 0..6
  // нам нужна так или иначе строка типа monday..sunday
  const weekdayFull = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][jsIndex];

  const shortRu = weekdayNamesShort[weekdayFull] || "";

  // форматируем дд.мм.гггг (коротко)
  const ddStr = String(dayNum).padStart(2, "0");
  const mmStr = String(monNum).padStart(2, "0");

  return `${ddStr}.${mmStr}.${yearNum} (${shortRu})`;
}