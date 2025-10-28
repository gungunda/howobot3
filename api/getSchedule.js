import { kv } from "@vercel/kv";
import { getUserIdOrFail } from "./_getUserId.js";

/**
 * /api/getSchedule
 *
 * Возвращает текущее недельное расписание.
 * {
 *   ok: true,
 *   schedule: { monday: [...], ... } | null,
 *   meta: { updatedAt, deviceId } | null
 * }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const auth = await getUserIdOrFail(req, res);
  if (!auth.ok) return;
  const { userId } = auth;

  const scheduleKey = `planner:${userId}:schedule`;
  const scheduleData = await kv.get(scheduleKey);

  if (!scheduleData) {
    // Ещё ни разу не сохраняли расписание
    res.status(200).json({
      ok: true,
      schedule: null,
      meta: null
    });
    return;
  }

  res.status(200).json({
    ok: true,
    schedule: scheduleData.schedule || null,
    meta: scheduleData.meta || null
  });
}