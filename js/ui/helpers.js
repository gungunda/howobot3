// js/ui/helpers.js
// Набор маленьких утилит для UI.

// Возвращает ключ даты вида YYYY-MM-DD
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Удобный селектор (как document.querySelector)
export function el(selector, root = document) {
  return root.querySelector(selector);
}

// Очищает элемент (удаляет всё внутри)
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}
