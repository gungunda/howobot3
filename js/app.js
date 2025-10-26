// js/app.js
import { Storage } from "./infra/telegramEnv.js";
// допустим, initUI из существующего UI-кода
import { initUI } from "./ui/events.js";

await Storage.init();
initUI();
