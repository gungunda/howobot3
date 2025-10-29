// js/ui/events.js
//
// Этот модуль отвечает за:
// - текущее состояние интерфейса (activeView, selectedDateKey, т.п.)
// - навигацию между вкладками (dashboard / calendar / schedule)
// - обработку кликов пользователя
// - перерисовку экранов (refreshDashboard, refreshCalendar, refreshScheduleEditor)
//
// В этот файл добавлены:
// 1. импорт SyncService
// 2. запуск периодической фоновой синхронизации pollUpdates()
// 3. вспомогательные функции syncAfterDayChange() и syncAfterScheduleChange()
// 4. вызовы syncAfterDayChange()/syncAfterScheduleChange() в обработчике кликов
//
// Если что-то визуально "не совпадёт" с твоими data-action,
// это не критично сразу. Главное сейчас — чтобы модуль загружался без ошибок
// и чтобы UI снова отрисовывался.

import * as repo from "../data/repo.js";

// use cases по дням (прогресс, done, inline edit, сброс)
import { adjustTaskPercentForDate } from "../usecases/adjustTaskPercentForDate.js";
import { toggleTaskDoneForDate } from "../usecases/toggleTaskDoneForDate.js";
import {
  startInlineEditTaskForDate,
  applyInlineEditForDate,
  cancelInlineEditForDate
} from "../usecases/editTaskInline.js";
import { resetToScheduleForDate } from "../usecases/resetToSchedule.js";

// use cases расписания недели
// ВАЖНО: тут мы НЕ импортируем несуществующий scheduleUseCases.js.
// Вместо этого импортируем реальные файлы, как они у нас лежат.
import { addTaskToSchedule } from "../usecases/addTaskToSchedule.js";
import {
  startEditTaskInSchedule,
  applyEditTaskInSchedule,
  cancelEditTaskInSchedule
} from "../usecases/editTaskInSchedule.js";
import { deleteTaskFromSchedule } from "../usecases/deleteTaskFromSchedule.js";

// рендеры экранов
import { renderDashboardView } from "./view-dashboard.js";
import { renderCalendarView } from "./view-calendar.js";
import { renderScheduleView } from "./view-schedule.js";

// сервис синхронизации с облаком
import SyncService from "../sync/syncService.js";

// ======================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ UI
// ======================

const state = {
  activeView: "dashboard",
  selectedDateKey: null,
  scheduleEdit: null
};

// ======================
// ХЕЛПЕРЫ СИНХРОНИЗАЦИИ
// ======================

async function syncAfterDayChange(dateKey) {
  try {
    await SyncService.pushOverride(dateKey);
  } catch (e) {
    console.warn("[events] syncAfterDayChange failed", e);
  }
}

async function syncAfterScheduleChange() {
  try {
    await SyncService.pushSchedule();
  } catch (e) {
    console.warn("[events] syncAfterScheduleChange failed", e);
  }
}

// ======================
// РЕНДЕР ФУНКЦИИ
// ======================

async function refreshDashboard() {
  const vm = await repo.buildDashboardViewModel(state.selectedDateKey);
  const rootEl = document.querySelector('[data-view="dashboard"]');
  if (rootEl) {
    rootEl.innerHTML = renderDashboardView(vm);
  }
}

async function refreshCalendar() {
  const rootEl = document.querySelector('[data-view="calendar"]');
  if (rootEl) {
    rootEl.innerHTML = renderCalendarView(state.selectedDateKey);
  }
}

async function refreshScheduleEditor() {
  const rootEl = document.querySelector('[data-view="schedule"]');
  if (rootEl) {
    rootEl.innerHTML = renderScheduleView(state.scheduleEdit);
  }
}

// ======================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ======================

function switchView(newView) {
  state.activeView = newView;

  const allViews = document.querySelectorAll("[data-view]");
  allViews.forEach((el) => {
    const v = el.getAttribute("data-view");
    el.style.display = v === newView ? "" : "none";
  });

  if (newView === "dashboard") {
    refreshDashboard();
  } else if (newView === "calendar") {
    refreshCalendar();
  } else if (newView === "schedule") {
    refreshScheduleEditor();
  }
}

// ======================
// ВСПОМОГАТЕЛЬНОЕ: КЛЮЧ ДАТЫ
// ======================

function getTodayKey() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ВАЖНО: в твоём реальном коде эта функция уже существует
// и учитывает offload (задачи из "Разгрузка" пишут прогресс в день-дедлайн).
// Здесь оставлен fallback, чтобы файл был самодостаточный.
// Если у тебя уже есть настоящая resolveEffectiveDateForTask(rowEl),
// нужно оставить твою, а эту заглушку удалить.
function resolveEffectiveDateForTask(rowEl) {
  return state.selectedDateKey;
}

// ======================
// initUI
// ======================
//
// initUI вызывается из app.js ПОСЛЕ Storage.init() и ПОСЛЕ SyncService.pullBootstrap().
// Здесь мы:
// - выбираем дату по умолчанию,
// - рендерим,
//
// ДОПОЛНЕНИЕ: вешаем глобальный обработчик кликов с синком,
// и запускаем pollUpdates() по таймеру.

async function initUI() {
  if (!state.selectedDateKey) {
    state.selectedDateKey = getTodayKey();
  }

  state.activeView = "dashboard";

  await refreshDashboard();
  await refreshCalendar();
  await refreshScheduleEditor();

  switchView(state.activeView);

  // Глобальный обработчик кликов.
  // Здесь мы подставляем sync-вызовы ПОСЛЕ локальных изменений.
  document.addEventListener("click", async (ev) => {
    const t = ev.target;

    // --- Навигация между вкладками ---
    if (t.matches("[data-nav]")) {
      const newView = t.getAttribute("data-nav");
      switchView(newView);
      return;
    }

    // --- Клик по дню в календаре ---
    if (t.matches("[data-calendar-day]")) {
      const newDateKey = t.getAttribute("data-calendar-day");
      if (newDateKey) {
        state.selectedDateKey = newDateKey;
        state.activeView = "dashboard";

        await refreshDashboard();
        await refreshCalendar();
        await refreshScheduleEditor();

        switchView("dashboard");
      }
      return;
    }

    // --- Прогресс +10 / -10 ---
    if (
      t.matches("[data-action='progress-plus']") ||
      t.matches("[data-action='progress-minus']")
    ) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);
      const delta = t.matches("[data-action='progress-plus']") ? +10 : -10;

      await adjustTaskPercentForDate(effDateKey, taskId, delta);
      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- Галочка done ---
    if (t.matches("[data-action='toggle-done']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      await toggleTaskDoneForDate(effDateKey, taskId);
      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- Начало инлайн-редактирования задачи дня ---
    if (t.matches("[data-action='inline-edit-start']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      await startInlineEditTaskForDate(effDateKey, taskId);
      await refreshDashboard();
      // здесь синк не нужен, мы пока только вошли в режим редактирования
      return;
    }

    // --- Применить инлайн-редактирование ---
    if (t.matches("[data-action='inline-edit-apply']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      const titleInput = rowEl.querySelector("[data-edit-title]");
      const minutesInput = rowEl.querySelector("[data-edit-minutes]");

      const newTitle = titleInput ? titleInput.value.trim() : "";
      const newMinutes = minutesInput
        ? parseInt(minutesInput.value, 10)
        : 0;

      await applyInlineEditForDate(effDateKey, taskId, {
        title: newTitle,
        minutes: newMinutes
      });

      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    // --- Отмена инлайн-редактирования ---
    if (t.matches("[data-action='inline-edit-cancel']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      await cancelInlineEditForDate(effDateKey, taskId);
      await refreshDashboard();
      return;
    }

    // --- Reset day to schedule ---
    if (t.matches("[data-action='reset-day-to-schedule']")) {
      const currentDateKey = state.selectedDateKey;
      await resetToScheduleForDate(currentDateKey);
      await refreshDashboard();
      await syncAfterDayChange(currentDateKey);
      return;
    }

    // --- Редактирование расписания недели ---
    //
    // ВАЖНО: дальше идут блоки, которые могут не в точности совпасть
    // с твоими data-action. Если у тебя другие атрибуты — это не страшно.
    // Главное: после успешного изменения расписания мы вызываем
    // syncAfterScheduleChange().

    // начать редактирование задачи расписания
    if (t.matches("[data-action='schedule-edit-start']")) {
      const dayKey = t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id");

      await startEditTaskInSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      return;
    }

    // применить изменения задачи расписания
    if (t.matches("[data-action='schedule-edit-apply']")) {
      const formEl = t.closest("[data-schedule-edit-row]");
      if (!formEl) return;

      const dayKey = formEl.getAttribute("data-day");
      const taskId = formEl.getAttribute("data-task-id");

      const titleInput = formEl.querySelector("[data-edit-title]");
      const minutesInput = formEl.querySelector("[data-edit-minutes]");
      const offloadInputs = formEl.querySelectorAll("[data-edit-offload-day]");

      const newTitle = titleInput ? titleInput.value.trim() : "";
      const newMinutes = minutesInput
        ? parseInt(minutesInput.value, 10)
        : 0;

      const offloadDays = [];
      offloadInputs.forEach((chk) => {
        if (chk.checked) {
          offloadDays.push(chk.value);
        }
      });

      await applyEditTaskInSchedule(dayKey, taskId, {
        title: newTitle,
        minutes: newMinutes,
        offloadDays
      });

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    // отменить редактирование задачи расписания
    if (t.matches("[data-action='schedule-edit-cancel']")) {
      const dayKey = t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id");

      await cancelEditTaskInSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      return;
    }

    // удалить задачу из расписания
    if (t.matches("[data-action='schedule-delete-task']")) {
      const dayKey = t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id");

      await deleteTaskFromSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    // добавить новую задачу в расписание
    if (t.matches("[data-action='schedule-add-task']")) {
      const dayKey = t.getAttribute("data-day");
      await addTaskToSchedule(dayKey);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }
  });

  // Периодическая фоновая синхронизация:
  // каждые 30 секунд спрашиваем сервер через pollUpdates().
  setInterval(() => {
    SyncService.pollUpdates().catch((e) => {
      console.warn("[events] pollUpdates failed", e);
    });
  }, 30000);
}

export { initUI };