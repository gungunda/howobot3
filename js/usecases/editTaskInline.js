import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

/**
 * editTaskInline
 *
 * Меняем заголовок и минуты задачи на КОНКРЕТНЫЙ ДЕНЬ,
 * когда пользователь нажал ✎ на дашборде и отредактировал поля.
 *
 * Это НЕ меняет расписание недели! Только конкретный снимок (override) даты.
 *
 * Аргументы:
 *  - dateKey: "2025-10-27"
 *  - taskId: "math1"
 *  - patch: { title?:string, minutes?:number }
 */
export async function editTaskInline({ dateKey, taskId, patch }) {
  const { ov, task } = await ensureTaskInOverrideForDate(dateKey, taskId);

  // обновляем task локально
  if (patch.title !== undefined) {
    task.title = String(patch.title || "").trim() || "Без названия";
  }

  if (patch.minutes !== undefined) {
    let mins = Number(patch.minutes) || 0;
    if (mins < 0) mins = 0;
    task.minutes = mins;
  }

  // применяем на список
  ov.tasks = ov.tasks.map(t => {
    if (String(t.id) === String(taskId)) {
      return {
        ...t,
        title: task.title,
        minutes: task.minutes
      };
    }
    return t;
  });

  await saveDayOverride(ov, "editTaskInline");
  return { taskId, title: task.title, minutes: task.minutes };
}

export default editTaskInline;