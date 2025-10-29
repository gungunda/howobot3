// js/sync/syncService.js
//
// Этот модуль отвечает за синхронизацию локальных данных (repo + Storage)
// с нашим удалённым KV-хранилищем через серверные функции (/api/* на Vercel).
//
// ВАЖНО:
// - Use cases (js/usecases/*.js) не обращаются к сети напрямую. Они только обновляют repo локально.
// - UI-контроллер (js/ui/events.js) решает, КОГДА вызывать синхронизацию.
//   Примеры:
//     * при старте приложения → pullBootstrap()
//     * периодически → pollUpdates()
//     * после локального изменения override → pushOverride(dateKey)
//     * после изменения расписания → pushSchedule()
// - Repo (js/data/repo.js) остаётся единственным источником правды на устройстве.
// - Storage (js/infra/telegramEnv.js) остаётся чистой абстракцией локального хранилища
//   и не знает про сеть.
//
// SyncService ≠ бизнес-логика планировщика.
// Он не решает "что менять". Он только тянет/отправляет данные.
//
// Архитектурно это вписывается в нашу договорённость о слоях.

import * as repo from "../data/repo.js";

// =====================
// Вспомогательные функции
// =====================

// initData — это подпись Telegram WebApp, по ней backend узнаёт userId.
// Если мы не внутри Telegram WebApp (например локально в браузере), initData будет null.
// В таком случае синхронизацию с сервером мы просто пропускаем — приложение работает оффлайн.
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

// Генерируем и кэшируем deviceId — это просто строка, чтобы сервер писал "кто последний менял".
// Это не безопасность, это только отладочная метка.
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

// Обёртка POST JSON → JSON
async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  // пробуем распарсить ответ как JSON
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: "bad_json_response" };
  }

  return data;
}

// текущее время в ISO-формате
function nowIso() {
  return new Date().toISOString();
}

// Безопасный лог. В проекте у нас уже есть механизм вывода логов в UI,
// поэтому мы стараемся использовать console.log/console.warn с префиксом,
// чтобы потом (если надо) перенаправить это в UI-логгер.
function logInfo(...args) {
  console.log("[SyncService]", ...args);
}
function logWarn(...args) {
  console.warn("[SyncService]", ...args);
}

// =====================
// Доступ к локальным meta.updatedAt
// =====================
//
// Нам нужно уметь сравнить локальную версию данных с серверной.
// repo.js сейчас не даёт готовых геттеров типа getScheduleMetaUpdatedAt(),
// но он хранит override целиком (loadDayOverride) и расписание (loadSchedule).
// Мы можем аккуратно их прочитать и достать .meta.updatedAt сами,
// не меняя repo.js прямо сейчас.

async function getLocalScheduleMetaUpdatedAt() {
  // repo.loadSchedule() ожидается как асинхронная функция,
  // которая возвращает объект расписания формата { monday: [...], ... }
  // В нашем хранении расписание и мета лежат раздельно: сами уроки и их служебные данные.
  //
  // Сейчас в repo нет публичного способа получить meta расписания.
  // Временный компромисс для MVP:
  // - мы будем хранить мету расписания отдельно как ключ в Storage через repo.saveSchedule().
  //
  // Чтобы SyncService работал уже сейчас без правок repo.js,
  // мы попытаемся вызвать repo._getScheduleWithMeta?.()
  // Если такой приватный метод не существует — вернём null.
  //
  // После того как ты добавишь поддержку меты в repo (например,
  // repo.getScheduleWithMeta() → {schedule, meta}), мы обновим этот участок.
  if (repo.getScheduleWithMeta) {
    const full = await repo.getScheduleWithMeta();
    if (full && full.meta && full.meta.updatedAt) {
      return full.meta.updatedAt;
    }
  }

  // fallback: нет меты — считаем, что локальная версия "0"
  return null;
}

async function getLocalOverrideMetaUpdatedAt(dateKey) {
  // repo.loadDayOverride(dateKey) должен вернуть override если он есть:
  // {
  //   dateKey: "2025-10-27",
  //   tasks: [...],
  //   meta: {
  //     createdAt,
  //     updatedAt,
  //     deviceId,
  //     userAction
  //   }
  // }
  try {
    const ov = await repo.loadDayOverride(dateKey);
    if (ov && ov.meta && ov.meta.updatedAt) {
      return ov.meta.updatedAt;
    }
  } catch (e) {
    // если дата не существует или loadDayOverride кидает ошибку — просто молчим
  }
  return null;
}

// =====================
// Внутренние помощники pull
// =====================

// Подтянуть один override с сервера и положить в локальное repo
async function pullSingleOverride(dateKey, initData) {
  const resp = await postJSON("/api/getOverride", {
    initData,
    dateKey
  });

  if (!resp.ok) {
    logWarn("pullSingleOverride failed for", dateKey, resp);
    return;
  }

  if (!resp.override) {
    // На сервере нет override для этого дня.
    // Мы НИЧЕГО не стираем локально. Локальные данные считаем важнее.
    return;
  }

  // Теперь нужно сохранить override локально.
  // repo.saveDayOverride(overrideObj) у нас уже есть по архитектуре.
  // saveDayOverride(overrideObj) должен:
  //   - записать этот override в локальное хранилище (Storage),
  //   - обновить кеш repo.
  if (typeof repo.saveDayOverride === "function") {
    await repo.saveDayOverride(resp.override);
    logInfo("pullSingleOverride applied for", dateKey);
  } else {
    logWarn("repo.saveDayOverride() is missing, can't apply override", dateKey);
  }
}

// Подтянуть расписание недели с сервера, если сервер свежее
async function pullScheduleIfServerNewer(serverUpdatedAt, localUpdatedAt, initData) {
  // сравниваем строки ISO: '2025-10-28T10:11:12.123Z'
  // они лексикографически сравнимы по времени
  if (!serverUpdatedAt) return;
  if (localUpdatedAt && localUpdatedAt >= serverUpdatedAt) return;

  // Сервер свежее → надо получить расписание.
  const resp = await postJSON("/api/getSchedule", {
    initData
  });

  if (!resp.ok) {
    logWarn("getSchedule failed", resp);
    return;
  }

  if (!resp.schedule) {
    // На сервере нет расписания — не трогаем локальное.
    return;
  }

  // Сохранить локально.
  // Важно: в repo уже есть saveSchedule(scheduleObj).
  // Нам также нужно сохранить meta.updatedAt в локальной копии.
  //
  // Для этого мы сейчас ожидаем, что потом repo будет уметь
  // принять мету (например repo.saveSchedule(scheduleObj, meta)).
  // Если у тебя текущая версия saveSchedule принимает только scheduleObj,
  // то meta.updatedAt нам девать некуда. Это придётся добавить в repo позже.
  //
  // Здесь мы пытаемся вызвать расширенный вариант.
  if (typeof repo.saveSchedule === "function") {
    if (resp.meta) {
      await repo.saveSchedule(resp.schedule, resp.meta);
    } else {
      await repo.saveSchedule(resp.schedule);
    }
    logInfo("pullScheduleIfServerNewer applied schedule");
  } else {
    logWarn("repo.saveSchedule() is missing, can't apply schedule from server");
  }
}

// =====================
// Публичные методы SyncService
// =====================

// 1. pullBootstrap()
//    Вызывается один раз при старте приложения (после Storage.init()).
//    Делает полную синхронизацию:
//      - узнаёт с сервера версии (updatedAt) расписания и override-дней,
//      - для тех, что свежее сервера → тянет свежие данные,
//      - кладёт их в repo локально.
async function pullBootstrap() {
  const initData = getInitDataSafe();
  if (!initData) {
    // не в Telegram → синк просто не делаем
    logInfo("pullBootstrap skipped (no initData, likely local dev)");
    return;
  }

  const listResp = await postJSON("/api/list", { initData });
  if (!listResp.ok) {
    logWarn("pullBootstrap /api/list failed", listResp);
    return;
  }

  // 1. расписание
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

  // 2. overrides по датам
  const overridesMap = listResp.overrides || {};
  const dateKeys = Object.keys(overridesMap);

  for (const dateKey of dateKeys) {
    const serverOverrideUpdatedAt =
      overridesMap[dateKey] && overridesMap[dateKey].updatedAt
        ? overridesMap[dateKey].updatedAt
        : null;

    const localOverrideUpdatedAt = await getLocalOverrideMetaUpdatedAt(dateKey);

    // Если на сервере запись свежее, чем у нас локально — забираем.
    if (
      serverOverrideUpdatedAt &&
      (!localOverrideUpdatedAt ||
        localOverrideUpdatedAt < serverOverrideUpdatedAt)
    ) {
      await pullSingleOverride(dateKey, initData);
    }
  }

  logInfo("pullBootstrap done");
}

// 2. pollUpdates()
//    Можно вызывать раз в 30-60 секунд через setInterval.
//    Логика почти такая же, как pullBootstrap, только она не трогает ничего лишнего.
//    Идея: если кто-то правил планировщик на другом устройстве, мы дотягиваем эти изменения.
async function pollUpdates() {
  const initData = getInitDataSafe();
  if (!initData) {
    // оффлайн/не в Telegram — просто не синкаем
    return;
  }

  const listResp = await postJSON("/api/list", { initData });
  if (!listResp.ok) {
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
      overridesMap[dateKey] && overridesMap[dateKey].updatedAt
        ? overridesMap[dateKey].updatedAt
        : null;

    const localOverrideUpdatedAt = await getLocalOverrideMetaUpdatedAt(
      dateKey
    );

    if (
      serverOverrideUpdatedAt &&
      (!localOverrideUpdatedAt ||
        localOverrideUpdatedAt < serverOverrideUpdatedAt)
    ) {
      await pullSingleOverride(dateKey, initData);
    }
  }
}

// 3. pushOverride(dateKey)
//    Вызывается ПОСЛЕ того как use case изменил прогресс в конкретном дне,
//    и repo уже сохранил override локально.
//    Задача — отправить этот override на сервер.
async function pushOverride(dateKey) {
  const initData = getInitDataSafe();
  if (!initData) {
    // не в Telegram → не пушим, но локально всё уже сохранено
    logInfo("pushOverride skipped (no initData)");
    return;
  }

  if (typeof repo.loadDayOverride !== "function") {
    logWarn("pushOverride: repo.loadDayOverride missing");
    return;
  }

  const overrideObj = await repo.loadDayOverride(dateKey);
  if (!overrideObj) {
    logWarn("pushOverride: no local override for", dateKey);
    return;
  }

  // Гарантируем meta.updatedAt и meta.deviceId
  if (!overrideObj.meta) {
    overrideObj.meta = {};
  }
  if (!overrideObj.meta.updatedAt) {
    overrideObj.meta.updatedAt = nowIso();
  }
  if (!overrideObj.meta.deviceId) {
    overrideObj.meta.deviceId = ensureDeviceId();
  }

  const resp = await postJSON("/api/saveOverride", {
    initData,
    dateKey,
    override: overrideObj
  });

  if (!resp.ok) {
    logWarn("pushOverride server error", dateKey, resp);
    return;
  }

  if (resp.applied === false) {
    // Сервер сказал "stale" → значит там более свежая версия.
    // На этом этапе мы не делаем авто-merge.
    // Мы просто в следующий pollUpdates() стянем свежак.
    logWarn("pushOverride not applied (stale)", dateKey, resp.reason);
  } else {
    logInfo("pushOverride applied OK for", dateKey);
  }
}

// 4. pushSchedule()
//    Вызывается ПОСЛЕ изменения расписания недели (добавил задачу, поменял минуты и т.д.).
//    repo уже обновлён локально — теперь надо отправить новую версию расписания.
async function pushSchedule() {
  const initData = getInitDataSafe();
  if (!initData) {
    logInfo("pushSchedule skipped (no initData)");
    return;
  }

  if (typeof repo.loadSchedule !== "function") {
    logWarn("pushSchedule: repo.loadSchedule missing");
    return;
  }

  const scheduleObj = await repo.loadSchedule();
  if (!scheduleObj) {
    logWarn("pushSchedule: no local schedule");
    return;
  }

  const clientMeta = {
    updatedAt: nowIso(),
    deviceId: ensureDeviceId()
  };

  const resp = await postJSON("/api/saveSchedule", {
    initData,
    schedule: scheduleObj,
    clientMeta
  });

  if (!resp.ok) {
    logWarn("pushSchedule server error", resp);
    return;
  }

  if (resp.applied === false) {
    // сервер считает нашу версию устаревшей
    logWarn("pushSchedule not applied (stale)", resp.reason);
  } else {
    logInfo("pushSchedule applied OK");
  }
}

const SyncService = {
  pullBootstrap,
  pollUpdates,
  pushOverride,
  pushSchedule
};

export default SyncService;