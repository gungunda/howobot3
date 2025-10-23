// js/domain/entities.js
// Task без устаревшего поля progress. Основная метрика — donePercent (0..100).

export class Task {
  constructor({ id, title, minutes = 0, done = false, donePercent = 0, meta = null } = {}) {
    this.id = String(id ?? "");
    this.title = String(title ?? "");
    this.minutes = Math.max(0, Number(minutes) || 0);
    // Проценты — главный индикатор
    this.donePercent = Math.max(0, Math.min(100, Math.round(Number(donePercent) || 0)));
    this.done = !!(done || this.donePercent >= 100);
    this.meta = meta && typeof meta === "object" ? meta : null;
  }
  setDonePercent(p) {
    this.donePercent = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
    this.done = this.donePercent >= 100;
  }
  increasePercent(delta = 0) { this.setDonePercent(this.donePercent + (Number(delta) || 0)); }
  decreasePercent(delta = 0) { this.setDonePercent(this.donePercent - (Number(delta) || 0)); }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      minutes: this.minutes,
      done: this.done,
      donePercent: this.donePercent,
      meta: this.meta
    };
  }
  static fromJSON(j = {}) { return new Task(j); }
}

export class Schedule {
  constructor(obj = {}) {
    const blank = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
    const src = obj || {};
    for (const k of Object.keys(blank)) {
      const arr = Array.isArray(src[k]) ? src[k] : [];
      this[k] = arr.map(t => (typeof t === "object" ? new Task(t) : t));
    }
  }
  toJSON() {
    const out = {};
    for (const k of ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]) {
      out[k] = (this[k] || []).map(t => (typeof t?.toJSON === "function" ? t.toJSON() : t));
    }
    return out;
  }
  static fromJSON(j = {}) { return new Schedule(j); }
}

export class DayOverride {
  constructor({ dateKey, tasks = [] } = {}) {
    this.dateKey = String(dateKey ?? "");
    this.tasks   = Array.isArray(tasks) ? tasks.map(t => (typeof t === "object" ? new Task(t) : t)) : [];
  }
  toJSON() { return { dateKey: this.dateKey, tasks: this.tasks.map(t => (t?.toJSON ? t.toJSON() : t)) }; }
  static fromJSON(j = {}) { return new DayOverride(j); }
}

export class Meta {
  constructor({ version = "1.0", createdAt = null, updatedAt = null } = {}) {
    this.version = String(version || "1.0");
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;
  }
  toJSON() { return { version: this.version, createdAt: this.createdAt, updatedAt: this.updatedAt }; }
  static fromJSON(j = {}) { return new Meta(j); }
}

export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
