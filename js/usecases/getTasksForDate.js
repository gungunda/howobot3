// js/usecases/getTasksForDate.js
import ensureOverrideForDate from "./ensureOverrideForDate.js";
export async function getTasksForDate(dateKey) {
  const ov = await ensureOverrideForDate(dateKey);
  return Array.isArray(ov.tasks) ? ov.tasks : [];
}
export default getTasksForDate;
