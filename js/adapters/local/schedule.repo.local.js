// js/adapters/local/schedule.repo.local.js
// Локальный репозиторий расписания недели.
// Данные лежат в localStorage под ключом "planner.schedule".
//
// Формат расписания, который мы храним и возвращаем:
//
// {
//   monday:    [ { id, title, minutes, offloadDays:[...] }, ... ],
//   tuesday:   [ ... ],
//   ...
//   sunday:    [ ... ]
// }
//
// ВАЖНО: offloadDays — это массив строк дней недели
// (например ["tuesday","thursday"]).
// Мы ГАРАНТИРУЕМ, что в возвращаемом объекте это всегда массив,
// даже если он пустой ([]), чтобы код выше не падал.

const STORAGE_KEY = "planner.schedule";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

function blankSchedule() {
  return {
    monday:    [],
    tuesday:   [],
    wednesday: [],
    thursday:  [],
    friday:    [],
    saturday:  [],
    sunday:    []
  };
}

// Приводим сырую задачу из localStorage к нормальному виду.
function normalizeTaskFromStorage(rawTask) {
  return {
    id: String(rawTask?.id || ""),
    title: String(rawTask?.title || "Без названия"),
    minutes: Math.max(0, Number(rawTask?.minutes) || 0),
    offloadDays: Array.isArray(rawTask?.offloadDays)
      ? [...rawTask.offloadDays]
      : [] // если нет поля — подставляем пустой массив
  };
}

// Чтение расписания:
// 1. достаем JSON из localStorage
// 2. парсим
// 3. гарантируем структуру по всем дням
// 4. нормализуем каждую задачу
export async function loadSchedule() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // бывает, например, если localStorage не доступен (sandbox и т.п.)
  }

  let parsed;
  if (!raw) {
    parsed = {};
  } else {
    try {
      parsed = JSON.parse(raw) || {};
    } catch (e) {
      parsed = {};
    }
  }

  const schedule = blankSchedule();

  for (const wd of WEEKDAYS) {
    const arr = Array.isArray(parsed[wd]) ? parsed[wd] : [];
    schedule[wd] = arr.map(normalizeTaskFromStorage);
  }

  return schedule;
}

// Сохранение расписания:
// 1. Берём текущее расписание (уже нормализованное объектами с offloadDays).
// 2. Гарантируем, что каждая задача содержит offloadDays (массив).
// 3. Пишем это обратно в localStorage.
export async function saveSchedule(schedule) {
  const out = blankSchedule();

  for (const wd of WEEKDAYS) {
    const arr = Array.isArray(schedule[wd]) ? schedule[wd] : [];
    out[wd] = arr.map(task => ({
      id: String(task?.id || ""),
      title: String(task?.title || "Без названия"),
      minutes: Math.max(0, Number(task?.minutes) || 0),
      offloadDays: Array.isArray(task?.offloadDays)
        ? [...task.offloadDays]
        : []
    }));
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch (e) {
    // можно логировать ошибку, но падать нельзя
  }

  return out;
}

export default {
  loadSchedule,
  saveSchedule
};
