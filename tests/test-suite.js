import { run, render } from "./test-runner.js";

// Подключаем сами тесты
import "./units/entities.task.test.js";
import "./units/usecases.getTasksForDate.test.js";
import "./units/usecases.editTaskInline.test.js";

export async function runAllTests() {
  const results = await run();
  return render(results);
}
