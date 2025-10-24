// js/usecases/editTaskInline.js
import ensureOverrideForDate from "./ensureOverrideForDate.js";
export default async function editTaskInline({ dateKey, taskId, patch }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const ov = await ensureOverrideForDate(dateKey);
  const tasks = Array.isArray(ov.tasks) ? ov.tasks : (ov.tasks = []);
  let t = tasks.find(x=>x.id===taskId);
  if(!t){
    t = { id: String(taskId||`task_${Date.now().toString(36)}`), title:"Без названия", minutes:0, donePercent:0, done:false };
    tasks.push(t);
  }
  Object.assign(t, patch||{});
  if (typeof t.donePercent === 'number') {
    t.donePercent = Math.max(0, Math.min(100, Math.round(t.donePercent)));
    t.done = t.donePercent >= 100;
  }
  await saveOv(ov);
  return ov.tasks;
}
