// js/usecases/editTaskInSchedule.js
// FIX: no imports from ../app.js. Use smart repo directly.
export default async function editTaskInSchedule({ weekday, taskId, patch = {} }){
  const repo = await import("../adapters/smart/smart.schedule.repo.js");
  const load = repo.loadSchedule || repo.load || (repo.default && repo.default.loadSchedule);
  const save = repo.saveSchedule || repo.save || (repo.default && repo.default.saveSchedule);
  if (typeof load !== "function" || typeof save !== "function") {
    throw new Error("[editTaskInSchedule] schedule repo missing load/save");
  }

  const s = await load();
  const arr = Array.isArray(s[weekday]) ? s[weekday] : [];
  const t = arr.find(x => x.id === taskId);
  if (!t) return false;
  Object.assign(t, patch || {});
  await save(s);
  return true;
}
