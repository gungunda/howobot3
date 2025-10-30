import { json, parseInitData, putSchedule, getSchedule } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const initData = payload?.initData || null;
  const client   = payload?.schedule || null;
  const clientMeta = payload?.clientMeta || null;

  const parsed = parseInitData(initData);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);
  if (!client) return json({ ok: false, error: "bad_payload" }, 400);

  const server = getSchedule(parsed.userId);
  const serverUpdatedAt = server?.meta?.updatedAt || null;
  const clientUpdatedAt = clientMeta?.updatedAt || null;

  // LWW: если на сервере свежее — не применяем
  if (serverUpdatedAt && clientUpdatedAt && serverUpdatedAt > clientUpdatedAt) {
    return json({ ok: true, applied: false, reason: "stale" });
  }

  putSchedule(parsed.userId, client, {
    updatedAt: clientUpdatedAt || new Date().toISOString(),
    deviceId: clientMeta?.deviceId || "unknown"
  });

  return json({ ok: true, applied: true });
}

export const runtime = "edge";
