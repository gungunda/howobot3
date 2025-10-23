// Подмена реального /js/app.js для тестов
// Экспортируем singletons, а также фасады schedule/overrides с нужными методами,
// т.к. use cases вызывают schedule.getTasks(...)

import { MemoryScheduleRepository } from "./memory.schedule.repo.js";
import { MemoryOverrideRepository } from "./memory.override.repo.js";

export const scheduleRepo = new MemoryScheduleRepository();
export const overrideRepo = new MemoryOverrideRepository();

// Фасад schedule с методом getTasks(weekday)
export const schedule = {
  async getTasks(weekday) {
    const s = await scheduleRepo.load();
    const arr = (s?.byWeekday && s.byWeekday[weekday]) ? s.byWeekday[weekday] : [];
    // отдаём клон, чтобы тесты не портили исходные данные
    return JSON.parse(JSON.stringify(arr));
  },
  async load() {
    return scheduleRepo.load();
  },
  async save(next) {
    return scheduleRepo.save(next);
  }
};

// Фасад overrides — минимальный API, который обычно нужен use cases
export const overrides = {
  async load(dateKey) {
    return overrideRepo.load(dateKey);
  },
  async save(dateKey, ov) {
    return overrideRepo.save(dateKey, ov);
  },
  async ensure(dateKey) {
    return overrideRepo.ensure(dateKey);
  }
};

// Начальные данные расписания для тестов
await scheduleRepo.save({
  byWeekday: {
    "Пн": [{ id: "math", title: "Математика", minutes: 40, progress: 0, closed: false, unloadDays: [], meta: { updatedAt: "2025-01-01T00:00:00Z" } }],
    "Вт": [],
    "Ср": [],
    "Чт": [],
    "Пт": [],
    "Сб": [],
    "Вс": []
  },
  meta: { updatedAt: "2025-01-01T00:00:00Z" }
});
