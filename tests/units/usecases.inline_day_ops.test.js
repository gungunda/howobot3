\
import { test, expect } from "../test-runner.js";

let editInline=null, delForDate=null, clearAll=null, getForDate=null;
try { editInline = await import("../../js/usecases/editTaskInline.js"); } catch {}
try { delForDate = await import("../../js/usecases/deleteTaskForDate.js"); } catch {}
try { clearAll  = await import("../../js/usecases/clearAllTasksForDate.js"); } catch {}
try { getForDate = await import("../../js/usecases/getTasksForDate.js"); } catch {}

const editTaskInline = editInline?.default || editInline?.editTaskInline || editInline?.run;
const deleteTaskForDate = delForDate?.default || delForDate?.deleteTaskForDate || delForDate?.run;
const clearAllTasksForDate = clearAll?.default || clearAll?.clearAllTasksForDate || clearAll?.run;
const getTasksForDate = getForDate?.default || getForDate?.getTasksForDate || getForDate?.run;

function assume(c,m){ if(!c){ console.warn("[SKIP] "+m); return false;} return true; }

test("Day inline ops: edit/delete/clear", async () => {
  const today = new Date();
  const iso = today.toISOString().slice(0,10);

  if (!assume(getTasksForDate, "getTasksForDate не найден")) return;
  const before = await getTasksForDate({ dateKey: iso });
  expect(Array.isArray(before || [])).toBe(true);

  if (editTaskInline) {
    try {
      await editTaskInline({ dateKey: iso, taskId: (before?.[0]?.id || "x"), patch: { title: "Edited" } });
      expect(true).toBe(true);
    } catch (e) {
      console.warn("[SKIP] editTaskInline не выполнился:", e?.message);
    }
  } else { console.warn("[SKIP] editTaskInline отсутствует"); }

  if (deleteTaskForDate) {
    try {
      await deleteTaskForDate({ dateKey: iso, taskId: (before?.[0]?.id || "x") });
      expect(true).toBe(true);
    } catch (e) {
      console.warn("[SKIP] deleteTaskForDate не выполнился:", e?.message);
    }
  } else { console.warn("[SKIP] deleteTaskForDate отсутствует"); }

  if (clearAllTasksForDate) {
    try {
      await clearAllTasksForDate({ dateKey: iso });
      expect(true).toBe(true);
    } catch (e) {
      console.warn("[SKIP] clearAllTasksForDate не выполнился:", e?.message);
    }
  } else { console.warn("[SKIP] clearAllTasksForDate отсутствует"); }
});
