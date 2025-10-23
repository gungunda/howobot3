import { test, expect } from "../test-runner.js";
import { editTaskInline } from "/js/usecases/editTaskInline.js";
import { getTasksForDate } from "/js/usecases/getTasksForDate.js";
import { overrideRepo } from "../mocks/app.test.js";

test("editTaskInline: при первом редактировании клонирует задачу из расписания и правит title", async () => {
  const monday = "2025-01-06"; // Пн
  let tasks = await getTasksForDate(monday);
  expect(tasks[0].title).toBe("Математика");

  await editTaskInline(monday, "math", { title: "Алгебра (изменено)" });

  const ov = await overrideRepo.load(monday);
  expect(ov).toBeTruthy();
  expect(ov.tasks.length).toBe(1);
  expect(ov.tasks[0].title).toBe("Алгебра (изменено)");
});
