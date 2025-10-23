"use strict";
import { overrideRepo } from "../app.js";
import { ensureOverride } from "./ensureOverride.js";

/** Полностью очищает список задач дня, но override сохраняется (пустой). */
export async function clearAllTasksForDate(dateKey) {
  const ov = await ensureOverride(dateKey);
  ov.clearTasks();
  await overrideRepo.save(dateKey, ov);
}
