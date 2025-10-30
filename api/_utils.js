// api/_utils.js
// Перевод утилит API на персистентное хранилище Vercel KV.
// Требуются переменные окружения на проекте Vercel: KV_REST_API_URL, KV_REST_API_TOKEN
// Используем официальный SDK, он работает и в Edge, и в Node runtime.

import { kv } from '@vercel/kv';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

// Простейший парсер initData (заглушка). Для продакшена нужно валидировать подпись Telegram.
export function parseInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  // TODO: разбор querystring + проверка hash (по токену бота).
  return { userId: 'demo-user' };
}

// --- Ключи в KV ---
// schedule:      <uid>:schedule            → JSON объекта расписания + meta в соседнем ключе
// scheduleMeta:  <uid>:schedule:meta
// override:      <uid>:ov:<dateKey>        → JSON override
// ovIndex:       <uid>:ov:index            → JSON-массив ["YYYY-MM-DD", ...] — список дат с override

function keySchedule(uid)      { return `${uid}:schedule`; }
function keyScheduleMeta(uid)  { return `${uid}:schedule:meta`; }
function keyOverride(uid, d)   { return `${uid}:ov:${d}`; }
function keyOvIndex(uid)       { return `${uid}:ov:index`; }

export async function getSnapshot(uid) {
  const [sched, meta, index] = await Promise.all([
    kv.get(keySchedule(uid)),
    kv.get(keyScheduleMeta(uid)),
    kv.get(keyOvIndex(uid))
  ]);

  const overrides = {};
  if (Array.isArray(index)) {
    const keys = index.map(d => keyOverride(uid, d));
    const rows = keys.length ? await kv.mget(...keys) : [];
    rows.forEach((val, i) => {
      const dateKey = index[i];
      if (val) overrides[dateKey] = val;
    });
  }

  const schedule = sched ? { schedule: sched, meta: meta || null } : null;
  return { schedule, overrides };
}

export async function putSchedule(uid, schedule, meta) {
  await Promise.all([
    kv.set(keySchedule(uid), schedule),
    kv.set(keyScheduleMeta(uid), meta || { updatedAt: new Date().toISOString(), deviceId: 'unknown' })
  ]);
}

export async function getSchedule(uid) {
  const [sched, meta] = await Promise.all([
    kv.get(keySchedule(uid)),
    kv.get(keyScheduleMeta(uid))
  ]);
  if (!sched) return null;
  return { schedule: sched, meta: meta || null };
}

export async function getOverride(uid, dateKey) {
  const val = await kv.get(keyOverride(uid, dateKey));
  return val || null;
}

export async function putOverride(uid, dateKey, override) {
  // поддерживаем индекс дат
  const idxKey = keyOvIndex(uid);
  const index = (await kv.get(idxKey)) || [];
  if (!index.includes(dateKey)) {
    index.push(dateKey);
    await kv.set(idxKey, index);
  }
  await kv.set(keyOverride(uid, dateKey), override);
}
