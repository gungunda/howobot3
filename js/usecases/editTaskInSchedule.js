"use strict";
import { scheduleRepo } from "../app.js";

/** Редактирует задачу в расписании. */
export async function editTaskInSchedule(weekday, taskId, patch) {
  const schedule = await scheduleRepo.load();
  const list = schedule.getTasks(weekday);
  const t = list.find(x => x.id === taskId);
  if (!t) return;
  if (patch.title   != null) t.rename(patch.title);
  if (patch.minutes != null) t.setPlannedMinutes(patch.minutes);
  if (Array.isArray(patch.unloadDays)) t.unloadDays = patch.unloadDays;
  schedule.setTasks(weekday, list);
  await scheduleRepo.save(schedule);
}
