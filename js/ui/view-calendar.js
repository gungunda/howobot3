// js/ui/view-calendar.js
// Большой календарь месяца (7 колонок, 6 строк).
// Подсветка сегодняшней даты, выбранной даты.
// Листание месяцев через ← → в events.js.

import { todayKey } from "./helpers.js";

function dateFromKey(dateKey){
  return new Date(`${dateKey}T00:00:00`);
}
function keyFromDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function addDays(d, delta){
  const nd=new Date(d);
  nd.setDate(nd.getDate()+Number(delta||0));
  return nd;
}
function weekdayMonFirst(jsDay){
  // JS getDay(): 0=Вс..6=Сб
  // мы хотим 1=Пн..7=Вс
  return jsDay===0 ? 7 : jsDay;
}

const MONTHS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];
const WEEK_HEADER = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export function updateCalendarView(state){
  const view=document.querySelector('[data-view="calendar"]');
  if(!view) return;
  const grid=view.querySelector("[data-cal-grid]");
  const labelEl=view.querySelector("[data-cal-label]");
  if(!grid||!labelEl) return;

  const {calYear,calMonth}=state;
  const today = todayKey();
  const selectedKey=state.currentDateKey;

  // Заголовок "Октябрь 2025"
  const monthName = MONTHS[calMonth] || "";
  labelEl.textContent = `${monthName} ${calYear}`;

  // первая дата месяца
  const firstDay=new Date(calYear,calMonth,1);
  const firstWeekday=weekdayMonFirst(firstDay.getDay()); // 1..7 (1=Пн)
  const leading=firstWeekday-1; // сколько "пустых" клеток до понедельника
  const startDate=new Date(calYear,calMonth,1-leading);

  // чистим грид
  grid.innerHTML="";

  // шапка (Пн..Вс)
  for(const wName of WEEK_HEADER){
    const headCell=document.createElement("div");
    headCell.className="calendar-cell cal-header";
    headCell.textContent=wName;
    grid.appendChild(headCell);
  }

  // 6 недель * 7 дней = 42 ячейки
  for(let i=0;i<42;i++){
    const d=addDays(startDate,i);
    const cellKey=keyFromDate(d);

    const cell=document.createElement("div");
    cell.className="calendar-cell cal-day";
    cell.dataset.dateKey=cellKey;

    cell.textContent=String(d.getDate());

    // вне текущего месяца делаем тусклым
    if(d.getMonth()!==calMonth){
      cell.classList.add("outside");
    }

    // сегодня
    if(cellKey===today){
      cell.classList.add("today");
    }

    // выбранная дата
    if(cellKey===selectedKey){
      cell.classList.add("selected");
    }

    grid.appendChild(cell);
  }
}
