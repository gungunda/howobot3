// js/infra/deviceId.js
// Единственная точка правды для идентификатора устройства.
// Назначение: дать стабильный ID между перезапусками на одном устройстве.
//
// API:
//   ensure(): string  — гарантирует наличие ID и возвращает его.
//   get(): string     — возвращает текущий ID (если нет — создаёт).
//
// Хранилище: window.localStorage, ключ 'planner.deviceId'.
// Это инфраструктурный слой, не бизнес-логика.

const LS_KEY = "planner.deviceId";

function readRaw() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}

function writeRaw(id) {
  try { if (id) localStorage.setItem(LS_KEY, String(id)); } catch {}
}

export function ensure() {
  // 1) внешняя инициализация (например, тесты) — опционально
  try {
    if (typeof window !== "undefined" && window.__DEVICE_ID__) {
      const v = String(window.__DEVICE_ID__);
      if (v) { writeRaw(v); return v; }
    }
  } catch {}

  // 2) уже есть?
  const existing = readRaw();
  if (existing) return existing;

  // 3) сгенерировать
  const fresh = "dev_" + Math.random().toString(36).slice(2);
  writeRaw(fresh);
  return fresh;
}

export function get() {
  return ensure();
}
