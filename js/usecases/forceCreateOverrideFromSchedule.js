import {
  loadDayOverride,
  loadSchedule,
  saveDayOverride
} from "../data/repo.js";

/**
 * forceCreateOverrideFromSchedule
 *
 * Это "жёсткий" сценарий.
 * Он нужен, когда пользователь САМ попросил пересобрать день,
 * например нажал "Сбросить день" в дашборде.
 *
 * Что делает:
 *  1. Строит override (снимок задач на день) С НУЛЯ, основываясь на расписании ("на завтра").
 *  2. Сразу сохраняет его в Storage (localStorage или Telegram CloudStorage).
 *
 * Чем отличается от ensureTaskInOverrideForDate:
 *  - ensureTaskInOverrideForDate НЕ сохраняет автоматически, и создаёт override
 *    только для редактирования конкретной задачи.
 *
 * ВАЖНО:
 * Эта функция не должна вызываться просто при просмотре дня.
 * Её можно вызывать только по явному действию пользователя.
 */
export default async function forceCreateOverrideFromSchedule(dateKey) {
  // Если override уже есть — просто вернём его.
  let ov = await loadDayOverride(dateKey);
  if (ov && Array.isArray(ov.tasks)) {
    return ov;
  }

  // хелперы
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

  const sched = await loadSchedule();

  // "на завтра"
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
    })),
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userAction: "forceCreateOverrideFromSchedule",
      deviceId: null
    }
  };

  await saveDayOverride(ov, "forceCreateOverrideFromSchedule");
  return ov;
}