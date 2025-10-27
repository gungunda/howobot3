import { Storage } from "../infra/telegramEnv.js";

import { updateDashboardView } from "./view-dashboard.js";
import { updateCalendarView } from "./view-calendar.js";
import { updateScheduleView } from "./view-schedule.js";

import { toDateKey, addDaysToDateKey } from "../domain/entities.js";

// usecases (доменные сценарии)
import toggleTaskDoneForDate from "../usecases/toggleTaskDoneForDate.js";
import { adjustTaskPercentForDate } from "../usecases/adjustTaskPercentForDate.js";
import { editTaskInline } from "../usecases/editTaskInline.js";
import resetToSchedule from "../usecases/resetToSchedule.js";

import addTaskToSchedule from "../usecases/addTaskToSchedule.js";
import editTaskInSchedule from "../usecases/editTaskInSchedule.js";
import deleteTaskFromSchedule from "../usecases/deleteTaskFromSchedule.js";

// repo для загрузки данных и построения моделей
import * as repo from "../data/repo.js";

////////////////////////////////////////////////////////////////////////////////
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ UI
////////////////////////////////////////////////////////////////////////////////
//
// state.activeView: "dashboard" | "calendar" | "schedule"
// state.selectedDateKey: "YYYY-MM-DD"
// state.scheduleEdit: null
//   или {
//     weekday: "monday",
//     taskId: "task_123" | null (если создаём новую),
//     title: "...", minutes: 30, offloadDays: ["tuesday","friday"]
//   }
//
// Правило: всегда после действий мы делаем refreshCurrentView()
//
const state = {
  activeView: "dashboard",
  selectedDateKey: toDateKey(new Date()),
  scheduleEdit: null
};

////////////////////////////////////////////////////////////////////////////////
// ПОМОЩНИКИ ДЛЯ МОДЕЛЕЙ ПРЕДСТАВЛЕНИЯ
////////////////////////////////////////////////////////////////////////////////

async function buildDashboardModel(dateKey) {
  // 1. грузим расписание недели
  const schedRaw = await repo.loadSchedule();

  // 2. грузим override для этой даты, если есть
  const ovRaw = await repo.loadDayOverride(dateKey);

  // 3. строим виртуальную модель дня:
  //    - если override есть -> берём его
  //    - если нет -> строим "на завтра" на лету, но не сохраняем
  //
  //    Эта логика у тебя уже реализована где-то выше в проекте,
  //    я не переписываю, только вызываю тот же подход.
  //
  //    Предположим, что у repo или хелпера есть функция
  //    repo.buildDayModel(dateKey) или что-то в этом духе.
  //
  //    В твоём бандле это называлось чем-то вроде getDashboardViewModel().
  //    Чтобы не потерять совместимость, я буду звать helper.
  //
  const model = await repo.buildDashboardViewModel(dateKey, schedRaw, ovRaw);
  return model;
}

// Текущее окно — "День"
async function refreshDashboard() {
  const model = await buildDashboardModel(state.selectedDateKey);
  updateDashboardView(model);
}

// Текущее окно — "Календарь"
async function refreshCalendar() {
  updateCalendarView({
    selectedDateKey: state.selectedDateKey,
    onDateClick: handleCalendarDateClick
  });
}

// Текущее окно — "Расписание"
async function refreshScheduleEditor() {
  // Просто передаём state, внутри view-schedule он сам дернёт repo.loadSchedule()
  await updateScheduleView(state);
}

/**
 * Универсально обновить текущий экран.
 */
async function refreshCurrentView() {
  if (state.activeView === "dashboard") {
    await refreshDashboard();
  } else if (state.activeView === "calendar") {
    await refreshCalendar();
  } else if (state.activeView === "schedule") {
    await refreshScheduleEditor();
  }
}

////////////////////////////////////////////////////////////////////////////////
// НАВИГАЦИЯ МЕЖДУ ВКЛАДКАМИ
////////////////////////////////////////////////////////////////////////////////

function switchView(newView) {
  state.activeView = newView;

  // переключаем видимость панелей
  document.querySelectorAll("[data-view]").forEach(el => {
    const v = el.getAttribute("data-view");
    el.style.display = v === newView ? "" : "none";
  });

  refreshCurrentView();
}

function handleCalendarDateClick(newDateKey) {
  state.selectedDateKey = newDateKey;
  state.activeView = "dashboard";
  switchView("dashboard");
}

////////////////////////////////////////////////////////////////////////////////
// ХЕЛПЕРЫ ДЛЯ РАСПИСАНИЯ НЕДЕЛИ (schedule)
////////////////////////////////////////////////////////////////////////////////

/**
 * Найти элемент task-item.editing и считать из него значения.
 * Это нужно когда пользователь нажимает "Сохранить".
 */
function readTaskEditorValues(taskItemEl) {
  const titleInput = taskItemEl.querySelector(".week-edit-title");
  const minsInput = taskItemEl.querySelector(".week-edit-minutes");
  const cbList = taskItemEl.querySelectorAll(".week-offload-checkbox");

  const title = titleInput ? titleInput.value.trim() : "";
  const minutesRaw = minsInput ? minsInput.value : "0";
  const minutes = Number(minutesRaw) || 0;

  // Собираем чекбоксы разгрузки
  const offloadDays = [];
  cbList.forEach(cb => {
    if (cb.checked) {
      const dayVal = cb.value;
      // disabled чекбоксы — это текущий день недели, их нельзя выбирать.
      // Но мы всё равно сюда не попадём, потому что disabled не позволит .checked=true.
      offloadDays.push(dayVal);
    }
  });

  return { title, minutes, offloadDays };
}

/**
 * Найти контекст редактируемой задачи:
 *  - в каком дне недели она сейчас?
 *  - это новая задача или существующая?
 *  - какой у неё taskId?
 */
function getWeekTaskContext(saveBtnEl) {
  // saveBtnEl -> .task-item.editing -> section.week-day[data-weekday]
  const taskItemEl = saveBtnEl.closest(".task-item.editing");
  if (!taskItemEl) return null;

  const sectionEl = saveBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return null;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id"); // "NEW" или реальный id

  return { taskItemEl, weekdayKey, taskId };
}

/**
 * Обработчик кнопки "Сохранить" в расписании.
 *  - Если taskId === "NEW" -> addTaskToSchedule
 *  - Иначе -> editTaskInSchedule
 */
async function handleWeekSaveClick(saveBtnEl) {
  const ctx = getWeekTaskContext(saveBtnEl);
  if (!ctx) return;
  const { taskItemEl, weekdayKey, taskId } = ctx;

  const { title, minutes, offloadDays } = readTaskEditorValues(taskItemEl);

  // подстрахуемся: пустое имя -> "Без названия"
  const safeTitle = title || "Без названия";

  try {
    if (taskId === "NEW" || !taskId) {
      // новая задача
      await addTaskToSchedule({
        weekdayKey,
        taskData: {
          title: safeTitle,
          minutes,
          offloadDays
        }
      });
    } else {
      // редактирование существующей задачи
      await editTaskInSchedule({
        weekdayKey,
        taskId,
        patch: {
          title: safeTitle,
          minutes,
          offloadDays
        }
      });
    }

    // после успешного сохранения выходим из режима редактирования
    state.scheduleEdit = null;
    await refreshScheduleEditor();

  } catch (err) {
    console.warn("week-save failed", err);
  }
}

/**
 * Обработчик кнопки "Отмена" в расписании.
 * Просто сбрасываем режим редактирования для этого дня.
 */
function handleWeekCancelClick(cancelBtnEl) {
  state.scheduleEdit = null;
  refreshScheduleEditor();
}

/**
 * Обработчик кнопки "✎" (редактировать задачу существующую).
 * Мы заполняем state.scheduleEdit так, чтобы view-schedule.js
 * отрисовал task-item.editing для нужной задачи.
 */
function handleWeekEditClick(editBtnEl) {
  const taskItemEl = editBtnEl.closest(".task-item");
  if (!taskItemEl) return;
  const sectionEl = editBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id");

  // текущее показанное значение мин и заголовка
  const titleEl = taskItemEl.querySelector(".task-title");
  const minsEl = taskItemEl.querySelector(".task-mins");

  const curTitle = titleEl ? titleEl.textContent.trim() : "";
  // "30 мин" -> 30
  let curMinutes = 0;
  if (minsEl) {
    const mm = minsEl.textContent.replace(/[^\d]/g, "");
    curMinutes = Number(mm) || 0;
  }

  // offloadDays зашиты в data-offload-days="mon,tue"
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
    offloadDays
  };

  refreshScheduleEditor();
}

/**
 * Обработчик кнопки "+ Добавить задачу".
 * Мы говорим состоянию "сейчас редактируем новую задачу в этом дне".
 */
function handleWeekAddClick(addBtnEl) {
  const sectionEl = addBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;
  const weekdayKey = sectionEl.getAttribute("data-weekday");

  state.scheduleEdit = {
    weekday: weekdayKey,
    taskId: null,
    title: "",
    minutes: 30,
    offloadDays: []
  };

  refreshScheduleEditor();
}

/**
 * Обработчик кнопки "🗑" (удалить задачу).
 */
async function handleWeekDeleteClick(delBtnEl) {
  const taskItemEl = delBtnEl.closest(".task-item");
  if (!taskItemEl) return;

  const sectionEl = delBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id");

  try {
    await deleteTaskFromSchedule({
      weekdayKey,
      taskId
    });
    // после удаления просто перерисуем
    await refreshScheduleEditor();
  } catch (err) {
    console.warn("deleteTaskFromSchedule error", err);
  }
}

////////////////////////////////////////////////////////////////////////////////
// ОБРАБОТЧИКИ ДЛЯ ДАШБОРДА (ДЕНЬ)
////////////////////////////////////////////////////////////////////////////////

/**
 * Клик по чекбоксу "сделано / не сделано" на задаче дня.
 */
async function handleToggleDoneClick(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");
  const dateKey = state.selectedDateKey;

  await toggleTaskDoneForDate({ dateKey, taskId });
  await refreshDashboard();
}

/**
 * Клик по "+10%" или "-10%" на задаче дня.
 */
async function handleBumpPercentClick(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");
  const dir = btnEl.getAttribute("data-dir"); // "+10" или "-10"
  const delta = dir === "+10" ? 10 : -10;

  const dateKey = state.selectedDateKey;

  await adjustTaskPercentForDate({
    dateKey,
    taskId,
    delta
  });

  await refreshDashboard();
}

/**
 * Переход в inline-редактирование задачи конкретного дня.
 * (не расписания, а именно snapshot дня)
 */
function handleInlineEditStart(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");

  // Здесь логика может у тебя отличаться,
  // но идея такая: мы помечаем в модели dashboardEdit,
  // а потом refreshDashboard() перерисует задачу в режиме редактирования.
  //
  // Чтобы не потерять твою кастомную реализацию,
  // я оставлю вызов через repo, если она у тебя была.
  //
  repo.startInlineEditTaskForDate(state.selectedDateKey, taskId);
  refreshDashboard();
}

/**
 * Завершить inline-редактирование задачи дня (сохранить изменения).
 */
async function handleInlineEditSave(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");

  const titleInput = rowEl.querySelector(".dash-edit-title");
  const minsInput = rowEl.querySelector(".dash-edit-minutes");

  const newTitle = titleInput ? titleInput.value.trim() : "";
  const newMinutes = minsInput ? Number(minsInput.value) || 0 : 0;

  await editTaskInline({
    dateKey: state.selectedDateKey,
    taskId,
    patch: {
      title: newTitle || "Без названия",
      minutes: newMinutes
    }
  });

  repo.finishInlineEditTaskForDate(state.selectedDateKey);
  await refreshDashboard();
}

/**
 * Отмена inline-редактирования задачи дня без сохранения.
 */
function handleInlineEditCancel(btnEl) {
  repo.finishInlineEditTaskForDate(state.selectedDateKey);
  refreshDashboard();
}

/**
 * Сбросить текущий день по расписанию ("пересобрать заново").
 */
async function handleResetDayClick() {
  await resetToSchedule({ dateKey: state.selectedDateKey });
  await refreshDashboard();
}

////////////////////////////////////////////////////////////////////////////////
// ГЛАВНЫЙ ЛИСТЕНЕР
////////////////////////////////////////////////////////////////////////////////

function onClick(e) {
  const target = e.target;

  // Навигация по вкладкам
  if (target.matches("[data-nav='dashboard']")) {
    switchView("dashboard");
    return;
  }
  if (target.matches("[data-nav='calendar']")) {
    switchView("calendar");
    return;
  }
  if (target.matches("[data-nav='schedule']")) {
    switchView("schedule");
    return;
  }

  // Календарь: выбор дня
  if (target.matches(".cal-day") && target.dataset.dateKey) {
    const dk = target.dataset.dateKey;
    state.selectedDateKey = dk;
    switchView("dashboard");
    return;
  }

  // Дашборд: чекбокс done
  if (target.matches(".dash-done-toggle")) {
    handleToggleDoneClick(target);
    return;
  }

  // Дашборд: +10 / -10
  if (target.matches(".dash-bump")) {
    handleBumpPercentClick(target);
    return;
  }

  // Дашборд: начать редактирование этой задачи дня
  if (target.matches(".dash-edit-start")) {
    handleInlineEditStart(target);
    return;
  }

  // Дашборд: сохранить редактирование задачи дня
  if (target.matches(".dash-edit-save")) {
    handleInlineEditSave(target);
    return;
  }

  // Дашборд: отменить редактирование задачи дня
  if (target.matches(".dash-edit-cancel")) {
    handleInlineEditCancel(target);
    return;
  }

  // Дашборд: сбросить день по расписанию
  if (target.matches(".dash-reset-day")) {
    handleResetDayClick();
    return;
  }

  // РАСПИСАНИЕ НЕДЕЛИ (schedule)

  // "+ Добавить задачу"
  if (target.matches(".week-add")) {
    handleWeekAddClick(target);
    return;
  }

  // "✎" редактировать задачу
  if (target.matches(".week-edit")) {
    handleWeekEditClick(target);
    return;
  }

  // "🗑" удалить задачу
  if (target.matches(".week-del")) {
    handleWeekDeleteClick(target);
    return;
  }

  // "Сохранить" в редакторе задачи недели
  if (target.matches(".week-save")) {
    handleWeekSaveClick(target);
    return;
  }

  // "Отмена" в редакторе задачи недели
  if (target.matches(".week-cancel")) {
    handleWeekCancelClick(target);
    return;
  }

  // "← Назад" сверху во вкладке расписания (назад к дню)
  if (target.matches(".back-btn[data-action='back-to-dashboard']")) {
    switchView("dashboard");
    return;
  }
}

////////////////////////////////////////////////////////////////////////////////
// ИНИЦИАЛИЗАЦИЯ ВСЕГО UI
////////////////////////////////////////////////////////////////////////////////

export default function initUI() {
  console.log("[events] initUI; Storage mode =", Storage.getMode && Storage.getMode());
  document.addEventListener("click", onClick);

  // показать только активную вкладку и отрисовать её
  switchView(state.activeView);
}