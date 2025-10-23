// js/adapters/local/schedule.repo.local.js
// Дефолтное расписание без устаревшего progress. Сохраняем/загружаем только donePercent.

const KEY = "planner.schedule";

const DEFAULT_SCHEDULE = {
  monday:    [ { id: "mon1", title: "Чтение",       minutes: 20, done: false, donePercent: 0 } ],
  tuesday:   [ { id: "tue1", title: "Математика",   minutes: 25, done: false, donePercent: 0 } ],
  wednesday: [ { id: "wed1", title: "Английский",   minutes: 15, done: false, donePercent: 0 } ],
  thursday:  [ { id: "thu1", title: "Математика",   minutes: 30, done: false, donePercent: 0 } ],
  friday:    [ { id: "fri1", title: "Спорт",        minutes: 20, done: false, donePercent: 0 } ],
  saturday:  [ { id: "sat1", title: "Хобби",        minutes: 20, done: false, donePercent: 0 } ],
  sunday:    [ { id: "sun1", title: "Планирование", minutes: 10, done: false, donePercent: 0 } ]
};

function normalizeTask(t) {
  if (!t || typeof t !== "object") return t;
  const { id, title, minutes = 0, donePercent = 0, done = undefined, meta = undefined } = t;
  const pct = Math.max(0, Math.min(100, Math.round(Number(donePercent) || 0)));
  const normalized = {
    id: String(id ?? ""),
    title: String(title ?? ""),
    minutes: Math.max(0, Number(minutes) || 0),
    donePercent: pct,
    done: typeof done === "boolean" ? done : pct >= 100
  };
  if (meta && typeof meta === "object") normalized.meta = meta;
  return normalized;
}

function normalizeSchedule(data) {
  const out = { ...DEFAULT_SCHEDULE, ...(data || {}) };
  for (const d of Object.keys(DEFAULT_SCHEDULE)) {
    const arr = Array.isArray(out[d]) ? out[d].map(normalizeTask) : [];
    out[d] = arr;
  }
  return out;
}

export async function loadSchedule(custom = {}) {
  const key = (typeof custom === "string") ? custom : (custom?.key || KEY);
  try {
    const hasLS = typeof localStorage !== "undefined";
    const raw = hasLS ? localStorage.getItem(key) : null;
    if (!raw) {
      const def = normalizeSchedule(DEFAULT_SCHEDULE);
      if (hasLS) localStorage.setItem(key, JSON.stringify(def));
      return def;
    }
    const data = JSON.parse(raw);
    return normalizeSchedule(data);
  } catch (e) {
    console.warn("[schedule.repo.local] load error:", e?.message);
    const def = normalizeSchedule(DEFAULT_SCHEDULE);
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
    }
    return def;
  }
}

export async function saveSchedule(schedule, custom = {}) {
  const key = (typeof custom === "string") ? custom : (custom?.key || KEY);
  try {
    const json = JSON.stringify(normalizeSchedule(schedule || {}));
    if (typeof localStorage !== "undefined") localStorage.setItem(key, json);
    return true;
  } catch (e) {
    console.warn("[schedule.repo.local] save error:", e?.message);
    return false;
  }
}

export const load = loadSchedule;
export const save  = saveSchedule;
export default { loadSchedule, saveSchedule, load, save };
