import { test, expect } from "../test-runner.js";
import { getTasksForDate } from "/js/usecases/getTasksForDate.js";

test("getTasksForDate: без override возвращает задачи из расписания по weekday", async () => {
  const monday = "2025-01-06"; // Пн
  const tasks = await getTasksForDate(monday);
  expect(tasks.length).toBe(1);
  expect(tasks[0].title).toBe("Математика");
});
