import { createClient } from "redis";

let _redis = null;

async function getRedis() {
  if (_redis && _redis.isOpen) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  _redis = createClient({ url });
  _redis.on("error", (err) => console.error("[redis] error:", err?.message || err));
  await _redis.connect();
  return _redis;
}

export function json(data, status = 200) {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(data)
  };
}

/**
 * Безопасный парсер initData.
 * Пока возвращает стабильный userId для тестов.
 * Позже подменим на реальную валидацию Telegram initData.
 */
export function parseInitData(initData) {
  if (typeof initData === "string" && initData.trim().length > 0) return { userId: "demo-user" };
  if (initData && typeof initData === "object") return { userId: "demo-user" };
  return { userId: "demo-user" };
}

function keySchedule(uid)     { return `${uid}:schedule`; }
function keyScheduleMeta(uid) { return `${uid}:schedule:meta`; }
function keyOverride(uid,d)   { return `${uid}:ov:${d}`; }
function keyOvIndex(uid)      { return `${uid}:ov:index`; }

async function getJSON(key) {
  const r = await (await getRedis()).get(key);
  if (r == null) return null;
  try { return JSON.parse(r); } catch { return null; }
}
async function setJSON(key, val) {
  const s = JSON.stringify(val);
  await (await getRedis()).set(key, s);
}

export function resolveByUpdatedAt(serverMeta, clientMeta) {
  const s = serverMeta?.updatedAt || null;
  const c = clientMeta?.updatedAt || null;
  if (!s && c) return "client";
  if (s && !c) return "server";
  if (!s && !c) return "client";
  return c > s ? "client" : "server";
}

export async function getSnapshot(uid) {
  const r = await getRedis();
  const [sched, meta, indexStr] = await r.mGet([keySchedule(uid), keyScheduleMeta(uid), keyOvIndex(uid)]);
  const schedule = sched ? { schedule: JSON.parse(sched), meta: (meta ? JSON.parse(meta) : null) } : null;
  const overrides = {};
  const index = indexStr ? JSON.parse(indexStr) : [];
  if (Array.isArray(index) && index.length) {
    const keys = index.map((d) => keyOverride(uid, d));
    const vals = await r.mGet(keys);
    vals.forEach((raw, i) => {
      if (raw) {
        const dateKey = index[i];
        overrides[dateKey] = JSON.parse(raw);
      }
    });
  }
  return { schedule, overrides };
}

export async function putSchedule(uid, schedule, meta) {
  const r = await getRedis();
  await r.mSet({
    [keySchedule(uid)]: JSON.stringify(schedule),
    [keyScheduleMeta(uid)]: JSON.stringify(meta || { updatedAt: new Date().toISOString(), deviceId: "unknown" })
  });
}

export async function getSchedule(uid) {
  const r = await getRedis();
  const [sched, meta] = await r.mGet([keySchedule(uid), keyScheduleMeta(uid)]);
  if (!sched) return null;
  return { schedule: JSON.parse(sched), meta: meta ? JSON.parse(meta) : null };
}

export async function getOverride(uid, dateKey) {
  return await getJSON(keyOverride(uid, dateKey));
}

export async function putOverride(uid, dateKey, override) {
  const r = await getRedis();
  const idxKey = keyOvIndex(uid);
  const idxRaw = await r.get(idxKey);
  const index = idxRaw ? JSON.parse(idxRaw) : [];
  if (!index.includes(dateKey)) {
    index.push(dateKey);
    await r.set(idxKey, JSON.stringify(index));
  }
  await setJSON(keyOverride(uid, dateKey), override);
}
