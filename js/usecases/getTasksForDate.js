// usecases/getTasksForDate.js
// Возвращает задачи на указанную дату:
// - если есть override для dateKey — берём его
// - иначе — задачи из шаблона недели (schedule[weekday])

function parseDateKey(key) {
  // key: 'YYYY-MM-DD' → Date (в локальной зоне)
  if (!key || typeof key !== "string") return new Date();
  const [y, m, d] = key.split("-").map(Number);
  // Создаём дату в локали: месяц 0..11
  return new Date(y, (m || 1) - 1, d || 1);
}

function weekdayFromDateKey(key) {
  // Возвращает ключ дня недели, совместимый со Schedule: monday..sunday
  const date = parseDateKey(key);
  // JS: 0=Sun..6=Sat
  const i = date.getDay();
  const map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return map[i] || "monday";
}

export async function getTasksForDate({ dateKey }) {
  // Lazy imports (избегаем циклических зависимостей)
  const overrideRepo = await import("../adapters/local/override.repo.local.js").catch(() => ({}));
  const scheduleRepo = await import("../adapters/local/schedule.repo.local.js").catch(() => ({}));

  const loadOverride = overrideRepo.loadOverride || overrideRepo.load;
  const loadSchedule = scheduleRepo.loadSchedule || scheduleRepo.load;

  const key = dateKey || (new Date()).toISOString().slice(0,10);

  // 1) Если есть override — он приоритетный
  if (typeof loadOverride === "function") {
    try {
      const ov = await loadOverride(key);
      if (ov && Array.isArray(ov.tasks)) return ov.tasks;
    } catch (e) {
      console.warn("[getTasksForDate] loadOverride error:", e?.message);
    }
  }

  // 2) Фоллбек: недельный шаблон
  if (typeof loadSchedule === "function") {
    try {
      const schedule = await loadSchedule();
      const wd = weekdayFromDateKey(key);
      const tasks = Array.isArray(schedule?.[wd]) ? schedule[wd] : [];
      return tasks;
    } catch (e) {
      console.warn("[getTasksForDate] loadSchedule error:", e?.message);
    }
  }

  return [];
}

export default getTasksForDate;
