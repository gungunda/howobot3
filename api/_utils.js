// api/_utils.js — общие утилиты для Node.js Serverless (Vercel)

// Ответ JSON
export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export function ok(res, data = {}) {
  sendJson(res, 200, { ok: true, ...data });
}

export function badRequest(res, error = "bad_request", extra) {
  sendJson(res, 400, { ok: false, error, ...(extra || {}) });
}

export function serverError(res, e) {
  const msg = typeof e === "string" ? e : (e?.message || String(e));
  sendJson(res, 500, { ok: false, error: msg });
}

export async function readJsonBody(req) {
  try {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    if (!chunks.length) return null;
    const txt = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(txt);
  } catch {
    throw new Error("invalid_json");
  }
}

// base64 по UTF‑8 (совместимо с btoa(unescape(encodeURIComponent(...))))
export function toBase64Utf8(str) {
  return Buffer.from(String(str), "utf8").toString("base64");
}

// userKey: «u:<base64(…)>» урезанный до 24 символов для компактности
export function userKey(initData) {
  if (!initData || typeof initData !== "string") return null;
  return "u:" + toBase64Utf8(initData).slice(0, 24);
}

// Параметр ?initData=... из URL (для GET)
export function getQueryParam(req, name) {
  try {
    const url = new URL(req.url, "http://localhost");
    return url.searchParams.get(name);
  } catch {
    return null;
  }
}

// Достаём initData: сначала query (?initData=), затем JSON‑тело
export async function resolveInitData(req) {
  const fromQuery = getQueryParam(req, "initData");
  if (fromQuery) return fromQuery;
  const body = await readJsonBody(req).catch(() => null);
  return body?.initData || null;
}

// Ключи в KV/Redis для namespace пользователя
export const KEYS = {
  schedule: (uk) => `${uk}:schedule`,
  scheduleMeta: (uk) => `${uk}:schedule:meta`,
  override: (uk, d) => `${uk}:override:${d}`,
  overrideMeta: (uk, d) => `${uk}:override:${d}:meta`,
  overrideIndex: (uk) => `${uk}:override:index`,
  beacon: (uk) => `${uk}:beacon`
};
