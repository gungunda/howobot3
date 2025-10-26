// js/domain/entities.js
// Task — одна учебная задача (предмет с работой на день).
// Основная метрика прогресса — donePercent (0..100).

export class Task {
  constructor({ id, title, minutes = 0, done = false, donePercent = 0, meta = null } = {}) {
    this.id = String(id ?? "");
    this.title = String(title ?? "");
    this.minutes = Math.max(0, Number(minutes) || 0);

    // donePercent — сколько процентов выполнено (0..100)
    const pct = Math.round(Number(donePercent) || 0);
    this.donePercent = Math.max(0, Math.min(100, pct));

    // done — флаг "задача закрыта". Если 100%, то done = true.
    this.done = !!(done || this.donePercent >= 100);

    // meta — служебные метаданные ("кто правил", "когда", "что сделал")
    this.meta = meta && typeof meta === "object" ? meta : null;
  }

  // Установить прогресс напрямую
  setDonePercent(p) {
    const pct = Math.round(Number(p) || 0);
    this.donePercent = Math.max(0, Math.min(100, pct));
    this.done = this.donePercent >= 100;
  }

  // Увеличить прогресс, например +10%
  increasePercent(delta = 0) {
    this.setDonePercent(this.donePercent + (Number(delta) || 0));
  }

  // Уменьшить прогресс, например -10%
  decreasePercent(delta = 0) {
    this.setDonePercent(this.donePercent - (Number(delta) || 0));
  }

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

  static fromJSON(j = {}) {
    return new Task(j);
  }
}

export class Schedule {
  constructor(obj = {}) {
    const blank = {
      monday: [], tuesday: [], wednesday: [],
      thursday: [], friday: [], saturday: [], sunday: []
    };
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
  constructor({ dateKey, tasks = [], meta = null } = {}) {
    this.dateKey = String(dateKey ?? "");
    this.tasks   = Array.isArray(tasks)
      ? tasks.map(t => (typeof t === "object" ? new Task(t) : t))
      : [];

    // meta для всего дня: кто правил этот день, когда, что делал
    this.meta    = meta && typeof meta === "object" ? meta : null;
  }

  toJSON() {
    return {
      dateKey: this.dateKey,
      tasks: this.tasks.map(t => (t?.toJSON ? t.toJSON() : t)),
      meta: this.meta
    };
  }

  static fromJSON(j = {}) { return new DayOverride(j); }
}

// Meta — служебные данные, которые помогают синхронизации и отладке:
// - когда объект создавался,
// - когда редактировался,
// - с какого устройства редактировали,
// - что за действие было,
// - и был ли объект помечен как удалённый.
export class Meta {
  constructor({
    version = "1.0",
    createdAt = null,
    updatedAt = null,
    deviceId = null,
    deletedAt = null,
    userAction = null
  } = {}) {
    const now = new Date().toISOString();

    this.version    = String(version || "1.0");
    this.createdAt  = createdAt || now;
    this.updatedAt  = updatedAt || this.createdAt;

    // кто правил
    this.deviceId   = deviceId || null;

    // пометка удаления (tombstone)
    this.deletedAt  = deletedAt || null;

    // что за действие делали: "edit", "progress++", "toggleDone", ...
    this.userAction = userAction || null;
  }

  // Обновляем метку "когда и кем тронули".
  // Это вызывается перед сохранением.
  touch({ deviceId, action } = {}) {
    const now = new Date().toISOString();
    this.updatedAt = now;
    if (deviceId) {
      this.deviceId = String(deviceId);
    }
    if (action) {
      this.userAction = String(action);
    }
  }

  // Помечаем объект как удалённый (tombstone).
  markDeleted({ deviceId } = {}) {
    const now = new Date().toISOString();
    this.deletedAt = now;
    this.updatedAt = now;
    if (deviceId) {
      this.deviceId = String(deviceId);
    }
    this.userAction = "delete";
  }

  toJSON() {
    return {
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deviceId: this.deviceId,
      deletedAt: this.deletedAt,
      userAction: this.userAction
    };
  }

  static fromJSON(j = {}) {
    return new Meta(j);
  }
}

// ensureAndTouchMeta(metaLike, { deviceId, action })
// Эта функция гарантирует, что у объекта есть meta,
// и обновляет её полями "кто правил", "какое действие", "когда".
// Она будет вызываться в smart-репозиториях перед сохранением.
export function ensureAndTouchMeta(anyMeta, { deviceId, action } = {}) {
  const meta = anyMeta instanceof Meta ? anyMeta : new Meta(anyMeta || {});
  meta.touch({ deviceId, action });
  return meta;
}

export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
