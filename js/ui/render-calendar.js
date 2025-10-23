// js/ui/render-calendar.js
// Мини-календарь: кнопки «влево/вправо» и input[type="date"].
// onChange(dateKey) вызывается при любом изменении даты.

import { el } from "./helpers.js";

export default function renderCalendar(root, { dateKey, onChange }) {
  if (!root) {
    root = document.getElementById("calendar");
    if (!root) {
      const app = document.getElementById("app") || document.body;
      root = document.createElement("div");
      root.id = "calendar";
      app.prepend(root);
    }
  }

  root.innerHTML = `
    <div class="calendar-bar">
      <button id="cal-prev" aria-label="предыдущий день">←</button>
      <input id="cal-date" type="date" />
      <button id="cal-next" aria-label="следующий день">→</button>
    </div>
  `;

  const input = el("#cal-date", root);
  const prev  = el("#cal-prev", root);
  const next  = el("#cal-next", root);

  // Устанавливаем дату
  if (dateKey) input.value = dateKey;

  // Навешиваем обработчики
  function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }
  function fromKey(k){
    if (!k) return new Date();
    const [y,m,d] = k.split("-").map(Number);
    return new Date(y, (m||1)-1, d||1);
  }

  input.addEventListener("change", () => {
    const k = input.value;
    if (onChange) onChange(k);
  });

  prev.addEventListener("click", () => {
    const cur = fromKey(input.value);
    cur.setDate(cur.getDate() - 1);
    const k = toKey(cur);
    input.value = k;
    if (onChange) onChange(k);
  });

  next.addEventListener("click", () => {
    const cur = fromKey(input.value);
    cur.setDate(cur.getDate() + 1);
    const k = toKey(cur);
    input.value = k;
    if (onChange) onChange(k);
  });

  return root;
}
