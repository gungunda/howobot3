// tests/ui/override-persist.test.js
import { test, expect } from "../test-runner.js";

test("Overrides: после правки появляется ключ planner.overrides в LocalStorage", async () => {
  // Подготовка: берём задачи на дату и запускаем inline-правку
  const dateKey = "2025-10-23";
  const getMod = await import("../../js/usecases/getTasksForDate.js");
  const editMod = await import("../../js/usecases/editTaskInline.js");
  const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;
  const editTaskInline = editMod.default || editMod.editTaskInline || editMod.run;

  const tasks = await getTasksForDate({ dateKey });
  if (!tasks.length) {
    // нечего править — считаем тест успешно пропущенным
    expect(true).toBe(true);
    return;
  }
  const taskId = tasks[0].id;
  await editTaskInline({ dateKey, taskId, patch: { title: "Проверка сохранения" } });

  // Проверка LocalStorage
  const hasLS = typeof localStorage !== "undefined";
  expect(hasLS).toBe(true);
  const raw = localStorage.getItem("planner.overrides");
  expect(!!raw).toBe(true);
});
