/**
 * Простейшие "тесты"-заглушки без фреймворка.
 * Дальше можно подключить любой runner, но пока просто ручные проверки.
 */
import { Task } from "../js/domain/entities.js";

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

export function runEntitiesTests() {
  const t = new Task({ id: "math1", title: "Математика", minutes: 60 });
  t.increaseProgress(10);
  assert(t.progress === 10, "progress should be 10 after +10");
  t.decreaseProgress(10);
  assert(t.progress === 0, "progress should be 0 after -10");
  return "entities.test.js: OK";
}
