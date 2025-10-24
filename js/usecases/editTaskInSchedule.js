// js/usecases/editTaskInSchedule.js
// Обновляет существующую задачу в расписании недели.
// Это вызывается из инлайн-редактора (view-week.js), когда нажимаем "Сохранить".
//
// Важно:
//  - Task в расписании имеет поля { id, title, minutes, offloadDays: [...] }.
//  - Мы не должны терять offloadDays при сохранении.
//  - patch может содержать title, minutes, offloadDays.
//
// Алгоритм:
//   1. loadSchedule()
//   2. найти нужный день недели (weekday)
//   3. найти нужный taskId и слить старые и новые поля
//   4. saveSchedule()

import { loadSchedule, saveSchedule } from "../adapters/smart/smart.schedule.repo.js";

export default async function editTaskInSchedule({ weekday, taskId, patch }) {
  // 1. загружаем расписание из LocalStorage
  const schedule = await loadSchedule();

  // 2. берём массив задач конкретного дня недели
  const dayArr = Array.isArray(schedule[weekday]) ? schedule[weekday] : [];

  // 3. создаём новый массив, где одна задача обновлена
  const newDayArr = dayArr.map(task => {
    if (String(task.id) === String(taskId)) {
      // не пересобираем задачу с нуля, а аккуратно накладываем patch
      const updated = { ...task };

      if (patch.title !== undefined) {
        updated.title = patch.title;
      }
      if (patch.minutes !== undefined) {
        updated.minutes = Math.max(0, Number(patch.minutes) || 0);
      }
      if (patch.offloadDays !== undefined) {
        // offloadDays в расписании — это массив строк дней недели,
        // например ["tuesday","thursday"]
        updated.offloadDays = Array.isArray(patch.offloadDays)
          ? [...patch.offloadDays]
          : [];
      }

      return updated;
    }
    return task;
  });

  // 4. кладём новый массив обратно и сохраняем всё расписание
  schedule[weekday] = newDayArr;

  await saveSchedule(schedule);

  return schedule;
}
