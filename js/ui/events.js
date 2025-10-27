import { Storage } from "../infra/telegramEnv.js";

import { updateDashboardView } from "./view-dashboard.js";
import { updateCalendarView } from "./view-calendar.js";
import { updateScheduleView } from "./view-schedule.js";

import { toDateKey } from "../domain/entities.js";

// usecases
import toggleTaskDoneForDate from "../usecases/toggleTaskDoneForDate.js";
import { adjustTaskPercentForDate } from "../usecases/adjustTaskPercentForDate.js";
import { editTaskInline } from "../usecases/editTaskInline.js";
import resetToSchedule from "../usecases/resetToSchedule.js";

import addTaskToSchedule from "../usecases/addTaskToSchedule.js";
import editTaskInSchedule from "../usecases/editTaskInSchedule.js";
import deleteTaskFromSchedule from "../usecases/deleteTaskFromSchedule.js";

import * as repo from "../data/repo.js";

////////////////////////////////////////////////////////////////////////////////
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ UI
////////////////////////////////////////////////////////////////////////////////

const state = {
  activeView: "dashboard",
  selectedDateKey: toDateKey(new Date()),
  scheduleEdit: null
};

////////////////////////////////////////////////////////////////////////////////
// МОДЕЛИ ПРЕДСТАВЛЕНИЯ
////////////////////////////////////////////////////////////////////////////////

async function buildDashboardModel(dateKey) {
  const schedRaw = await repo.loadSchedule();
  const ovRaw = await repo.loadDayOverride(dateKey);

  const model = await repo.buildDashboardViewModel(
    dateKey,
    schedRaw,
    ovRaw
  );

  return model;
}

async function refreshDashboard() {
  const model = await buildDashboardModel(state.selectedDateKey);
  updateDashboardView(model);
}

async function refreshCalendar() {
  updateCalendarView({
    selectedDateKey: state.selectedDateKey,
    onDateClick: handleCalendarDateClick
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
  state.activeView = "dashboard";
  switchView("dashboard");
}

////////////////////////////////////////////////////////////////////////////////
// ХЕЛПЕРЫ ДЛЯ РАСПИСАНИЯ (WEEK SCHEDULE)
////////////////////////////////////////////////////////////////////////////////

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

function getWeekTaskContext(saveBtnEl) {
  const taskItemEl = saveBtnEl.closest(".task-item.editing");
  if (!taskItemEl) return null;

  const sectionEl = saveBtnEl.closest(".week-day[data-weekday]");
  if (!sectionEl) return null;

  const weekdayKey = sectionEl.getAttribute("data-weekday");
  const taskId = taskItemEl.getAttribute("data-task-id"); // "NEW" или реальный id

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
          offloadDays
        }
      });
    } else {
      console.log("[week-save] editing task", taskId, "for", weekdayKey);
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

    // Покажем, что реально лежит в расписании после save
    const after = await repo.loadSchedule();
    console.log("[week-save] schedule after save =", after);

    state.scheduleEdit = null;
    await refreshScheduleEditor();
  } catch (err) {
    console.warn("week-save failed", err);
  }
}

function handleWeekCancelClick(cancelBtnEl) {
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
    offloadDays
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
    offloadDays: []
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
      taskId
    });

    const after = await repo.loadSchedule();
    console.log("[week-delete] schedule after delete =", after);

    await refreshScheduleEditor();
  } catch (err) {
    console.warn("deleteTaskFromSchedule error", err);
  }
}

////////////////////////////////////////////////////////////////////////////////
// ОБРАБОТЧИКИ ДАШБОРДА (ДЕНЬ)
////////////////////////////////////////////////////////////////////////////////

async function handleToggleDoneClick(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");
  const dateKey = state.selectedDateKey;

  await toggleTaskDoneForDate({ dateKey, taskId });
  await refreshDashboard();
}

async function handleBumpPercentClick(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");
  const dir = btnEl.getAttribute("data-dir");
  const delta = dir === "+10" ? 10 : -10;

  const dateKey = state.selectedDateKey;

  await adjustTaskPercentForDate({
    dateKey,
    taskId,
    delta
  });

  await refreshDashboard();
}

function handleInlineEditStart(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");

  repo.startInlineEditTaskForDate(state.selectedDateKey, taskId);
  refreshDashboard();
}

async function handleInlineEditSave(btnEl) {
  const rowEl = btnEl.closest("[data-task-id]");
  if (!rowEl) return;

  const taskId = rowEl.getAttribute("data-task-id");

  const titleInput = rowEl.querySelector(".dash-edit-title");
  const minsInput  = rowEl.querySelector(".dash-edit-minutes");

  const newTitle   = titleInput ? titleInput.value.trim() : "";
  const newMinutes = minsInput  ? Number(minsInput.value) || 0 : 0;

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

function handleInlineEditCancel(btnEl) {
  repo.finishInlineEditTaskForDate(state.selectedDateKey);
  refreshDashboard();
}

async function handleResetDayClick() {
  await resetToSchedule({ dateKey: state.selectedDateKey });
  await refreshDashboard();
}

////////////////////////////////////////////////////////////////////////////////
// ГЛАВНЫЙ КЛИК-ЛИСТЕНЕР
////////////////////////////////////////////////////////////////////////////////

function onClick(e) {
  const target = e.target;

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

  if (target.matches(".cal-day") && target.dataset.dateKey) {
    const dk = target.dataset.dateKey;
    state.selectedDateKey = dk;
    switchView("dashboard");
    return;
  }

  if (target.matches(".dash-done-toggle")) {
    handleToggleDoneClick(target);
    return;
  }

  if (target.matches(".dash-bump")) {
    handleBumpPercentClick(target);
    return;
  }

  if (target.matches(".dash-edit-start")) {
    handleInlineEditStart(target);
    return;
  }

  if (target.matches(".dash-edit-save")) {
    handleInlineEditSave(target);
    return;
  }

  if (target.matches(".dash-edit-cancel")) {
    handleInlineEditCancel(target);
    return;
  }

  if (target.matches(".dash-reset-day")) {
    handleResetDayClick();
    return;
  }

  // ------- расписание недели ---------

  if (target.matches(".week-add")) {
    handleWeekAddClick(target);
    return;
  }

  if (target.matches(".week-edit")) {
    handleWeekEditClick(target);
    return;
  }

  if (target.matches(".week-del")) {
    handleWeekDeleteClick(target);
    return;
  }

  if (target.matches(".week-save")) {
    handleWeekSaveClick(target);
    return;
  }

  if (target.matches(".week-cancel")) {
    handleWeekCancelClick(target);
    return;
  }

  if (target.matches(".back-btn[data-action='back-to-dashboard']")) {
    switchView("dashboard");
    return;
  }
}

////////////////////////////////////////////////////////////////////////////////
// initUI
////////////////////////////////////////////////////////////////////////////////

export default function initUI() {
  console.log("[events] initUI; Storage mode =", Storage.getMode && Storage.getMode());
  document.addEventListener("click", onClick);
  switchView(state.activeView);
}