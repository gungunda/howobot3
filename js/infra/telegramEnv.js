// js/infra/telegramEnv.js
// Слой доступа к хранилищу данных.
// Работает либо через Telegram.WebApp.CloudStorage (если доступно),
// либо через localStorage браузера.
//
// Экспортируется объект Storage с методами:
//   init(), getMode(), getItem(), setItem(), removeItems(), getKeys()
//
// ВАЖНО: init() вызывается один раз в app.js перед запуском UI.

const tg = (function getTelegramWebApp() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
})();

// Обёртка с таймаутом, чтобы не зависнуть навсегда на неотвечающем API Телеграма.
function withTimeout(promise, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Telegram CloudStorage timeout")), ms);
    promise
      .then(v => { clearTimeout(t); resolve(v); })
      .catch(e => { clearTimeout(t); reject(e); });
  });
}

// Cloud = низкоуровневый адаптер к Telegram.WebApp.CloudStorage
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

  return {
    supported: true,
    getItem,
    setItem,
    removeItems,
    getKeys
  };
})();

// Storage = высокоуровневый сервис, которым пользуется всё приложение
export const Storage = (() => {
  // mode:
  //  "cloud_probe"  -> мы думаем, что CloudStorage доступен, но ещё не проверяли запись.
  //  "cloud"        -> CloudStorage проверен и рабочий.
  //  "local"        -> работаем через localStorage.
  //  "cloud_fallback" -> CloudStorage отказал, переключились на localStorage.
  let mode = Cloud.supported ? "cloud_probe" : "local";

  async function probeCloud() {
    const probeKey = "__probe__";
    const probeVal = String(Date.now());
    try {
      const okSet = await Cloud.setItem(probeKey, probeVal);
      const back  = await Cloud.getItem(probeKey);
      await Cloud.removeItems([probeKey]).catch(() => {});
      return okSet && back === probeVal;
    } catch (_) {
      return false;
    }
  }

  // init() вызывается в app.js перед стартом UI.
  // Здесь мы окончательно решаем, куда пишем данные.
  async function init() {
    if (mode === "cloud_probe") {
      mode = (await probeCloud()) ? "cloud" : "local";
    }
    if (tg) {
      try { tg.expand(); } catch(_) {}
    }
    console.log("[Storage.init] mode resolved =", mode);
  }

  function getMode() { return mode; }

  async function getItem(key) {
    if (mode === "cloud" && Cloud.supported) {
      try {
        return await Cloud.getItem(key);
      } catch (e) {
        console.warn("Cloud.getItem failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn("localStorage.getItem failed:", err);
      return null;
    }
  }

  async function setItem(key, value) {
    console.log("[Storage.setItem] mode =", mode, "key =", key, "value.length =", (value?.length ?? 0));

    if (mode === "cloud" && Cloud.supported) {
      try {
        const ok = await Cloud.setItem(key, value);
        if (ok) {
          console.log("[Storage.setItem] saved to CLOUD ok");
          return;
        }
        console.warn("[Storage.setItem] cloud returned !ok, switching to fallback");
        mode = "cloud_fallback";
      } catch (e) {
        console.warn("[Storage.setItem] Cloud.setItem failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }

    try {
      localStorage.setItem(key, value);
      console.log("[Storage.setItem] saved to LOCAL ok");
    } catch (err) {
      console.error("[Storage.setItem] localStorage.setItem FAILED:", err);
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
        console.warn("Cloud.removeItems failed, fallback to local:", e);
        mode = "cloud_fallback";
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
        console.warn("Cloud.getKeys failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    const out = [];
    try {
      for (let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) out.push(k);
      }
    } catch (err) {
      console.warn("[Storage.getKeys] localStorage iteration failed:", err);
    }
    console.log("[Storage.getKeys] local keys =", out);
    return out;
  }

  return { init, getMode, getItem, setItem, removeItems, getKeys };
})();