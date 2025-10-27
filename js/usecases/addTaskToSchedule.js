import { loadSchedule, saveSchedule } from "../data/repo.js";

/**
 * addTaskToSchedule
 * Добавляет новую задачу в расписание недели (шаблон).
 *
 * Пояснение:
 * Расписание недели — это не конкретный день календаря,
 * а "модель по дням недели". Например:
 *   monday: [ { id, title, minutes, offloadDays[] }, ... ]
 *
 * Когда ученик потом открывает дашборд,
 * мы на его выбранный dateKey берём задачи "на завтра"
 * из расписания и создаём override.
 *
 * Здесь мы просто дописываем новую задачу в конкретный weekdayKey.
 */
export async function addTaskToSchedule({ weekdayKey, task }) {
  const sched = await loadSchedule();

  // убедимся, что там есть массив
  if (!Array.isArray(sched[weekdayKey])) {
    sched[weekdayKey] = [];
  }

  // генерим id (простая версия: timestamp + random)
  const newTask = {
    id: "task_" + Date.now().toString(36) + "_" + Math.floor(Math.random()*1e6),
    title: task.title || "Без названия",
    minutes: Number(task.minutes) || 0,
    offloadDays: Array.isArray(task.offloadDays) ? [...task.offloadDays] : [],
    donePercent: 0,
    done: false,
    meta: task.meta || null
  };

  sched[weekdayKey].push(newTask);

  await saveSchedule(sched, "addTaskToSchedule");
  return newTask;
}

export default addTaskToSchedule;