//
// js/domain/entities.js
//
// Здесь живут "сущности домена" (domain entities).
// Это самый важный слой с точки зрения предметной логики приложения.
//
// Идея очень простая:
//
// - Schedule  — это "расписание недели", то есть какие предметы и задания вообще есть.
//               Это как школьный дневник на всю неделю: в понедельник математика,
//               во вторник английский и т.д. Тут нет прогресса выполнения,
//               это просто список того, что ЗАДАНО.
//
// - DayOverride — это "конкретный день календаря", типа "2025-10-27".
//                 Это уже реальный рабочий список дел на день.
//                 Здесь мы отмечаем прогресс выполнения, галочки "сделано", проценты.
//                 Это то, с чем взаимодействует ученик каждый день.
//
// - Task — это одна задача (одно задание по предмету).
//          Она может жить либо в Schedule, либо внутри DayOverride.
//          В Schedule у задачи может быть offloadDays (куда можно разгружать заранее).
//          В DayOverride прогресс задачи отслеживается (donePercent, done).
//
// Очень важно: все эти классы НЕ знают
// ни про DOM (интерфейс), ни про Storage, ни про Telegram.
// Они описывают только бизнес-логику и данные.
// Это и есть суть "чистой архитектуры":
// UI и хранилище - сверху, а доменная логика - внизу и не зависит от них.
//

// ---------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ ДАТ
// ---------------------------------------------------------

/**
 * Преобразовать объект Date в строку "YYYY-MM-DD".
 * Пример: 27 октября 2025 → "2025-10-27".
 */
export function toDateKey(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Вернуть новый dateKey, сдвинутый на n дней.
 * addDaysToDateKey("2025-10-27", 1) → "2025-10-28"
 */
export function addDaysToDateKey(dateKey, n) {
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  dt.setDate(dt.getDate() + Number(n || 0));
  return toDateKey(dt);
}

/**
 * По строке "YYYY-MM-DD" вернуть ключ дня недели:
 * sunday, monday, tuesday, ..., saturday
 *
 * Это нужно потому что расписание у нас хранится
 * по ключам дней недели.
 */
export function weekdayKeyFromDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  const map = [
    "sunday",    // 0
    "monday",    // 1
    "tuesday",   // 2
    "wednesday", // 3
    "thursday",  // 4
    "friday",    // 5
    "saturday"   // 6
  ];
  return map[dt.getDay()] || "monday";
}

/**
 * Ограничить процент выполнения до диапазона 0..100 и округлить.
 * Это маленькая, но важная штука для консистентности.
 */
export function clampPercent(x) {
  let v = Math.round(Number(x) || 0);
  if (v < 0) v = 0;
  if (v > 100) v = 100;
  return v;
}


// ---------------------------------------------------------
// КЛАСС Task
// ---------------------------------------------------------
//
// Task — это одна учебная "единица работы".
// Например: "Математика: упр. 5", 30 минут.
//
// Важно понимать разницу:
// - Когда таск живёт в Schedule (расписание недели), это как шаблон:
//   offloadDays = ["tuesday","thursday"], donePercent всегда 0 по умолчанию.
//   Здесь мы не трекаем прогресс, это просто "эта вещь у меня задаётся по средам".
//
// - Когда таск живёт в DayOverride (конкретный день),
//   он становится "живым": у него есть donePercent и done,
//   и он больше не несёт offloadDays (потому что он уже реально назначен на дату).
//
// Мы не делаем два разных класса для этого — это один Task.
// Просто некоторые поля имеют смысл только в одном контексте.
//

export class Task {
  /**
   * Конструктор.
   *
   * Обрати внимание: мы здесь не пытаемся угадать контекст
   * (schedule или override). Мы просто даём тебе возможность
   * явно передать нужные поля.
   *
   * Параметры:
   * - id: уникальный идентификатор задачи (string)
   * - title: текст задачи ("упр. 5 по математике")
   * - minutes: сколько минут займёт
   * - donePercent: число от 0 до 100
   * - done: boolean (true, если задача полностью сделана)
   * - offloadDays: массив строк дней недели,
   *                используется только в Schedule
   * - meta: объект с любой служебной инфой (можно null)
   */
  constructor({
    id,
    title,
    minutes,
    donePercent = 0,
    done = false,
    offloadDays = [],
    meta = null
  }) {
    this.id = String(id || ("task_" + Date.now().toString(36) + "_" + Math.floor(Math.random()*1e6)));
    this.title = String(title || "Без названия");
    this.minutes = Math.max(0, Number(minutes) || 0);

    // donePercent и done должны быть согласованы.
    // donePercent = 100 → done = true.
    const pct = clampPercent(donePercent);
    this.donePercent = pct;
    this.done = (pct >= 100) || !!done;

    // offloadDays имеет смысл только в расписании (Schedule).
    // В DayOverride мы обычно это поле не используем.
    this.offloadDays = Array.isArray(offloadDays) ? [...offloadDays] : [];

    this.meta = meta || null;
  }

  /**
   * Вернуть копию задачи с обновлённым прогрессом (в процентах).
   * Мы не мутируем исходный объект. Мы создаём новый.
   *
   * Это важно для предсказуемости:
   * "была старая версия объекта, вот новая".
   */
  withProgressPercent(newPercent) {
    const pct = clampPercent(newPercent);
    return new Task({
      ...this,
      donePercent: pct,
      done: pct >= 100
    });
  }

  /**
   * Вернуть копию задачи с отредактированными "текстовыми" полями.
   * Это используется для inline-редактирования на дашборде:
   * поменяли название и/или минуты.
   */
  withInlinePatch(patch) {
    return new Task({
      ...this,
      title:
        patch.title !== undefined
          ? (String(patch.title || "").trim() || "Без названия")
          : this.title,
      minutes:
        patch.minutes !== undefined
          ? Math.max(0, Number(patch.minutes) || 0)
          : this.minutes
    });
  }

  /**
   * Проверка "сделана ли задача целиком".
   * Это удобнее, чем везде писать task.donePercent >= 100.
   */
  isDone() {
    return this.donePercent >= 100;
  }

  /**
   * Превратить Task в обычный plain-object,
   * чтобы его можно было сохранить через repo -> Storage -> localStorage / CloudStorage.
   *
   * Это важно, потому что при JSON.stringify() методы классов теряются.
   * Мы явно указываем, какие поля должны попасть в хранилище.
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      minutes: this.minutes,
      donePercent: this.donePercent,
      done: this.done,
      offloadDays: this.offloadDays.slice(), // копия массива
      meta: this.meta
    };
  }

  /**
   * Создать Task из "сырых" данных (plain-object),
   * например, которые пришли из repo.loadDayOverride() или loadSchedule().
   *
   * Это симметричная пара к toJSON().
   */
  static fromJSON(raw) {
    if (!raw || typeof raw !== "object") {
      return new Task({});
    }
    return new Task({
      id: raw.id,
      title: raw.title,
      minutes: raw.minutes,
      donePercent: raw.donePercent,
      done: raw.done,
      offloadDays: raw.offloadDays,
      meta: raw.meta
    });
  }

  /**
   * Создать задачу "для override" на конкретный день
   * на основе задачи из расписания (Schedule).
   *
   * Здесь важно:
   * - прогресс всегда начинается с 0;
   * - done = false;
   * - offloadDays НЕ переносим в override.
   */
  static fromScheduleTask(scheduleTask) {
    return new Task({
      id: scheduleTask.id,
      title: scheduleTask.title,
      minutes: scheduleTask.minutes,
      donePercent: 0,
      done: false,
      offloadDays: [], // в override не используем варианты разгрузки
      meta: scheduleTask.meta || null
    });
  }
}



// ---------------------------------------------------------
// КЛАСС DayOverride
// ---------------------------------------------------------
//
// DayOverride описывает конкретный день календаря, например "2025-10-27".
// Это то, что ученик реально видит в дашборде и редактирует.
// Здесь есть прогресс по каждому заданию.
//
// Важно:
// DayOverride может быть "собран" заново из расписания
// (например, кнопкой "Сбросить день").
//

export class DayOverride {
  /**
   * Конструктор.
   *
   * dateKey: строка "YYYY-MM-DD"
   * tasks: массив экземпляров Task (не plain-объекты!)
   * meta: служебка (createdAt, updatedAt, userAction, deviceId)
   */
  constructor({ dateKey, tasks, meta }) {
    this.dateKey = String(dateKey);

    // Гарантируем, что tasks — это именно Task[]
    this.tasks = Array.isArray(tasks)
      ? tasks.map(t => (t instanceof Task ? t : Task.fromJSON(t)))
      : [];

    this.meta = {
      createdAt: meta?.createdAt || new Date().toISOString(),
      updatedAt: meta?.updatedAt || new Date().toISOString(),
      userAction: meta?.userAction || "init",
      deviceId: meta?.deviceId || null
    };
  }

  /**
   * Установить/обновить updatedAt и userAction.
   * Это пригодится при любом изменении.
   */
  touch(userAction) {
    this.meta = {
      ...this.meta,
      updatedAt: new Date().toISOString(),
      userAction: userAction || this.meta.userAction || "update"
    };
  }

  /**
   * Получить задачу по id.
   * Возвращает Task или undefined.
   */
  getTask(taskId) {
    return this.tasks.find(t => String(t.id) === String(taskId));
  }

  /**
   * Гарантировать, что задача с таким taskId существует в этом дне.
   *
   * Если задачи нет:
   *  - мы пытаемся найти её в расписании (Schedule)
   *  - клонируем через Task.fromScheduleTask(...)
   *  - добавляем в текущий DayOverride
   *
   * Возвращаем сам Task (уже существующий или только что добавленный).
   */
  ensureTask(taskId, scheduleInstance) {
    let task = this.getTask(taskId);
    if (task) return task;

    if (scheduleInstance instanceof Schedule) {
      const schedTask = scheduleInstance.findTaskAnywhere(taskId);
      if (schedTask) {
        const newTask = Task.fromScheduleTask(schedTask);
        this.tasks = [...this.tasks, newTask];
        this.touch("ensureTask");
        return newTask;
      }
    }

    // fallback: если вдруг не нашли вообще нигде,
    // создаём пустую задачу-заглушку с данным id
    const fallback = new Task({
      id: taskId,
      title: "Задача",
      minutes: 0,
      donePercent: 0,
      done: false,
      offloadDays: [],
      meta: null
    });
    this.tasks = [...this.tasks, fallback];
    this.touch("ensureTask:fallback");
    return fallback;
  }

  /**
   * Изменить прогресс задачи (±10% и т.д.)
   */
  bumpTaskPercent(taskId, delta) {
    const current = this.getTask(taskId);
    if (!current) return;

    const newPct = clampPercent((current.donePercent || 0) + (delta || 0));
    const updatedTask = current.withProgressPercent(newPct);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("bumpTaskPercent");
    return updatedTask;
  }

  /**
   * Переключить чекбокс "сделано".
   * Если было <100%, станет 100.
   * Если было 100%, станет 0.
   */
  toggleTaskDone(taskId) {
    const current = this.getTask(taskId);
    if (!current) return;

    const newPct = current.isDone() ? 0 : 100;
    const updatedTask = current.withProgressPercent(newPct);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("toggleTaskDone");
    return updatedTask;
  }

  /**
   * Отредактировать саму задачу (название и минуты) для конкретного дня.
   * Это то, что сейчас делает editTaskInline.
   */
  editTaskInline(taskId, patch) {
    const current = this.getTask(taskId);
    if (!current) return;

    const updatedTask = current.withInlinePatch(patch);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("editTaskInline");
    return updatedTask;
  }

  /**
   * Сериализация. Готовим объект, который можно сохранить в repo/Storage.
   * Здесь в tasks мы превращаем каждый Task в plain-object через toJSON().
   */
  toJSON() {
    return {
      dateKey: this.dateKey,
      tasks: this.tasks.map(t => t.toJSON()),
      meta: { ...this.meta }
    };
  }

  /**
   * Обратная операция: реанимируем DayOverride из plain-object.
   * Это важно, потому что данные в хранилище лежат без методов,
   * и нам нужно вернуть методы обратно.
   */
  static fromJSON(raw) {
    if (!raw || typeof raw !== "object") {
      return new DayOverride({
        dateKey: "1970-01-01",
        tasks: [],
        meta: {}
      });
    }
    return new DayOverride({
      dateKey: raw.dateKey,
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.map(t => Task.fromJSON(t))
        : [],
      meta: raw.meta || {}
    });
  }

  /**
   * Создать новый DayOverride "с нуля" для конкретной даты,
   * основываясь на задачах из расписания (scheduleTasksForTomorrow).
   *
   * Это ровно то, что раньше делала forceCreateOverrideFromSchedule:
   * - берём задачи "на завтра" из расписания,
   * - сбрасываем прогресс в 0,
   * - формируем новый override.
   */
  static createFromSchedule(dateKey, scheduleTasksForTomorrow) {
    const tasks = Array.isArray(scheduleTasksForTomorrow)
      ? scheduleTasksForTomorrow.map(t => Task.fromScheduleTask(t))
      : [];

    return new DayOverride({
      dateKey,
      tasks,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAction: "createFromSchedule",
        deviceId: null
      }
    });
  }
}



// ---------------------------------------------------------
// КЛАСС Schedule
// ---------------------------------------------------------
//
// Schedule — это "расписание недели".
// Пример внутреннего вида:
// {
//   monday:    [Task, Task, ...],
//   tuesday:   [...],
//   ...
//   sunday:    [...]
// }
//
// Это шаблон: "по средам у меня математика на 30 минут, можно разгрузить на вторник".
// Здесь не хранятся реальные проценты выполнения за сегодня.
// Это как учебный план.
//
// Очень важно для нашего приложения:
// Из Schedule мы умеем "собрать" DayOverride для конкретной даты.
// То есть расписание недели производит конкретный план дня.
// Это и есть механизм "домашка на завтра".
//

export class Schedule {
  constructor(weekMap) {
    // Приведём объект к нормальной форме, где каждый день - массив Task
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];

    this.week = {};
    for (const d of days) {
      const arr = Array.isArray(weekMap?.[d]) ? weekMap[d] : [];
      this.week[d] = arr.map(t =>
        t instanceof Task ? t : Task.fromJSON(t)
      );
    }
  }

  /**
   * Вернуть копию расписания с добавленной новой задачей в указанный день недели.
   * Это то, что сейчас делает addTaskToSchedule.
   *
   * weekdayKey: например "monday"
   * taskData: { title, minutes, offloadDays }
   */
  withNewTask(weekdayKey, taskData) {
    const newTask = new Task({
      id: taskData.id, // можно undefined, тогда сгенерируется
      title: taskData.title,
      minutes: taskData.minutes,
      offloadDays: Array.isArray(taskData.offloadDays)
        ? [...taskData.offloadDays]
        : [],
      donePercent: 0,
      done: false,
      meta: taskData.meta || null
    });

    const clone = new Schedule(this.toJSON()); // скопируем текущее состояние
    const list = Array.isArray(clone.week[weekdayKey])
      ? clone.week[weekdayKey]
      : [];
    clone.week[weekdayKey] = [...list, newTask];
    return clone;
  }

  /**
   * Вернуть копию расписания с изменённой задачей.
   * Это то, что сейчас делает editTaskInSchedule.
   */
  withEditedTask(weekdayKey, taskId, patch) {
    const clone = new Schedule(this.toJSON());

    clone.week[weekdayKey] = (clone.week[weekdayKey] || []).map(task => {
      if (String(task.id) !== String(taskId)) return task;

      return task.withInlinePatch({
        title: patch.title,
        minutes: patch.minutes
      }).constructor({
        // доп. обработка offloadDays
        id: task.id,
        title: patch.title !== undefined
          ? patch.title
          : task.title,
        minutes: patch.minutes !== undefined
          ? patch.minutes
          : task.minutes,
        donePercent: task.donePercent,
        done: task.done,
        offloadDays:
          patch.offloadDays !== undefined
            ? [...patch.offloadDays]
            : task.offloadDays,
        meta: task.meta
      });
    });

    return clone;
  }

  /**
   * Вернуть копию расписания без задачи (удаление).
   * Это то, что сейчас делает deleteTaskFromSchedule.
   */
  withTaskRemoved(weekdayKey, taskId) {
    const clone = new Schedule(this.toJSON());
    clone.week[weekdayKey] = (clone.week[weekdayKey] || []).filter(
      t => String(t.id) !== String(taskId)
    );
    return clone;
  }

  /**
   * Найти задачу по taskId в ЛЮБОМ дне недели.
   * Это нужно DayOverride.ensureTask(), когда мы пытаемся
   * "подтянуть задачу из расписания", если её не оказалось в override.
   */
  findTaskAnywhere(taskId) {
    for (const weekdayKey of Object.keys(this.week)) {
      const arr = this.week[weekdayKey] || [];
      for (const task of arr) {
        if (String(task.id) === String(taskId)) {
          return task;
        }
      }
    }
    return null;
  }

  /**
   * Дай мне массив задач, который должен лечь в override
   * для указанной dateKey.
   *
   * Сейчас бизнес-правило такое:
   *   "на день D ребёнок видит домашку на завтра"
   * Т.е. для dateKey мы смотрим расписание завтрашнего дня.
   *
   * Пример:
   *   dateKey = "2025-10-27" (понедельник)
   *   tomorrow = "2025-10-28" (вторник)
   *   => берём tasks расписания вторника
   *
   * Это очень важное правило приложения.
   */
  tasksForOverrideDate(dateKey) {
    const tomorrowKey = addDaysToDateKey(dateKey, 1);
    const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey);
    const arr = this.week[wdTomorrow] || [];
    return arr;
  }

  /**
   * Сгенерировать новый DayOverride для конкретного dateKey.
   * Это то, что сейчас делает forceCreateOverrideFromSchedule().
   */
  makeOverrideForDate(dateKey) {
    const tomorrowTasks = this.tasksForOverrideDate(dateKey);
    return DayOverride.createFromSchedule(
      dateKey,
      tomorrowTasks
    );
  }

  /**
   * Сериализация расписания недели в plain-object.
   * Это то, что мы будем складывать в repo.saveSchedule().
   */
  toJSON() {
    const out = {};
    for (const dayKey of Object.keys(this.week)) {
      out[dayKey] = (this.week[dayKey] || []).map(t => t.toJSON());
    }
    return out;
  }

  /**
   * Восстановить Schedule из plain-object.
   * Это то, что мы будем делать после loadSchedule().
   */
  static fromJSON(raw) {
    return new Schedule(raw || {});
  }
}