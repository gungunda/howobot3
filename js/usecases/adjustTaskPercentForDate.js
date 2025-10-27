import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function adjustTaskPercentForDate({
  dateKey,
  taskId,
  delta = 0
}){
  console.log("[usecase.adjustTaskPercentForDate] called", { dateKey, taskId, delta });

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  let cur = Number(task.donePercent);
  if (!Number.isFinite(cur)) cur = 0;
  cur = Math.max(0, Math.min(100, Math.round(cur)));

  const newPercent = Math.max(
    0,
    Math.min(100, cur + Math.round(Number(delta) || 0))
  );

  task.donePercent = newPercent;
  task.done = newPercent >= 100;

  console.log("[usecase.adjustTaskPercentForDate] new task state", {
    taskId: task.id,
    donePercent: task.donePercent,
    done: task.done
  });

  await saveDayOverride(ov, "adjustPercent");
  return ov.tasks;
}