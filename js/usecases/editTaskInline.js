"use strict";
import { DateKey } from "../domain/entities.js";
import { scheduleRepo, overrideRepo } from "../app.js";
import { ensureOverride } from "./ensureOverride.js";

/** Редактирует задачу (название, минуты, прогресс, закрытие) в выбранный день. */
export async function editTaskInline(dateKey, taskId, changes) {
  const ov = await ensureOverride(dateKey);
  let t = ov.findTask(taskId);
  if (!t) {
    const schedule = await scheduleRepo.load();
    const weekday  = DateKey.weekdayNameMonFirst(dateKey);
    const src = schedule.getTasks(weekday).find(x => x.id === taskId);
    if (!src) return;
    t = src.clone();
    ov.addTask(t);
  }
  ov.editTask(taskId, changes);
  await overrideRepo.save(dateKey, ov);
}
