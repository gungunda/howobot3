import { kv } from "@vercel/kv";
import { getUserIdOrFail } from "./_getUserId.js";

/**
 * /api/getOverride
 *
 * Тело запроса:
 * {
 *   initData: "...",
 *   dateKey: "2025-10-27"
 * }
 *
 * Ответ:
 * {
 *   ok: true,
 *   override: { dateKey, tasks, meta } | null
 * }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const auth = await getUserIdOrFail(req, res);
  if (!auth.ok) return;
  const { userId, body } = auth;

  const { dateKey } = body;
  if (!dateKey) {
    res.status(400).json({ ok: false, error: "missing dateKey" });
    return;
  }

  const oKey = `planner:${userId}:override:${dateKey}`;
  const oData = await kv.get(oKey);

  if (!oData) {
    res.status(200).json({
      ok: true,
      override: null
    });
    return;
  }

  res.status(200).json({
    ok: true,
    override: oData
  });
}