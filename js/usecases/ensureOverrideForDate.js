// js/usecases/ensureOverrideForDate.js
function addDaysToDateKey(dateKey, days){
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + Number(days||0));
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function weekdayKeyFromDateKey(dateKey){
  const d = new Date(`${dateKey}T00:00:00`);
  const map=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[d.getDay()] || 'monday';
}
function normTask(t){
  return {
    id: String(t.id||""),
    title: String(t.title||""),
    minutes: Math.max(0, Number(t.minutes)||0),
    donePercent: 0,
    done: false,
    ...(t.meta ? { meta: t.meta } : {}),
  };
}
export default async function ensureOverrideForDate(dateKey){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const schRepo = await import("../adapters/smart/smart.schedule.repo.js");
  const loadOv = ovRepo.loadOverride || ovRepo.load;
  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const loadS  = schRepo.loadSchedule || schRepo.load;

  let ov = await loadOv(dateKey);
  if (ov && Array.isArray(ov.tasks) && ov.tasks.length) return ov;

  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const wd = weekdayKeyFromDateKey(nextDateKey);
  const s = await loadS();
  const src = Array.isArray(s?.[wd]) ? s[wd] : [];
  ov = { dateKey, tasks: src.map(normTask) };
  await saveOv(ov);
  return ov;
}
