// js/usecases/getTasksForDate.js
// Вернуть список задач на конкретную дату.
// Логика простая: берём override дня. Если нет — ensureOverrideForDate создаст.

import ensureOverrideForDate from "./ensureOverrideForDate.js";

export async function getTasksForDate(dateKey) {
  const ov = await ensureOverrideForDate(dateKey);
  return Array.isArray(ov.tasks) ? ov.tasks : [];
}

export default getTasksForDate;
