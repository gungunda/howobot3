/* js/infra/telegramEnv.js
   Абстракция Storage: "cloud" (Telegram CloudStorage) или "local" (localStorage).
   Добавлено безопасное преобразование ключей для CloudStorage (без точек и пр.).
*/

let MODE = "cloud_probe"; // "cloud" | "local" | "cloud_probe"

function log(mode, ...args) {
  const ts = new Date().toISOString();
  console.log(`[Storage.${mode}]`, ...args);
}

// допустимые ключи для CloudStorage — без точек и с ограничением длины.
// аккуратно транслируем только В CLOUD-РЕЖИМЕ, в LOCAL ничего не меняем.
function toCloudKey(key) {
  // упрощённо: заменим все небезопасные символы на подчеркивание
  // (точки, пробелы и т.д.). Ограничим длину до 64 символов.
  const safe = String(key).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return safe;
}

export async function init() {
  try {
    const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
    const verStr = tg?.version || "0.0";
    const ver = parseFloat(verStr) || 0;

    if (!tg || ver < 6.0) {
      MODE = "local";
      log("init", "Telegram detected=false or version<6.0 → fallback to local");
      return;
    }

    // проба CloudStorage: set → get → delete
    try {
      const reqId = Math.random().toString(36).slice(2);
      tg.postEvent("web_app_invoke_custom_method", {
        req_id: reqId,
        method: "saveStorageValue",
        params: { key: "__probe__", value: Date.now().toString() }
      });

      // ждём ответ (очень простой одноразовый промис)
      await new Promise((resolve, reject) => {
        const handler = (e) => {
          const data = e?.detail || e;
          if (data?.eventType === "custom_method_invoked" && data?.req_id === reqId) {
            tg.offEvent("receiveEvent", handler);
            if (data?.result === true) resolve();
            else reject(new Error("probe_save_failed"));
          }
        };
        tg.onEvent("receiveEvent", handler);
        setTimeout(() => reject(new Error("probe_timeout")), 1500);
      });

      MODE = "cloud";
      log("init", `Telegram detected=true, version=${verStr}, mode=cloud`);
    } catch {
      MODE = "local";
      log("init", "Cloud probe failed → local");
    }
  } catch {
    MODE = "local";
    log("init", "unexpected error → local");
  }
}

export function getMode() {
  return MODE;
}

export async function getItem(key) {
  if (MODE === "cloud") {
    try {
      const tg = window.Telegram.WebApp;
      const reqId = Math.random().toString(36).slice(2);
      const cloudKey = toCloudKey(key);

      tg.postEvent("web_app_invoke_custom_method", {
        req_id: reqId,
        method: "getStorageValues",
        params: { keys: [cloudKey] }
      });

      const result = await new Promise((resolve) => {
        const handler = (e) => {
          const data = e?.detail || e;
          if (data?.eventType === "custom_method_invoked" && data?.req_id === reqId) {
            tg.offEvent("receiveEvent", handler);
            resolve(data);
          }
        };
        tg.onEvent("receiveEvent", handler);
        setTimeout(() => resolve({ error: "timeout" }), 1500);
      });

      if (result?.result && typeof result.result[cloudKey] === "string") {
        return JSON.parse(result.result[cloudKey]);
      } else {
        if (result?.error) {
          console.warn("[Storage.getItem] Cloud failed → local:", result.error);
        }
        // падение в local — как и раньше
      }
    } catch (e) {
      console.warn("[Storage.getItem] Cloud exception → local:", String(e));
    }
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  if (MODE === "cloud") {
    try {
      const tg = window.Telegram.WebApp;
      const reqId = Math.random().toString(36).slice(2);
      const cloudKey = toCloudKey(key);

      tg.postEvent("web_app_invoke_custom_method", {
        req_id: reqId,
        method: "saveStorageValue",
        params: { key: cloudKey, value: JSON.stringify(value) }
      });

      const result = await new Promise((resolve) => {
        const handler = (e) => {
          const data = e?.detail || e;
          if (data?.eventType === "custom_method_invoked" && data?.req_id === reqId) {
            tg.offEvent("receiveEvent", handler);
            resolve(data);
          }
        };
        tg.onEvent("receiveEvent", handler);
        setTimeout(() => resolve({ error: "timeout" }), 1500);
      });

      if (result?.result === true) return true;
      if (result?.error) {
        console.warn("[Storage.setItem] Cloud failed → local:", result.error);
      }
      // падение в local
    } catch (e) {
      console.warn("[Storage.setItem] Cloud exception → local:", String(e));
    }
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function getKeys() {
  if (MODE === "cloud") {
    // У Telegram CloudStorage нет метода "получить список всех ключей".
    // Поэтому в cloud-режиме вернём пустой список (repo умеет жить без этого),
    // а локально — реальные ключи.
  }

  try {
    const out = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      out.push(window.localStorage.key(i));
    }
    return out;
  } catch {
    return [];
  }
}

/* === ВАЖНОЕ ДОБАВЛЕНИЕ ===
   Именованный объект-обёртка, чтобы импорт в repo.js
   `import { Storage } from '../infra/telegramEnv.js'` работал корректно.
   При этом сохраняем и прежние именованные функции (init/getMode/…),
   чтобы не ломать другие места.
*/
export const Storage = {
  init,
  getMode,
  getItem,
  setItem,
  getKeys
};
