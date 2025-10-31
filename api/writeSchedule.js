// api/writeSchedule.js — запись расписания + обновление маяка (Node)

import { kv } from "@vercel/kv";
import { ok, badRequest, serverError, readJsonBody, resolveInitData, userKey, KEYS } from "./_utils.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return badRequest(res, "method_not_allowed");

    const initData = await resolveInitData(req);
    const uk = userKey(initData);
    if (!uk) return badRequest(res, "bad_init_data");

    const body = await readJsonBody(req).catch(() => ({}));
    const schedule = body?.schedule;
    const clientMeta = body?.clientMeta || {};

    if (!schedule || typeof schedule !== "object") {
      return badRequest(res, "bad_payload");
    }

    const serverMeta = {
      updatedAt: new Date().toISOString(),
      deviceId: typeof clientMeta.deviceId === "string" ? clientMeta.deviceId : null
    };

    await kv.set(KEYS.schedule(uk), schedule);
    await kv.set(KEYS.scheduleMeta(uk), serverMeta);
    await kv.set(KEYS.beacon(uk), serverMeta);

    return ok(res, { applied: true, serverMeta });
  } catch (e) {
    return serverError(res, e);
  }
}
