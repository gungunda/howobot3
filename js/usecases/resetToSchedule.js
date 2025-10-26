// js/usecases/resetToSchedule.js
// Перезаписать день заново из расписания (сброс прогресса).
import ensureOverrideForDate from "./ensureOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function resetToSchedule(dateKey){
  const ov = await ensureOverrideForDate(dateKey);
  // ensureOverrideForDate уже создаёт день из шаблона с 0%,
  // так что просто пересохраняем его с actionHint.
  await saveDayOverride(ov, "resetToSchedule");
  return ov;
}
