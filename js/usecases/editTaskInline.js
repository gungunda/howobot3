// js/usecases/editTaskInline.js
// D+1-совместимая логика: редактирование на дату D клонирует задачу из шаблона недели D+1.
// Если в шаблоне не нашли — создаём минимальную задачу прямо в override, чтобы он не оставался пустым.

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

export default async function editTaskInline({ dateKey, taskId, patch }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const schRepo = await import("../adapters/smart/smart.schedule.repo.js");
  const loadOv = ovRepo.loadOverride || ovRepo.load;
  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const loadS  = schRepo.loadSchedule || schRepo.load;

  let ov = await loadOv(dateKey);
  if(!ov) ov = { dateKey, tasks: [] };
  if(!Array.isArray(ov.tasks)) ov.tasks = [];

  // 1) ищем уже отредактированную задачу в override
  let t = ov.tasks.find(x=>x.id===taskId);

  // 2) если нет — ищем в шаблоне Д+1
  if(!t){
    const nextDateKey = addDaysToDateKey(dateKey, 1);
    const wd = weekdayKeyFromDateKey(nextDateKey); // завтрашний weekday
    const s = await loadS();
    const src = (s?.[wd]||[]).find(x=>x.id===taskId);
    if (src) {
      t = { ...src };
      if (typeof t.donePercent !== 'number') t.donePercent = 0;
      t.done = t.donePercent >= 100;
      ov.tasks.push(t);
    }
  }

  // 3) если в шаблоне не нашли — создаём минимальную задачу прямо в override,
  //    чтобы override не оставался пустым. Используем данные из patch по возможности.
  if(!t){
    const base = {
      id: String(taskId || `task_${Date.now().toString(36)}`),
      title: (patch && patch.title) ? String(patch.title) : "Без названия",
      minutes: 0,
      donePercent: 0,
      done: false,
    };
    t = base;
    ov.tasks.push(t);
  }

  // 4) применяем patch и нормализуем
  Object.assign(t, patch || {});
  if (typeof t.donePercent === 'number') {
    t.donePercent = Math.max(0, Math.min(100, Math.round(t.donePercent)));
    t.done = t.donePercent >= 100;
  }

  await saveOv(ov);
  return ov.tasks;
}
