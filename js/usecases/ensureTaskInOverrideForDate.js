import {
  loadDayOverride,
  saveDayOverride,
  loadSchedule
} from "../data/repo.js";

/**
 * ensureTaskInOverrideForDate
 *
 * Цель:
 *  - Гарантировать, что override (снимок задач) для конкретной даты существует в памяти (ov)
 *  - Гарантировать, что в этом override есть задача с нужным taskId
 *
 * Очень важно понять:
 *  - Эта функция не просто "читает". Она готовит override к редактированию.
 *  - Она МОЖЕТ создать новый override в памяти (ov),
 *    но она НЕ сохраняет его сразу в хранилище.
 *    Сохранение делает вызывающий usecase после фактического изменения.
 *
 * Поведение:
 *  1. Если override уже есть → ок.
 *  2. Если override нет → создаём новый объект ov на основе расписания
 *     (берём задачи "на завтра" как основу), со сброшенными donePercent=0.
 *  3. Если в ov нет задачи с таким taskId →
 *     - ищем её в расписании недели
 *     - копируем и добавляем
 *  4. Возвращаем { ov, task } (task — это ссылка на задачу внутри ov),
 *     чтобы вызывающий код мог менять её и потом вызвать saveDayOverride().
 *
 * Это вызывается, например, в:
 *  - adjustTaskPercentForDate
 *  - toggleTaskDoneForDate
 *  - editTaskInline
 */
export default async function ensureTaskInOverrideForDate(dateKey, taskId) {
  // Загружаем override этой даты, если есть.
  let ov = await loadDayOverride(dateKey);

  // Функция-помощник: получаем weekday строки вида "YYYY-MM-DD"
  function weekdayKeyFromDateKey(dk) {
    const [y, m, d] = String(dk).split("-");
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const map = [
      "sunday",    // 0
      "monday",    // 1
      "tuesday",   // 2
      "wednesday", // 3
      "thursday",  // 4
      "friday",    // 5
      "saturday"   // 6
    ];
    return map[dateObj.getDay()] || "monday";
  }

  function addDaysToDateKey(dk, n) {
    const [y, m, d] = String(dk).split("-");
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    dateObj.setDate(dateObj.getDate() + Number(n || 0));
    const yy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  // Если override ещё нет — создаём базу "с нуля" из расписания.
  if (!ov) {
    const sched = await loadSchedule();

    // Базовая логика:
    // для дня dateKey берём задачи "на завтра".
    const tomorrowKey = addDaysToDateKey(dateKey, 1);
    const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey);

    const baseArr = Array.isArray(sched[wdTomorrow]) ? sched[wdTomorrow] : [];

    ov = {
      dateKey,
      tasks: baseArr.map(t => ({
        id: String(t.id || ""),
        title: String(t.title || "Без названия"),
        minutes: Number(t.minutes) || 0,
        donePercent: 0,
        done: false,
        meta: t.meta || null
        // offloadDays в override не храним
      })),
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAction: "ensureTaskInOverrideForDate:init",
        deviceId: null
      }
    };
  }

  // Проверяем, есть ли уже задача с taskId
  let task = ov.tasks.find(t => String(t.id) === String(taskId));

  if (!task) {
    // не нашли — надо поискать в расписании недели и добавить
    const sched = await loadSchedule();

    // Перебираем все дни расписания недели в поисках задачи
    outer: {
      for (const weekdayKey of Object.keys(sched || {})) {
        const dayTasks = Array.isArray(sched[weekdayKey])
          ? sched[weekdayKey]
          : [];
        for (const t of dayTasks) {
          if (String(t.id) === String(taskId)) {
            // нашли задачу в расписании → клонируем в override
            const newTask = {
              id: String(t.id || ""),
              title: String(t.title || "Без названия"),
              minutes: Number(t.minutes) || 0,
              donePercent: 0,
              done: false,
              meta: t.meta || null
            };
            ov.tasks.push(newTask);
            task = newTask;
            break outer;
          }
        }
      }
    }
  }

  // Простая страховка: если всё равно нет task — создадим заглушку
  if (!task) {
    const fallbackTask = {
      id: String(taskId),
      title: "Задача",
      minutes: 0,
      donePercent: 0,
      done: false,
      meta: null
    };
    ov.tasks.push(fallbackTask);
    task = fallbackTask;
  }

  // Мы НЕ сохраняем ov здесь.
  // Сохранение делает вызывающий код, когда он реально меняет задачу.
  //
  // Это важно, чтобы простое ОТКРЫТИЕ дня не засоряло хранилище.
  ov.meta = {
    ...ov.meta,
    updatedAt: new Date().toISOString()
  };

  return { ov, task };
}