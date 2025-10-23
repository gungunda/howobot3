"use strict";
import { overrideRepo } from "../app.js";
import { DayOverride, Meta } from "../domain/entities.js";

/** Гарантирует существование override для даты — если нет, создаёт пустой. */
export async function ensureOverride(dateKey) {
  let ov = await overrideRepo.load(dateKey);
  if (!ov) {
    ov = new DayOverride({ date: dateKey, tasks: [], meta: new Meta() });
    await overrideRepo.save(dateKey, ov);
  }
  return ov;
}
