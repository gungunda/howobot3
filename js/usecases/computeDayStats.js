"use strict";
import { getTasksForDate } from "./getTasksForDate.js";

/** Возвращает DTO статистики за день. */
export async function computeDayStats(dateKey) {
  const tasks = await getTasksForDate(dateKey);
  const tasksCount   = tasks.length;
  const closedCount  = tasks.filter(t => t.closed || t.progress === 100).length;
  const minutesPlanned = tasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const minutesDone    = tasks.reduce((s, t) => s + Math.round((t.minutes || 0) * (t.progress || 0) / 100), 0);
  const minutesLeft    = Math.max(0, minutesPlanned - minutesDone);
  const percentClosed  = tasksCount ? Math.round((closedCount / tasksCount) * 100) : 0;
  return { tasksCount, closedCount, percentClosed, minutesPlanned, minutesDone, minutesLeft };
}
