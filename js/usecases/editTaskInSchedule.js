import { loadSchedule, saveSchedule } from "../data/repo.js";

/**
 * editTaskInSchedule
 *
 * Меняем задачу в недельном расписании (экран "Расписание недели").
 * Это влияет на будущее, но не переписывает прошедшие override-дни.
 *
 * Аргументы:
 *  - weekday: "monday"
 *  - taskId: "math1"
 *  - patch: {
 *      title?: string,
 *      minutes?: number,
 *      offloadDays?: string[]
 *    }
 */
export async function editTaskInSchedule({ weekday, taskId, patch }) {
  const sched = await loadSchedule();

  let dayArr = Array.isArray(sched[weekday]) ? sched[weekday] : [];
  dayArr = dayArr.map(task => {
    if (String(task.id) !== String(taskId)) return task;

    const updated = { ...task };

    if (patch.title !== undefined) {
      updated.title = String(patch.title || "").trim() || "Без названия";
    }

    if (patch.minutes !== undefined) {
      let mins = Number(patch.minutes) || 0;
      if (mins < 0) mins = 0;
      updated.minutes = mins;
    }

    if (patch.offloadDays !== undefined) {
      updated.offloadDays = Array.isArray(patch.offloadDays)
        ? [...patch.offloadDays]
        : [];
    }

    return updated;
  });

  sched[weekday] = dayArr;
  await saveSchedule(sched, "editTaskInSchedule");
  return true;
}

export default editTaskInSchedule;