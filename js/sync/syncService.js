const LS = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return localStorage.getItem(k); } },
  set(k,v){ localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); }
};

const SYNC_KEYS = {
  beaconApplied: "planner.sync.beacon.lastAppliedAt",
  scheduleApplied: "planner.sync.schedule.lastAppliedUpdatedAt",
  overrideAppliedPrefix: "planner.sync.override.lastApplied.", // + dateKey
};

function isNewer(serverTs, localTs){
  if (!serverTs) return false;
  if (!localTs) return true;
  return new Date(serverTs).getTime() > new Date(localTs).getTime();
}

function initData() {
  return (window.Telegram?.WebApp?.initData || "") + "";
}

function getDeviceId() {
  let id = localStorage.getItem("planner.deviceId");
  if (!id) { id = "dev_" + Math.random().toString(36).slice(2); localStorage.setItem("planner.deviceId", id); }
  return id;
}

function log(level, scope, msg, obj){
  if (window.__UILOG) window.__UILOG(level, scope, msg, obj);
  else console.log(level, `[${scope}] ${msg}`, obj || "");
}

async function post(path, body){
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`bad_json_response ${res.status}: ${text?.slice(0,200)}`);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

const SyncService = {
  async pullBootstrap(){
    log("LOG","SyncService","pullBootstrap done");
    return true;
  },

  async readBeacon(){
    try{
      const json = await post("/api/beacon", { initData: initData() });
      return { ok: true, updatedAt: json.updatedAt || null, deviceId: json.deviceId || null };
    }catch(e){
      log("WRN","SyncService","/api/beacon failed", { error: String(e) });
      return { ok: false, updatedAt: null, deviceId: null };
    }
  },

  async listVersions(){
    return await post("/api/listVersions", { initData: initData() });
  },

  async readSchedule(){
    return await post("/api/readSchedule", { initData: initData() });
  },

  async readOverride(dateKey){
    return await post("/api/readOverride", { initData: initData(), dateKey });
  },

  async pushSchedule(scheduleObj){
    try{
      const json = await post("/api/writeSchedule", {
        initData: initData(),
        schedule: scheduleObj,
        clientMeta: { updatedAt: new Date().toISOString(), deviceId: getDeviceId() }
      });
      if (json?.ok && json?.applied && json?.serverMeta?.updatedAt){
        LS.set(SYNC_KEYS.scheduleApplied, json.serverMeta.updatedAt);
        LS.set(SYNC_KEYS.beaconApplied, json.serverMeta.updatedAt);
      }
      log("LOG","SyncService","pushSchedule applied OK");
      return true;
    }catch(e){
      log("WRN","SyncService","pushSchedule server error", { error: String(e) });
      return false;
    }
  },

  async pushOverride(dateKey, overrideObj){
    try{
      const json = await post("/api/writeOverride", {
        initData: initData(),
        dateKey,
        override: overrideObj,
        clientMeta: { updatedAt: new Date().toISOString(), deviceId: getDeviceId() }
      });
      if (json?.ok && json?.applied && json?.serverMeta?.updatedAt){
        LS.set(SYNC_KEYS.overrideAppliedPrefix + dateKey, json.serverMeta.updatedAt);
        LS.set(SYNC_KEYS.beaconApplied, json.serverMeta.updatedAt);
      }
      log("LOG","SyncService",`pushOverride applied OK for ${dateKey}`);
      return true;
    }catch(e){
      log("WRN","SyncService","pushOverride server error", { error: String(e) });
      return false;
    }
  },

  startPolling(intervalMs = 30000){
    log("INF","SyncService",`polling started each ${intervalMs} ms`);
    const tick = async () => {
      try{
        const beacon = await this.readBeacon();
        if (!beacon.ok) return;
        const applied = LS.get(SYNC_KEYS.beaconApplied);
        if (beacon.updatedAt && beacon.updatedAt === applied) return;

        const versions = await this.listVersions();
        if (versions?.scheduleMeta?.updatedAt && isNewer(versions.scheduleMeta.updatedAt, LS.get(SYNC_KEYS.scheduleApplied))) {
          const { schedule, meta } = await this.readSchedule();
          if (schedule && meta?.updatedAt) {
            window.dispatchEvent(new CustomEvent("sync:apply:schedule", { detail: { schedule, meta } }));
            LS.set(SYNC_KEYS.scheduleApplied, meta.updatedAt);
          }
        }
        const overridesMeta = versions?.overridesMeta || {};
        for (const [dateKey, meta] of Object.entries(overridesMeta)) {
          const localTs = LS.get(SYNC_KEYS.overrideAppliedPrefix + dateKey);
          if (meta?.updatedAt && isNewer(meta.updatedAt, localTs)) {
            const { override, meta: ometa } = await this.readOverride(dateKey);
            if (override && ometa?.updatedAt) {
              window.dispatchEvent(new CustomEvent("sync:apply:override", { detail: { dateKey, override, meta: ometa } }));
              LS.set(SYNC_KEYS.overrideAppliedPrefix + dateKey, ometa.updatedAt);
            }
          }
        }
        if (beacon.updatedAt) {
          LS.set(SYNC_KEYS.beaconApplied, beacon.updatedAt);
        }
      }catch(e){
        log("WRN","SyncService","polling tick error", { error: String(e) });
      }
    };
    tick();
    return setInterval(tick, intervalMs);
  }
};

export default SyncService;
