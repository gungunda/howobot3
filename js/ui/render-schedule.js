// js/ui/render-schedule.js
// Убедимся, что data-dateKey всегда выставлен (сохранение handlers корректно читает дату).

import { clear } from "./helpers.js";
import { minutesToStr } from "../utils/format-utils.js";

export default function renderSchedule(root, { dateKey, tasks }){
  if(!root){
    root=document.getElementById("schedule");
    if(!root){
      const app=document.getElementById("app")||document.body;
      root=document.createElement("div");
      root.id="schedule";
      app.appendChild(root);
    }
  }
  clear(root);
  const wrap=document.createElement("div");
  wrap.className="section card schedule";
  root.appendChild(wrap);

  const header=document.createElement("div");
  header.className="schedule-header";
  header.innerHTML = `
    <div class="schedule-title">Домашняя работа ${dateKey}</div>
    <div class="schedule-actions">
      <button id="open-week-editor" type="button">Редактировать расписание</button>
      <button id="reset-day-btn" type="button">Сбросить день</button>
    </div>`;
  wrap.appendChild(header);

  const list=document.createElement("div");
  list.className="task-list";
  wrap.appendChild(list);

  if(!Array.isArray(tasks)||!tasks.length){
    const empty=document.createElement("div");
    empty.className="muted";
    empty.textContent="Нет задач";
    list.appendChild(empty);
    root.dataset.dateKey = dateKey || "";
    return root;
  }

  for(const t of tasks){
    const item=document.createElement("div");
    item.className="task-item";
    item.dataset.taskId = t.id ?? "";

    const left=document.createElement("div");
    left.style.display="flex"; left.style.alignItems="center"; left.style.gap="8px";

    const cb=document.createElement("input");
    cb.type="checkbox";
    cb.className="task-done";
    cb.checked=!!t.done || (t.donePercent>=100);

    const title=document.createElement("span");
    title.className="task-title";
    title.textContent = `(${t.donePercent||0}%) ${t.title || "Без названия"}`;

    left.appendChild(cb); left.appendChild(title);

    const right=document.createElement("div");
    right.className="task-controls";

    const minus=document.createElement("button");
    minus.className="task-pct-minus";
    minus.textContent="−10%";

    const plus=document.createElement("button");
    plus.className="task-pct-plus";
    plus.textContent="+10%";

    const time=document.createElement("span");
    time.className="badge";
    time.title="План";
    time.textContent = minutesToStr(t.minutes||0);

    const edit=document.createElement("button");
    edit.className="task-edit";
    edit.textContent="✎";

    right.append(minus,plus,time,edit);
    item.append(left,right);
    list.appendChild(item);
  }

  root.dataset.dateKey = dateKey || "";
  return root;
}
