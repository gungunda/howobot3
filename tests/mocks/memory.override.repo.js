export class MemoryOverrideRepository {
  constructor() { this._map = {}; }
  async load(dateKey) { return this._map[dateKey] ? structuredClone(this._map[dateKey]) : null; }
  async save(dateKey, override) { this._map[dateKey] = structuredClone(override); }
  async listAll() { return structuredClone(this._map); }
  async ensure(dateKey) {
    if (!this._map[dateKey]) {
      this._map[dateKey] = { date: dateKey, tasks: [], meta: { updatedAt: new Date().toISOString() } };
    }
    return structuredClone(this._map[dateKey]);
  }
}
