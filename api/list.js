import { kv } from "@vercel/kv";
import { getUserIdOrFail } from "./_getUserId.js";

/**
 * /api/list
 *
 * Возвращает карту версий:
 * {
 *   ok: true,
 *   schedule: { updatedAt: "..."} или null,
 *   overrides: {
 *     "2025-10-27": { updatedAt: "..." },
 *     ...
 *   }
 * }
 *
 * Клиент по этому ответу решает,
 * какие куски ему нужно дотянуть с сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const auth = await getUserIdOrFail(req, res);
  if (!auth.ok) return;
  const { userId } = auth;

  // 1. Читаем расписание
  const scheduleKey = `planner:${userId}:schedule`;
  const scheduleData = await kv.get(scheduleKey);
  // scheduleData может быть null, или объект:
  // { schedule: {...}, meta: { updatedAt, deviceId } }

  // 2. Нам нужно получить список всех override-ключей этого юзера.
  // KV тут ведёт себя как Redis, у него нет прямого "list keys with prefix"
  // в edge-режиме без доп. индекса. Поэтому:
  //
  // --> мы будем дополнительно хранить отдельный индекс-список дат.
  //
  // Ключ индекса:
  //   planner:<userId>:override_index
  //
  // Значение:
  //   массив дат ["2025-10-27","2025-10-28", ...]
  //
  // Этот список мы будем обновлять в /saveOverride.
  //
  const indexKey = `planner:${userId}:override_index`;
  let overrideDates = (await kv.get(indexKey)) || [];
  if (!Array.isArray(overrideDates)) overrideDates = [];

  const overridesMeta = {};

  // Для каждой даты читаем только мету (но мета лежит внутри объекта override)
  // Нам всё равно придётся сделать kv.get(...) по каждой дате.
  // Это O(N) по количеству override-дней. Это ок для MVP.
  for (const dateKey of overrideDates) {
    const oKey = `planner:${userId}:override:${dateKey}`;
    const oData = await kv.get(oKey);
    if (oData && oData.meta && oData.meta.updatedAt) {
      overridesMeta[dateKey] = {
        updatedAt: oData.meta.updatedAt
      };
    } else {
      overridesMeta[dateKey] = {
        updatedAt: null
      };
    }
  }

  res.status(200).json({
    ok: true,
    schedule: scheduleData && scheduleData.meta
      ? { updatedAt: scheduleData.meta.updatedAt }
      : null,
    overrides: overridesMeta
  });
}