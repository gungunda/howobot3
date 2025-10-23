"use strict";

import { DeviceId } from "./id.js";

/**
 * Простые сущности: Meta, Task, Schedule, DayOverride, плюс утилита DateKey.
 * Это чистая логика: здесь нет DOM, localStorage или Telegram API.
 */

export class Meta {
  constructor({ updatedAt = null, deviceId = null, deletedAt = null } = {}) {
    this.updatedAt = updatedAt || new Date().toISOString();
    this.deviceId  = deviceId ?? DeviceId.get();
    this.deletedAt = deletedAt || null;
  }
  markUpdated() { this.updatedAt = new Date().toISOString(); this.deviceId = DeviceId.get(); }
  markDeleted() { this.deletedAt = new Date().toISOString(); this.deviceId = DeviceId.get(); }
  isDeleted()   { return Boolean(this.deletedAt); }
}

const WEEKDAYS_MON_FIRST = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const DateKey = {
  fromDate(d) { return d.toISOString().slice(0, 10); },        // "YYYY-MM-DD"
  toUTCDate(s){ return new Date(s + "T00:00:00Z"); },
  weekdayIndexMonFirst(s) {
    const js = this.toUTCDate(s).getUTCDay(); // Вс=0..Сб=6
    return (js + 6) % 7;                      // Пн=0..Вс=6
  },
  weekdayNameMonFirst(s) { return WEEKDAYS_MON_FIRST[this.weekdayIndexMonFirst(s)]; }
};

export class Task {
  constructor({ id, title, minutes, progress = 0, closed = false, unloadDays = [], meta = new Meta() }) {
    this.id = id;
    this.title = title;
    this.minutes = minutes;
    this.progress = progress;
    this.closed = closed;
    this.unloadDays = Array.isArray(unloadDays) ? unloadDays : [];
    this.meta = meta;
  }
  rename(newTitle){ this.title = String(newTitle); this.meta.markUpdated(); }
  setPlannedMinutes(min){ this.minutes = Number(min); this.meta.markUpdated(); }
  increaseProgress(delta){ this.progress = Math.min(100, this.progress + delta); if (this.progress===100) this.closed=true; this.meta.markUpdated(); }
  decreaseProgress(delta){ this.progress = Math.max(0, this.progress - delta); if (this.progress<100) this.closed=false; this.meta.markUpdated(); }
  clone() { return new Task({ id:this.id, title:this.title, minutes:this.minutes, progress:this.progress, closed:this.closed, unloadDays:[...this.unloadDays], meta:new Meta({ updatedAt:this.meta.updatedAt, deviceId:this.meta.deviceId, deletedAt:this.meta.deletedAt }) }); }
}

export class Schedule {
  constructor({ byWeekday = {}, meta = new Meta() } = {}) {
    this.byWeekday = byWeekday;
    this.meta = meta;
  }
  getTasks(weekday){ return this.byWeekday[weekday] || []; }
  setTasks(weekday, tasks){ this.byWeekday[weekday] = tasks; this.meta.markUpdated(); }
  addTaskToDay(weekday, task){ const list = this.byWeekday[weekday] || (this.byWeekday[weekday] = []); list.push(task); this.meta.markUpdated(); }
  removeTaskFromDay(weekday, taskId){ const list = this.byWeekday[weekday] || []; this.byWeekday[weekday] = list.filter(t => t.id !== taskId); this.meta.markUpdated(); }
  buildOverrideForDate(dateKey){
    const weekday = DateKey.weekdayNameMonFirst(dateKey);
    const clones  = this.getTasks(weekday).map(t => t.clone());
    return new DayOverride({ date: dateKey, tasks: clones, meta: new Meta() });
  }
}

export class DayOverride {
  constructor({ date, tasks = [], meta = new Meta() }) {
    this.date = date;
    this.tasks = tasks;
    this.meta = meta;
  }
  findTask(taskId){ return this.tasks.find(t => t.id === taskId) || null; }
  addTask(task){ this.tasks.push(task); this.meta.markUpdated(); }
  removeTask(taskId){ this.tasks = this.tasks.filter(t => t.id !== taskId); this.meta.markUpdated(); }
  editTask(taskId, changes){
    const t = this.findTask(taskId);
    if (!t) return;
    if (changes.title   != null) t.rename(changes.title);
    if (changes.minutes != null) t.setPlannedMinutes(changes.minutes);
    if (changes.progressDelta != null) {
      changes.progressDelta > 0 ? t.increaseProgress(changes.progressDelta) : t.decreaseProgress(Math.abs(changes.progressDelta));
    }
    if (changes.closed === true)  { t.progress = 100; t.closed = true;  t.meta.markUpdated(); }
    if (changes.closed === false) { t.closed   = false;                 t.meta.markUpdated(); }
    this.meta.markUpdated();
  }
  clearTasks(){ this.tasks = []; this.meta.markUpdated(); }
  resetFromSchedule(schedule, dateKey){
    const weekday = DateKey.weekdayNameMonFirst(dateKey);
    const clones  = (schedule.getTasks(weekday) || []).map(t => t.clone());
    this.tasks = clones; this.meta.markUpdated();
  }
  isEmpty(){ return this.tasks.length === 0; }
}
