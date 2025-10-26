// js/usecases/editTaskInSchedule.js
// Правка задачи прямо в недельном расписании.
import { loadSchedule, saveSchedule } from "../data/repo.js";

export default async function editTaskInSchedule({ weekdayKey, taskId, patch }){
  const sched = await loadSchedule();
  const arr = Array.isArray(sched[weekdayKey]) ? sched[weekdayKey] : [];
  const t = arr.find(x => String(x.id||"") === String(taskId||""));
  if (t && patch){
    if (typeof patch.title==="string") t.title = patch.title;
    if (
      typeof patch.minutes==="number" &&
      !Number.isNaN(patch.minutes) &&
      patch.minutes>=0
    ){
      t.minutes = patch.minutes;
    }
    if (Array.isArray(patch.offloadDays)){
      t.offloadDays = [...patch.offloadDays];
    }
  }
  await saveSchedule(sched, "editTaskInSchedule");
  return sched;
}
