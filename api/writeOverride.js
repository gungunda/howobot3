import { json, parseInitData, getOverride, putOverride, resolveByUpdatedAt } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const parsed   = parseInitData(payload?.initData || null);
  const dateKey  = payload?.dateKey;
  const override = payload?.override || null;
  if (!parsed)              return json({ ok: false, error: "bad_init_data" }, 400);
  if (!dateKey || !override) return json({ ok: false, error: "bad_payload" }, 400);
  const server = await getOverride(parsed.userId, dateKey);
  const decision = resolveByUpdatedAt(server?.meta, override?.meta);
  if (decision === "server") {
    return json({ ok: true, applied: false, reason: "stale" });
  }
  await putOverride(parsed.userId, dateKey, override);
  return json({ ok: true, applied: true });
}
export const runtime = "nodejs";
