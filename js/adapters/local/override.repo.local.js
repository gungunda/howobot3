"use strict";
import { DayOverride } from "../../domain/entities.js";
import { OverrideRepositoryPort } from "../../ports/override-repo.port.js";

const KEY = "study.overridesByDate:v2";

function loadAllRaw() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch (_) { return {}; }
}
function saveAllRaw(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); }
  catch (e) { console.error("[planner] override.saveAll error", e); }
}

class LocalOverrideRepo extends OverrideRepositoryPort {
  async load(dateKey) {
    const all = loadAllRaw();
    const v = all[dateKey];
    return v ? new DayOverride(v) : null;
  }
  async save(dateKey, override) {
    const all = loadAllRaw();
    all[dateKey] = { date: override.date, tasks: override.tasks, meta: override.meta };
    saveAllRaw(all);
  }
  async listAll() { return loadAllRaw(); }
}

export const overrideRepo = new LocalOverrideRepo();
