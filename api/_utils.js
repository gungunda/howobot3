/* Общие утилиты для /api/*. Минимум зависимостей, всегда JSON-ответы. */

// Очень простая обёртка JSON-ответа
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

// Парсинг initData (здесь — заглушка!). В бою надо верифицировать подпись Telegram.
export function parseInitData(initData) {
  if (!initData || typeof initData !== "string") return null;
  // В проде: разбираем querystring, проверяем hash, достаём user.id.
  // Сейчас — просто заглушка, чтобы API работало предсказуемо.
  return { userId: "demo-user" };
}

// Временно: in-memory KV (НЕ ПЕРСИСТЕНТНО). Для реальной синхи нужно подключить Vercel KV.
const MEMORY = new Map();
// helpers
function k(uid, suffix) { return `${uid}:${suffix}`; }

export function getSnapshot(uid) {
  const schedule = MEMORY.get(k(uid, "schedule")) || null;
  const overrides = MEMORY.get(k(uid, "overrides")) || {}; // { "YYYY-MM-DD": {...} }
  return { schedule, overrides };
}

export function putSchedule(uid, schedule, meta) {
  MEMORY.set(k(uid, "schedule"), { schedule, meta });
}

export function getSchedule(uid) {
  return MEMORY.get(k(uid, "schedule")) || null;
}

export function getOverride(uid, dateKey) {
  const dict = MEMORY.get(k(uid, "overrides")) || {};
  return dict[dateKey] || null;
}

export function putOverride(uid, dateKey, override) {
  const dict = MEMORY.get(k(uid, "overrides")) || {};
  dict[dateKey] = override;
  MEMORY.set(k(uid, "overrides"), dict);
}
