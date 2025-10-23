// js/state.js
// Простейшее хранилище состояния приложения.
// Для junior-разработчика: это просто объект с геттером/сеттером.

const __STATE__ = {
  schedule: null,  // недельный шаблон
};

export function getState() {
  return __STATE__;
}

export function setState(patch = {}) {
  // Object.assign — «склеивает» свойства из patch в наш объект состояния
  Object.assign(__STATE__, patch);
  return __STATE__;
}
