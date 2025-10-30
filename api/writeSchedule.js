import { json } from "./_utils.js";

async function readPayload(req) {
  // Универсальный парсер тела для Vercel Node — работает и когда req.body не распарсен.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  let data = "";
  return await new Promise((resolve) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    const r = json({ ok: false, error: "method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
    return;
  }
  const payload = await readPayload(req);
  try {
    const result = await logic(payload);
    res.status(result.status).setHeader("content-type", result.headers["content-type"]).send(result.body);
  } catch (e) {
    const r = json({ ok:false, error:"exception", detail:String(e && e.message || e) }, 500);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
  }
}

async function logic(payload) {

  const {{ parseInitData, putSchedule, getSchedule, resolveByUpdatedAt }} = await import("./_utils.js");
  const parsed     = parseInitData(payload?.initData);
  const client     = payload?.schedule ?? null;
  const clientMeta = payload?.clientMeta ?? null;
  if (!client) return json({{ ok:false, error:"bad_payload" }}, 400);
  const server   = await getSchedule(parsed.userId);
  const decision = resolveByUpdatedAt(server?.meta, clientMeta);
  if (decision === "server") return json({{ ok:true, applied:false, reason:"stale" }});
  await putSchedule(parsed.userId, client, {{
    updatedAt: clientMeta?.updatedAt || new Date().toISOString(),
    deviceId:  clientMeta?.deviceId  || "unknown"
  }});
  return json({{ ok:true, applied:true }});

}
