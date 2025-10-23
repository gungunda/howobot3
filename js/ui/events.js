// js/ui/events.js
// Календарь + inline-редактирование + проценты + чекбокс done + сброс дня.

import { todayKey } from "./helpers.js";
import renderCalendar from "./render-calendar.js";
import renderSchedule from "./render-schedule.js";

export function enableInlineEditing(container = document) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".task-edit");
    if (!btn) return;
    const item = btn.closest(".task-item");
    const list = btn.closest("#schedule");
    if (!item || !list) return;
    const taskId = item.dataset.taskId;
    const dateKey = list.dataset.dateKey || list.getAttribute("data-date-key");
    const titleNode = item.querySelector(".task-title");
    if (!titleNode) return;

    const prevText = titleNode.textContent || "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-title-edit";
    input.value = prevText.replace(/^\(\d+\)%\s*/,'').trim();
    titleNode.replaceWith(input);
    input.focus();
    input.select();

    const editInlineMod = await import("../usecases/editTaskInline.js").catch(() => ({}));
    const getTasksMod   = await import("../usecases/getTasksForDate.js").catch(() => ({}));
    const editTaskInline = editInlineMod.default || editInlineMod.editTaskInline || editInlineMod.run;
    const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;

    async function refresh() {
      const tasks = typeof getTasksForDate === "function" ? await getTasksForDate({ dateKey }) : [];
      renderSchedule(null, { dateKey, tasks });
    }

    async function commit() {
      const newTitle = input.value.trim();
      if (typeof editTaskInline === "function" && taskId) {
        try { await editTaskInline({ dateKey, taskId, patch: { title: newTitle } }); } catch {}
      }
      await refresh();
    }

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit();
      if (ev.key === "Escape") refresh();
    });
    input.addEventListener("blur", () => commit());
  });
}

export function enablePercentControls(container = document) {
  container.addEventListener("click", async (e) => {
    const plus = e.target.closest(".task-pct-plus");
    const minus = e.target.closest(".task-pct-minus");
    if (!plus && !minus) return;

    const item = (plus || minus).closest(".task-item");
    const list = (plus || minus).closest("#schedule");
    if (!item || !list) return;

    const dateKey = list.dataset.dateKey || list.getAttribute("data-date-key");
    const taskId = item.dataset.taskId;
    const delta = plus ? +10 : -10;

    const adjMod = await import("../usecases/adjustTaskPercentForDate.js").catch(() => ({}));
    const getMod = await import("../usecases/getTasksForDate.js").catch(() => ({}));
    const adjustTaskPercentForDate = adjMod.default || adjMod.adjustTaskPercentForDate || adjMod.run;
    const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;

    if (typeof adjustTaskPercentForDate === "function" && taskId) {
      try { await adjustTaskPercentForDate({ dateKey, taskId, delta }); } catch {}
    }
    const tasks = typeof getTasksForDate === "function" ? await getTasksForDate({ dateKey }) : [];
    renderSchedule(null, { dateKey, tasks });
  });
}

export function enableDoneToggle(container = document) {
  container.addEventListener("change", async (e) => {
    const cb = e.target.closest(".task-done");
    if (!cb) return;
    const item = cb.closest(".task-item");
    const list = cb.closest("#schedule");
    if (!item || !list) return;

    const dateKey = list.dataset.dateKey || list.getAttribute("data-date-key");
    const taskId = item.dataset.taskId;

    const toggleMod = await import("../usecases/toggleTaskDoneForDate.js").catch(() => ({}));
    const getMod    = await import("../usecases/getTasksForDate.js").catch(() => ({}));
    const toggleTaskDoneForDate = toggleMod.default || toggleMod.toggleTaskDoneForDate || toggleMod.run;
    const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;

    if (typeof toggleTaskDoneForDate === "function" && taskId) {
      try { await toggleTaskDoneForDate({ dateKey, taskId }); } catch {}
    }
    const tasks = typeof getTasksForDate === "function" ? await getTasksForDate({ dateKey }) : [];
    renderSchedule(null, { dateKey, tasks });
  });
}

export function enableResetDay(container = document) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("#reset-day-btn");
    if (!btn) return;
    const list = document.getElementById("schedule");
    if (!list) return;
    const dateKey = list.dataset.dateKey || list.getAttribute("data-date-key");

    const resetMod = await import("../usecases/resetToSchedule.js").catch(() => ({}));
    const getMod   = await import("../usecases/getTasksForDate.js").catch(() => ({}));
    const resetToSchedule = resetMod.default || resetMod.resetToSchedule || resetMod.run;
    const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;

    if (typeof resetToSchedule === "function") {
      try { await resetToSchedule({ dateKey }); } catch {}
    }
    const tasks = typeof getTasksForDate === "function" ? await getTasksForDate({ dateKey }) : [];
    renderSchedule(null, { dateKey, tasks });
  });
}

export async function initUI() {
  const getTasksMod = await import("../usecases/getTasksForDate.js").catch(() => ({}));
  const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;

  let current = todayKey();

  async function refresh(dateKey = current) {
    current = dateKey;
    const tasks = typeof getTasksForDate === "function" ? await getTasksForDate({ dateKey }) : [];
    renderSchedule(null, { dateKey, tasks });
  }

  renderCalendar(null, {
    dateKey: current,
    onChange: (k) => refresh(k)
  });

  enableInlineEditing(document);
  enablePercentControls(document);
  enableDoneToggle(document);
  enableResetDay(document);

  await refresh(current);
}

export default initUI;
