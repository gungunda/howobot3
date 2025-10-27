import forceCreateOverrideFromSchedule from "./forceCreateOverrideFromSchedule.js";

/**
 * resetToSchedule
 *
 * Это сценарий для кнопки "Сбросить день".
 * Он просто вызывает forceCreateOverrideFromSchedule(dateKey).
 *
 * Почему у нас остаётся отдельный usecase resetToSchedule?
 * Потому что UI думает в терминах "сбросить день",
 * а домен думает в терминах "форс-создать override заново".
 *
 * Это читабельно для джуна:
 *   - resetToSchedule → читается из UI
 *   - forceCreateOverrideFromSchedule → доменная операция
 */
export default async function resetToSchedule({ dateKey }) {
  const ovEntity = await forceCreateOverrideFromSchedule(dateKey);
  return ovEntity;
}