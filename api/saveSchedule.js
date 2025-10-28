import { kv } from "@vercel/kv";
import { getUserIdOrFail } from "./_getUserId.js";

/**
 * /api/saveSchedule
 *
 * Клиент шлёт новое расписание недели целиком.
 *
 * Тело запроса:
 * {
 *   initData: "...",
 *   schedule: {
 *     monday: [ ... ],
 *     tuesday: [ ... ],
 *     ...
 *   },
 *   clientMeta: {
 *     updatedAt: "2025-10-28T20:10:45.123Z",
 *     deviceId: "ipad_anna"
 *   }
 * }
 *
 * Сервер сравнивает clientMeta.updatedAt со своим stored.meta.updatedAt.
 * - Если новое свежее -> принимает.
 * - Если старое -> отклоняет (applied:false).
 *
 * Ответ:
 * { ok:true, applied:true, updatedAt:"..." }
 * или
 * { ok:true, applied:false, reason:"stale" }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const auth = await getUserIdOrFail(req, res);
  if (!auth.ok) return;
  const { userId, body } = auth;

  const { schedule, clientMeta } = body || {};
  if (!schedule || !clientMeta || !clientMeta.updatedAt) {
    res.status(400).json({ ok: false, error: "missing schedule/clientMeta" });
    return;
  }

  const scheduleKey = `planner:${userId}:schedule`;
  const stored = await kv.get(scheduleKey);

  // Если ничего не было - просто пишем.
  if (!stored) {
    await kv.set(scheduleKey, {
      schedule,
      meta: {
        updatedAt: clientMeta.updatedAt,
        deviceId: clientMeta.deviceId || "unknown"
      }
    });

    res.status(200).json({
      ok: true,
      applied: true,
      updatedAt: clientMeta.updatedAt
    });
    return;
  }

  // Если было: сравниваем updatedAt
  const prevUpdatedAt = stored.meta && stored.meta.updatedAt
    ? stored.meta.updatedAt
    : "";

  // Простой лексикографический compare ISO-дат как строк.
  // ISO 8601 (new Date().toISOString()) сортируется корректно как строка.
  if (clientMeta.updatedAt > prevUpdatedAt) {

    await kv.set(scheduleKey, {
      schedule,
      meta: {
        updatedAt: clientMeta.updatedAt,
        deviceId: clientMeta.deviceId || "unknown"
      }
    });

    res.status(200).json({
      ok: true,
      applied: true,
      updatedAt: clientMeta.updatedAt
    });
    return;
  }

  // Если наше время не новее - отклоняем.
  res.status(200).json({
    ok: true,
    applied: false,
    reason: "stale",
    updatedAt: prevUpdatedAt
  });
}