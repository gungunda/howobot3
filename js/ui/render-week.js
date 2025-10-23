// js/ui/render-week.js
// Рендер вкладки "Неделя"

import { clear } from "./helpers.js";
import { minutesToStr } from "../utils/format-utils.js";

export default function renderWeek(root, schedule){
  if(!root){
    root=document.getElementById("week");
    if(!root){
      const app=document.getElementById("app")||document.body;
      root=document.createElement("div");
      root.id="week";
      app.appendChild(root);
    }
  }
  clear(root);
  const wrap=document.createElement("div");
  wrap.className="section";
  root.appendChild(wrap);

  const daysOrder=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const daysRu={monday:"Пн",tuesday:"Вт",wednesday:"Ср",thursday:"Чт",friday:"Пт",saturday:"Сб",sunday:"Вс"};

  const container=document.createElement("div");
  container.className="week";
  wrap.appendChild(container);

  for(const d of daysOrder){
    const dayCard=document.createElement("div");
    dayCard.className="card week-day";
    dayCard.dataset.weekday=d;
    const head=document.createElement("div");
    head.className="day-head";
    const total=(schedule[d]||[]).reduce((a,b)=>a+(Number(b.minutes)||0),0);
    head.innerHTML = `<div><strong>${daysRu[d]}</strong></div><div class="day-total muted">${minutesToStr(total)}</div>`;
    dayCard.appendChild(head);

    for(const t of (schedule[d]||[])){
      const row=document.createElement("div");
      row.className="task-item";
      row.dataset.taskId=t.id;
      const left=document.createElement("div");
      left.className="task-title";
      left.textContent = `${t.title}`;
      const right=document.createElement("div");
      right.className="task-controls";
      const time=document.createElement("span");
      time.className="badge";
      time.textContent=minutesToStr(t.minutes||0);
      const edit=document.createElement("button");
      edit.className="week-edit";
      edit.textContent="✎";
      const del=document.createElement("button");
      del.className="week-del";
      del.textContent="🗑";
      right.append(time,edit,del);
      row.append(left,right);
      dayCard.appendChild(row);
    }

    const addBtn=document.createElement("button");
    addBtn.className="add-btn week-add";
    addBtn.textContent="+ Добавить задачу";
    dayCard.appendChild(addBtn);

    container.appendChild(dayCard);
  }
  return root;
}
