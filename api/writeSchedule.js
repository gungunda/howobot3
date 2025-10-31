export const config = { runtime: "edge" };
import { kv } from '@vercel/kv';

function bad(res) { return new Response(JSON.stringify(res), { status: 400, headers: { "content-type": "application/json" } }); }
function ok(res) { return new Response(JSON.stringify(res), { status: 200, headers: { "content-type": "application/json" } }); }

function userKey(initData) {
  if (!initData || typeof initData !== "string") return null;
  return "u:" + btoa(unescape(encodeURIComponent(initData))).slice(0, 24);
}

export default async function handler(req) {
  try {
    const { initData, schedule, clientMeta } = await req.json().catch(() => ({}));
    const uk = userKey(initData);
    if (!uk || !schedule || typeof schedule !== "object") return bad({ ok: false, error: "bad_payload" });

    const now = new Date().toISOString();
    const serverMeta = { updatedAt: now, deviceId: clientMeta?.deviceId || null };

    await kv.set(`${uk}:schedule`, schedule);
    await kv.set(`${uk}:schedule:meta`, serverMeta);

    await kv.set(`${uk}:beacon`, serverMeta);

    return ok({ ok: true, applied: true, serverMeta });
  } catch (e) {
    return new Response("A server error has occurred\n\nFUNCTION_INVOCATION_FAILED\n", { status: 500 });
  }
}