/**
 * js/infra/telegramEnv.js
 * 
 * Слой доступа к хранилищу данных.
 * Работает либо через Telegram.WebApp.CloudStorage (если реально поддерживается),
 * либо через localStorage браузера.
 * 
 * Экспортируется объект Storage с методами:
 *   init(), getMode(), getItem(), setItem(), removeItems(), getKeys(), isTelegramEnv()
 */

const tg = (function getTelegramWebApp() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
})();

// Обёртка с таймаутом (чтобы не зависнуть на неотвечающем API Телеграма)
function withTimeout(promise, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Telegram CloudStorage timeout")), ms);
    promise
      .then(v => { clearTimeout(t); resolve(v); })
      .catch(e => { clearTimeout(t); reject(e); });
  });
}

// --- Cloud adapter -----------------------------------------------------------
const Cloud = (() => {
  const supported =
    !!(tg &&
       tg.CloudStorage &&
       typeof tg.CloudStorage.getItem === "function" &&
       typeof tg.CloudStorage.setItem === "function");

  if (!supported) {
    return { supported: false };
  }

  function getItem(key) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.getItem(key, (err, val) => {
        if (err) return reject(err);
        resolve(val ?? null);
      });
    }));
  }

  function setItem(key, value) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.setItem(key, value, (err, ok) => {
        if (err) return reject(err);
        resolve(ok === true);
      });
    }));
  }

  function removeItems(keysArray) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.removeItems(keysArray, (err, ok) => {
        if (err) return reject(err);
        resolve(ok === true);
      });
    }));
  }

  function getKeys() {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.getKeys((err, arr) => {
        if (err) return reject(err);
        resolve(Array.isArray(arr) ? arr : []);
      });
    }));
  }

  return { supported: true, getItem, setItem, removeItems, getKeys };
})();

// --- Storage service ---------------------------------------------------------
export const Storage = (() => {
  let mode = Cloud.supported ? "cloud_probe" : "local";

  // Проверка версии Telegram WebApp (если доступно)
  function telegramVersion() {
    try {
      const ver = tg?.version ?? "0.0";
      return parseFloat(ver);
    } catch (_) {
      return 0;
    }
  }

  async function probeCloud() {
    const probeKey = "__probe__";
    const probeVal = String(Date.now());
    try {
      const okSet = await Cloud.setItem(probeKey, probeVal);
      const back  = await Cloud.getItem(probeKey);
      await Cloud.removeItems([probeKey]).catch(() => {});
      return okSet && back === probeVal;
    } catch (err) {
      console.warn("[Storage] probeCloud failed:", err);
      return false;
    }
  }

  async function init() {
    const ver = telegramVersion();
    const isInTelegram = !!tg;

    // Раскрываем WebApp (не влияет на режим)
    if (isInTelegram) {
      try { tg.expand(); } catch(_) {}
    }

    // Проверяем доступность CloudStorage по версии
    if (Cloud.supported && ver >= 6.2) {
      try {
        const ok = await probeCloud();
        mode = ok ? "cloud" : "local";
      } catch (err) {
        console.warn("[Storage.init] probeCloud threw:", err);
        mode = "local";
      }
    } else if (Cloud.supported && ver < 6.2) {
      console.warn("[Storage.init] Telegram version", ver, "< 6.2 — CloudStorage not supported, fallback to local.");
      mode = "local";
    } else {
      mode = "local";
    }

    console.log(`[Storage.init] Telegram detected = ${isInTelegram}, version = ${ver}, mode = ${mode}`);
  }

  function getMode() { return mode; }

  function isTelegramEnv() { return !!tg; }

  async function getItem(key) {
    if (mode === "cloud" && Cloud.supported) {
      try {
        return await Cloud.getItem(key);
      } catch (e) {
        console.warn("[Storage.getItem] Cloud failed → fallback to local:", e);
        mode = "local";
      }
    }
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn("[Storage.getItem] localStorage failed:", err);
      return null;
    }
  }

  async function setItem(key, value) {
    console.log("[Storage.setItem] mode =", mode, "key =", key);
    if (mode === "cloud" && Cloud.supported) {
      try {
        const ok = await Cloud.setItem(key, value);
        if (ok) {
          console.log("[Storage.setItem] saved to CLOUD ok");
          return;
        }
        console.warn("[Storage.setItem] cloud returned !ok, switching to local");
        mode = "local";
      } catch (e) {
        console.warn("[Storage.setItem] Cloud failed → fallback to local:", e);
        mode = "local";
      }
    }
    try {
      localStorage.setItem(key, value);
      console.log("[Storage.setItem] saved to LOCAL ok");
    } catch (err) {
      console.error("[Storage.setItem] localStorage FAILED:", err);
    }
  }

  async function removeItems(keysArray) {
    if (!Array.isArray(keysArray)) return;
    if (mode === "cloud" && Cloud.supported) {
      try {
        await Cloud.removeItems(keysArray);
        console.log("[Storage.removeItems] cloud ok", keysArray);
        return;
      } catch (e) {
        console.warn("[Storage.removeItems] Cloud failed → fallback to local:", e);
        mode = "local";
      }
    }
    for (const k of keysArray) {
      try {
        localStorage.removeItem(k);
        console.log("[Storage.removeItems] local ok", k);
      } catch (err) {
        console.error("[Storage.removeItems] local remove FAILED:", err, k);
      }
    }
  }

  async function getKeys() {
    if (mode === "cloud" && Cloud.supported) {
      try {
        const arr = await Cloud.getKeys();
        console.log("[Storage.getKeys] cloud keys =", arr);
        return arr;
      } catch (e) {
        console.warn("[Storage.getKeys] Cloud failed → fallback to local:", e);
        mode = "local";
      }
    }
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) out.push(k);
      }
    } catch (err) {
      console.warn("[Storage.getKeys] localStorage iteration failed:", err);
    }
    console.log("[Storage.getKeys] local keys =", out);
    return out;
  }

  return { init, getMode, isTelegramEnv, getItem, setItem, removeItems, getKeys };
})();