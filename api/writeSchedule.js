import { json, parseInitData, putSchedule, getSchedule, resolveByUpdatedAt } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const parsed     = parseInitData(payload?.initData || null);
  const client     = payload?.schedule || null;
  const clientMeta = payload?.clientMeta || null;
  if (!parsed)  return json({ ok: false, error: "bad_init_data" }, 400);
  if (!client)  return json({ ok: false, error: "bad_payload" }, 400);
  const server = await getSchedule(parsed.userId);
  const decision = resolveByUpdatedAt(server?.meta, clientMeta);
  if (decision === "server") {
    return json({ ok: true, applied: false, reason: "stale" });
  }
  await putSchedule(parsed.userId, client, {
    updatedAt: clientMeta?.updatedAt || new Date().toISOString(),
    deviceId:  clientMeta?.deviceId  || "unknown"
  });
  return json({ ok: true, applied: true });
}
export const runtime = "nodejs";
