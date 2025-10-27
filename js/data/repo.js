import { Storage } from "../infra/telegramEnv.js";
import { DeviceId } from "../domain/id.js";

// -------------------- helpers --------------------

function safeParse(str, fallback) {
  if (!str || typeof str !== "string") return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

// meta:
//   { createdAt, updatedAt, deviceId, userAction }
function touchMeta(oldMeta, actionHint) {
  const base = (oldMeta && typeof oldMeta === "object") ? { ...oldMeta } : {};
  if (!base.createdAt) base.createdAt = nowIso();
  base.updatedAt = nowIso();
  base.deviceId = DeviceId.get();
  if (actionHint) base.userAction = String(actionHint);
  return base;
}

// Готовим объект "снимка дня" (override) к сохранению:
// - проставляем meta дню и каждой задаче
function stampDayOverride(dayObj, actionHint) {
  const copy = { ...dayObj };
  copy.dateKey = String(copy.dateKey || "");
  copy.meta = touchMeta(copy.meta, actionHint);

  const safeTasks = Array.isArray(copy.tasks) ? copy.tasks : [];
  copy.tasks = safeTasks.map(t => {
    const tCopy = { ...t };
    tCopy.meta = touchMeta(tCopy.meta, actionHint);
    return tCopy;
  });

  return copy;
}

// Проставляем meta расписанию недели (и всем задачам внутри него).
function stampSchedule(scheduleObj, actionHint) {
  const weekdays = [
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
  ];

  const out = {};
  for (const wd of weekdays) {
    const arr = Array.isArray(scheduleObj[wd]) ? scheduleObj[wd] : [];
    out[wd] = arr.map(task => ({
      id: String(task?.id || ""),
      title: String(task?.title || "Без названия"),
      minutes: Math.max(0, Number(task?.minutes) || 0),
      offloadDays: Array.isArray(task?.offloadDays)
        ? [...task.offloadDays]
        : [],
      meta: (task?.meta && typeof task.meta === "object") ? task.meta : null
    }));
  }

  return out;
}

// ------- ключи хранения -------
const KEY_SCHEDULE = "planner.schedule.v1";
function dayStorageKey(dateKey) {
  return `planner.override.${dateKey}.v1`;
}

// -------------------- PUBLIC API: расписание недели --------------------

export async function loadSchedule() {
  const raw = await Storage.getItem(KEY_SCHEDULE);
  const parsed = safeParse(raw, {});

  const weekdays = [
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
  ];

  const norm = {};
  for (const wd of weekdays) {
    const arr = Array.isArray(parsed[wd]) ? parsed[wd] : [];
    norm[wd] = arr.map(task => ({
      id: String(task?.id || ""),
      title: String(task?.title || "Без названия"),
      minutes: Math.max(0, Number(task?.minutes)||0),
      offloadDays: Array.isArray(task?.offloadDays)
        ? [...task.offloadDays]
        : [],
      meta: (task?.meta && typeof task.meta === "object")
        ? task.meta
        : null
    }));
  }

  return norm;
}

export async function saveSchedule(scheduleObj, actionHint) {
  if (!scheduleObj || typeof scheduleObj !== "object") return false;

  const stamped = stampSchedule(scheduleObj, actionHint);
  const json = JSON.stringify(stamped);

  console.log("[repo.saveSchedule] save => key=", KEY_SCHEDULE, "payload =", stamped);

  await Storage.setItem(KEY_SCHEDULE, json);
  return true;
}

// -------------------- PUBLIC API: снимок дня (override) --------------------

export async function loadDayOverride(dateKey) {
  const k = dayStorageKey(dateKey);
  const raw = await Storage.getItem(k);
  const parsed = safeParse(raw, null);

  if (!parsed) return null;

  const normTasks = Array.isArray(parsed.tasks)
    ? parsed.tasks.map(task => ({
        id: String(task?.id || ""),
        title: String(task?.title || "Без названия"),
        minutes: Math.max(0, Number(task?.minutes)||0),
        donePercent: Math.max(
          0,
          Math.min(100, Math.round(Number(task?.donePercent)||0))
        ),
        done: Boolean(task?.done) || (Number(task?.donePercent)>=100),
        offloadDays: null,
        meta: (task?.meta && typeof task.meta === "object")
          ? task.meta
          : null
      }))
    : [];

  return {
    dateKey: String(parsed.dateKey || dateKey || ""),
    tasks: normTasks,
    meta: (parsed.meta && typeof parsed.meta === "object")
      ? parsed.meta
      : null
  };
}

export async function saveDayOverride(dayObj, actionHint) {
  if (!dayObj || typeof dayObj !== "object") return false;
  if (!dayObj.dateKey) return false;

  const stamped = stampDayOverride(dayObj, actionHint);

  const k = dayStorageKey(stamped.dateKey);
  const json = JSON.stringify(stamped);

  console.log(
    "[repo.saveDayOverride] saving override",
    "dateKey=", stamped.dateKey,
    "tasks.len=", stamped.tasks?.length ?? 0,
    "storageKey=", k,
    "payload=", stamped
  );

  await Storage.setItem(k, json);
  return true;
}

// Возвращает массив дат ["2025-10-26", ...], у которых есть сохранённый override.
export async function listOverrideDates() {
  const keys = await Storage.getKeys();
  const out = [];

  for (const k of keys) {
    const m = /^planner\.override\.(\d{4}-\d{2}-\d{2})\.v1$/.exec(k);
    if (m) out.push(m[1]);
  }

  console.log("[repo.listOverrideDates] keys =", keys, "dates =", out);
  return out;
}

// -------------------- UI INLINE EDIT STATE (дашборд) --------------------
// Эти функции не взаимодействуют со Storage, а просто держат состояние в памяти.

const _inlineEditState = {}; // { dateKey: { taskId } }

export function startInlineEditTaskForDate(dateKey, taskId) {
  if (!dateKey) return;
  _inlineEditState[dateKey] = { taskId };
  console.log("[repo.inlineEdit] start", dateKey, "=>", taskId);
}

export function finishInlineEditTaskForDate(dateKey) {
  if (!dateKey) return;
  if (_inlineEditState[dateKey]) delete _inlineEditState[dateKey];
  console.log("[repo.inlineEdit] finish", dateKey);
}

export function getInlineEditStateForDate(dateKey) {
  return _inlineEditState[dateKey] || null;
}

// -------------------- EXPORT DEFAULT --------------------
export default {
  loadSchedule,
  saveSchedule,
  loadDayOverride,
  saveDayOverride,
  listOverrideDates,
  startInlineEditTaskForDate,
  finishInlineEditTaskForDate,
  getInlineEditStateForDate,
};