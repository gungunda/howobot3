// js/data/repo.js
// Единый репозиторий данных (расписание недели + снимки дней).
// Всё приложение (usecases, UI) общается с данными только через этот слой.
//
// Сейчас Storage — это обёртка над localStorage или Telegram.WebApp.storage
// (см. infra/telegramEnv.js). То есть здесь уже тот интерфейс, который
// мы будем потом маппить на Telegram CloudStorage.

import { Storage } from "../infra/telegramEnv.js";
import { DeviceId } from "../domain/id.js";

// -------------------- helpers --------------------

function safeParse(str, fallback) {
  if (!str || typeof str !== "string") return fallback;
  try {
    const val = JSON.parse(str);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

// где храним расписание недели
const KEY_SCHEDULE = "planner.schedule.v1";

// где храним "снимки дня" (override) по конкретной дате
// пример ключа: planner.override.2025-10-26.v1
function dayStorageKey(dateKey) {
  return `planner.override.${dateKey}.v1`;
}

// Штамп метаданных. Это нужно для будущей синхронизации между девайсами.
// meta.updatedAt — когда меняли
// meta.deviceId  — кто менял
// meta.userAction — что делали ("toggleDone", "adjustPercent", и т.д.)
function touchMeta(oldMeta, actionHint) {
  const now = new Date().toISOString();
  const dev = DeviceId.get();
  const base = (oldMeta && typeof oldMeta === "object") ? { ...oldMeta } : {};

  if (!base.createdAt) {
    base.createdAt = now;
  }
  base.updatedAt = now;
  base.deviceId = dev || base.deviceId || null;
  base.userAction = actionHint || "edit";

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
    out[wd] = arr.map(task => {
      const tCopy = { ...task };
      tCopy.id = String(tCopy.id || "");
      tCopy.title = String(tCopy.title || "Без названия");
      tCopy.minutes = Math.max(0, Number(tCopy.minutes) || 0);
      tCopy.offloadDays = Array.isArray(tCopy.offloadDays)
        ? [...tCopy.offloadDays]
        : [];
      tCopy.meta = touchMeta(tCopy.meta, actionHint || "editSchedule");
      return tCopy;
    });
  }
  return out;
}

// -------------------- Schedule API --------------------
//
// Формат расписания недели, который возвращаем и принимаем:
//
// {
//   monday:    [ { id, title, minutes, offloadDays[], meta? }, ... ],
//   tuesday:   [ ... ],
//   ...,
//   sunday:    [ ... ]
// }

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

  // нормализация полей каждой задачи
  for (const wd of Object.keys(blank)) {
    const arr = Array.isArray(parsed[wd]) ? parsed[wd] : [];
    parsed[wd] = arr.map(task => ({
      id: String(task?.id || ""),
      title: String(task?.title || "Без названия"),
      minutes: Math.max(0, Number(task?.minutes) || 0),
      offloadDays: Array.isArray(task?.offloadDays)
        ? [...task.offloadDays]
        : [],
      meta: (task?.meta && typeof task.meta === "object") ? task.meta : null
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

// -------------------- Day Override API --------------------
//
// Формат "снимка дня":
//
// {
//   dateKey: "2025-10-26",
//   tasks: [
//     {
//       id: "math1",
//       title: "Математика",
//       minutes: 30,
//       donePercent: 40,
//       done: false,
//       offloadDays: null, // в override всегда null
//       meta: {...} | null
//     },
//     ...
//   ],
//   meta: {
//     createdAt: "...",
//     updatedAt: "...",
//     deviceId: "...",
//     userAction: "adjustPercent" | "toggleDone" | ...
//   }
// }

export async function loadDayOverride(dateKey) {
  const k = dayStorageKey(dateKey);
  const raw = await Storage.getItem(k);
  if (!raw) return null;

  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== "object") return null;

  const tasksArr = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  const normTasks = tasksArr.map(t => {
    const pct = Math.max(
      0,
      Math.min(100, Math.round(Number(t?.donePercent) || 0))
    );
    return {
      id: String(t?.id || ""),
      title: String(t?.title || ""),
      minutes: Math.max(0, Number(t?.minutes) || 0),
      donePercent: pct,
      done: (typeof t?.done === "boolean") ? t.done : (pct >= 100),
      offloadDays: null, // всегда null в override
      meta: (t?.meta && typeof t.meta === "object") ? t.meta : null
    };
  });

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

  await Storage.setItem(k, json);
  return true;
}

// Возвращает массив дат ["2025-10-26", "2025-10-27", ...],
// у которых есть сохранённый override.
export async function listOverrideDates() {
  const keys = await Storage.getKeys();
  const out = [];

  for (const k of keys) {
    // Ищем ключи вида planner.override.2025-10-26.v1
    const m = /^planner\.override\.(\d{4}-\d{2}-\d{2})\.v1$/.exec(k);
    if (m) {
      out.push(m[1]);
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
