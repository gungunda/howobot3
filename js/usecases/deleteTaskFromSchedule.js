"use strict";
import { scheduleRepo } from "../app.js";

/** Удаляет задачу из шаблона недели. */
export async function deleteTaskFromSchedule(weekday, taskId) {
  const schedule = await scheduleRepo.load();
  schedule.removeTaskFromDay(weekday, taskId);
  await scheduleRepo.save(schedule);
}
