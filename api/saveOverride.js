import { kv } from "@vercel/kv";
import { getUserIdOrFail } from "./_getUserId.js";

/**
 * /api/saveOverride
 *
 * Сохраняет override для конкретного дня.
 *
 * Тело запроса:
 * {
 *   initData: "...",
 *   dateKey: "2025-10-27",
 *   override: {
 *     dateKey: "2025-10-27",
 *     tasks: [ ... ],
 *     meta: {
 *       updatedAt: "2025-10-28T20:11:10.000Z",
 *       deviceId: "phone_xiaomi_123",
 *       userAction: "adjustPercent"
 *     }
 *   }
 * }
 *
 * Сервер:
 * 1. читает старую версию override;
 * 2. сравнивает meta.updatedAt;
 * 3. если новое -> пишет;
 * 4. добавляет dateKey в индекс override_index, если его там не было.
 *
 * Ответ:
 * { ok:true, applied:true }
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

  const { dateKey, override } = body || {};
  if (!dateKey || !override || !override.meta || !override.meta.updatedAt) {
    res.status(400).json({ ok: false, error: "missing dateKey/override/meta" });
    return;
  }

  if (override.dateKey !== dateKey) {
    res.status(400).json({ ok: false, error: "mismatching dateKey" });
    return;
  }

  const oKey = `planner:${userId}:override:${dateKey}`;
  const stored = await kv.get(oKey);

  if (!stored) {
    // ещё нет версии для этого дня -> пишем сразу
    await kv.set(oKey, override);

    // нужно обновить индекс дат override_index
    const indexKey = `planner:${userId}:override_index`;
    let dateList = (await kv.get(indexKey)) || [];
    if (!Array.isArray(dateList)) dateList = [];
    if (!dateList.includes(dateKey)) {
      dateList.push(dateKey);
      await kv.set(indexKey, dateList);
    }

    res.status(200).json({
      ok: true,
      applied: true
    });
    return;
  }

  // уже есть версия -> сравниваем updatedAt
  const prevUpdatedAt = stored.meta && stored.meta.updatedAt
    ? stored.meta.updatedAt
    : "";

  if (override.meta.updatedAt > prevUpdatedAt) {
    await kv.set(oKey, override);

    // индекс тоже должен содержать дату (на случай если раньше был кривой индекс)
    const indexKey = `planner:${userId}:override_index`;
    let dateList = (await kv.get(indexKey)) || [];
    if (!Array.isArray(dateList)) dateList = [];
    if (!dateList.includes(dateKey)) {
      dateList.push(dateKey);
      await kv.set(indexKey, dateList);
    }

    res.status(200).json({
      ok: true,
      applied: true
    });
    return;
  }

  // старая или та же версия
  res.status(200).json({
    ok: true,
    applied: false,
    reason: "stale",
    updatedAt: prevUpdatedAt
  });
}