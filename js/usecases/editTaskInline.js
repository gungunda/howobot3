// js/usecases/editTaskInline.js
// -----------------------------------------------------------------------------
// Редактирование задачи для КОНКРЕТНОЙ ДАТЫ (override).
//
// Это не изменение расписания недели "навсегда".
// Это правка локальной копии задачи на конкретную дату.
//
// Вызов из UI (см. events.js):
//   editTaskInline({
//     dateKey: <дата, в чей override надо писать>,
//     taskId: <ID задачи>,
//     patch: { title: "...", minutes: 45 }
//   })
//
// Алгоритм:
//   1. ensureTaskInOverrideForDate({ dateKey, taskId })
//      - гарантирует, что для этой даты уже есть override в LocalStorage,
//        и что внутри него есть задача с таким taskId.
//        Если задачи не было — она клонируется из расписания, прогресс = 0.
//      - возвращает { ov, task }
//   2. Меняем в task поля из patch (title, minutes).
//   3. Сохраняем весь ov обратно через saveOverride(ov).
//
// Важно для понимания (уровень junior):
// override — это «снимок задач на конкретный день», который живёт в
// localStorage.planner.overrides[dateKey]. Мы правим только этот снимок,
// не ломая глобальное расписание недели.
//

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";

export async function editTaskInline({ dateKey, taskId, patch }) {
  if (!dateKey || !taskId) {
    return;
  }

  // 1. Убедиться, что override и задача внутри него существуют
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  // 2. Обновляем данные задачи
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

  // 3. Сохраняем override обратно
  await saveOv(ov);
}

// Оставляем default для совместимости с кодом, который вызывает
// m.default || m.editTaskInline
export default editTaskInline;
