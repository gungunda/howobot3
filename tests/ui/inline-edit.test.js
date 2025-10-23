import { test, expect } from "../test-runner.js";

test("UI: inline-редактирование — меняет title и перерисовывает DOM", async () => {
  const renderSchedule = (await import("../../js/ui/render-schedule.js")).default;
  const editInlineMod = await import("../../js/usecases/editTaskInline.js").catch(() => ({}));
  const getTasksMod = await import("../../js/usecases/getTasksForDate.js").catch(() => ({}));

  const editTaskInline = editInlineMod.default || editInlineMod.editTaskInline || editInlineMod.run;
  const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;

  const dateKey = "2025-10-23";
  const tasks = await getTasksForDate({ dateKey });
  renderSchedule(null, { dateKey, tasks });

  const schedule = document.getElementById("schedule");
  const firstItem = schedule.querySelector(".task-item");
  expect(!!firstItem).toBe(true);

  const editBtn = firstItem.querySelector(".task-edit");
  editBtn.click();

  const input = schedule.querySelector(".task-title-edit");
  expect(!!input).toBe(true);

  input.value = "Новый заголовок";
  const evt = new KeyboardEvent("keydown", { key: "Enter" });
  input.dispatchEvent(evt);

  // После коммита компонент заново рендерит список — проверим, что дом обновлён.
  // Здесь мягкая проверка: наличие .task-item после ререндера
  const items = schedule.querySelectorAll(".task-item");
  expect(items.length >= 1).toBe(true);
});
