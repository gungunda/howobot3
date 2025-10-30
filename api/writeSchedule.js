const { json, parseInitData, putSchedule, getSchedule, resolveByUpdatedAt } = require("./_utils.js");

async function readPayload(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let data = ""; return await new Promise((resolve) => {
    req.setEncoding("utf8");
    req.on("data", (c) => data += c);
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    const r = json({ ok:false, error:"method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body); return;
  }
  const payload   = await readPayload(req);
  const parsed    = parseInitData(payload?.initData);
  const client    = payload?.schedule ?? null;
  const clientMeta= payload?.clientMeta ?? null;

  if (!client) {
    const r = json({ ok:false, error:"bad_payload" }, 400);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body); return;
  }

  const server   = await getSchedule(parsed.userId);
  const decision = resolveByUpdatedAt(server?.meta, clientMeta);
  if (decision === "server") {
    const r = json({ ok:true, applied:false, reason:"stale" });
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body); return;
  }

  await putSchedule(parsed.userId, client, {
    updatedAt: clientMeta?.updatedAt || new Date().toISOString(),
    deviceId:  clientMeta?.deviceId  || "unknown"
  });

  const r = json({ ok:true, applied:true });
  res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
};
