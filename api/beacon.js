// api/beacon.js  (пример: Node.js serverless function на Vercel)

import { kv } from "@vercel/kv";

// Универсальные helpers для ответов JSON в Node-функции
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
const ok  = (res, data = {}) => sendJson(res, 200, { ok: true,  ...data });
const bad = (res, error, extra) => sendJson(res, 400, { ok: false, error, ...(extra || {}) });
const oops = (res, e) => sendJson(res, 500, { ok: false, error: String(e?.message || e) });

// Надёжный base64 в Node
function toBase64(str) {
  return Buffer.from(String(str), "utf8").toString("base64");
}

// Генерация ключа пользователя по initData
function userKey(initData) {
  if (!initData || typeof initData !== "string") return null;
  // короткий стабильный ключ (24 символа base64)
  return "u:" + toBase64(initData).slice(0, 24);
}

// Прочитать JSON-тело Node-запроса (без Express)
async function readJsonBody(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
}

// Главный хендлер: (req, res) для Node-рантайма
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return bad(res, "method_not_allowed");
    }

    const body = await readJsonBody(req);
    const initData = body?.initData;
    const uk = userKey(initData);
    if (!uk) return bad(res, "bad_init_data");

    const beaconKey = `${uk}:beacon`;
    let beacon = await kv.get(beaconKey);
    if (!beacon) beacon = { updatedAt: null, deviceId: null };

    return ok(res, beacon);
  } catch (e) {
    return oops(res, e);
  }
}
