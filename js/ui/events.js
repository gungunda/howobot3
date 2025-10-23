// js/ui/events.js
// Усиливаем работу кнопки «Редактировать расписание»: гарантированный переход на вкладку «Неделя».

import { todayKey } from "./helpers.js";
import renderCalendar from "./render-calendar.js";
import renderSchedule from "./render-schedule.js";
import renderWeek from "./render-week.js";

async function computeStatsSafe(tasks){
  try{
    const mod = await import("../usecases/computeDayStats.js");
    const fn = mod.default || mod.computeDayStats || mod.run;
    if (typeof fn === "function") return await fn({ tasks });
  }catch(e){ /* noop */ }
  const totalTasks=(tasks||[]).length;
  return { totalTasks, totalMinutes:0, doneAvg:0, doneMinutes:0 };
}
async function updateStats(tasks){
  const s = await computeStatsSafe(tasks||[]);
  const total = document.getElementById("stat-total");
  const done  = document.getElementById("stat-done");
  const left  = document.getElementById("stat-left");
  if (total) total.textContent = `${Math.floor((s.totalMinutes||0)/60)} ч ${(s.totalMinutes||0)%60} мин`;
  if (done)  done.textContent  = `${s.doneAvg||0}%`;
  if (left)  left.textContent  = `${Math.floor(((s.totalMinutes-s.doneMinutes)||0)/60)} ч ${((s.totalMinutes-s.doneMinutes)||0)%60} мин`;
}

export async function switchToWeek(){
  // Обеспечиваем, что неделя отрисована
  const getSchedule=(await import("../usecases/getSchedule.js")).default;
  const s=await getSchedule();
  renderWeek(null, s);

  // Включаем вкладку «Неделя» и скрываем «День»
  const tabDay = document.getElementById("tab-day");
  const tabWeek = document.getElementById("tab-week");
  tabWeek?.classList.add("active");
  tabDay?.classList.remove("active");
  document.getElementById("schedule")?.classList.add("hidden");
  document.getElementById("week")?.classList.remove("hidden");
}

export function enableOpenWeekEditor(container=document){
  container.addEventListener("click", async (e)=>{
    const btn = e.target.closest("#open-week-editor");
    if(!btn) return;
    await switchToWeek();
  });
}

export function enableInlineEditing(container=document){
  container.addEventListener("click", async (e)=>{
    const btn=e.target.closest(".task-edit"); if(!btn) return;
    const item=btn.closest(".task-item"), list=btn.closest("#schedule");
    if(!item||!list) return;
    const taskId=item.dataset.taskId, dateKey=list.dataset.dateKey||list.getAttribute("data-date-key");
    const titleNode=item.querySelector(".task-title"); if(!titleNode) return;
    const prevText=titleNode.textContent||"";
    const input=document.createElement("input"); input.type="text"; input.className="task-title-edit"; input.value = prevText.replace(/^\(\d+\)%\s*/,'').trim();
    titleNode.replaceWith(input); input.focus(); input.select();

    const editInline=(await import("../usecases/editTaskInline.js")).default;
    const getTasks=(await import("../usecases/getTasksForDate.js")).default;

    async function refresh(){ const tasks=await getTasks({dateKey}); renderSchedule(null,{dateKey,tasks}); await updateStats(tasks); }
    async function commit(){ const title=input.value.trim(); try{ await editInline({dateKey,taskId,patch:{title}});}catch{} await refresh(); }
    input.addEventListener("keydown", ev=>{ if(ev.key==="Enter") commit(); if(ev.key==="Escape") refresh(); });
    input.addEventListener("blur", ()=>commit());
  });
}

export function enablePercentControls(container=document){
  container.addEventListener("click", async (e)=>{
    const plus=e.target.closest(".task-pct-plus"); const minus=e.target.closest(".task-pct-minus");
    if(!plus && !minus) return;
    const btn=plus||minus; const item=btn.closest(".task-item"); const list=btn.closest("#schedule");
    if(!item||!list) return;
    const dateKey=list.dataset.dateKey||list.getAttribute("data-date-key"); const taskId=item.dataset.taskId;
    const adjust=(await import("../usecases/adjustTaskPercentForDate.js")).default;
    const getTasks=(await import("../usecases/getTasksForDate.js")).default;
    try{ await adjust({dateKey,taskId,delta: plus?+10:-10}); }catch{}
    const tasks=await getTasks({dateKey}); renderSchedule(null,{dateKey,tasks}); await updateStats(tasks);
  });
}

export function enableDoneToggle(container=document){
  container.addEventListener("change", async (e)=>{
    const cb=e.target.closest(".task-done"); if(!cb) return;
    const item=cb.closest(".task-item"); const list=cb.closest("#schedule");
    if(!item||!list) return;
    const dateKey=list.dataset.dateKey||list.getAttribute("data-date-key"); const taskId=item.dataset.taskId;
    const toggle=(await import("../usecases/toggleTaskDoneForDate.js")).default;
    const getTasks=(await import("../usecases/getTasksForDate.js")).default;
    try{ await toggle({dateKey,taskId}); }catch{}
    const tasks=await getTasks({dateKey}); renderSchedule(null,{dateKey,tasks}); await updateStats(tasks);
  });
}

export function enableResetDay(container=document){
  container.addEventListener("click", async (e)=>{
    const btn=e.target.closest("#reset-day-btn"); if(!btn) return;
    const list=document.getElementById("schedule"); if(!list) return;
    const dateKey=list.dataset.dateKey||list.getAttribute("data-date-key");
    const reset=(await import("../usecases/resetToSchedule.js")).default;
    const getTasks=(await import("../usecases/getTasksForDate.js")).default;
    try{ await reset({dateKey}); }catch{}
    const tasks=await getTasks({dateKey}); renderSchedule(null,{dateKey,tasks}); await updateStats(tasks);
  });
}

export function enableWeekCrud(container=document){
  container.addEventListener("click", async (e)=>{
    const add=e.target.closest(".week-add");
    const edit=e.target.closest(".week-edit");
    const del =e.target.closest(".week-del");
    if(!add && !edit && !del) return;
    const dayCard=(add||edit||del).closest(".week-day"); const weekday=dayCard?.dataset.weekday;
    const getSchedule=(await import("../usecases/getSchedule.js")).default;
    const addUC=(await import("../usecases/addTaskToSchedule.js")).default;
    const editUC=(await import("../usecases/editTaskInSchedule.js")).default;
    const delUC=(await import("../usecases/deleteTaskFromSchedule.js")).default;

    if(add){
      const title=prompt("Название задачи","Новая задача")||"Новая задача";
      const minutes=Number(prompt("Минуты","30")||"30");
      await addUC({weekday, task:{title, minutes}});
    }
    if(edit){
      const row=edit.closest(".task-item"); const taskId=row?.dataset.taskId;
      const curTitle=row?.querySelector(".task-title")?.textContent?.trim()||"";
      const minutesBadge=row?.querySelector(".badge")?.textContent||"";
      const minutes=Number((minutesBadge.match(/(\d+)/)||[])[1]||"30");
      const title=prompt("Название", curTitle)||curTitle;
      const mins=Number(prompt("Минуты", String(minutes))||String(minutes));
      await editUC({weekday, taskId, patch:{ title, minutes: mins }});
    }
    if(del){
      const row=del.closest(".task-item"); const taskId=row?.dataset.taskId;
      if(confirm("Удалить задачу из шаблона?")) await delUC({weekday, taskId});
    }
    const s=await getSchedule(); renderWeek(null, s);
  });
}

export async function initUI(){
  const tabDay=document.getElementById("tab-day");
  const tabWeek=document.getElementById("tab-week");
  const dateInput=document.getElementById("date-input");
  const todayBtn=document.getElementById("today-btn");

  let current = todayKey();

  function setTab(name){
    if(name==="day"){
      tabDay?.classList.add("active"); tabWeek?.classList.remove("active");
      document.getElementById("week")?.classList.add("hidden");
      document.getElementById("schedule")?.classList.remove("hidden");
    } else {
      tabWeek?.classList.add("active"); tabDay?.classList.remove("active");
      document.getElementById("schedule")?.classList.add("hidden");
      document.getElementById("week")?.classList.remove("hidden");
    }
  }

  const getTasks=(await import("../usecases/getTasksForDate.js")).default;
  const getSchedule=(await import("../usecases/getSchedule.js")).default;

  async function renderDay(k){
    const tasks=await getTasks({dateKey:k});
    renderSchedule(null,{dateKey:k,tasks});
    await updateStats(tasks);
  }
  async function renderWeekView(){ const s=await getSchedule(); renderWeek(null,s); }

  renderCalendar(null, { dateKey: current, onChange: (k)=>{ current=k; dateInput.value=k; renderDay(k); } });
  dateInput.value=current;
  dateInput.addEventListener("change", ()=>{ current=dateInput.value; renderDay(current);});
  todayBtn.addEventListener("click", ()=>{ const d=todayKey(); current=d; dateInput.value=d; renderDay(d);} );

  enableInlineEditing(document);
  enablePercentControls(document);
  enableDoneToggle(document);
  enableResetDay(document);
  enableWeekCrud(document);
  enableOpenWeekEditor(document);

  await renderDay(current);
  await renderWeekView();
  setTab("day");

  tabDay.addEventListener("click", ()=> setTab("day"));
  tabWeek.addEventListener("click", ()=> setTab("week"));
}
