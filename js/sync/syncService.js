/* js/sync/syncService.js
   Синхронизация локальных данных (repo + Storage) с backend (/api/*).
   ВАЖНО: бизнес-логики не меняем; это только сеть и триггеры.
*/

import * as repo from "../data/repo.js";

// =====================
// Вспомогательные функции
// =====================

// initData — подпись Telegram WebApp (для серверной идентификации userId).
function getInitDataSafe() {
  if (
    typeof window !== "undefined" &&
    window.Telegram &&
    window.Telegram.WebApp &&
    typeof window.Telegram.WebApp.initData === "string" &&
    window.Telegram.WebApp.initData.length > 0
  ) {
    return window.Telegram.WebApp.initData;
  }
  return null;
}

// deviceId — простая метка устройства (для отладки "кто писал последним").
function ensureDeviceId() {
  try {
    const KEY = "planner.deviceId";
    let existing = window.localStorage.getItem(KEY);
    if (!existing) {
      existing = "dev_" + Math.random().toString(16).slice(2);
      window.localStorage.setItem(KEY, existing);
    }
    return existing;
  } catch (e) {
    return "dev_" + Math.random().toString(16).slice(2);
  }
}

// POST JSON → JSON (с расширенной диагностикой)
async function postJSON(url, payload) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    console.warn("[SyncService] fetch failed", url, networkErr?.message || networkErr);
    return { ok: false, error: "network_error", detail: String(networkErr) };
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    // игнор
  }

  // пробуем распарсить как JSON
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      ok: false,
      error: "bad_json_response",
      status: res.status,
      bodyPreview: (text || "").slice(0, 200)
    };
  }

  // если сервер вернул non-2xx, но JSON — тоже прокинем статус
  if (!res.ok && data && typeof data === "object") {
    data.ok ??= false;
    data.status ??= res.status;
  }

  return data;
}

function nowIso() {
  return new Date().toISOString();
}

// Локальные meta.updatedAt для сравнения
async function getLocalScheduleMetaUpdatedAt() {
  // Пробуем получить расширенный вариант (если когда-нибудь появится)
  if (typeof repo._getScheduleWithMeta === "function") {
    const pair = await repo._getScheduleWithMeta();
    return pair?.meta?.updatedAt || null;
  }
  // Иначе — у нас пока нет явного способа вытащить meta расписания → вернём null
  return null;
}

async function getLocalOverrideMetaUpdatedAt(dateKey) {
  try {
    const ov = await repo.loadDayOverride(dateKey);
    return ov?.meta?.updatedAt || null;
  } catch {
    return null;
  }
}

// =====================
// Вспомогательные pull'ы
// =====================

async function pullSingleOverride(dateKey, initData) {
  const resp = await postJSON("/api/getOverride", { initData, dateKey });
  if (!resp.ok || !resp.override) return;
  await repo.saveDayOverride(resp.override);
}

async function pullScheduleIfServerNewer(serverUpdatedAt, localUpdatedAt, initData) {
  if (!serverUpdatedAt) return; // на сервере нет расписания
  if (localUpdatedAt && localUpdatedAt >= serverUpdatedAt) return; // локальное не старее

  const resp = await postJSON("/api/getSchedule", { initData });
  if (!resp.ok || !resp.schedule) return;

  if (resp.meta) {
    await repo.saveSchedule(resp.schedule, resp.meta);
  } else {
    await repo.saveSchedule(resp.schedule);
  }
  console.log("[SyncService] pullScheduleIfServerNewer applied schedule");
}

// =====================
// Публичные методы
// =====================

// 1) Полный стартовый pull
async function pullBootstrap() {
  const initData = getInitDataSafe();
  if (!initData) {
    console.log("[SyncService] pullBootstrap skipped (no initData, likely local dev)");
    return;
  }

  const listResp = await postJSON("/api/list", { initData });
  if (!listResp.ok) {
    console.warn("[SyncService] pullBootstrap /api/list failed", listResp);
    return;
  }

  // schedule
  const serverScheduleUpdatedAt =
    listResp.schedule && listResp.schedule.updatedAt
      ? listResp.schedule.updatedAt
      : null;

  const localScheduleUpdatedAt = await getLocalScheduleMetaUpdatedAt();

  await pullScheduleIfServerNewer(
    serverScheduleUpdatedAt,
    localScheduleUpdatedAt,
    initData
  );

  // overrides
  const overridesMap = listResp.overrides || {};
  for (const dateKey of Object.keys(overridesMap)) {
    const serverOverrideUpdatedAt =
      overridesMap[dateKey]?.updatedAt || null;

    const localOverrideUpdatedAt = await getLocalOverrideMetaUpdatedAt(dateKey);

    if (serverOverrideUpdatedAt &&
        (!localOverrideUpdatedAt || localOverrideUpdatedAt < serverOverrideUpdatedAt)) {
      await pullSingleOverride(dateKey, initData);
    }
  }

  console.log("[SyncService] pullBootstrap done");
}

// 2) Периодический poll
async function pollUpdates() {
  const initData = getInitDataSafe();
  if (!initData) return;

  const listResp = await postJSON("/api/list", { initData });
  if (!listResp.ok) return;

  const serverScheduleUpdatedAt = listResp.schedule?.updatedAt || null;
  const localScheduleUpdatedAt  = await getLocalScheduleMetaUpdatedAt();
  await pullScheduleIfServerNewer(serverScheduleUpdatedAt, localScheduleUpdatedAt, initData);

  const overridesMap = listResp.overrides || {};
  for (const dateKey of Object.keys(overridesMap)) {
    const serverOverrideUpdatedAt = overridesMap[dateKey]?.updatedAt || null;
    const localOverrideUpdatedAt  = await getLocalOverrideMetaUpdatedAt(dateKey);

    if (serverOverrideUpdatedAt &&
        (!localOverrideUpdatedAt || localOverrideUpdatedAt < serverOverrideUpdatedAt)) {
      await pullSingleOverride(dateKey, initData);
    }
  }
}

// 3) После изменения override локально
async function pushOverride(dateKey) {
  const initData = getInitDataSafe();
  if (!initData) {
    console.log("[SyncService] pushOverride skipped (no initData)");
    return;
  }

  if (typeof repo.loadDayOverride !== "function") {
    console.warn("[SyncService] pushOverride: repo.loadDayOverride missing");
    return;
  }

  const overrideObj = await repo.loadDayOverride(dateKey);
  if (!overrideObj) {
    console.warn("[SyncService] pushOverride: no local override for", dateKey);
    return;
  }

  overrideObj.meta ??= {};
  overrideObj.meta.updatedAt ??= new Date().toISOString();
  overrideObj.meta.deviceId  ??= ensureDeviceId();

  const resp = await postJSON("/api/saveOverride", {
    initData,
    dateKey,
    override: overrideObj
  });

  if (!resp.ok) {
    console.warn("[SyncService] pushOverride server error", dateKey, resp);
    return;
  }

  if (resp.applied === false) {
    console.warn("[SyncService] pushOverride not applied (stale)", dateKey, resp.reason);
  } else {
    console.log("[SyncService] pushOverride applied OK for", dateKey);
  }
}

// 4) После изменения расписания недели локально
async function pushSchedule() {
  const initData = getInitDataSafe();
  if (!initData) {
    console.log("[SyncService] pushSchedule skipped (no initData)");
    return;
  }

  if (typeof repo.loadSchedule !== "function") {
    console.warn("[SyncService] pushSchedule: repo.loadSchedule missing");
    return;
  }

  const scheduleObj = await repo.loadSchedule();
  if (!scheduleObj) {
    console.warn("[SyncService] pushSchedule: no local schedule");
    return;
  }

  const clientMeta = {
    updatedAt: new Date().toISOString(),
    deviceId: ensureDeviceId()
  };

  const resp = await postJSON("/api/saveSchedule", {
    initData,
    schedule: scheduleObj,
    clientMeta
  });

  if (!resp.ok) {
    console.warn("[SyncService] pushSchedule server error", resp);
    return;
  }

  if (resp.applied === false) {
    console.warn("[SyncService] pushSchedule not applied (stale)", resp.reason);
  } else {
    console.log("[SyncService] pushSchedule applied OK");
  }
}

const SyncService = {
  pullBootstrap,
  pollUpdates,
  pushOverride,
  pushSchedule
};

export default SyncService;
