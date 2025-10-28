import crypto from "crypto";

/**
 * parseInitData(initDataStr)
 * initDataStr приходит из Telegram.WebApp.initData как строка querystring:
 * "query_id=AA...&user=%7B...%7D&auth_date=169...&hash=abcdef123..."
 *
 * Возвращаем объект вида { query_id, user, auth_date, hash, ... }
 */
function parseInitData(initDataStr = "") {
  const out = {};
  const parts = initDataStr.split("&");
  for (const p of parts) {
    const [rawKey, rawVal] = p.split("=");
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey);
    const val = decodeURIComponent(rawVal || "");
    out[key] = val;
  }
  return out;
}

/**
 * buildDataCheckString(parsed)
 *
 * По правилам Telegram WebApp:
 * 1. Берём все пары "key=value", кроме `hash`.
 * 2. Сортируем по ключу в алфавитном порядке.
 * 3. Склеиваем через '\n'.
 */
function buildDataCheckString(parsed) {
  const entries = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "hash") continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort(); // сортируем по ключу
  return entries.join("\n");
}

/**
 * verifyTelegramInitData(initDataStr, botToken)
 *
 * Возвращает:
 * { ok: true, userId }
 * или
 * { ok: false, reason }
 *
 * Логика:
 * - Проверяем подпись hash через HMAC.
 * - Извлекаем user.id из поля parsed.user.
 *
 * ВАЖНО: для Mini Apps Telegram рекомендует формировать ключ HMAC так:
 *   secretKey = HMAC_SHA256("WebAppData", bot_token)
 * и затем:
 *   myHash = HMAC_SHA256(secretKey, data_check_string)
 *
 * Это может меняться в будущем, нужно будет свериться с актуальной докой Telegram.
 */
export function verifyTelegramInitData(initDataStr, botToken) {
  const parsed = parseInitData(initDataStr);

  const hashFromTelegram = parsed.hash;
  if (!hashFromTelegram) {
    return { ok: false, reason: "no-hash" };
  }

  const dataCheckString = buildDataCheckString(parsed);

  // Формируем secretKey
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const myHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (myHash !== hashFromTelegram) {
    return { ok: false, reason: "bad-hash" };
  }

  // user — это JSON-строка с данными пользователя
  let userId = null;
  try {
    const userObj = JSON.parse(parsed.user);
    userId = userObj && userObj.id;
  } catch (e) {
    /* ignore */
  }

  if (!userId) {
    return { ok: false, reason: "no-user" };
  }

  return { ok: true, userId };
}