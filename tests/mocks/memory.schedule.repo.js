export class MemoryScheduleRepository {
  constructor() { this._state = { byWeekday: {}, meta: { updatedAt: new Date().toISOString() } }; }
  async load() { return structuredClone(this._state); }
  async save(schedule) { this._state = structuredClone(schedule); }
}
