"use strict";
import { scheduleRepo, overrideRepo } from "../app.js";
import { ensureOverride } from "./ensureOverride.js";

/** Пересобирает override для даты заново из шаблона расписания. */
export async function resetToSchedule(dateKey) {
  const ov = await ensureOverride(dateKey);
  const schedule = await scheduleRepo.load();
  ov.resetFromSchedule(schedule, dateKey);
  await overrideRepo.save(dateKey, ov);
}
