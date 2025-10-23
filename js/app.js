
import rehydrateApp from "./usecases/rehydrateApp.js";
import { initUI } from "./ui/events.js";

window.addEventListener("DOMContentLoaded", async ()=>{
  await rehydrateApp();
  await initUI();
});
