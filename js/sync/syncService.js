/*
  js/sync/syncService.js
  Узкий сетевой слой. Ходит в маршруты:
   - /api/listVersions
   - /api/readSchedule
   - /api/readOverride
   - /api/writeSchedule
   - /api/writeOverride
*/

function log(level, msg, extra) {
  const tag = "[SyncService]";
  if (extra !== undefined) console[level](`${tag} ${msg}`, extra);
  else console[level](`${tag} ${msg}`);
}

async function postJSON(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {})
    });

    const text = await res.text();

    try {
      const json = JSON.parse(text);
      if (!res.ok) {
        log("warn", `${path} failed`, { status: res.status, json });
        return { ok: false, error: "http_error", status: res.status, json };
      }
      return json;
    } catch {
      log("warn", `${path} bad_json_response`, {
        status: res.status,
        bodyPreview: text.slice(0, 200)
      });
      return {
        ok: false,
        error: "bad_json_response",
        status: res.status,
        bodyPreview: text.slice(0, 200)
      };
    }
  } catch (e) {
    log("warn", `${path} network_error`, String(e));
    return { ok: false, error: "network_error", detail: String(e) };
  }
}

const SyncService = {
  async pullBootstrap(initData) {
    const resp = await postJSON("/api/listVersions", { initData });
    if (!resp?.ok) return resp;
    log("log", "pullBootstrap done");
    return resp;
  },

  async getSchedule(initData) {
    return await postJSON("/api/readSchedule", { initData });
  },

  async getOverride(initData, dateKey) {
    return await postJSON("/api/readOverride", { initData, dateKey });
  },

  async pushSchedule(initData, schedule, clientMeta) {
    const resp = await postJSON("/api/writeSchedule", {
      initData,
      schedule,
      clientMeta
    });
    if (resp?.ok && resp?.applied) log("log", "pushSchedule applied OK");
    else if (resp?.ok && resp?.applied === false)
      log("warn", "pushSchedule NOT applied", resp?.reason || "unknown");
    return resp;
  },

  async pushOverride(initData, dateKey, override) {
    const resp = await postJSON("/api/writeOverride", {
      initData,
      dateKey,
      override
    });
    if (resp?.ok && resp?.applied) log("log", "pushOverride applied OK");
    else if (resp?.ok && resp?.applied === false)
      log("warn", "pushOverride NOT applied", resp?.reason || "unknown");
    return resp;
  }
};

export default SyncService;
