// js/usecases/editTaskInline.js
// Редактирование задачи для КОНКРЕТНОЙ ДАТЫ.
// Мы правим только override дня, не глобальное расписание.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export async function editTaskInline({ dateKey, taskId, patch }) {
  if (!dateKey || !taskId) return;

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  if (patch) {
    if (typeof patch.title === "string") {
      task.title = patch.title;
    }

    if (
      typeof patch.minutes === "number" &&
      !Number.isNaN(patch.minutes) &&
      patch.minutes >= 0
    ) {
      task.minutes = patch.minutes;
    }
  }

  await saveDayOverride(ov, "editTaskInline");
}

export default editTaskInline;
