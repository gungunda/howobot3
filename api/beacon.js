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
    const { initData } = await req.json().catch(() => ({}));
    const uk = userKey(initData);
    if (!uk) return bad({ ok: false, error: "bad_init_data" });

    const beaconKey = `${uk}:beacon`;
    let beacon = await kv.get(beaconKey);
    if (!beacon) beacon = { updatedAt: null, deviceId: null };
    return ok({ ok: true, ...beacon });
  } catch (e) {
    return new Response("A server error has occurred\n\nFUNCTION_INVOCATION_FAILED\n", { status: 500 });
  }
}