// js/usecases/toggleTaskDoneForDate.js
import ensureOverrideForDate from "./ensureOverrideForDate.js";
export default async function toggleTaskDoneForDate({ dateKey, taskId }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const ov = await ensureOverrideForDate(dateKey);
  const tasks = ov.tasks || (ov.tasks=[]);
  const t = tasks.find(x=>x.id===taskId);
  if (!t) return tasks;
  t.donePercent = (Math.max(0, Math.min(100, Math.round(Number(t.donePercent)||0))) >= 100) ? 0 : 100;
  t.done = t.donePercent >= 100;
  await saveOv(ov);
  return tasks;
}
