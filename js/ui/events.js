import { Storage } from "../infra/telegramEnv.js";

import { updateDashboardView } from "./view-dashboard.js";
import { updateCalendarView } from "./view-calendar.js";
import { updateScheduleView } from "./view-schedule.js";

import {
  toDateKey,
  addDaysToDateKey,
  weekdayKeyFromDateKey,
  Task,
} from "../domain/entities.js";

import toggleTaskDoneForDate from "../usecases/toggleTaskDoneForDate.js";
import { adjustTaskPercentForDate } from "../usecases/adjustTaskPercentForDate.js";
import { editTaskInline } from "../usecases/editTaskInline.js";
import resetToSchedule from "../usecases/resetToSchedule.js";

import addTaskToSchedule from "../usecases/addTaskToSchedule.js";
import editTaskInSchedule from "../usecases/editTaskInSchedule.js";
import deleteTaskFromSchedule from "../usecases/deleteTaskFromSchedule.js";

import * as repo from "../data/repo.js";

console.log("[events] LOADED BUILD = v-offload-progress-4-inlinefix");

// -----------------------------------------------------------------------------
// Глобальное состояние UI
// -----------------------------------------------------------------------------
const state = {
  activeView: "dashboard",
  selectedDateKey: toDateKey(new Date()),
  scheduleEdit: null,
};

// -----------------------------------------------------------------------------
// Утилиты для дней недели и дат
// -----------------------------------------------------------------------------

const WEEK_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Возвращает предыдущий день недели по циклу.
// Пример: для "saturday" -> "friday".
function prevWeekday(weekdayKey) {
  const idx = WEEK_ORDER.indexOf(weekdayKey);
  if (idx === -1) return weekdayKey;
  const prevIdx = (idx + WEEK_ORDER.length - 1) % WEEK_ORDER.length;
  return WEEK_ORDER[prevIdx];
}

// Найти ближайшую дату (от fromDateKey и до +7 дней вперёд),
// у которой weekday = targetWeekday.
function findNextDateKeyForWeekday(fromDateKey, targetWeekday) {
  for (let offset = 0; offset < 8; offset++) {
    const probe = addDaysToDateKey(fromDateKey, offset);
    const wd = weekdayKeyFromDateKey(probe);
    if (wd === targetWeekday) {
      return probe;
    }
  }
  return fromDateKey;
}

// -----------------------------------------------------------------------------
// Построение списка задач дня (основных)
// -----------------------------------------------------------------------------

function buildTasksForDay(dateKey, scheduleObj, overrideObj) {
  if (overrideObj && Array.isArray(overrideObj.tasks)) {
    // Есть override: берём реальные задачи с их прогрессом.
    return overrideObj.tasks.map(t => {
      const taskObj = t instanceof Task
        ? t
        : (Task.fromJSON ? Task.fromJSON(t) : t);

      return {
        ...taskObj,
        source: "core",
        mainWeekday: weekdayKeyFromDateKey(dateKey),
        deadlineWeekday: weekdayKeyFromDateKey(dateKey),
      };
    });
  }

  // Нет override: показываем "домашку на завтра".
  const tomorrowKey = addDaysToDateKey(dateKey, 1);
  const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey);

  const templateList = Array.isArray(scheduleObj[wdTomorrow])
    ? scheduleObj[wdTomorrow]
    : [];

  return templateList.map(t => {
    const src = t instanceof Task
      ? t
      : (Task.fromJSON ? Task.fromJSON(t) : t);

    return {
      id: src.id,
      title: src.title,
      minutes: src.minutes,
      donePercent: 0,
      done: false,
      offloadDays: [],
      meta: src.meta || null,

      source: "core",
      mainWeekday: wdTomorrow,
      deadlineWeekday: wdTomorrow,
    };
  });
}

// -----------------------------------------------------------------------------
// Построение списка "Разгрузка"
// -----------------------------------------------------------------------------

// Ищем задачи, которые можно сделать заранее в выбранный день.
// Для каждой такой задачи:
//   mainWeekday      = исходный день расписания ("saturday")
//   deadlineWeekday  = день дедлайна (предыдущий weekday, например "friday")
function buildOffloadTasksForDay(dateKey, scheduleObj) {
  const todayWeekday = weekdayKeyFromDateKey(dateKey);
  const result = [];

  Object.entries(scheduleObj).forEach(([weekdayName, tasks]) => {
    if (!Array.isArray(tasks)) return;

    const deadlineWDay = prevWeekday(weekdayName);

    for (const t of tasks) {
      if (
        Array.isArray(t.offloadDays) &&
        t.offloadDays.includes(todayWeekday)
      ) {
        result.push({
          id: t.id,
          title: t.title,
          minutes: t.minutes,

          // по умолчанию, до обогащения
          donePercent: 0,
          done: false,

          offloadDays: t.offloadDays || [],
          meta: t.meta || null,

          source: "offload",
          mainWeekday: weekdayName,
          deadlineWeekday: deadlineWDay,
        });
      }
    }
  });

  return result;
}

// -----------------------------------------------------------------------------
// Обогащение задач "Разгрузка" прогрессом из override дня дедлайна
// -----------------------------------------------------------------------------

async function enrichOffloadTasksProgress(viewDateKey, offloadTasks) {
  const cache = {}; // {deadlineDateKey: overrideObj}
  const enriched = [];

  for (const task of offloadTasks) {
    const deadlineWeekday = task.deadlineWeekday;
    let donePercent = task.donePercent;
    let done = task.done;

    if (deadlineWeekday) {
      // Находим ближайшую дату, чей weekday = deadlineWeekday.
      const deadlineDateKey = findNextDateKeyForWeekday(
        viewDateKey,
        deadlineWeekday
      );

      if (!cache[deadlineDateKey]) {
        cache[deadlineDateKey] = await repo.loadDayOverride(deadlineDateKey);
      }

      const ov = cache[deadlineDateKey];
      if (ov && Array.isArray(ov.tasks)) {
        const same = ov.tasks.find(ot => ot.id === task.id);
        if (same) {
          donePercent = Number(same.donePercent) || 0;
          done = !!same.done || donePercent >= 100;
        }
      }
    }

    enriched.push({
      ...task,
      donePercent,
      done,
    });
  }

  return enriched;
}

// -----------------------------------------------------------------------------
// Подсчёт статистики по основным задачам дня
// -----------------------------------------------------------------------------

function buildStats(tasksArr) {
  let totalMinutes = 0;
  let doneMinutes = 0;
  let totalPercent = 0;

  tasksArr.forEach(task => {
    const mins = Number(task.minutes) || 0;
    const pct = Number(task.donePercent) || 0;

    totalMinutes += mins;
    doneMinutes += mins * (pct / 100);
    totalPercent += pct;
  });

  const doneAvg = tasksArr.length
    ? Math.round(totalPercent / tasksArr.length)
    : 0;

  return {
    totalMinutes,
    doneMinutes: Math.round(doneMinutes),
    doneAvg,
  };
}

// -----------------------------------------------------------------------------
// Inline edit state (репозиторий хранит, мы читаем)
// -----------------------------------------------------------------------------

function getDashboardInlineEdit(dateKey) {
  if (typeof repo.getInlineEditStateForDate === "function") {
    return repo.getInlineEditStateForDate(dateKey);
  }
  return null;
}

// -----------------------------------------------------------------------------
// Сборка модели дашборда
// -----------------------------------------------------------------------------

async function buildDashboardViewModel(dateKey) {
  const scheduleObj = await repo.loadSchedule();
  const overrideObj = await repo.loadDayOverride(dateKey);

  // Основные задачи текущего дня / завтрашней сдачи
  const tasks = buildTasksForDay(dateKey, scheduleObj, overrideObj);

  // "Разгрузка": задачи, которые можно сделать заранее
  const offloadRaw = buildOffloadTasksForDay(dateKey, scheduleObj);

  // "Разгрузка" + прогресс из override реального дедлайна
  const offloadTasks = await enrichOffloadTasksProgress(dateKey, offloadRaw);

  // Статистика по основным задачам
  const stats = buildStats(tasks);

  // Текущая задача в режиме редактирования для выбранного дня
  const dashboardEdit = getDashboardInlineEdit(dateKey);

  return {
    dateKey,
    tasks,
    offloadTasks,
    stats,
    dashboardEdit,
  };
}

// -----------------------------------------------------------------------------
// Определяем "в какой день мы реально сохраняем прогресс"
// -----------------------------------------------------------------------------

// Для обычной задачи (source="core"):
//   сохраняем прогресс в override текущего выбранного дня (state.selectedDateKey).
//
// Для разгрузки (source="offload"):
//   прогресс должен попасть в override дня дедлайна.
//   Мы берём deadlineWeekday задачи, находим ближайшую дату с таким weekday
//   (относительно выбранного дня), и туда пишем.
function resolveEffectiveDateForTask(rowEl) {
  const source = rowEl.dataset.source;
  if (source !== "offload") {
    return state.selectedDateKey;
  }

  const deadlineWeekday = rowEl.dataset.deadlineWeekday;
  if (!deadlineWeekday) {
    return state.selectedDateKey;
  }

  const targetDateKey = findNextDateKeyForWeekday(
    state.selectedDateKey,
    deadlineWeekday
  );
  return targetDateKey;
}

// -----------------------------------------------------------------------------
// Обновление текущей вкладки
// -----------------------------------------------------------------------------

async function refreshDashboard() {
  const model = await buildDashboardViewModel(state.selectedDateKey);
  console.log("[dashboard] model =", model);
  updateDashboardView(model);
}

async function refreshCalendar() {
  const d = new Date(`${state.selectedDateKey}T00:00:00`);
  const calYear = d.getFullYear();
  const calMonth = d.getMonth();

  updateCalendarView({
    calYear,
    calMonth,
    currentDateKey: state.selectedDateKey,
  });
}

async function refreshScheduleEditor() {
  await updateScheduleView(state);
}

async function refreshCurrentView() {
  if (state.activeView === "dashboard") {
    await refreshDashboard();
  } else if (state.activeView === "calendar") {
    await refreshCalendar();
  } else if (state.activeView === "schedule") {
    await refreshScheduleEditor();
  }
}

function switchView(newView) {
  state.activeView = newView;

  document.querySelectorAll("[data-view]").forEach(el => {
    const v = el.getAttribute("data-view");
    el.style.display = v === newView ? "" : "none";
  });

  refreshCurrentView();
}

function handleCalendarDateClick(newDateKey) {
  state.selectedDateKey = newDateKey;
  switchView("dashboard");
}

// -----------------------------------------------------------------------------
// Логика вкладки "Расписание недели"
// -----------------------------------------------------------------------------

function readTaskEditorValues(taskItemEl) {
  const titleInput = taskItemEl.querySelector(".week-edit-title");
  const minsInput = taskItemEl.querySelector(".week-edit-minutes");
  const cbList = taskItemEl.querySelectorAll(".week-offload-checkbox");

  const title = titleInput ? titleInput.value.trim() : "";
  const minutesRaw = minsInput ? minsInput.value : "0";
  const minutes = Number(minutesRaw) || 0;

  const offloadDays = [];
  cbList.forEach(cb => {
    if (cb.checked) {
      offloadDays.push(cb.value);
    }
  });

  return { title, minutes, offloadDays };
}

// Возвращает контекст редактируемой задачи расписания
// { taskItemEl, weekdayKey, taskId }
function getWeekTaskContext(saveBtnEl) {
  const taskItemEl = saveBtnEl.closest(".task-item.editing");
  if (!taskItemEl) return null;

  const sectionEl = saveBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return null;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id");

  return { taskItemEl, weekdayKey, taskId };
}

async function handleWeekSaveClick(saveBtnEl) {
  const ctx = getWeekTaskContext(saveBtnEl);
  if (!ctx) return;

  const { taskItemEl, weekdayKey, taskId } = ctx;
  const { title, minutes, offloadDays } = readTaskEditorValues(taskItemEl);

  const safeTitle = title || "Без названия";

  console.log("[week-save] ctx =", ctx);
  console.log("[week-save] values =", { title, minutes, offloadDays });

  try {
    if (taskId === "NEW" || !taskId) {
      console.log("[week-save] creating new task for", weekdayKey);
      await addTaskToSchedule({
        weekdayKey,
        taskData: {
          title: safeTitle,
          minutes,
          offloadDays,
        },
      });
    } else {
      console.log("[week-save] editing task", taskId, "for", weekdayKey);
      await editTaskInSchedule({
        weekdayKey,
        taskId,
        patch: {
          title: safeTitle,
          minutes,
          offloadDays,
        },
      });
    }

    const after = await repo.loadSchedule();
    console.log("[week-save] schedule after save =", after);

    state.scheduleEdit = null;
    await refreshScheduleEditor();
  } catch (err) {
    console.warn("week-save failed", err);
  }
}

function handleWeekCancelClick() {
  state.scheduleEdit = null;
  refreshScheduleEditor();
}

function handleWeekEditClick(editBtnEl) {
  const taskItemEl = editBtnEl.closest(".task-item");
  if (!taskItemEl) return;
  const sectionEl = editBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id");

  const titleEl = taskItemEl.querySelector(".task-title");
  const minsEl = taskItemEl.querySelector(".task-mins");

  const curTitle = titleEl ? titleEl.textContent.trim() : "";

  let curMinutes = 0;
  if (minsEl) {
    const mm = minsEl.textContent.replace(/[^\d]/g, "");
    curMinutes = Number(mm) || 0;
  }

  const rawOffload = taskItemEl.getAttribute("data-offload-days") || "";
  const offloadDays = rawOffload
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  state.scheduleEdit = {
    weekday: weekdayKey,
    taskId,
    title: curTitle,
    minutes: curMinutes,
    offloadDays,
  };

  console.log("[week-edit-start] state.scheduleEdit =", state.scheduleEdit);

  refreshScheduleEditor();
}

function handleWeekAddClick(addBtnEl) {
  const sectionEl = addBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;

  const weekdayKey = sectionEl.getAttribute("data-weekday");

  state.scheduleEdit = {
    weekday: weekdayKey,
    taskId: null,
    title: "",
    minutes: 30,
    offloadDays: [],
  };

  console.log("[week-add-start] state.scheduleEdit =", state.scheduleEdit);

  refreshScheduleEditor();
}

async function handleWeekDeleteClick(delBtnEl) {
  const taskItemEl = delBtnEl.closest(".task-item");
  if (!taskItemEl) return;

  const sectionEl = delBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id");

  try {
    console.log("[week-delete] removing", taskId, "from", weekdayKey);
    await deleteTaskFromSchedule({
      weekdayKey,
      taskId,
    });

    const after = await repo.loadSchedule();
    console.log("[week-delete] schedule after delete =", after);

    await refreshScheduleEditor();
  } catch (err) {
    console.warn("deleteTaskFromSchedule error", err);
  }
}

// -----------------------------------------------------------------------------
// Обработчики задач дашборда (основных и разгрузки)
// -----------------------------------------------------------------------------

async function handleToggleDone(btnEl) {
  const rowEl = btnEl.closest(".task-item");
  if (!rowEl) return;

  const taskId = rowEl.dataset.taskId;
  const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

  await toggleTaskDoneForDate({
    dateKey: effectiveDateKey,
    taskId,
  });

  await refreshDashboard();
}

async function handleBump(btnEl, delta) {
  const rowEl = btnEl.closest(".task-item");
  if (!rowEl) return;

  const taskId = rowEl.dataset.taskId;
  const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

  await adjustTaskPercentForDate({
    dateKey: effectiveDateKey,
    taskId,
    delta,
  });

  await refreshDashboard();
}

// Старт инлайн-редактирования строки.
// ВАЖНО: визуальный режим редактирования всегда привязан к открытому дню
// (state.selectedDateKey), даже если это offload-задача.
// Так view-dashboard сможет показать либо форму, либо плашку.
function handleInlineEditStart(btnEl) {
  const rowEl = btnEl.closest(".task-item");
  if (!rowEl) return;

  const taskId = rowEl.dataset.taskId;

  repo.startInlineEditTaskForDate(state.selectedDateKey, taskId);

  refreshDashboard();
}

// Сохранить редактирование (только для обычных задач дня,
// потому что offload-задачи не имеют формы ввода title/minutes).
async function handleInlineEditSave(btnEl) {
  const rowEl = btnEl.closest(".task-item");
  if (!rowEl) return;

  const taskId = rowEl.dataset.taskId;
  const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

  const titleInput = rowEl.querySelector(".dash-edit-title");
  const minsInput = rowEl.querySelector(".dash-edit-minutes");

  const newTitle = titleInput ? titleInput.value.trim() : "";
  const newMinutes = minsInput ? Number(minsInput.value) || 0 : 0;

  await editTaskInline({
    dateKey: effectiveDateKey,
    taskId,
    patch: {
      title: newTitle || "Без названия",
      minutes: newMinutes,
    },
  });

  // снимаем визуальный режим редактирования для открытого дня
  repo.finishInlineEditTaskForDate(state.selectedDateKey);

  await refreshDashboard();
}

// Отмена редактирования / закрытие плашки "это разгрузка"
function handleInlineEditCancel(btnEl) {
  repo.finishInlineEditTaskForDate(state.selectedDateKey);
  refreshDashboard();
}

// Сброс дня к расписанию (удаляем override)
async function handleResetDayClick() {
  await resetToSchedule({
    dateKey: state.selectedDateKey,
  });
  await refreshDashboard();
}

// -----------------------------------------------------------------------------
// Делегирование кликов по документу
// -----------------------------------------------------------------------------

function onClick(e) {
  const t = e.target;

  // навигация вкладок
  if (t.matches("[data-nav='dashboard']")) {
    switchView("dashboard");
    return;
  }
  if (t.matches("[data-nav='calendar']")) {
    switchView("calendar");
    return;
  }
  if (t.matches("[data-nav='schedule']")) {
    switchView("schedule");
    return;
  }

  // календарь: выбор дня
  if (t.matches(".cal-day") && t.dataset.dateKey) {
    handleCalendarDateClick(t.dataset.dateKey);
    return;
  }

  // дашборд: управление прогрессом
  if (t.matches(".task-done")) {
    handleToggleDone(t);
    return;
  }
  if (t.matches(".task-pct-plus")) {
    handleBump(t, +10);
    return;
  }
  if (t.matches(".task-pct-minus")) {
    handleBump(t, -10);
    return;
  }

  // дашборд: инлайн-редактор / плашка
  if (t.matches(".task-edit")) {
    handleInlineEditStart(t);
    return;
  }
  if (t.matches(".dash-save")) {
    handleInlineEditSave(t);
    return;
  }
  if (t.matches(".dash-cancel")) {
    handleInlineEditCancel(t);
    return;
  }

  // дашборд: сброс дня
  if (t.matches(".dash-reset-day") || t.matches("[data-action='reset-day']")) {
    handleResetDayClick();
    return;
  }

  // расписание недели
  if (t.matches(".week-add")) {
    handleWeekAddClick(t);
    return;
  }
  if (t.matches(".week-edit")) {
    handleWeekEditClick(t);
    return;
  }
  if (t.matches(".week-del")) {
    handleWeekDeleteClick(t);
    return;
  }
  if (t.matches(".week-save")) {
    handleWeekSaveClick(t);
    return;
  }
  if (t.matches(".week-cancel")) {
    handleWeekCancelClick();
    return;
  }

  // кнопки "назад к дню"
  if (t.matches(".back-btn[data-action='back-to-dashboard']")) {
    switchView("dashboard");
    return;
  }
  if (t.matches(".back-btn[data-action='back-to-dashboard-2']")) {
    switchView("dashboard");
    return;
  }
}

// -----------------------------------------------------------------------------
// initUI — вызывается из app.js после Storage.init()
// -----------------------------------------------------------------------------

export default function initUI() {
  console.log(
    "[events] initUI; Storage mode =",
    Storage.getMode && Storage.getMode()
  );

  document.addEventListener("click", onClick);

  // стартуем с дашборда
  switchView("dashboard");
}