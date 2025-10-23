// js/adapters/local/schedule.repo.local.js
// Локальный репозиторий расписания: русские названия предметов
// и автосохранение дефолта в localStorage при первом чтении.

const KEY = "planner.schedule";

const DEFAULT_SCHEDULE = {
  monday:    [ { id: "mon1", title: "Чтение",       minutes: 20, done: false } ],
  tuesday:   [ { id: "tue1", title: "Математика",   minutes: 25, done: false } ],
  wednesday: [ { id: "wed1", title: "Английский",   minutes: 15, done: false } ],
  thursday:  [ { id: "thu1", title: "Математика",   minutes: 30, done: false } ], // важно для теста
  friday:    [ { id: "fri1", title: "Спорт",        minutes: 20, done: false } ],
  saturday:  [ { id: "sat1", title: "Хобби",        minutes: 20, done: false } ],
  sunday:    [ { id: "sun1", title: "Планирование", minutes: 10, done: false } ]
};

export async function loadSchedule(custom = {}) {
  const key = (typeof custom === "string") ? custom : (custom?.key || KEY);
  try {
    const hasLS = typeof localStorage !== "undefined";
    const raw = hasLS ? localStorage.getItem(key) : null;
    if (!raw) {
      const def = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
      if (hasLS) localStorage.setItem(key, JSON.stringify(def)); // сохраняем дефолт сразу
      return def;
    }
    const data = JSON.parse(raw);
    const out = { ...DEFAULT_SCHEDULE, ...(data || {}) };
    for (const d of Object.keys(DEFAULT_SCHEDULE)) {
      if (!Array.isArray(out[d])) out[d] = [];
    }
    return out;
  } catch (e) {
    console.warn("[schedule.repo.local] load error:", e?.message);
    const def = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
    }
    return def;
  }
}

export async function saveSchedule(schedule, custom = {}) {
  const key = (typeof custom === "string") ? custom : (custom?.key || KEY);
  try {
    const json = JSON.stringify(schedule || {});
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
