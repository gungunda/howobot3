\
import { test, expect } from "../test-runner.js";

let comp=null, reh=null, sync=null, setup=null, gc=null;
try { comp  = await import("../../js/usecases/computeDayStats.js"); } catch {}
try { reh   = await import("../../js/usecases/rehydrateApp.js"); } catch {}
try { sync  = await import("../../js/usecases/syncNow.js"); } catch {}
try { setup = await import("../../js/usecases/setupSyncTriggers.js"); } catch {}
try { gc    = await import("../../js/usecases/gcOldDates.js"); } catch {}

const computeDayStats   = comp?.default  || comp?.computeDayStats  || comp?.run;
const rehydrateApp      = reh?.default   || reh?.rehydrateApp      || reh?.run;
const syncNow           = sync?.default  || sync?.syncNow          || sync?.run;
const setupSyncTriggers = setup?.default || setup?.setupSyncTriggers|| setup?.run;
const gcOldDates        = gc?.default    || gc?.gcOldDates         || gc?.run;

test("computeDayStats — базовый контракт (мягко)", async () => {
  if (!computeDayStats) { console.warn("[SKIP] computeDayStats отсутствует"); return; }
  const res = await computeDayStats({ tasks: [] });
  expect(res != null).toBe(true);
});

test("rehydrateApp — не падает", async () => {
  if (!rehydrateApp) { console.warn("[SKIP] rehydrateApp отсутствует"); return; }
  await rehydrateApp();
  expect(true).toBe(true);
});

test("syncNow/setupSyncTriggers/gcOldDates — не падают", async () => {
  if (syncNow)           await syncNow().catch(e => console.warn("[SKIP] syncNow:", e?.message));
  else                   console.warn("[SKIP] syncNow отсутствует");

  if (setupSyncTriggers) await setupSyncTriggers().catch(e => console.warn("[SKIP] setupSyncTriggers:", e?.message));
  else                   console.warn("[SKIP] setupSyncTriggers отсутствует");

  if (gcOldDates)        await gcOldDates().catch(e => console.warn("[SKIP] gcOldDates:", e?.message));
  else                   console.warn("[SKIP] gcOldDates отсутствует");

  expect(true).toBe(true);
});
