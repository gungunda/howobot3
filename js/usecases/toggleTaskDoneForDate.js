import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function toggleTaskDoneForDate({
  dateKey,
  taskId
}){
  console.log("[usecase.toggleTaskDoneForDate] called", { dateKey, taskId });

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  let cur = Number(task.donePercent);
  if (!Number.isFinite(cur)) cur = 0;

  const wasDone = cur >= 100;
  const newPercent = wasDone ? 0 : 100;

  task.donePercent = newPercent;
  task.done = newPercent >= 100;

  console.log("[usecase.toggleTaskDoneForDate] new task state", {
    taskId: task.id,
    donePercent: task.donePercent,
    done: task.done
  });

  await saveDayOverride(ov, "toggleDone");
  return ov.tasks;
}