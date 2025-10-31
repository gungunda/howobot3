// api/readSchedule.js — чтение расписания и его меты (Node)

import { kv } from "@vercel/kv";
import { ok, badRequest, serverError, resolveInitData, userKey, KEYS } from "./_utils.js";

export default async function handler(req, res) {
  try {
    const initData = await resolveInitData(req);
    const uk = userKey(initData);
    if (!uk) return badRequest(res, "bad_init_data");

    const schedule = await kv.get(KEYS.schedule(uk));
    const meta = await kv.get(KEYS.scheduleMeta(uk));

    return ok(res, { schedule: schedule || null, meta: meta || null });
  } catch (e) {
    return serverError(res, e);
  }
}
