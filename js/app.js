"use strict";

/**
 * Точка входа приложения.
 * Здесь создаём singletons репозиториев (по умолчанию — локальные адаптеры).
 * Use Cases будут импортировать их напрямую (Dependency Access Policy).
 */

export { scheduleRepo } from "./adapters/local/schedule.repo.local.js";
export { overrideRepo } from "./adapters/local/override.repo.local.js";

// Простейшая инициализация DOM (заглушка — чтобы страница жила без ошибок).
const elTotal = document.getElementById("stat-total");
if (elTotal) elTotal.textContent = "—";
