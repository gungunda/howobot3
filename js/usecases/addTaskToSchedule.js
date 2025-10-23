"use strict";
import { scheduleRepo } from "../app.js";
import { Task } from "../domain/entities.js";

/** Добавляет задачу в расписание (по названию дня недели). */
export async function addTaskToSchedule(weekday, newTask) {
  const schedule = await scheduleRepo.load();
  schedule.addTaskToDay(weekday, new Task(newTask));
  await scheduleRepo.save(schedule);
}
