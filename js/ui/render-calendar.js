// js/ui/render-calendar.js
// Большой календарь месяца (7 колонок, 6 строк).
// Использует ту же разметку и классы, что и старый view-calendar.js,
// чтобы визуально календарь выглядел так же, как "красиво было раньше".
// ПЛЮС: аккуратно добавили подсветку дней с override из CloudStorage (класс has-override).

import * as repo from "../data/repo.js";

/**
 * Помощники дат.
 * Мы повторяем твою логику 1-в-1.
 */

// todayKey() — вернуть ключ сегодняшней даты вида "YYYY-MM-DD"
function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(dateKey) {
  // "2025-10-26" -> Date("2025-10-26T00:00:00")
  return new Date(`${dateKey}T00:00:00`);
}

function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, delta) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + Number(delta || 0));
  return nd;
}

// weekdayMonFirst(jsDay):
// JS Date.getDay() возвращает 0=Вс..6=Сб.
// Нам нужно "Пн=1 .. Вс=7", чтобы понять,
// сколько пустых ячеек поставить перед началом месяца.
function weekdayMonFirst(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

// Названия месяцев и заголовок дней
const MONTHS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];
const WEEK_HEADER = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

/**
 * Основная функция, которую зовёт events.js -> refreshCalendar(state)
 *
 * state:
 *   {
 *     calYear: number,
 *     calMonth: number (0..11),
 *     currentDateKey: "YYYY-MM-DD" (та дата, что выбрана сейчас),
 *     ...дальше нам неважно
 *   }
 *
 * Что делаем:
 *   - Находим <section data-view="calendar">
 *   - Обновляем заголовок месяца/года
 *   - Перерисовываем сетку дней внутри [data-cal-grid]
 *   - Используем классы:
 *       .calendar-cell.cal-header   для шапки Пн..Вс
 *       .calendar-cell.cal-day      для обычной ячейки дня
 *       .outside                    если день не из текущего месяца
 *       .today                      если это сегодняшняя дата
 *       .selected                   если это выбранная дата (state.currentDateKey)
 *       .has-override               если для дня есть override
 *
 * Эти классы совпадают со старым view-calendar.js
 * и старыми твоими стилями -> календарь снова будет красивым.
 */
export async function updateCalendarView(state) {
  // 1. ищем корень календаря и нужные элементы внутри него
  const view = document.querySelector('[data-view="calendar"]');
  if (!view) return;
  const grid = view.querySelector("[data-cal-grid]");
  const labelEl = view.querySelector("[data-cal-label]");
  if (!grid || !labelEl) return;

  const calYear = state.calYear;
  const calMonth = state.calMonth; // 0..11
  const today = todayKey();        // "YYYY-MM-DD"
  const selectedKey = state.currentDateKey; // тоже "YYYY-MM-DD"

  // 2. Заголовок "Октябрь 2025"
  const monthName = MONTHS[calMonth] || "";
  labelEl.textContent = `${monthName} ${calYear}`;

  // 3. Нам нужно знать, для каких дат есть override в хранилище.
  //    Это полезно родителю: видно, какие дни уже "зафиксированы".
  //    Мы добавим класс .has-override этим датам.
  let overrideDates = [];
  try {
    overrideDates = await repo.listOverrideDates();
  } catch (_) {
    // не страшно, просто будет пусто
  }
  const overrideSet = new Set(overrideDates); // быстрый поиск O(1)

  // 4. Рассчитываем, с какой даты начинать сетку (1 число месяца − отмотать к понедельнику)
  //    Твоя логика из view-calendar.js:
  //
  //    firstDay         = первое число месяца
  //    firstWeekday     = weekdayMonFirst(firstDay.getDay()) // 1..7, где 1=Пн
  //    leading          = firstWeekday - 1  // сколько пустых клеток перед Пн
  //    startDate        = первое число месяца минус leading дней
  //
  //    Потом рисуем 42 ячейки (6 недель * 7 дней).
  //
  const firstDay = new Date(calYear, calMonth, 1);
  const firstWeekday = weekdayMonFirst(firstDay.getDay()); // 1..7
  const leading = firstWeekday - 1; // 0..6
  const startDate = new Date(calYear, calMonth, 1 - leading);

  // 5. Очищаем грид перед перерисовкой
  grid.innerHTML = "";

  // 6. Рисуем шапку (Пн..Вс)
  for (const wName of WEEK_HEADER) {
    const headCell = document.createElement("div");
    headCell.className = "calendar-cell cal-header";
    headCell.textContent = wName;
    grid.appendChild(headCell);
  }

  // 7. Рисуем сами дни (42 ячейки)
  for (let i = 0; i < 42; i++) {
    const d = addDays(startDate, i);     // Date объекта для этой клетки
    const cellKey = keyFromDate(d);      // "YYYY-MM-DD"

    const cell = document.createElement("div");
    cell.className = "calendar-cell cal-day";
    cell.dataset.dateKey = cellKey;
    cell.textContent = String(d.getDate());

    // если это не тот же месяц -> делаем тусклым
    if (d.getMonth() !== calMonth) {
      cell.classList.add("outside");
    }

    // если это сегодня -> подсветка сегодняшнего дня
    if (cellKey === today) {
      cell.classList.add("today");
    }

    // если это выбранная дата -> подсветка выбранной даты
    if (cellKey === selectedKey) {
      cell.classList.add("selected");
    }

    // если на эту дату уже есть override в облаке/локали
    // → добавляем has-override. Это новый класс.
    // (Если у тебя нет стиля для него — ничего страшного)
    if (overrideSet.has(cellKey)) {
      cell.classList.add("has-override");
    }

    grid.appendChild(cell);
  }
}

// fallback экспорт на случай старых импортов типа default
export default { updateCalendarView };
