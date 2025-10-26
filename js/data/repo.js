// js/data/repo.js
//
// Единый репозиторий данных планировщика для Telegram mini-app.
// Хранение идёт через Storage (который использует tg.CloudStorage).
//
// Здесь есть операции:
//   loadSchedule / saveSchedule
//   loadDayOverride / saveDayOverride
//   listOverrideDates
//
// Мы также добавляем метаданные meta.* перед сохранением.
//

import { Storage } from "../infra/telegramEnv.js";
import { DeviceId } from "../domain/id.js";

function safeParse(str, fallback) {
  if (!str || typeof str !== "string") return fallback;
  try {
    const val = JSON.parse(str);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function dayKey(dateKey) {
  return `day_${dateKey}_v1`; // пример: "day_2025-10-26_v1"
}

const KEY_SCHEDULE = "week_schedule_v1";

// ---- helpers для meta ----

function touchMeta(oldMeta, actionHint) {
  const now = new Date().toISOString();
  const dev = DeviceId.get();
  const action = actionHint || "edit";

  const base = (oldMeta && typeof oldMeta === "object") ? { ...oldMeta } : {};
  if (!base.createdAt) {
    base.createdAt = now;
  }
  base.updatedAt = now;
  base.deviceId  = dev || base.deviceId || null;
  base.userAction = action;
  return base;
}

// мета у дня + у задач дня
function stampDayOverride(dayObj, actionHint) {
  const copy = { ...dayObj };
  copy.meta = touchMeta(copy.meta, actionHint);

  const safeTasks = Array.isArray(copy.tasks) ? copy.tasks : [];
  copy.tasks = safeTasks.map(t => {
    const tCopy = { ...t };
    tCopy.meta = touchMeta(tCopy.meta, actionHint);
    return tCopy;
  });

  return copy;
}

// мета у задач недельного расписания
function stampSchedule(scheduleObj, actionHint) {
  const weekdays = [
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
  ];
  const out = {};
  for (const wd of weekdays) {
    const arr = Array.isArray(scheduleObj[wd]) ? scheduleObj[wd] : [];
    out[wd] = arr.map(task => {
      const tCopy = { ...task };
      tCopy.meta = touchMeta(tCopy.meta, actionHint || "editSchedule");
      return tCopy;
    });
  }
  return out;
}

// ---- расписание недели ----

export async function loadSchedule() {
  const raw = await Storage.getItem(KEY_SCHEDULE);

  const blank = {
    monday:    [],
    tuesday:   [],
    wednesday: [],
    thursday:  [],
    friday:    [],
    saturday:  [],
    sunday:    []
  };

  const parsed = safeParse(raw, blank);

  for (const wd of Object.keys(blank)) {
    const arr = Array.isArray(parsed[wd]) ? parsed[wd] : [];
    parsed[wd] = arr.map(task => ({
      id: String(task?.id || ""),
      title: String(task?.title || "Без названия"),
      minutes: Math.max(0, Number(task?.minutes) || 0),
      offloadDays: Array.isArray(task?.offloadDays)
        ? [...task.offloadDays]
        : [],
      meta: task?.meta && typeof task.meta === "object" ? task.meta : null
    }));
  }

  return parsed;
}

export async function saveSchedule(scheduleObj, actionHint) {
  if (!scheduleObj || typeof scheduleObj !== "object") return false;

  const stamped = stampSchedule(scheduleObj, actionHint);
  const json = JSON.stringify(stamped);
  await Storage.setItem(KEY_SCHEDULE, json);
  return true;
}

// ---- override дня ----

export async function loadDayOverride(dateKey) {
  const k = dayKey(dateKey);
  const raw = await Storage.getItem(k);
  if (!raw) return null;

  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== "object") return null;

  const tasksArr = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  parsed.tasks = tasksArr.map(t => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(t?.donePercent) || 0)));
    return {
      id: String(t?.id || ""),
      title: String(t?.title || ""),
      minutes: Math.max(0, Number(t?.minutes) || 0),
      donePercent: pct,
      done: (typeof t?.done === "boolean") ? t.done : (pct >= 100),
      offloadDays: null,
      meta: t?.meta && typeof t.meta === "object" ? t.meta : null
    };
  });

  parsed.meta = parsed.meta && typeof parsed.meta === "object"
    ? parsed.meta
    : null;

  return parsed;
}

export async function saveDayOverride(dayObj, actionHint) {
  if (!dayObj || typeof dayObj !== "object") return false;
  if (!dayObj.dateKey) return false;

  const stamped = stampDayOverride(dayObj, actionHint);
  const k = dayKey(stamped.dateKey);
  const json = JSON.stringify(stamped);
  await Storage.setItem(k, json);
  return true;
}

export async function listOverrideDates() {
  const keys = await Storage.getKeys();
  const out = [];
  for (const k of keys) {
    if (k.startsWith("day_") && k.endsWith("_v1")) {
      const middle = k.slice(4, -3);
      if (middle && /^\d{4}-\d{2}-\d{2}$/.test(middle)) {
        out.push(middle);
      }
    }
  }
  return out;
}

export default {
  loadSchedule,
  saveSchedule,
  loadDayOverride,
  saveDayOverride,
  listOverrideDates
};
