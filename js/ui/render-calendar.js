"use strict";

/** Заглушка рендера календаря. */
export function renderCalendar(root) {
  const el = document.createElement("div");
  el.textContent = "Календарь появится здесь.";
  root.appendChild(el);
}
