// js/usecases/getTasksForDate.js
// D+1 логика: для даты D показываем таски из шаблона недели на D+1 (завтра),
// если на D нет override. Если override на D есть — берём его.

function addDaysToDateKey(dateKey, days){
  // dateKey в формате YYYY-MM-DD
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + Number(days||0));
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function weekdayKeyFromDateKey(dateKey){
  const d = new Date(`${dateKey}T00:00:00`);
  const map=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[d.getDay()] || 'monday';
}

export default async function getTasksForDate({ dateKey }){
  // 1) если есть override на D — берём его
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const loadOv = ovRepo.loadOverride || ovRepo.load;
  const ov = await loadOv(dateKey);
  if (ov && Array.isArray(ov.tasks) && ov.tasks.length){
    return ov.tasks.map(t => ({
      ...t,
      donePercent: Math.max(0, Math.min(100, Math.round(Number(t.donePercent)||0))),
      done: typeof t.done === "boolean" ? t.done : ((Number(t.donePercent)||0) >= 100),
    }));
  }

  // 2) иначе берём из шаблона недели по дню D+1
  const schRepo = await import("../adapters/smart/smart.schedule.repo.js");
  const loadS  = schRepo.loadSchedule || schRepo.load;
  const s = await loadS();
  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const wd = weekdayKeyFromDateKey(nextDateKey); // завтра

  const src = Array.isArray(s?.[wd]) ? s[wd] : [];
  return src.map(t => ({
    id: String(t.id||""),
    title: String(t.title||""),
    minutes: Math.max(0, Number(t.minutes)||0),
    donePercent: 0,
    done: false,
  }));
}
