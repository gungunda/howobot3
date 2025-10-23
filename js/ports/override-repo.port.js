"use strict";
/** Контракт репозитория overrides по датам (интерфейс). */
export class OverrideRepositoryPort {
  /** @param {string} dateKey @returns {Promise<import('../domain/entities.js').DayOverride|null>} */
  async load(_dateKey){ throw new Error("OverrideRepositoryPort.load not implemented"); }
  /** @param {string} dateKey @param {import('../domain/entities.js').DayOverride} override */
  async save(_dateKey, _override){ throw new Error("OverrideRepositoryPort.save not implemented"); }
  /** @returns {Promise<Record<string, import('../domain/entities.js').DayOverride>>} */
  async listAll(){ throw new Error("OverrideRepositoryPort.listAll not implemented"); }
}
