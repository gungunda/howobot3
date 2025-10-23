"use strict";

/**
 * Заглушка рендера дашборда.
 * Позже сюда добавим логику получения задач и отрисовки карточек.
 */
export function renderDashboard(root) {
  const el = document.createElement("div");
  el.textContent = "Дашборд появится здесь.";
  root.appendChild(el);
}
