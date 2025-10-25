// js/ui/events.js
// ------------------------------------------------------------
// Управление состоянием UI, навигация и обработка кликов.
// Добавлено:
//
// 1) dashboardEdit:
//    - для обычных задач ("core") при клике ✎ открывается инлайн-форма
//    - для разгрузочных задач ("offload") при клике ✎ показывается подсказка,
//      где править эту задачу
//
// state.dashboardEdit = {
//   taskId: string,
//   source: 'core' | 'offload',
//   mainWeekday: string,     // день недели расписания, откуда эта задача
//   targetDateKey: string    // дата override, куда сохраняем правку для core
// }
//
// 2) Мы по-прежнему экспортируем bindDashboard для тестов.

import { updateDashboardView } from "./view-dashboard.js";
import { updateWeekView } from "./view-week.js";
import { updateCalendarView } from "./view-calendar.js";
import { todayKey } from "./helpers.js";

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДАТ
// ============================================================================

// dateKey ('YYYY-MM-DD') -> Date
function dateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

// Date -> 'YYYY-MM-DD'
function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// addDaysToDateKey('2025-10-24', 1) -> '2025-10-25'
function addDaysToDateKey(dateKey, n) {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + Number(n || 0));
  return keyFromDate(d);
}

// weekdayKeyFromDateKey('2025-10-24') -> 'friday'
function weekdayKeyFromDateKey(dateKey) {
  const d = dateFromKey(dateKey);
  const map = [
    "sunday",    // 0
    "monday",    // 1
    "tuesday",   // 2
    "wednesday", // 3
    "thursday",  // 4
    "friday",    // 5
    "saturday"   // 6
  ];
  return map[d.getDay()] || "monday";
}

// 'monday' -> 'sunday', 'tuesday' -> 'monday', ...
function prevWeekdayKey(dayKey) {
  const prevMap = {
    monday: "sunday",
    tuesday: "monday",
    wednesday: "tuesday",
    thursday: "wednesday",
    friday: "thursday",
    saturday: "friday",
    sunday: "saturday"
  };
  return prevMap[dayKey] || "saturday";
}

// найти ближайшую ВПЕРЁД дату (включая стартовую), у которой weekday == targetWeekday
function nextDateKeyForWeekday(fromDateKey, targetWeekday) {
  for (let step = 0; step < 7; step++) {
    const probeKey = addDaysToDateKey(fromDateKey, step);
    if (weekdayKeyFromDateKey(probeKey) === targetWeekday) {
      return probeKey;
    }
  }
  return fromDateKey; // fallback, не должен сработать
}

// ============================================================================
// СТАТИСТИКА ДНЯ
// ============================================================================
async function statsFor(tasks) {
  // Пытаемся вызвать computeDayStats (если он есть)
  try {
    const m = await import("../usecases/computeDayStats.js");
    const fn = m.default || m.computeDayStats || m.run;
    if (typeof fn === "function") {
      const r = await fn({ tasks });
      if (r) return r;
    }
  } catch (e) {
    // молча fallback ниже
  }

  // fallback: считаем сами
  let totalMinutes = 0;
  let doneMinutes = 0;
  let sumPct = 0;
  let n = 0;

  for (const t of tasks || []) {
    const mins = Number(t.minutes) || 0;
    const pctRaw = Number(t.donePercent) || 0;
    const pct = Math.max(0, Math.min(100, pctRaw));

    totalMinutes += mins;
    doneMinutes += (mins * pct) / 100;
    sumPct += pct;
    n++;
  }

  const doneAvg = n ? Math.round(sumPct / n) : 0;
  return { totalMinutes, doneMinutes, doneAvg };
}

// ============================================================================
// normalizeTaskForDay
// Делает задачу безопасной для UI.
// ============================================================================
function normalizeTaskForDay(t) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round(Number(t?.donePercent || 0)))
  );

  let offloadDays = null;
  if (Array.isArray(t?.offloadDays)) {
    offloadDays = [...t.offloadDays];
  }

  return {
    id: String(t?.id || ""),
    title: String(t?.title || "Без названия"),
    minutes: Math.max(0, Number(t?.minutes) || 0),
    donePercent: pct,
    done: pct >= 100,
    offloadDays
  };
}

// ============================================================================
// buildDayViewModel(dateKey)
// Возвращает данные для дашборда:
//   coreTasks    -> задания "на завтра"
//   offloadTasks -> задания "разгрузки"
// ============================================================================
async function buildDayViewModel(dateKey) {
  // грузим репозитории
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const schRepo = await import("../adapters/smart/smart.schedule.repo.js");

  const loadOv = ovRepo.loadOverride || ovRepo.load;
  const loadS = schRepo.loadSchedule || schRepo.load;

  // кэш для override по датам
  const ovCache = {};
  async function getOverrideCached(dk) {
    if (!ovCache[dk]) {
      ovCache[dk] = await loadOv(dk);
    }
    return ovCache[dk];
  }

  const schedule = await loadS();

  const wdToday = weekdayKeyFromDateKey(dateKey);      // напр. "wednesday"
  const tomorrowKey = addDaysToDateKey(dateKey, 1);    // D+1
  const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey); // напр. "thursday"

  // override сегодняшнего дня:
  // он хранит прогресс задач "на завтра"
  const ovToday = await getOverrideCached(dateKey);

  // CORE TASKS ("на завтра")
  let coreTasksRaw;
  if (ovToday && Array.isArray(ovToday.tasks) && ovToday.tasks.length) {
    // если уже клонировали и редактировали -> берём оттуда
    coreTasksRaw = ovToday.tasks.map(normalizeTaskForDay);
  } else {
    // иначе берём чистое расписание завтрашнего дня
    const src = Array.isArray(schedule?.[wdTomorrow]) ? schedule[wdTomorrow] : [];
    coreTasksRaw = src.map(t => normalizeTaskForDay({
      ...t,
      donePercent: 0,
      done: false
    }));
  }

  const coreTasks = coreTasksRaw.map(t => ({
    ...t,
    mainWeekday: wdTomorrow, // из какого дня недели расписания задача "родом"
    source: "core"
  }));

  // OFFLOAD TASKS ("разгрузка")
  // Логика:
  //   у каждой задачи расписания есть offloadDays[] — дни, когда можно делать её заранее.
  //   если сегодня wdToday входит в offloadDays этой задачи,
  //   то эту задачу показываем как "разгрузка".
  //
  //   прогресс для разгрузки хранится не в самом дне расписания,
  //   а в override дедлайн-дня = предыдущий weekday.
  const offloadTasks = [];

  for (const weekdayKey of Object.keys(schedule || {})) {
    const dayArr = Array.isArray(schedule[weekdayKey]) ? schedule[weekdayKey] : [];

    for (const task of dayArr) {
      const off = Array.isArray(task.offloadDays) ? task.offloadDays : [];
      if (!off.includes(wdToday)) continue;

      // не дублировать core
      const alreadyCore = coreTasks.find(
        ct => ct.id === String(task.id || "")
      );
      if (alreadyCore) continue;

      // дедлайн-день = предыдущий weekday
      const deadlineWeekday = prevWeekdayKey(weekdayKey);

      // ближайшая вперёд дата с этим дедлайн-weekday
      const targetDateKey = nextDateKeyForWeekday(dateKey, deadlineWeekday);

      // возьмём override этой даты (прогресс по разгрузке пишется туда)
      const ovTarget = await getOverrideCached(targetDateKey);

      let match = null;
      if (ovTarget && Array.isArray(ovTarget.tasks)) {
        match = ovTarget.tasks.find(
          x => String(x.id || "") === String(task.id || "")
        );
      }

      let norm;
      if (match) {
        norm = normalizeTaskForDay(match);
      } else {
        norm = normalizeTaskForDay({
          ...task,
          donePercent: 0,
          done: false
        });
      }

      offloadTasks.push({
        ...norm,
        mainWeekday: weekdayKey, // в каком дне расписания эта задача живёт
        source: "offload"
      });
    }
  }

  return { coreTasks, offloadTasks };
}

// ============================================================================
// resolveTargetDateKeyForRow(row, currentDateKey)
//
// Нужно понять, в КАКОЙ override-день писать прогресс/правки.
// - core  -> override(currentDateKey)  (это "сегодня", т.к. мы делаем завтра)
// - offload -> override дедлайн-дня (предыдущего weekday от mainWeekday)
// ============================================================================
function resolveTargetDateKeyForRow(row, currentDateKey) {
  const source = row?.dataset?.source || "core";
  const mainWeekday = row?.dataset?.mainWeekday || "";

  if (source === "core") {
    // прогресс / правки core-задачи храним в override сегодняшнего дня
    return currentDateKey;
  }

  if (source === "offload" && mainWeekday) {
    const deadlineWeekday = prevWeekdayKey(mainWeekday);
    return nextDateKeyForWeekday(currentDateKey, deadlineWeekday);
  }

  return currentDateKey;
}

// ============================================================================
// REFRESH HELPERS
// ============================================================================
async function refreshDashboard(state) {
  const { coreTasks, offloadTasks } = await buildDayViewModel(state.currentDateKey);

  const allTasksForStats = [...coreTasks, ...offloadTasks];
  const st = await statsFor(allTasksForStats);

  updateDashboardView({
    dateKey: state.currentDateKey,
    tasks: coreTasks,
    offloadTasks,
    stats: st,
    dashboardEdit: state.dashboardEdit
  });
}

async function refreshScheduleEditor(state) {
  const m = await import("../usecases/getSchedule.js");
  const getSchedule = m.default || m.getSchedule;
  const schedule = await getSchedule();
  updateWeekView(schedule, state);
}

async function refreshCalendar(state) {
  updateCalendarView(state);
}

// ============================================================================
// bindDashboard(state)
// - обработчики дашборда: прогресс, чекбоксы, редактирование, сброс дня
// ============================================================================
function bindDashboard(state) {
  const root = document.querySelector('[data-view="dashboard"]');
  if (!root) return;

  root.addEventListener("click", async (e) => {
    const dashRoot = document.querySelector("[data-dashboard-root]");
    const dateKey = dashRoot?.dataset.dateKey || state.currentDateKey;

    // Кнопка "Расписание"
    if (e.target.closest('[data-action="open-schedule-editor"]')) {
      await refreshScheduleEditor(state);
      showView("schedule");
      return;
    }

    // Кнопка "Сбросить день"
    if (e.target.closest('[data-action="reset-day"]')) {
      const m = await import("../usecases/resetToSchedule.js");
      const fn = m.default || m.resetToSchedule;
      try {
        await fn({ dateKey });
      } catch (err) {}
      await refreshDashboard(state);
      return;
    }

    // +/- 10% прогресса
    const minus = e.target.closest(".task-pct-minus");
    const plus = e.target.closest(".task-pct-plus");
    if (minus || plus) {
      const row = e.target.closest(".task-item");
      if (!row) return;
      const taskId = row.dataset.taskId;

      const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

      const m = await import("../usecases/adjustTaskPercentForDate.js");
      const fn = m.default || m.adjustTaskPercentForDate;
      try {
        await fn({
          dateKey: targetDateKey,
          taskId,
          delta: plus ? +10 : -10
        });
      } catch (err) {}
      await refreshDashboard(state);
      return;
    }

    // ✎ Редактировать
    const editBtn = e.target.closest(".task-edit");
    if (editBtn) {
      const row = editBtn.closest(".task-item");
      if (!row) return;

      const taskId = row.dataset.taskId;
      const source = row.dataset.source || "core";          // "core" | "offload"
      const mainWeekday = row.dataset.mainWeekday || "";    // день расписания
      const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

      // Ставим в state, какой таск сейчас "в редактировании"
      // Для core -> будет показана форма редактирования
      // Для offload -> будет показана подсказка
      state.dashboardEdit = {
        taskId,
        source,
        mainWeekday,
        targetDateKey
      };

      await refreshDashboard(state);
      return;
    }

    // Сохранить (форма редактирования core-задачи)
    const saveBtn = e.target.closest(".dash-save");
    if (saveBtn) {
      const row = saveBtn.closest(".task-item.editing");
      if (!row) return;

      const { taskId } = row.dataset;
      const { source, targetDateKey } = state.dashboardEdit || {};

      // если почему-то открыли форму у offload (не должно быть) -> просто закрываем
      if (source !== "core") {
        state.dashboardEdit = null;
        await refreshDashboard(state);
        return;
      }

      const titleInp = row.querySelector(".dash-edit-title");
      const minsInp  = row.querySelector(".dash-edit-minutes");

      const newTitle = titleInp ? titleInp.value.trim() : "";
      const newMin   = minsInp  ? Number(minsInp.value || "0") : 0;

      const m = await import("../usecases/editTaskInline.js");
      const fn = m.default || m.editTaskInline;
      try {
        await fn({
          dateKey: targetDateKey || state.currentDateKey,
          taskId,
          patch: {
            title: newTitle,
            minutes: newMin
          }
        });
      } catch (err) {}

      state.dashboardEdit = null;
      await refreshDashboard(state);
      return;
    }

    // Отмена / Закрыть (и для core, и для offload)
    const cancelBtn = e.target.closest(".dash-cancel");
    if (cancelBtn) {
      state.dashboardEdit = null;
      await refreshDashboard(state);
      return;
    }
  });

  // Чекбокс done / не done
  root.addEventListener("change", async (e) => {
    const cb = e.target.closest(".task-done");
    if (!cb) return;

    const row = cb.closest(".task-item");
    if (!row) return;

    const taskId = row.dataset.taskId;
    const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

    const m = await import("../usecases/toggleTaskDoneForDate.js");
    const fn = m.default || m.toggleTaskDoneForDate;
    try {
      await fn({ dateKey: targetDateKey, taskId });
    } catch (err) {}

    await refreshDashboard(state);
  });
}

// ============================================================================
// bindSchedule(state)
// управление вкладкой "Расписание недели"
// ============================================================================
function bindSchedule(state) {
  const view = document.querySelector('[data-view="schedule"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // Назад в дашборд
    if (e.target.closest('[data-action="back-to-dashboard"]')) {
      await refreshDashboard(state);
      showView("dashboard");
      return;
    }

    // "+" -> новая задача в конкретный weekday
    const addBtn = e.target.closest(".week-add");
    if (addBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      if (!weekday) return;

      state.scheduleEdit = { weekday, taskId: "__new__" };
      await refreshScheduleEditor(state);
      return;
    }

    // ✎ редактировать задачу расписания
    const editBtn = e.target.closest(".week-edit");
    if (editBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const row = editBtn.closest(".task-item");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId) return;

      state.scheduleEdit = { weekday, taskId };
      await refreshScheduleEditor(state);
      return;
    }

    // 🗑 удалить задачу из расписания
    const delBtn = e.target.closest(".week-del");
    if (delBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const row = delBtn.closest(".task-item");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId) return;

      if (window.confirm("Удалить задачу из шаблона?")) {
        const delMod = await import("../usecases/deleteTaskFromSchedule.js");
        const delUC = delMod.default || delMod.deleteTaskFromSchedule;
        await delUC({ weekday, taskId });
      }

      await refreshScheduleEditor(state);
      return;
    }

    // "Сохранить" (для новой или редактируемой задачи расписания)
    const saveBtn = e.target.closest(".week-save");
    if (saveBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;

      const row = saveBtn.closest(".task-item.editing");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId || !row) return;

      const titleInp = row.querySelector(".week-edit-title");
      const minutesInp = row.querySelector(".week-edit-minutes");
      const chkNodes = row.querySelectorAll(".week-offload-chk");

      const newTitle = titleInp ? titleInp.value.trim() : "";
      const newMin = minutesInp ? Number(minutesInp.value || "0") : 0;

      const offloadDays = [];
      chkNodes.forEach(cb => {
        if (cb.checked && !cb.disabled) {
          offloadDays.push(cb.value);
        }
      });

      if (taskId === "__new__" || row.classList.contains("is-new")) {
        // новая задача
        const addMod = await import("../usecases/addTaskToSchedule.js");
        const addUC = addMod.default || addMod.addTaskToSchedule;
        await addUC({
          weekday,
          task: {
            title: newTitle || "Новая задача",
            minutes: newMin || 30,
            offloadDays
          }
        });
      } else {
        // редактирование существующей задачи расписания
        const editMod = await import("../usecases/editTaskInSchedule.js");
        const editUC = editMod.default || editMod.editTaskInSchedule;
        await editUC({
          weekday,
          taskId,
          patch: {
            title: newTitle,
            minutes: newMin,
            offloadDays
          }
        });
      }

      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }

    // "Отмена"
    const cancelBtn = e.target.closest(".week-cancel");
    if (cancelBtn) {
      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }
  });
}

// ============================================================================
// bindCalendar(state)
// управление вкладкой "Календарь"
// ============================================================================
function bindCalendar(state) {
  const view = document.querySelector('[data-view="calendar"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // Назад
    if (e.target.closest('[data-action="back-to-dashboard-2"]')) {
      await refreshDashboard(state);
      showView("dashboard");
      return;
    }

    // Листание месяцев
    const prevBtn = e.target.closest("[data-cal-prev]");
    const nextBtn = e.target.closest("[data-cal-next]");
    if (prevBtn || nextBtn) {
      if (prevBtn) {
        state.calMonth -= 1;
        if (state.calMonth < 0) {
          state.calMonth = 11;
          state.calYear -= 1;
        }
      }
      if (nextBtn) {
        state.calMonth += 1;
        if (state.calMonth > 11) {
          state.calMonth = 0;
          state.calYear += 1;
        }
      }
      await refreshCalendar(state);
      return;
    }

    // выбор дня в календаре
    const cell = e.target.closest(".cal-day[data-date-key]");
    if (cell) {
      const pickedKey = cell.getAttribute("data-date-key");
      if (pickedKey) {
        state.currentDateKey = pickedKey;

        // обновим input с датой в хедере
        const dateInput = document.querySelector("[data-date-input]");
        if (dateInput) {
          dateInput.value = state.currentDateKey;
        }

        await refreshDashboard(state);
        showView("dashboard");
      }
      return;
    }
  });
}

// ============================================================================
// bindHeader(state)
// обработка шапки (дата, навигация между табами)
// ============================================================================
function bindHeader(state) {
  const dateInput = document.querySelector("[data-date-input]");
  const todayBtn = document.querySelector('[data-action="today"]');
  const navDash = document.querySelector('[data-nav="dashboard"]');
  const navSched = document.querySelector('[data-nav="schedule"]');
  const navCal = document.querySelector('[data-nav="calendar"]');

  // ручной выбор даты
  if (dateInput) {
    dateInput.value = state.currentDateKey;
    dateInput.addEventListener("change", async () => {
      state.currentDateKey = dateInput.value;
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  // кнопка "Сегодня"
  if (todayBtn) {
    todayBtn.addEventListener("click", async () => {
      const tk = todayKey();
      state.currentDateKey = tk;

      const dObj = new Date(tk + "T00:00:00");
      state.calYear = dObj.getFullYear();
      state.calMonth = dObj.getMonth();

      if (dateInput) dateInput.value = state.currentDateKey;
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  // навигация "День"
  if (navDash) {
    navDash.addEventListener("click", async () => {
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  // навигация "Расписание"
  if (navSched) {
    navSched.addEventListener("click", async () => {
      await refreshScheduleEditor(state);
      showView("schedule");
    });
  }

  // навигация "Календарь"
  if (navCal) {
    navCal.addEventListener("click", async () => {
      await refreshCalendar(state);
      showView("calendar");
    });
  }
}

// ============================================================================
// showView(name)
// показывает нужный блок .view, прячет остальные
// ============================================================================
function showView(name) {
  document.querySelectorAll(".view").forEach(v => {
    v.hidden = (v.dataset.view !== name);
  });
}

// ============================================================================
// initUI()
// точка входа — вызывается из app.js после rehydrate и т.д.
// ============================================================================
export async function initUI() {
  const tk = todayKey();
  const dObj = new Date(tk + "T00:00:00");

  const state = {
    currentDateKey: tk,
    calYear: dObj.getFullYear(),
    calMonth: dObj.getMonth(),
    scheduleEdit: null,   // редактирование недельного расписания
    dashboardEdit: null   // редактирование строки на дашборде
  };

  bindHeader(state);
  bindDashboard(state);
  bindSchedule(state);
  bindCalendar(state);

  await refreshDashboard(state);
  await refreshScheduleEditor(state);
  await refreshCalendar(state);

  showView("dashboard");
}

// Экспортируем bindDashboard отдельно, тесты на него полагаются.
export { bindDashboard };
