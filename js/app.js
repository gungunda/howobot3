import { Storage } from "./infra/telegramEnv.js";
import initUI from "./ui/events.js"; // теперь default import

// Универсальный логгер: вывод в консоль и внизу экрана
function pushToDebugPane(text) {
  try {
    const box = document.getElementById("debug-log");
    if (!box) return;
    box.textContent += text + "\n";
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
  } catch (_) {}
}

function debugLog(...args) {
  const line = args.map(x => {
    if (typeof x === "object") {
      try { return JSON.stringify(x); } catch(_) { return String(x); }
    }
    return String(x);
  }).join(" ");
  console.log(line);
  pushToDebugPane(line);
}

window.debugLog = debugLog;

// Точка входа
async function main() {
  await Storage.init();
  debugLog("[app] Storage mode =", Storage.getMode && Storage.getMode());
  initUI();
}

main().catch(err => {
  debugLog("[app] fatal init error", err);
});