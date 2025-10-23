// js/domain/entities.js
// Исправленные классы Task и DayOverride (клиппинг и строковый dateKey)

export class Task {
  constructor({ id, title, minutes = 0, done = false, progress = 0 } = {}) {
    this.id = String(id ?? "");
    this.title = String(title ?? "");
    this.minutes = Math.max(0, Number(minutes) || 0);
    this.done = !!done;
    this.progress = Math.min(this.minutes, Math.max(0, Number(progress) || 0));
  }
  increaseProgress(n = 0) {
    this.progress = Math.min(this.minutes, this.progress + (Number(n) || 0));
  }
  decreaseProgress(n = 0) {
    this.progress = Math.max(0, this.progress - (Number(n) || 0));
  }
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      minutes: this.minutes,
      done: this.done,
      progress: this.progress
    };
  }
  static fromJSON(j = {}) { return new Task(j); }
}

export class Schedule {
  constructor(obj = {}) {
    const blank = {
      monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
    };
    for (const k of Object.keys(blank)) {
      this[k] = Array.isArray(obj[k]) ? obj[k] : [];
    }
  }
  toJSON() {
    const out = {};
    for (const k of ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]) {
      out[k] = Array.isArray(this[k]) ? this[k] : [];
    }
    return out;
  }
  static fromJSON(j = {}) { return new Schedule(j); }
}

export class DayOverride {
  constructor({ dateKey, tasks = [] } = {}) {
    this.dateKey = String(dateKey ?? "");
    this.tasks   = Array.isArray(tasks) ? tasks : [];
  }
  toJSON() { return { dateKey: this.dateKey, tasks: this.tasks }; }
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
