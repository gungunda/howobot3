import forceCreateOverrideFromSchedule from "./forceCreateOverrideFromSchedule.js";

/**
 * resetToSchedule
 *
 * Сценарий кнопки "Сбросить день" на дашборде.
 *
 * Что делаем:
 *  - Жёстко пересоздаём override для dateKey на основе расписания ("на завтра"),
 *    с обнулёнными прогрессами.
 *  - Сразу сохраняем.
 *
 * Это ИМЕННО та ситуация, когда мы разрешаем насильно перезаписать override.
 * То есть здесь "создать override" — ок, потому что это явное действие пользователя.
 */
export default async function resetToSchedule({ dateKey }) {
  const ov = await forceCreateOverrideFromSchedule(dateKey);
  return ov;
}