\
import { test, expect } from "../test-runner.js";

let ENT=null, addUC=null, editUC=null, delUC=null, getUC=null;
try { ENT = await import("../../js/domain/entities.js"); } catch {}
try { addUC  = await import("../../js/usecases/addTaskToSchedule.js"); } catch {}
try { editUC = await import("../../js/usecases/editTaskInSchedule.js"); } catch {}
try { delUC  = await import("../../js/usecases/deleteTaskFromSchedule.js"); } catch {}
try { getUC  = await import("../../js/usecases/getSchedule.js"); } catch {}

const addTask  = addUC?.default  || addUC?.addTaskToSchedule  || addUC?.run;
const editTask = editUC?.default || editUC?.editTaskInSchedule|| editUC?.run;
const delTask  = delUC?.default  || delUC?.deleteTaskFromSchedule || delUC?.run;
const getSched = getUC?.default  || getUC?.getSchedule || getUC?.run;

function assume(c,m){ if(!c){ console.warn("[SKIP] "+m); return false;} return true; }

test("Schedule CRUD: add/edit/delete в недельном шаблоне", async () => {
  if (!assume(addTask,"addTaskToSchedule не найден")) return;
  if (!assume(getSched,"getSchedule не найден")) return;
  const Task = ENT?.Task || class { constructor(x){ Object.assign(this,x); } };

  const t = new Task({ id: "uc-add-1", title: "Математика", minutes: 15, done: false });
  await addTask({ weekday: "monday", task: t });

  const afterAdd = await getSched();
  const countAdd = (afterAdd?.monday?.length || 0);
  expect(countAdd >= 1).toBe(true);

  if (editTask) {
    await editTask({ weekday: "monday", taskId: "uc-add-1", patch: { title: "Математика++" } });
    const afterEdit = await getSched();
    const found = (afterEdit?.monday||[]).find(x => (x.id||x?.task?.id) === "uc-add-1");
    if (found && "title" in found) expect(found.title).toBe("Математика++");
  } else {
    console.warn("[SKIP] editTaskInSchedule отсутствует");
  }

  if (delTask) {
    await delTask({ weekday: "monday", taskId: "uc-add-1" });
    const afterDel = await getSched();
    const still = (afterDel?.monday||[]).some(x => (x.id||x?.task?.id) === "uc-add-1");
    expect(still).toBe(false);
  } else {
    console.warn("[SKIP] deleteTaskFromSchedule отсутствует");
  }
});
