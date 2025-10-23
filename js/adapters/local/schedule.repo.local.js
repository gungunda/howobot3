"use strict";
import { Schedule } from "../../domain/entities.js";
import { ScheduleRepositoryPort } from "../../ports/schedule-repo.port.js";

const KEY = "study.weekTemplate:v2";

class LocalScheduleRepo extends ScheduleRepositoryPort {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return new Schedule();
      const data = JSON.parse(raw);
      return new Schedule(data);
    } catch (e) {
      console.warn("[planner] schedule.load error", e);
      return new Schedule();
    }
  }
  async save(schedule) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ byWeekday: schedule.byWeekday, meta: schedule.meta }));
    } catch (e) {
      console.error("[planner] schedule.save error", e);
    }
  }
}

// Экспортируем singleton — его будут импортировать use cases через app.js
export const scheduleRepo = new LocalScheduleRepo();
