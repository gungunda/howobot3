// js/usecases/addTaskToSchedule.js
// FIX: безопасный импорт makeId (поддержка default/именованного/отсутствия).

export default async function addTaskToSchedule({ weekday, task }){
  const repo = await import("../adapters/smart/smart.schedule.repo.js");
  const load = repo.loadSchedule || repo.load || (repo.default && repo.default.loadSchedule);
  const save = repo.saveSchedule || repo.save || (repo.default && repo.default.saveSchedule);
  if (typeof load !== "function" || typeof save !== "function") {
    throw new Error("[addTaskToSchedule] schedule repo missing load/save");
  }

  // Безопасный импорт генератора id
  let makeIdFn;
  try {
    const idMod = await import("../domain/id.js");
    makeIdFn = idMod.makeId || idMod.default;
  } catch {}
  if (typeof makeIdFn !== "function") {
    // Фолбэк: небольшой генератор id
    makeIdFn = (prefix="task") => {
      const rnd = Math.random().toString(36).slice(2, 8);
      return `${prefix}_${Date.now().toString(36)}_${rnd}`;
    };
  }

  const s = await load();
  const arr = Array.isArray(s[weekday]) ? s[weekday] : (s[weekday] = []);
  const t = {
    id: (task && task.id) || makeIdFn("task"),
    title: (task && task.title) || "Новая задача",
    minutes: Number(task && task.minutes) || 0,
    done: false,
    donePercent: 0
  };
  arr.push(t);
  await save(s);
  return t;
}
