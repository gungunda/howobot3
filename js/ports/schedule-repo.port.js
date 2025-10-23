"use strict";
/** Контракт репозитория расписания (интерфейс). */
export class ScheduleRepositoryPort {
  /** @returns {Promise<import('../domain/entities.js').Schedule>} */
  async load(){ throw new Error("ScheduleRepositoryPort.load not implemented"); }
  /** @param {import('../domain/entities.js').Schedule} schedule */
  async save(_schedule){ throw new Error("ScheduleRepositoryPort.save not implemented"); }
}
