import * as repo from "../data/repo.js";

/*
  ВАЖНО:
  - state.currentDateKey        -> активная дата (строка 'YYYY-MM-DD')
  - state.calYear / state.calMonth -> какой месяц сейчас открыт в календаре
  - state.dashboardEdit         -> какая задача сейчас редактируется на дашборде
  - state.scheduleEdit          -> какая задача редактируется в расписании недели

  Главные принципы:
  1. buildDayViewModel() НЕ сохраняет override автоматически.
     Мы только показываем данные. Override создаётся ТОЛЬКО по действию
     (toggle чекбокса, +10%, редактирование, сброс дня).
  2. После любого действия мы вызываем refreshDashboard(state),
     чтобы заново нарисовать дашборд. НО! Слушатели кликов
     (bindDashboard) вешаются только один раз в initUI().

  ИМПОРТЫ ОТРИСОВКИ:
  - Календарь   -> view-calendar.js   (ранее назывался render-calendar.js)
  - Расписание  -> view-schedule.js   (ранее назывался render-schedule.js)
  - Дашборд     -> view-dashboard.js

  render-schedule.js и view-week.js больше не используются
  и могут быть удалены.
*/


// ===================== УТИЛИТЫ ДАТЫ =====================

function dateFromKey(key) {
  const [y, m, d] = String(key || "").split("-");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDateKey(dateKey, n) {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + Number(n || 0));
  return keyFromDate(d);
}

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

// предыдущий будний день (для дедлайна оффлоад-задач)
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
  return prevMap[dayKey] || "sunday";
}

// найдёт ближайшую вперёд дату (включая сегодня),
// у которой weekday === weekdayKey
function nextDateKeyForWeekday(currentDateKey, weekdayKey) {
  let d = dateFromKey(currentDateKey);
  for (let i = 0; i < 14; i++) {
    const dk = keyFromDate(d);
    if (weekdayKeyFromDateKey(dk) === weekdayKey) {
      return dk;
    }
    d.setDate(d.getDate() + 1);
  }
  return currentDateKey;
}

function todayKey() {
  return keyFromDate(new Date());
}


// ===================== СТАТИСТИКА ПО ЗАДАЧАМ =====================

async function statsFor(tasks) {
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


// ===================== НОРМАЛИЗАЦИЯ ЗАДАЧИ ДЛЯ UI =====================

function normalizeTaskForDay(t) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round(Number(t?.donePercent || 0)))
  );

  let offloadDays = null;
  if (Array.isArray(t?.offloadDays)) {
    offloadDays = [...t.offloadDays];
    // оффлоад-задачи в расписании имеют offloadDays,
    // но в override (снимке дня) мы их храним уже без offloadDays
  }

  return {
    id: String(t?.id || ""),
    title: String(t?.title || "Без названия"),
    minutes: Math.max(0, Number(t?.minutes) || 0),
    donePercent: pct,
    done: t?.done ? true : (pct >= 100),
    offloadDays,
    mainWeekday: t?.mainWeekday || null
  };
}


// ===================== МОДЕЛЬ ДНЯ ДЛЯ ДАШБОРДА =====================
//
// НЕ СОЗДАЁТ override сама по себе.
// Просто строит то, что надо показать.
async function buildDayViewModel(dateKey) {
  const schedule = await repo.loadSchedule();

  const wdToday = weekdayKeyFromDateKey(dateKey);
  const ov = await repo.loadDayOverride(dateKey);

  // CORE TASKS
  let coreTasks;
  if (ov && Array.isArray(ov.tasks) && ov.tasks.length) {
    coreTasks = ov.tasks.map(normalizeTaskForDay);
  } else {
    const tomorrowKey = addDaysToDateKey(dateKey, 1);
    const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey);

    const srcArr = Array.isArray(schedule?.[wdTomorrow])
      ? schedule[wdTomorrow]
      : [];

    coreTasks = srcArr.map(t =>
      normalizeTaskForDay({
        ...t,
        donePercent: 0,
        done: false
      })
    );
  }

  // OFFLOAD TASKS
  const offloadTasks = [];

  for (const mainWeekday of Object.keys(schedule || {})) {
    const dayArr = Array.isArray(schedule[mainWeekday])
      ? schedule[mainWeekday]
      : [];

    for (const task of dayArr) {
      const off = Array.isArray(task.offloadDays) ? task.offloadDays : [];
      if (!off.includes(wdToday)) continue;

      // не дублировать с coreTasks
      const alreadyCore = coreTasks.find(
        ct => ct.id === String(task.id || "")
      );
      if (alreadyCore) continue;

      // дедлайн — предыдущий будний день
      const deadlineWeekday = prevWeekdayKey(mainWeekday);
      const targetDateKey = nextDateKeyForWeekday(dateKey, deadlineWeekday);

      // попытка найти прогресс в override целевой даты
      const ovTarget = await repo.loadDayOverride(targetDateKey);

      let match = null;
      if (ovTarget && Array.isArray(ovTarget.tasks)) {
        match = ovTarget.tasks.find(
          x => String(x.id || "") === String(task.id || "")
        );
      }

      const norm = match
        ? normalizeTaskForDay({
            ...match,
            offloadDays: task.offloadDays
          })
        : normalizeTaskForDay(task);

      norm.mainWeekday = mainWeekday; // важно для сохранения
      offloadTasks.push(norm);
    }
  }

  return { coreTasks, offloadTasks };
}


// ===================== КАКОЙ ДЕНЬ МЕНЯЕМ ПРИ КЛИКЕ =====================
//
// Для обычной задачи ("core") → пишем в override выбранного дня.
// Для разгрузки ("offload") → пишем в override даты, которая является дедлайном.
function resolveTargetDateKeyForRow(row, currentDateKey) {
  const source = row?.dataset?.source || "core";
  const mainWeekday = row?.dataset?.mainWeekday || "";

  if (source === "core") {
    return currentDateKey;
  }

  if (source === "offload" && mainWeekday) {
    const deadlineWeekday = prevWeekdayKey(mainWeekday);
    return nextDateKeyForWeekday(currentDateKey, deadlineWeekday);
  }

  return currentDateKey;
}


// ===================== ОБНОВЛЕНИЕ ДАШБОРДА =====================
//
// ВАЖНО: мы НЕ перевешиваем bindDashboard(state) при каждом обновлении.
// Обработчики кликов вешаются один раз в initUI().
async function refreshDashboard(state) {
  const { coreTasks, offloadTasks } = await buildDayViewModel(
    state.currentDateKey
  );

  const allTasksForStats = [...coreTasks, ...offloadTasks];
  const st = await statsFor(allTasksForStats);

  const m = await import("./view-dashboard.js");
  const updateDashboardView = m.updateDashboardView || m.default;

  updateDashboardView({
    dateKey: state.currentDateKey,
    tasks: coreTasks,
    offloadTasks: offloadTasks,
    stats: st,
    dashboardEdit: state.dashboardEdit || null
  });
}

async function refreshScheduleEditor(state) {
  try {
    const m = await import("./view-schedule.js"); // <--- заменили render-schedule.js
    const updateScheduleView = m.updateScheduleView || m.default;
    await updateScheduleView(state);
  } catch (err) {
    console.warn("refreshScheduleEditor failed:", err);
  }
}

async function refreshCalendar(state) {
  try {
    const m = await import("./view-calendar.js"); // <--- раньше было render-calendar.js
    const updateCalendarView = m.updateCalendarView || m.default;
    await updateCalendarView(state);
  } catch (err) {
    console.warn("refreshCalendar failed:", err);
  }
}


// ===================== ОБРАБОТЧИКИ ДАШБОРДА =====================
//
// Слушатели кликов и чекбоксов. Вешаем ОДИН РАЗ.
function bindDashboard(state) {
  const root = document.querySelector('[data-view="dashboard"]');
  if (!root) return;

  // click-события (+/-10%, редактирование, сброс дня, открыть расписание)
  root.addEventListener("click", async (e) => {
    const dashRoot = document.querySelector("[data-dashboard-root]");
    const dateKey = dashRoot?.dataset.dateKey || state.currentDateKey;

    // открыть расписание
    if (e.target.closest('[data-action="open-schedule-editor"]')) {
      await refreshScheduleEditor(state);
      showViewSafe("schedule");
      return;
    }

    // сброс дня
    if (e.target.closest('[data-action="reset-day"]')) {
      const m = await import("../usecases/resetToSchedule.js");
      const fn = m.default || m.resetToSchedule;
      try {
        await fn({ dateKey });
      } catch (err) {
        console.warn("resetToSchedule error", err);
      }
      await refreshDashboard(state);
      return;
    }

    // -10% / +10%
    const minusBtn = e.target.closest(".task-pct-minus");
    const plusBtn  = e.target.closest(".task-pct-plus");
    if (minusBtn || plusBtn) {
      const row = e.target.closest(".task-item");
      if (!row) return;
      const taskId = row.dataset.taskId;

      const targetDateKey = resolveTargetDateKeyForRow(
        row,
        state.currentDateKey
      );

      const mod = await import("../usecases/adjustTaskPercentForDate.js");
      const fn = mod.default || mod.adjustTaskPercentForDate;

      console.log("[bindDashboard] click +/-10%", { taskId, targetDateKey });

      try {
        await fn({
          dateKey: targetDateKey,
          taskId,
          delta: minusBtn ? -10 : +10
        });
      } catch (err) {
        console.warn("adjustTaskPercentForDate error", err);
      }

      await refreshDashboard(state);
      return;
    }

    // ✎ редактирование задачи
    const editBtn = e.target.closest(".task-edit");
    if (editBtn) {
      const row = editBtn.closest(".task-item");
      if (!row) return;

      const taskId = row.dataset.taskId;
      const source = row.dataset.source || "core";
      const mainWeekday = row.dataset.mainWeekday || "";

      const targetDateKey = resolveTargetDateKeyForRow(
        row,
        state.currentDateKey
      );

      state.dashboardEdit = {
        taskId,
        source,
        mainWeekday,
        targetDateKey
      };

      await refreshDashboard(state);
      return;
    }

    // сохранить изменения (только для core)
    const saveBtn = e.target.closest(".dash-save");
    if (saveBtn) {
      const row = saveBtn.closest(".task-item.editing");
      if (!row) return;

      const { taskId } = row.dataset;
      const { source, targetDateKey } = state.dashboardEdit || {};

      if (source !== "core") {
        state.dashboardEdit = null;
        await refreshDashboard(state);
        return;
      }

      const titleInp = row.querySelector(".dash-edit-title");
      const minInp   = row.querySelector(".dash-edit-minutes");

      const newTitle = titleInp ? titleInp.value : "";
      const newMin   = minInp ? Number(minInp.value) || 0 : 0;

      const mod = await import("../usecases/editTaskInline.js");
      const editUC = mod.default || mod.editTaskInline;

      try {
        await editUC({
          dateKey: targetDateKey,
          taskId,
          patch: {
            title: newTitle,
            minutes: newMin
          }
        });
      } catch (err) {
        console.warn("editTaskInline error", err);
      }

      state.dashboardEdit = null;
      await refreshDashboard(state);
      return;
    }

    // отмена редактирования
    const cancelBtn = e.target.closest(".dash-cancel");
    if (cancelBtn) {
      state.dashboardEdit = null;
      await refreshDashboard(state);
      return;
    }
  });

  // change-события (чекбокс done)
  root.addEventListener("change", async (e) => {
    const cb = e.target.closest(".task-done");
    if (!cb) return;

    const row = cb.closest(".task-item");
    if (!row) return;

    const taskId = row.dataset.taskId;

    const targetDateKey = resolveTargetDateKeyForRow(
      row,
      state.currentDateKey
    );

    const mod = await import("../usecases/toggleTaskDoneForDate.js");
    const fn = mod.default || mod.toggleTaskDoneForDate;

    console.log("[bindDashboard] checkbox change", { taskId, targetDateKey });

    try {
      await fn({ dateKey: targetDateKey, taskId });
    } catch (err) {
      console.warn("toggleTaskDoneForDate error", err);
    }

    await refreshDashboard(state);
  });
}


// ===================== ОБРАБОТЧИКИ РАСПИСАНИЯ НЕДЕЛИ =====================

function bindSchedule(state) {
  const view = document.querySelector('[data-view="schedule"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // назад -> дашборд
    if (e.target.closest('[data-action="back-to-dashboard"]')) {
      await refreshDashboard(state);
      showViewSafe("dashboard");
      return;
    }

    // добавить задачу
    const addBtn = e.target.closest(".week-add");
    if (addBtn) {
      const dayCard = e.target.closest(".week-day");
      if (!dayCard) return;
      const weekday = dayCard.dataset.weekday;
      if (!weekday) return;

      state.scheduleEdit = {
        weekday,
        taskId: null,
        title: "",
        minutes: 30,
        offloadDays: []
      };

      await refreshScheduleEditor(state);
      return;
    }

    // ✎ редактирование в расписании
    const editBtn = e.target.closest(".week-edit");
    if (editBtn) {
      const row = editBtn.closest(".task-item");
      const dayCard = editBtn.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId) return;

      const titleNode = row.querySelector(".task-title");
      const minutesNode = row.querySelector(".task-mins");

      const newTitle = titleNode ? titleNode.textContent.trim() : "";
      // "30 мин" -> 30
      const rawMinStr = minutesNode ? minutesNode.textContent.trim() : "0";
      const rawNum = parseInt(rawMinStr, 10);
      const newMin = Number.isFinite(rawNum) ? rawNum : 0;

      let offloadDays = [];
      const rawOff = row.getAttribute("data-offload-days");
      if (rawOff) {
        offloadDays = rawOff
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
      }

      state.scheduleEdit = {
        weekday,
        taskId,
        title: newTitle,
        minutes: newMin,
        offloadDays
      };

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
        try {
          await delUC({ weekdayKey: weekday, taskId });
        } catch (err) {
          console.warn("deleteTaskFromSchedule error", err);
        }
      }

      await refreshScheduleEditor(state);
      return;
    }

    // сохранить изменения (новая или редактируемая задача)
    const saveBtn = e.target.closest(".week-save");
    if (saveBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const row = saveBtn.closest(".task-item.editing");
      if (!row || !weekday) return;

      const titleInp = row.querySelector(".week-edit-title");
      const minInp = row.querySelector(".week-edit-minutes");
      const checkboxes = row.querySelectorAll(".week-offload-checkbox");

      const newTitle = titleInp ? titleInp.value : "";
      const newMin   = minInp ? Number(minInp.value) || 0 : 0;

      const offloadDays = [];
      checkboxes.forEach(ch => {
        if (ch.checked) {
          offloadDays.push(ch.value);
        }
      });

      const taskId = row.dataset.taskId;
      if (!taskId || taskId === "NEW") {
        const addMod = await import("../usecases/addTaskToSchedule.js");
        const addUC  = addMod.default || addMod.addTaskToSchedule;
        try {
          await addUC({
            weekdayKey: weekday,
            taskData: {
              title: newTitle,
              minutes: newMin,
              offloadDays
            }
          });
        } catch (err) {
          console.warn("addTaskToSchedule error", err);
        }
      } else {
        const editMod = await import("../usecases/editTaskInSchedule.js");
        const editUC  = editMod.default || editMod.editTaskInSchedule;
        try {
          await editUC({
            weekday,
            taskId,
            patch: {
              title: newTitle,
              minutes: newMin,
              offloadDays
            }
          });
        } catch (err) {
          console.warn("editTaskInSchedule error", err);
        }
      }

      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }

    // отмена редактирования расписания
    const cancelBtn = e.target.closest(".week-cancel");
    if (cancelBtn) {
      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }
  });
}


// ===================== ОБРАБОТЧИКИ КАЛЕНДАРЯ =====================

function bindCalendar(state) {
  const view = document.querySelector('[data-view="calendar"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // назад -> дашборд
    if (e.target.closest('[data-action="back-to-dashboard-2"]')) {
      await refreshDashboard(state);
      showViewSafe("dashboard");
      return;
    }

    // листаем месяц назад
    if (e.target.closest("[data-cal-prev]")) {
      state.calMonth -= 1;
      if (state.calMonth < 0) {
        state.calMonth = 11;
        state.calYear -= 1;
      }
      await refreshCalendar(state);
      return;
    }

    // листаем месяц вперёд
    if (e.target.closest("[data-cal-next]")) {
      state.calMonth += 1;
      if (state.calMonth > 11) {
        state.calMonth = 0;
        state.calYear += 1;
      }
      await refreshCalendar(state);
      return;
    }

    // выбор даты
    const cell = e.target.closest(".cal-day[data-date-key]");
    if (cell) {
      const pickedKey = cell.getAttribute("data-date-key");
      if (pickedKey) {
        state.currentDateKey = pickedKey;

        const dObj = dateFromKey(pickedKey);
        state.calYear = dObj.getFullYear();
        state.calMonth = dObj.getMonth();

        const dateInput = document.querySelector("[data-date-input]");
        if (dateInput) {
          dateInput.value = state.currentDateKey;
        }

        await refreshDashboard(state);
        showViewSafe("dashboard");
      }
      return;
    }
  });
}


// ===================== ХЭДЕР / НАВИГАЦИЯ =====================

function bindHeader(state) {
  const dateInput = document.querySelector("[data-date-input]");
  const todayBtn = document.querySelector('[data-action="today"]');
  const navDash  = document.querySelector('[data-nav="dashboard"]');
  const navSched = document.querySelector('[data-nav="schedule"]');
  const navCal   = document.querySelector('[data-nav="calendar"]');

  // ручной выбор даты
  if (dateInput) {
    dateInput.addEventListener("change", async (e) => {
      const dk = e.target.value;
      if (!dk) return;
      state.currentDateKey = dk;

      const dObj = dateFromKey(dk);
      state.calYear = dObj.getFullYear();
      state.calMonth = dObj.getMonth();

      await refreshDashboard(state);
      showViewSafe("dashboard");
    });
  }

  // кнопка "Сегодня"
  if (todayBtn) {
    todayBtn.addEventListener("click", async () => {
      const tk = todayKey();
      state.currentDateKey = tk;

      const dObj = dateFromKey(tk);
      state.calYear = dObj.getFullYear();
      state.calMonth = dObj.getMonth();

      if (dateInput) {
        dateInput.value = state.currentDateKey;
      }

      await refreshDashboard(state);
      showViewSafe("dashboard");
    });
  }

  // навигация "Сегодня" / дашборд
  if (navDash) {
    navDash.addEventListener("click", async () => {
      await refreshDashboard(state);
      showViewSafe("dashboard");
    });
  }

  // навигация "Расписание"
  if (navSched) {
    navSched.addEventListener("click", async () => {
      await refreshScheduleEditor(state);
      showViewSafe("schedule");
    });
  }

  // навигация "Календарь"
  if (navCal) {
    navCal.addEventListener("click", async () => {
      await refreshCalendar(state);
      showViewSafe("calendar");
    });
  }
}


// ===================== ПЕРЕКЛЮЧЕНИЕ ВИДОВ =====================

function showViewSafe(targetName) {
  const allViews = Array.from(document.querySelectorAll(".view"));
  const target = allViews.find(v => v.dataset.view === targetName);

  if (!target) {
    console.warn("showViewSafe: view not found:", targetName);
    return;
  }

  allViews.forEach(v => {
    v.hidden = (v !== target);
  });
}


// ===================== initUI =====================
//
// Создаёт state, один раз вешает обработчики,
// потом делает первый рендер трёх вкладок.
//
export async function initUI() {
  const tk = todayKey();
  const dObj = dateFromKey(tk);

  const state = {
    currentDateKey: tk,
    calYear: dObj.getFullYear(),
    calMonth: dObj.getMonth(),
    dashboardEdit: null,
    scheduleEdit: null
  };

  // навешиваем обработчики ОДИН РАЗ
  bindHeader(state);
  bindDashboard(state);
  bindSchedule(state);
  bindCalendar(state);

  // рисуем первоначальные экраны
  await refreshDashboard(state);
  await refreshScheduleEditor(state);
  await refreshCalendar(state);

  // по умолчанию показываем дашборд
  showViewSafe("dashboard");
}