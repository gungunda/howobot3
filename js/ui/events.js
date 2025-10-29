// js/ui/events.js
//
// Это объединённая версия:
// - твоя рабочая логика дашборда/разгрузки из предыдущей сборки (buildDashboardViewModel и т.д.)
// - корректные импорты usecases (default / объектные аргументы)
// - вызовы SyncService.pushOverride / pushSchedule после изменений
// - периодический SyncService.pollUpdates()
// - рендер через updateDashboardView / updateCalendarView / updateScheduleView
//
// Важно: я не меняю формат данных задач, не трогаю структуру view-*,
// не переписываю бизнес-правила дедлайна. Я только склеиваю слои.

import * as repo from "../data/repo.js";

import adjustTaskPercentForDate from "../usecases/adjustTaskPercentForDate.js";
import toggleTaskDoneForDate from "../usecases/toggleTaskDoneForDate.js";
import editTaskInline from "../usecases/editTaskInline.js";
import resetToSchedule from "../usecases/resetToSchedule.js";

import addTaskToSchedule from "../usecases/addTaskToSchedule.js";
import editTaskInSchedule from "../usecases/editTaskInSchedule.js";
import deleteTaskFromSchedule from "../usecases/deleteTaskFromSchedule.js";

import { updateDashboardView } from "./view-dashboard.js";
import { updateCalendarView } from "./view-calendar.js";
import { updateScheduleView } from "./view-schedule.js";

import SyncService from "../sync/syncService.js";

////////////////////////////////////////////////////////////////////////////////
// Вспомогательные утилиты по датам и дням недели
////////////////////////////////////////////////////////////////////////////////

const WEEK_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

// weekdayKeyFromDateKey: "2025-10-27" -> "monday"
function weekdayKeyFromDateKey(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  // JS: 0 = Sunday, 1 = Monday, ...
  const jsDay = d.getDay(); // 0..6
  const mapJsToKey = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  return mapJsToKey[jsDay];
}

// addDaysToDateKey("2025-10-27", +1) -> "2025-10-28"
function addDaysToDateKey(dateKey, delta) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// находим ближайшую дату с weekdayTarget, начиная от baseDateKey и двигаясь ВПЕРЁД
function findNextDateKeyForWeekday(baseDateKey, weekdayTarget) {
  for (let i = 0; i < 8; i++) {
    const candidate = addDaysToDateKey(baseDateKey, i);
    const w = weekdayKeyFromDateKey(candidate);
    if (w === weekdayTarget) {
      return candidate;
    }
  }
  return baseDateKey;
}

// удобная функция: текущий день в формате YYYY-MM-DD
function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

////////////////////////////////////////////////////////////////////////////////
// Построение списков задач для дашборда
////////////////////////////////////////////////////////////////////////////////

// Основные задачи дня (и "на завтра", если дедлайн завтра и т.д.)
// Берётся недельное расписание (scheduleObj[weekdayKey]) + override текущего дня.
function buildTasksForDay(dateKey, scheduleObj, overrideObj) {
  // 1. базовые задачи из расписания для weekday текущей даты
  const weekday = weekdayKeyFromDateKey(dateKey);
  const baseTasks = Array.isArray(scheduleObj?.[weekday])
    ? scheduleObj[weekday]
    : [];

  // 2. если есть overrideObj (снимок конкретного дня), он используется как источник правды
  // overrideObj.tasks полностью заменяют базовые задачи этого дня.
  // Если override есть — то именно его показываем как "основные задачи".
  if (overrideObj && Array.isArray(overrideObj.tasks)) {
    return overrideObj.tasks.map(t => ({
      id: t.id,
      title: t.title,
      minutes: t.minutes,
      donePercent: Number(t.donePercent) || 0,
      done: !!t.done || (Number(t.donePercent) || 0) >= 100,
      offloadDays: null, // в override offloadDays неактуален
      meta: t.meta || null,
      source: "core",
      deadlineWeekday: null,
    }));
  }

  // 3. fallback: если override нет, то строим из расписания
  return baseTasks.map(t => ({
    id: t.id,
    title: t.title,
    minutes: t.minutes,
    donePercent: 0,
    done: false,
    offloadDays: t.offloadDays || [],
    meta: t.meta || null,
    source: "core",
    deadlineWeekday: null,
  }));
}

// Строим список "Разгрузка":
// это задачи из будущих дней расписания, у которых offloadDays включает СЕГОДНЯ.
function buildOffloadTasksForDay(viewDateKey, scheduleObj) {
  const todayWeekday = weekdayKeyFromDateKey(viewDateKey);

  const result = [];

  WEEK_ORDER.forEach((weekdayName, idx) => {
    const dayTasks = Array.isArray(scheduleObj?.[weekdayName])
      ? scheduleObj[weekdayName]
      : [];

    dayTasks.forEach(t => {
      const offArr = Array.isArray(t.offloadDays) ? t.offloadDays : [];

      // если текущий день разрешён как "разгрузочный" для этой задачи
      if (offArr.includes(todayWeekday)) {
        // deadlineWeekday — это "предыдущий день" относительно дня урока.
        // пример: урок в пятницу -> дедлайн четверг.
        const prevIdx = (idx - 1 + WEEK_ORDER.length) % WEEK_ORDER.length;
        const deadlineWDay = WEEK_ORDER[prevIdx];

        result.push({
          id: t.id,
          title: t.title,
          minutes: t.minutes,
          donePercent: 0, // будет обогащено позже
          done: false,    // будет обогащено позже
          offloadDays: t.offloadDays || [],
          meta: t.meta || null,

          source: "offload",
          mainWeekday: weekdayName,
          deadlineWeekday: deadlineWDay,
        });
      }
    });
  });

  return result;
}

// Обогащаем "Разгрузку": подставляем прогресс из override ДНЯ ДЕДЛАЙНА.
async function enrichOffloadTasksProgress(viewDateKey, offloadTasks) {
  const cache = {}; // {deadlineDateKey: overrideObj}
  const enriched = [];

  for (const task of offloadTasks) {
    const deadlineWeekday = task.deadlineWeekday;
    let donePercent = task.donePercent;
    let done = task.done;

    if (deadlineWeekday) {
      // Найдём реальную календарную дату дедлайна
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

// Собираем короткую статистику по основным задачам дня.
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

// Достаём из repo информацию о "какая задача сейчас редактируется инлайн".
function getDashboardInlineEdit(dateKey) {
  if (typeof repo.getInlineEditStateForDate === "function") {
    return repo.getInlineEditStateForDate(dateKey);
  }
  return null;
}

// Итоговая модель дашборда (то, что пойдёт в updateDashboardView)
async function buildDashboardViewModel(dateKey) {
  const scheduleObj = await repo.loadSchedule();
  const overrideObj = await repo.loadDayOverride(dateKey);

  // Основные задачи (текущий день)
  const tasks = buildTasksForDay(dateKey, scheduleObj, overrideObj);

  // Разгрузка (задачи будущих дней, которые можно делать сегодня заранее)
  const offloadRaw = buildOffloadTasksForDay(dateKey, scheduleObj);

  // Обогащаем прогрессом с дедлайна
  const offloadTasks = await enrichOffloadTasksProgress(dateKey, offloadRaw);

  // Статистика по основным задачам
  const stats = buildStats(tasks);

  // Текущая строка, которая находится в режиме инлайн-редактирования
  const dashboardEdit = getDashboardInlineEdit(dateKey);

  return {
    dateKey,
    tasks,
    offloadTasks,
    stats,
    dashboardEdit,
  };
}

// Определяем, в КАКОЙ ДЕНЬ надо записывать прогресс задачи.
// Обычная задача → текущий выбранный день.
// Задача из "Разгрузка" → дедлайн-день (deadlineWeekday).
function resolveEffectiveDateForTask(rowEl) {
  const source = rowEl?.dataset?.source;
  if (source !== "offload") {
    return state.selectedDateKey;
  }

  const deadlineWeekday = rowEl.dataset.deadlineWeekday;
  if (!deadlineWeekday) {
    return state.selectedDateKey;
  }

  // дедлайн — предыдущий день относительно дня урока,
  // находим ближайшую дату с таким weekday
  const targetDateKey = findNextDateKeyForWeekday(
    state.selectedDateKey,
    deadlineWeekday
  );
  return targetDateKey;
}

////////////////////////////////////////////////////////////////////////////////
// Глобальное состояние UI
////////////////////////////////////////////////////////////////////////////////

const state = {
  activeView: "dashboard",       // "dashboard" | "calendar" | "schedule"
  selectedDateKey: getTodayKey(),// текущий день, "YYYY-MM-DD"
  calYear: null,                 // год, который рисует календарь
  calMonth: null,                // месяц (0..11), который рисует календарь
  scheduleEdit: null             // какая задача расписания редактируется (если вообще)
};

////////////////////////////////////////////////////////////////////////////////
// Перерисовка экранов
////////////////////////////////////////////////////////////////////////////////

async function refreshDashboard() {
  const model = await buildDashboardViewModel(state.selectedDateKey);
  updateDashboardView(model);
}

async function refreshCalendar() {
  // если calYear / calMonth не заданы — выставим их от текущей даты
  if (state.calYear == null || state.calMonth == null) {
    const d = new Date(state.selectedDateKey + "T00:00:00");
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth(); // 0..11
  }

  await updateCalendarView({
    calYear: state.calYear,
    calMonth: state.calMonth,
    currentDateKey: state.selectedDateKey
  });
}

async function refreshScheduleEditor() {
  await updateScheduleView({
    scheduleEdit: state.scheduleEdit
  });
}

////////////////////////////////////////////////////////////////////////////////
// Переключение вкладок
////////////////////////////////////////////////////////////////////////////////

function switchView(newView) {
  state.activeView = newView;

  const allViews = document.querySelectorAll("[data-view]");
  allViews.forEach((el) => {
    const v = el.getAttribute("data-view");
    el.style.display = v === newView ? "" : "none";
  });

  if (newView === "dashboard") {
    refreshDashboard();
  }
  if (newView === "calendar") {
    refreshCalendar();
  }
  if (newView === "schedule") {
    refreshScheduleEditor();
  }
}

////////////////////////////////////////////////////////////////////////////////
// initUI
////////////////////////////////////////////////////////////////////////////////

async function initUI() {
  // первичная отрисовка
  await refreshDashboard();
  await refreshCalendar();
  await refreshScheduleEditor();
  switchView(state.activeView);

  // обработчик ВСЕХ кликов
  document.addEventListener("click", async (ev) => {
    const t = ev.target;

    // --- переключение вкладок (навигация) ---
    if (t.matches("[data-nav]")) {
      const newView = t.getAttribute("data-nav");
      switchView(newView);
      return;
    }

    // --- выбор дня в календаре ---
    // календарь рендерит ячейки с атрибутом data-date-key
    if (t.matches("[data-view='calendar'] [data-date-key]")) {
      const newDateKey = t.getAttribute("data-date-key");
      if (newDateKey) {
        state.selectedDateKey = newDateKey;
        state.activeView = "dashboard";

        await refreshDashboard();
        await refreshCalendar(); // чтобы подсветка selected обновилась
        switchView("dashboard");
      }
      return;
    }

    // --- +10% / -10% ---
    if (
      t.matches("[data-action='progress-plus'], [data-action='progress-minus'], .task-pct-plus, .task-pct-minus")
    ) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      const delta = (
        t.matches("[data-action='progress-plus'], .task-pct-plus")
          ? +10
          : -10
      );

      await adjustTaskPercentForDate({
        dateKey: effDateKey,
        taskId,
        delta
      });

      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- чекбокс done ---
    if (t.matches("[data-action='toggle-done'], .task-done")) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      await toggleTaskDoneForDate({
        dateKey: effDateKey,
        taskId
      });

      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- сохранить inline-редакт задачи дня ---
    if (t.matches("[data-action='inline-edit-apply'], .dash-save")) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      const newTitle = rowEl.querySelector(".dash-edit-title")?.value?.trim() ?? "";
      const newMinutes = parseInt(
        rowEl.querySelector(".dash-edit-minutes")?.value ?? "0",
        10
      );

      await editTaskInline({
        dateKey: effDateKey,
        taskId,
        patch: {
          title: newTitle,
          minutes: newMinutes
        }
      });

      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- отмена inline-редакт задачи дня ---
    if (t.matches("[data-action='inline-edit-cancel'], .dash-cancel")) {
      await refreshDashboard();
      return;
    }

    // --- reset day to schedule (сбросить день к расписанию) ---
    if (t.matches("[data-action='reset-day-to-schedule'], .dash-reset-day")) {
      const dayKey = state.selectedDateKey;

      await resetToSchedule({
        dateKey: dayKey
      });

      await refreshDashboard();
      await syncAfterDayChange(dayKey);
      return;
    }

    // --- расписание недели: добавить задачу ---
    if (t.matches("[data-action='schedule-add-task'], .week-add")) {
      const day = t.closest("[data-weekday]")?.getAttribute("data-weekday")
        || t.getAttribute("data-day");
      if (!day) return;

      await addTaskToSchedule({
        weekdayKey: day,
        taskData: {
          title: "Новая задача",
          minutes: 30,
          offloadDays: []
        }
      });

      state.scheduleEdit = { weekday: day, taskId: null };

      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    // --- расписание недели: сохранить изменения задачи ---
    if (t.matches("[data-action='schedule-edit-apply'], .week-save")) {
      const form = t.closest("[data-weekday] .task-item.editing, [data-schedule-edit-row], .task-item.editing");
      if (!form) return;

      const day = form.closest("[data-weekday]")?.getAttribute("data-weekday")
        || form.getAttribute("data-day");
      const taskId = form.getAttribute("data-task-id");

      const newTitle = form.querySelector(".week-edit-title")?.value?.trim() ?? "";
      const newMinutes = parseInt(
        form.querySelector(".week-edit-minutes")?.value ?? "0",
        10
      );
      const offloadDays = [...form.querySelectorAll(".week-offload-checkbox:checked")]
        .map((c) => c.value);

      await editTaskInSchedule({
        weekdayKey: day,
        taskId,
        patch: {
          title: newTitle,
          minutes: newMinutes,
          offloadDays
        }
      });

      state.scheduleEdit = null;

      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    // --- расписание недели: удалить задачу ---
    if (t.matches("[data-action='schedule-delete-task'], .week-del")) {
      const day = t.closest("[data-weekday]")?.getAttribute("data-weekday")
        || t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id")
        || t.closest(".task-item")?.getAttribute("data-task-id");

      if (!day || !taskId) return;

      await deleteTaskFromSchedule({
        weekdayKey: day,
        taskId
      });

      state.scheduleEdit = null;

      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    // --- расписание недели: отменить редактирование ---
    if (t.matches("[data-action='schedule-edit-cancel'], .week-cancel")) {
      state.scheduleEdit = null;
      await refreshScheduleEditor();
      return;
    }

    // --- кнопка "назад к дню" из расписания ---
    if (t.matches("[data-action='back-to-dashboard'], [data-action='back-to-dashboard-2']")) {
      switchView("dashboard");
      return;
    }
  });

  // периодический pull (проверка облака и подтяжка свежих кусков)
  setInterval(() => {
    SyncService.pollUpdates().catch((e) => {
      console.warn("[events] pollUpdates failed", e);
    });
  }, 30000);
}

////////////////////////////////////////////////////////////////////////////////
// Экспорт
////////////////////////////////////////////////////////////////////////////////

export { initUI };