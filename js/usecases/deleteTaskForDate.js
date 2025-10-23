"use strict";
import { overrideRepo } from "../app.js";
import { ensureOverride } from "./ensureOverride.js";

/** Удаляет задачу из override на указанную дату. */
export async function deleteTaskForDate(dateKey, taskId) {
  const ov = await ensureOverride(dateKey);
  ov.removeTask(taskId);
  await overrideRepo.save(dateKey, ov);
}
