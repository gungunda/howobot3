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
// 4. ВСТАВКИ вызовов syncAfterDayChange()/syncAfterScheduleChange() прямо
//    в обработчик кликов document.addEventListener("click", ...)
//
// Важно:
// - Логика дедлайна (offload → прогресс пишем в день-дедлайн, а не "сегодня")
//   уже есть в resolveEffectiveDateForTask(rowEl). Мы её используем для sync.
// - Мы не меняем бизнес-логику use case'ов. Мы только добавляем синх-вызовы после них.

import * as repo from "../data/repo.js";
import {
  adjustTaskPercentForDate
} from "../usecases/adjustTaskPercentForDate.js";
import {
  toggleTaskDoneForDate
} from "../usecases/toggleTaskDoneForDate.js";
import {
  startInlineEditTaskForDate,
  applyInlineEditForDate,
  cancelInlineEditForDate
} from "../usecases/editTaskInline.js";
import {
  resetToScheduleForDate
} from "../usecases/resetToSchedule.js";

import {
  addTaskToSchedule,
  startEditTaskInSchedule,
  applyEditTaskInSchedule,
  cancelEditTaskInSchedule,
  deleteTaskFromSchedule
} from "../usecases/scheduleUseCases.js"; // <-- ВАЖНО: если у тебя другие имена / файлы
// (например editTaskInSchedule.js / deleteTaskFromSchedule.js / addTaskToSchedule.js),
// скорректируй эти импорты под свои реальные файлы. Я здесь сгруппировал для читаемости.

// РЕНДЕРЫ
import { renderDashboardView } from "./view-dashboard.js";
import { renderCalendarView } from "./view-calendar.js";
import { renderScheduleView } from "./view-schedule.js";

// СИНХРОНИЗАЦИЯ
import SyncService from "../sync/syncService.js";

// ======================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ UI
// ======================
//
// state.selectedDateKey — текущий выбранный день в формате YYYY-MM-DD.
// state.activeView — "dashboard" | "calendar" | "schedule".
// state.scheduleEdit — временное состояние редактирования расписания.

const state = {
  activeView: "dashboard",
  selectedDateKey: null,
  scheduleEdit: null
};

// ======================
// ВСПОМОГАТЕЛЬНЫЕ ХЕЛПЕРЫ СИНХРОНИЗАЦИИ
// ======================
//
// 1. syncAfterDayChange(dateKey)
//    Вызывается после локального изменения конкретного дня (override).
//
//    Типичные случаи:
//    - +10% / -10% прогресса
//    - toggle done
//    - inline-редакт задачи дня
//    - resetToScheduleForDate()
//
//    dateKey — это ключ даты, где реально хранится прогресс.
//    Для обычной задачи это state.selectedDateKey.
//    Для задачи из "Разгрузка" — это дедлайн-день (правило D / D+1),
//    который мы узнаём через resolveEffectiveDateForTask(rowEl).
//
async function syncAfterDayChange(dateKey) {
  try {
    await SyncService.pushOverride(dateKey);
  } catch (e) {
    console.warn("[events] syncAfterDayChange failed", e);
  }
}

// 2. syncAfterScheduleChange()
//    Вызывается после локального изменения расписания недели.
//    Типичные случаи:
//    - добавили задачу в расписание дня недели
//    - отредактировали задачу расписания
//    - удалили задачу из расписания
//
async function syncAfterScheduleChange() {
  try {
    await SyncService.pushSchedule();
  } catch (e) {
    console.warn("[events] syncAfterScheduleChange failed", e);
  }
}

// ======================
// ОТРИСОВКА ВКЛАДОК
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
// УТИЛИТЫ ДЛЯ ДАТ
// ======================

// Форматирует дату "сейчас" в YYYY-MM-DD
function getTodayKey() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Эта функция у тебя уже должна существовать в проекте,
// она важна для логики разгрузки: определяет,
// В КАКОЙ ДАТЕ хранить прогресс конкретной задачи.
// Если она у тебя в другом месте или с другим именем —
// нужно использовать именно её версию.
// Здесь просто каркас, чтобы файл был целостным.
function resolveEffectiveDateForTask(rowEl) {
  // В реальном коде эта функция должна:
  // - отличать обычную задачу дня от задачи из "Разгрузка",
  // - если это обычная задача → вернуть state.selectedDateKey,
  // - если это задача из "Разгрузка" → вернуть ключ дедлайна (предыдущий день недели).
  //
  // Здесь мы ставим fallback на selectedDateKey,
  // но у тебя в проекте эта логика уже реализована.
  return state.selectedDateKey;
}

// ======================
// ИНИЦИАЛИЗАЦИЯ UI
// ======================
//
// initUI вызывается из app.js после:
//   await Storage.init();
//   await SyncService.pullBootstrap();
//
// здесь мы:
// 1. выставляем выбранную дату, если её нет
// 2. рендерим вкладки
// 3. вешаем глобальный обработчик кликов
// 4. запускаем периодическую pollUpdates()

async function initUI() {
  if (!state.selectedDateKey) {
    state.selectedDateKey = getTodayKey();
  }

  state.activeView = "dashboard";

  await refreshDashboard();
  await refreshCalendar();
  await refreshScheduleEditor();

  switchView(state.activeView);

  // ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ВСЕХ КЛИКОВ
  //
  // Внутри мы аккуратно встраиваем вызовы syncAfterDayChange и syncAfterScheduleChange,
  // сразу после того, как локальные данные уже изменены через use case
  // и мы обновили UI через refresh*().
  //
  document.addEventListener("click", async (ev) => {
    const t = ev.target;

    // ----------------------------------------
    // НАВИГАЦИЯ МЕЖДУ ВКЛАДКАМИ
    // ----------------------------------------
    if (t.matches("[data-nav]")) {
      const newView = t.getAttribute("data-nav");
      switchView(newView);
      return;
    }

    // ----------------------------------------
    // УПРАВЛЕНИЕ ПРОГРЕССОМ ЗАДАЧ ДНЯ (+10 / -10)
    // ----------------------------------------
    if (t.matches("[data-action='progress-plus']") ||
        t.matches("[data-action='progress-minus']")) {

      // находим строку задачи (row), оттуда узнаём taskId и т.д.
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      // Определяем, куда писать прогресс (может быть дедлайн-день, а не сегодня)
      const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

      // шаг изменения: +10 или -10
      const delta = t.matches("[data-action='progress-plus']") ? +10 : -10;

      // вызываем бизнес-логику
      await adjustTaskPercentForDate(
        effectiveDateKey,
        taskId,
        delta
      );

      // перерисовываем дашборд
      await refreshDashboard();

      // синхронизируем только изменённый день
      await syncAfterDayChange(effectiveDateKey);

      return;
    }

    // ----------------------------------------
    // ТОГГЛ DONE (чекбокс "сделано")
    // ----------------------------------------
    if (t.matches("[data-action='toggle-done']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

      await toggleTaskDoneForDate(
        effectiveDateKey,
        taskId
      );

      await refreshDashboard();

      await syncAfterDayChange(effectiveDateKey);

      return;
    }

    // ----------------------------------------
    // ИНЛАЙН-РЕДАКТИРОВАНИЕ ЗАДАЧИ ДНЯ (✎, сохранить, отмена)
    // ----------------------------------------

    // начало редактирования задачи дня
    if (t.matches("[data-action='inline-edit-start']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

      await startInlineEditTaskForDate(
        effectiveDateKey,
        taskId
      );

      await refreshDashboard();
      return;
    }

    // сохранение изменений инлайн-редактирования
    if (t.matches("[data-action='inline-edit-apply']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

      // поля формы (новое название, новые минуты и т.д.)
      const titleInput = rowEl.querySelector("[data-edit-title]");
      const minutesInput = rowEl.querySelector("[data-edit-minutes]");

      const newTitle = titleInput ? titleInput.value.trim() : "";
      const newMinutes = minutesInput ? parseInt(minutesInput.value, 10) : 0;

      await applyInlineEditForDate(
        effectiveDateKey,
        taskId,
        {
          title: newTitle,
          minutes: newMinutes
        }
      );

      await refreshDashboard();

      // пушим изменения конкретного дня
      await syncAfterDayChange(effectiveDateKey);

      return;
    }

    // отмена инлайн-редактирования
    if (t.matches("[data-action='inline-edit-cancel']")) {
      const rowEl = t.closest("[data-task-row]");
      if (!rowEl) return;

      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effectiveDateKey = resolveEffectiveDateForTask(rowEl);

      await cancelInlineEditForDate(
        effectiveDateKey,
        taskId
      );

      await refreshDashboard();
      return;
    }

    // ----------------------------------------
    // RESET TO SCHEDULE (сбросить день к расписанию)
    // ----------------------------------------
    if (t.matches("[data-action='reset-day-to-schedule']")) {
      // берём дату из state.selectedDateKey — это тот день,
      // который мы сейчас просматриваем в дашборде
      const currentDateKey = state.selectedDateKey;

      await resetToScheduleForDate(currentDateKey);

      await refreshDashboard();

      // отправляем новый снимок дня (override обновился)
      await syncAfterDayChange(currentDateKey);

      return;
    }

    // ----------------------------------------
    // ОБНОВЛЕНИЕ ВЫБРАННОЙ ДАТЫ ЧЕРЕЗ КАЛЕНДАРЬ
    // (клик по дню в календаре должен переключать выбранный день
    //  и переключать вкладку обратно на dashboard)
    // ----------------------------------------
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

    // ----------------------------------------
    // РАБОТА С РАСПИСАНИЕМ НЕДЕЛИ (schedule)
    // ----------------------------------------
    //
    // Ниже примеры. Твой реальный код может отличаться по атрибутам data-action.
    // Важно то, что ПОСЛЕ локального изменения расписания мы вызываем
    //   await syncAfterScheduleChange();
    //
    // Пример: начало редактирования задачи расписания
    if (t.matches("[data-action='schedule-edit-start']")) {
      const dayKey = t.getAttribute("data-day"); // monday / tuesday / ...
      const taskId = t.getAttribute("data-task-id");

      await startEditTaskInSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      return;
    }

    // Пример: сохранить изменения задачи в расписании
    if (t.matches("[data-action='schedule-edit-apply']")) {
      const formEl = t.closest("[data-schedule-edit-row]");
      if (!formEl) return;

      const dayKey = formEl.getAttribute("data-day");
      const taskId = formEl.getAttribute("data-task-id");

      const titleInput = formEl.querySelector("[data-edit-title]");
      const minutesInput = formEl.querySelector("[data-edit-minutes]");
      const offloadInputs = formEl.querySelectorAll("[data-edit-offload-day]");

      const newTitle = titleInput ? titleInput.value.trim() : "";
      const newMinutes = minutesInput ? parseInt(minutesInput.value, 10) : 0;

      // собираем offloadDays
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

      // пушим новое расписание
      await syncAfterScheduleChange();

      return;
    }

    // Пример: отменить редактирование задачи расписания
    if (t.matches("[data-action='schedule-edit-cancel']")) {
      const dayKey = t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id");

      await cancelEditTaskInSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();
      return;
    }

    // Пример: удалить задачу из расписания
    if (t.matches("[data-action='schedule-delete-task']")) {
      const dayKey = t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id");

      await deleteTaskFromSchedule(dayKey, taskId);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();

      await syncAfterScheduleChange();

      return;
    }

    // Пример: добавить новую задачу в расписание
    if (t.matches("[data-action='schedule-add-task']")) {
      const dayKey = t.getAttribute("data-day");
      await addTaskToSchedule(dayKey);

      state.scheduleEdit = await repo.getScheduleEditState();
      await refreshScheduleEditor();

      await syncAfterScheduleChange();

      return;
    }
  });

  // ПЕРИОДИЧЕСКАЯ ФОНОВАЯ СИНХРОНИЗАЦИЯ
  //
  // Раз в 30 секунд спрашиваем сервер через SyncService.pollUpdates():
  // - /api/list → сравнение updatedAt
  // - если сервер свежее — стягиваем только эти куски (schedule или override дня)
  //
  // UI не блокируем.
  // Пока мы не делаем авто-обновление экрана после pollUpdates,
  // но мы можем это легко добавить позже (просто вызвать refreshDashboard()).
  setInterval(() => {
    SyncService.pollUpdates().catch((e) => {
      console.warn("[events] pollUpdates failed", e);
    });
  }, 30000);
}

// экспортируем initUI, потому что app.js его вызывает
export { initUI };