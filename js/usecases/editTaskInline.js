// usecases/editTaskInline.js
// Первое редактирование задачи в дне:
// - если override отсутствует — создаём его на основе расписания (копируем редактируемую задачу);
// - если задачи с таким id нет в override — докладываем копию из расписания;
// - применяем patch и сохраняем override.

function parseDateKey(key) {
  return typeof key === "string" && key ? key : (new Date()).toISOString().slice(0,10);
}
function weekdayFromDateKey(key) {
  const [y,m,d] = key.split("-").map(Number);
  const date = new Date(y, (m||1)-1, d||1);
  const i = date.getDay(); // 0..6
  const map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return map[i] || "monday";
}

export async function editTaskInline({ dateKey, taskId, patch }) {
  const key = parseDateKey(dateKey);
  const overrideRepo = await import("../adapters/local/override.repo.local.js").catch(() => ({}));
  const scheduleRepo = await import("../adapters/local/schedule.repo.local.js").catch(() => ({}));

  const loadOverride = overrideRepo.loadOverride || overrideRepo.load;
  const saveOverride = overrideRepo.saveOverride || overrideRepo.save;
  const loadSchedule = scheduleRepo.loadSchedule || scheduleRepo.load;

  // 1) Пытаемся прочитать override
  let ov = typeof loadOverride === "function" ? await loadOverride(key) : null;

  // 2) Если override нет — создаём по образцу из недельного расписания
  if (!ov) {
    const schedule = typeof loadSchedule === "function" ? await loadSchedule() : null;
    const wd = weekdayFromDateKey(key);
    const fromWeek = Array.isArray(schedule?.[wd]) ? schedule[wd] : [];
    const src = fromWeek.find(x => x?.id === taskId);
    if (!src) return null; // нечего редактировать
    ov = { dateKey: key, tasks: [ { ...src } ] };
  }

  // 3) Находим или добавляем копию задачи в override
  let t = Array.isArray(ov.tasks) ? ov.tasks.find(x => x?.id === taskId) : null;
  if (!t) {
    const schedule = typeof loadSchedule === "function" ? await loadSchedule() : null;
    const wd = weekdayFromDateKey(key);
    const fromWeek = Array.isArray(schedule?.[wd]) ? schedule[wd] : [];
    const src = fromWeek.find(x => x?.id === taskId);
    if (!src) return null;
    t = { ...src };
    if (!Array.isArray(ov.tasks)) ov.tasks = [];
    ov.tasks.push(t);
  }

  // 4) Применяем patch
  Object.assign(t, patch || {});

  // 5) Сохраняем
  if (typeof saveOverride === "function") {
    await saveOverride(ov);
  } else {
    console.warn("[editTaskInline] saveOverride не найден — изменения не сохранены");
  }

  return ov.tasks;
}

export default editTaskInline;
