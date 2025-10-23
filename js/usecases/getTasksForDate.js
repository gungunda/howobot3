"use strict";
import { DateKey } from "../domain/entities.js";
import { scheduleRepo, overrideRepo } from "../app.js";

/** Возвращает список задач на выбранную дату (override || расписание). */
export async function getTasksForDate(dateKey) {
  const ov = await overrideRepo.load(dateKey);
  if (ov) return ov.tasks;
  const schedule = await scheduleRepo.load();
  const weekday  = DateKey.weekdayNameMonFirst(dateKey);
  return schedule.getTasks(weekday);
}
