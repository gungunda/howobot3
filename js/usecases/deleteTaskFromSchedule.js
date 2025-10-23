// js/usecases/deleteTaskFromSchedule.js
// FIX: no imports from ../app.js. Use smart repo directly.
export default async function deleteTaskFromSchedule({ weekday, taskId }){
  const repo = await import("../adapters/smart/smart.schedule.repo.js");
  const load = repo.loadSchedule || repo.load || (repo.default && repo.default.loadSchedule);
  const save = repo.saveSchedule || repo.save || (repo.default && repo.default.saveSchedule);
  if (typeof load !== "function" || typeof save !== "function") {
    throw new Error("[deleteTaskFromSchedule] schedule repo missing load/save");
  }

  const s = await load();
  const arr = Array.isArray(s[weekday]) ? s[weekday] : [];
  const idx = arr.findIndex(x => x.id === taskId);
  if (idx >= 0) {
    arr.splice(idx, 1);
    await save(s);
    return true;
  }
  return false;
}
