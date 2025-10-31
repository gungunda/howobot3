// js/ui/events.js
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

const state = {
  activeView: "dashboard",
  selectedDateKey: null,
  calYear: null,
  calMonth: null,
  scheduleEdit: null
};

export function getState() { return state; }

const WEEK_ORDER = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

function weekdayKeyFromDateKey(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  const mapJsToKey = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
  ];
  return mapJsToKey[d.getDay()];
}

function addDaysToDateKey(dateKey, delta) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function findNextDateKeyForWeekday(baseDateKey, weekdayTarget) {
  for (let i = 0; i < 8; i++) {
    const candidate = addDaysToDateKey(baseDateKey, i);
    if (weekdayKeyFromDateKey(candidate) === weekdayTarget) return candidate;
  }
  return baseDateKey;
}

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function syncAfterDayChange(dateKey) {
  try {
    const ov = await repo.loadDayOverride(dateKey);
    if (ov) await SyncService.pushOverride(dateKey, ov);
  } catch (e) {
    console.warn("[events] pushOverride failed:", e);
  }
}

async function syncAfterScheduleChange() {
  try {
    const sched = await repo.loadSchedule();
    if (sched) await SyncService.pushSchedule(sched);
  } catch (e) {
    console.warn("[events] pushSchedule failed:", e);
  }
}

function buildTasksForDay(dateKey, scheduleObj, overrideObj) {
  const weekday = weekdayKeyFromDateKey(dateKey);
  const baseTasks = Array.isArray(scheduleObj?.[weekday]) ? scheduleObj[weekday] : [];

  if (overrideObj && Array.isArray(overrideObj.tasks)) {
    return overrideObj.tasks.map(t => ({
      id: t.id,
      title: t.title,
      minutes: t.minutes,
      donePercent: Number(t.donePercent) || 0,
      done: !!t.done || (Number(t.donePercent) || 0) >= 100,
      offloadDays: null,
      meta: t.meta || null,
      source: "core",
      deadlineWeekday: null
    }));
  }

  return baseTasks.map(t => ({
    id: t.id,
    title: t.title,
    minutes: t.minutes,
    donePercent: 0,
    done: false,
    offloadDays: t.offloadDays || [],
    meta: t.meta || null,
    source: "core",
    deadlineWeekday: null
  }));
}

function buildOffloadTasksForDay(viewDateKey, scheduleObj) {
  const todayWeekday = weekdayKeyFromDateKey(viewDateKey);
  const result = [];

  WEEK_ORDER.forEach((weekdayName, idx) => {
    const dayTasks = Array.isArray(scheduleObj?.[weekdayName]) ? scheduleObj[weekdayName] : [];
    dayTasks.forEach(t => {
      const offArr = Array.isArray(t.offloadDays) ? t.offloadDays : [];
      if (offArr.includes(todayWeekday)) {
        const prevIdx = (idx - 1 + WEEK_ORDER.length) % WEEK_ORDER.length;
        result.push({
          id: t.id,
          title: t.title,
          minutes: t.minutes,
          donePercent: 0,
          done: false,
          offloadDays: t.offloadDays || [],
          meta: t.meta || null,
          source: "offload",
          mainWeekday: weekdayName,
          deadlineWeekday: WEEK_ORDER[prevIdx]
        });
      }
    });
  });

  return result;
}

async function enrichOffloadTasksProgress(viewDateKey, offloadTasks) {
  const cache = {};
  const out = [];

  for (const task of offloadTasks) {
    let { donePercent, done } = task;
    if (task.deadlineWeekday) {
      const deadlineDateKey = findNextDateKeyForWeekday(viewDateKey, task.deadlineWeekday);
      if (!cache[deadlineDateKey]) cache[deadlineDateKey] = await repo.loadDayOverride(deadlineDateKey);
      const ov = cache[deadlineDateKey];
      const same = ov?.tasks?.find?.(ot => ot.id === task.id);
      if (same) {
        donePercent = Number(same.donePercent) || 0;
        done = !!same.done || donePercent >= 100;
      }
    }
    out.push({ ...task, donePercent, done });
  }

  return out;
}

function buildStats(tasksArr) {
  let totalMinutes = 0;
  let doneMinutes = 0;
  let totalPercent = 0;

  tasksArr.forEach(t => {
    const mins = Number(t.minutes) || 0;
    const pct = Number(t.donePercent) || 0;
    totalMinutes += mins;
    doneMinutes += mins * (pct / 100);
    totalPercent += pct;
  });

  return {
    totalMinutes,
    doneMinutes: Math.round(doneMinutes),
    doneAvg: tasksArr.length ? Math.round(totalPercent / tasksArr.length) : 0
  };
}

function getDashboardInlineEdit(dateKey) {
  return typeof repo.getInlineEditStateForDate === "function"
    ? repo.getInlineEditStateForDate(dateKey)
    : null;
}

async function buildDashboardViewModel(dateKey) {
  const scheduleObj = await repo.loadSchedule();
  const overrideObj = await repo.loadDayOverride(dateKey);
  const tasks = buildTasksForDay(dateKey, scheduleObj, overrideObj);
  const offloadRaw = buildOffloadTasksForDay(dateKey, scheduleObj);
  const offloadTasks = await enrichOffloadTasksProgress(dateKey, offloadRaw);
  const stats = buildStats(tasks);
  const dashboardEdit = getDashboardInlineEdit(dateKey);
  return { dateKey, tasks, offloadTasks, stats, dashboardEdit };
}

function resolveEffectiveDateForTask(rowEl) {
  const source = rowEl?.dataset?.source;
  if (source !== "offload") return state.selectedDateKey;
  const deadlineWeekday = rowEl.dataset.deadlineWeekday;
  if (!deadlineWeekday) return state.selectedDateKey;
  return findNextDateKeyForWeekday(state.selectedDateKey, deadlineWeekday);
}

export async function refreshDashboard() {
  const model = await buildDashboardViewModel(state.selectedDateKey);
  updateDashboardView(model);
}

async function refreshCalendar() {
  if (state.calYear == null || state.calMonth == null) {
    const d = new Date(state.selectedDateKey + "T00:00:00");
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth();
  }
  await updateCalendarView({ calYear: state.calYear, calMonth: state.calMonth, currentDateKey: state.selectedDateKey });
}

export async function refreshScheduleEditor() {
  await updateScheduleView({ scheduleEdit: state.scheduleEdit });
}

function switchView(newView) {
  state.activeView = newView;
  document.querySelectorAll("[data-view]").forEach(el => {
    el.style.display = (el.getAttribute("data-view") === newView) ? "" : "none";
  });
  if (newView === "dashboard") refreshDashboard();
  if (newView === "calendar") refreshCalendar();
  if (newView === "schedule") refreshScheduleEditor();
}

export async function initUI() {
  if (!state.selectedDateKey) state.selectedDateKey = getTodayKey();

  await refreshDashboard();
  await refreshCalendar();
  await refreshScheduleEditor();
  switchView(state.activeView);

  document.addEventListener("click", async (ev) => {
    const t = ev.target;

    if (t.matches("[data-nav]")) {
      switchView(t.getAttribute("data-nav"));
      return;
    }

    if (t.matches("[data-view='calendar'] [data-date-key]")) {
      const newDateKey = t.getAttribute("data-date-key");
      if (newDateKey) {
        state.selectedDateKey = newDateKey;
        state.activeView = "dashboard";
        await refreshDashboard();
        await refreshCalendar();
        switchView("dashboard");
      }
      return;
    }

    const editBtn = t.closest(
      "[data-action='inline-edit-start'], .dash-edit, .task-edit, [data-role='dash-edit'], button[data-icon='edit'], [aria-label='Редактировать']"
    );
    const inDashboard = editBtn && editBtn.closest("[data-view='dashboard']");
    if (inDashboard) {
      const rowEl = editBtn.closest("[data-task-row], .task-item");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;
      if (typeof repo.startInlineEditTaskForDate === "function") {
        await repo.startInlineEditTaskForDate(state.selectedDateKey, taskId);
      }
      await refreshDashboard();
      return;
    }

    if (t.matches("[data-action='progress-plus'], [data-action='progress-minus'], .task-pct-plus, .task-pct-minus")) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);
      const delta = (t.matches("[data-action='progress-plus'], .task-pct-plus") ? +10 : -10);

      await adjustTaskPercentForDate({ dateKey: effDateKey, taskId, delta });
      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    if (t.matches("[data-action='toggle-done'], .task-done")) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);

      await toggleTaskDoneForDate({ dateKey: effDateKey, taskId });
      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    if (t.matches("[data-action='inline-edit-apply'], .dash-save")) {
      const rowEl = t.closest("[data-task-row], .task-item");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const effDateKey = resolveEffectiveDateForTask(rowEl);
      const newTitle = rowEl.querySelector(".dash-edit-title")?.value?.trim() ?? "";
      const newMinutes = parseInt(rowEl.querySelector(".dash-edit-minutes")?.value ?? "0", 10);

      await editTaskInline({ dateKey: effDateKey, taskId, patch: { title: newTitle, minutes: newMinutes } });

      if (typeof repo.finishInlineEditTaskForDate === "function") {
        await repo.finishInlineEditTaskForDate(state.selectedDateKey);
      }

      await refreshDashboard();
      await syncAfterDayChange(effDateKey);
      return;
    }

    if (t.matches("[data-action='inline-edit-cancel'], .dash-cancel")) {
      if (typeof repo.finishInlineEditTaskForDate === "function") {
        await repo.finishInlineEditTaskForDate(state.selectedDateKey);
      }
      await refreshDashboard();
      return;
    }

    if (t.matches("[data-action='reset-day-to-schedule'], .dash-reset-day")) {
      const dayKey = state.selectedDateKey;
      await resetToSchedule({ dateKey: dayKey });
      await refreshDashboard();
      await syncAfterDayChange(dayKey);
      return;
    }

    if (t.matches("[data-action='schedule-edit-start'], .week-edit")) {
      const taskItemEl = t.closest(".task-item"); if (!taskItemEl) return;
      const sectionEl = t.closest(".week-day[data-weekday]"); if (!sectionEl) return;

      const weekdayKey = sectionEl.getAttribute("data-weekday");
      const taskId = taskItemEl.getAttribute("data-task-id");

      const titleEl = taskItemEl.querySelector(".task-title");
      const minsEl  = taskItemEl.querySelector(".task-mins");

      const curTitle = titleEl ? titleEl.textContent.trim() : "";
      let curMinutes = 0; if (minsEl) { const mm = minsEl.textContent.replace(/[^\d]/g, ""); curMinutes = Number(mm) || 0; }

      const rawOffload = taskItemEl.getAttribute("data-offload-days") || "";
      const offloadDays = rawOffload.split(",").map(s => s.trim()).filter(Boolean);

      state.scheduleEdit = { weekday: weekdayKey, taskId, title: curTitle, minutes: curMinutes, offloadDays };
      await refreshScheduleEditor();
      return;
    }

    if (t.matches("[data-action='schedule-add-task'], .week-add")) {
      const day = t.closest("[data-weekday]")?.getAttribute("data-weekday") || t.getAttribute("data-day");
      if (!day) return;
      state.scheduleEdit = { weekday: day, taskId: null, title: "", minutes: 30, offloadDays: [] };
      await refreshScheduleEditor();
      return;
    }

    if (t.matches("[data-action='schedule-edit-apply'], .week-save")) {
      const form = t.closest("[data-weekday] .task-item.editing, [data-schedule-edit-row], .task-item.editing");
      if (!form) return;

      const day = form.closest("[data-weekday]")?.getAttribute("data-weekday") || form.getAttribute("data-day");
      const taskId = form.getAttribute("data-task-id");

      const newTitle = form.querySelector(".week-edit-title")?.value?.trim() ?? "";
      const newMinutes = parseInt(form.querySelector(".week-edit-minutes")?.value ?? "0", 10);
      const offloadDays = [...form.querySelectorAll(".week-offload-checkbox:checked")].map(c => c.value);

      if (!taskId || taskId == "NEW") {
        await addTaskToSchedule({ weekdayKey: day, taskData: { title: newTitle || "Без названия", minutes: newMinutes, offloadDays } });
      } else {
        await editTaskInSchedule({ weekdayKey: day, taskId, patch: { title: newTitle || "Без названия", minutes: newMinutes, offloadDays } });
      }

      state.scheduleEdit = null;
      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    if (t.matches("[data-action='schedule-delete-task'], .week-del")) {
      const day = t.closest("[data-weekday]")?.getAttribute("data-weekday") || t.getAttribute("data-day");
      const taskId = t.getAttribute("data-task-id") || t.closest(".task-item")?.getAttribute("data-task-id");
      if (!day || !taskId) return;

      await deleteTaskFromSchedule({ weekdayKey: day, taskId });

      state.scheduleEdit = null;
      await refreshScheduleEditor();
      await syncAfterScheduleChange();
      return;
    }

    if (t.matches("[data-action='schedule-edit-cancel'], .week-cancel")) {
      state.scheduleEdit = null;
      await refreshScheduleEditor();
      return;
    }

    if (t.matches("[data-action='back-to-dashboard'], [data-action='back-to-dashboard-2']")) {
      switchView("dashboard");
      return;
    }
  });
}
