// js/usecases/adjustTaskPercentForDate.js
import ensureOverrideForDate from "./ensureOverrideForDate.js";
export default async function adjustTaskPercentForDate({ dateKey, taskId, delta = 0 }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const ov = await ensureOverrideForDate(dateKey);
  const tasks = ov.tasks || (ov.tasks=[]);
  const t = tasks.find(x=>x.id===taskId);
  if (!t) return tasks;
  const cur = Math.max(0, Math.min(100, Math.round(Number(t.donePercent)||0)));
  t.donePercent = Math.max(0, Math.min(100, Math.round(cur + (Number(delta)||0))));
  t.done = t.donePercent >= 100;
  await saveOv(ov);
  return tasks;
}
