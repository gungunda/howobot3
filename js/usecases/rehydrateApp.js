// js/usecases/rehydrateApp.js
// Инициализируем состояние приложения из репозитория (LocalStorage / дефолт).

import { setState } from "../state.js";

export default async function rehydrateApp() {
  // Делаем «ленивый» импорт, чтобы избежать циклических зависимостей
  const repo = await import("../adapters/local/schedule.repo.local.js").catch(() => ({}));
  const loadSchedule = repo.loadSchedule || repo.load;

  let schedule = null;
  if (typeof loadSchedule === "function") {
    schedule = await loadSchedule();
  } else {
    // На раннем этапе — подстрахуемся пустым шаблоном
    schedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
  }

  setState({ schedule });
  return { schedule };
}
