// tests/ui/events.js
// ------------------------------------------------------------
// Адаптер между старыми UI-тестами и новой архитектурой приложения.
//
// Зачем он нужен:
//  • Старые тесты ожидали функции enablePercentControls / enableResetDay / enableDoneToggle,
//    которые раньше навешивали обработчики кликов прямо на DOM.
//  • Сейчас у нас есть bindDashboard(state) внутри js/ui/events.js,
//    которая вешает ВСЕ обработчики разом (и +10%, и reset-day, и чекбокс done).
//
// Этот файл даёт тестам тот же публичный API, который они ждут,
// но внутри просто вызывает bindDashboard(...) с временным state.
//
// ВАЖНО:
//  • Некоторые тесты делают именованный импорт:
//        import { enablePercentControls } from "./events.js"
//  • А некоторые делают дефолтный импорт:
//        import enablePercentControls from "./events.js"
//    и потом вызывают как функцию.
//  Поэтому ниже есть и именованные экспорты, и default-экспорт,
//  причём default — это вызываемая функция-обёртка.

import { bindDashboard } from "../../js/ui/events.js";
import { todayKey } from "../../js/ui/helpers.js";

// Создаёт state так же, как initUI делает внутри приложения
function makeState() {
  const tk = todayKey();
  const d = new Date(tk + "T00:00:00");
  return {
    currentDateKey: tk,
    calYear: d.getFullYear(),
    calMonth: d.getMonth(),
    scheduleEdit: null
  };
}

// --- Именованные экспорты для старых тестов -------------------------------

// Тест percent-controls вызывал enablePercentControls(rootEl?).
// Сейчас rootEl нам не нужен, bindDashboard сам найдёт [data-view="dashboard"].
export function enablePercentControls(/* maybeRootEl */) {
  const st = makeState();
  bindDashboard(st);
  return st;
}

// Тест reset-day вызывал enableResetDay(...), ожидая,
// что клик по [data-action="reset-day"] будет обработан.
export function enableResetDay(/* maybeRootEl */) {
  const st = makeState();
  bindDashboard(st);
  return st;
}

// Тест done-toggle вызывал enableDoneToggle(...), ожидая,
// что change на чекбоксе .task-done будет обработан.
export function enableDoneToggle(/* maybeRootEl */) {
  const st = makeState();
  bindDashboard(st);
  return st;
}

// --- Default export -------------------------------------------------------
// Для тестов, которые делают
//     import enablePercentControls from "./events.js"
// и потом ВЫЗЫВАЮТ это как функцию.
export default function legacyDefaultEnable() {
  return enablePercentControls();
}
