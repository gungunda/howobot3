[... оставь код до класса Schedule без изменений ...]


  /**
   * Вернуть копию расписания с добавленной новой задачей в указанный день недели.
   * Это то, что сейчас делает addTaskToSchedule.
   *
   * weekdayKey: например "monday"
   * taskData: { title, minutes, offloadDays }
   */
  withNewTask(weekdayKey, taskData) {
    // Создаём новую задачу
    const newTask = new Task({
      id: taskData?.id, // undefined — ок, Task сам сгенерит id
      title: taskData?.title ?? "Без названия",
      minutes: Number(taskData?.minutes) || 0,
      offloadDays: Array.isArray(taskData?.offloadDays)
        ? [...taskData.offloadDays]
        : [],
      donePercent: 0,
      done: false,
      meta: taskData?.meta || null
    });

    // Клонируем расписание и добавляем задачу в нужный день
    const clone = new Schedule(this.toJSON());
    const currentList = Array.isArray(clone.week[weekdayKey])
      ? clone.week[weekdayKey]
      : [];
    clone.week[weekdayKey] = [...currentList, newTask];

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

      // Обновляем основные поля задачи (title, minutes)
      let updated = task.withInlinePatch({
        title: patch?.title,
        minutes: patch?.minutes
      });

      // Обновляем offloadDays, если они переданы
      if (patch?.offloadDays !== undefined) {
        updated = new Task({
          ...updated,
          offloadDays: Array.isArray(patch.offloadDays)
            ? [...patch.offloadDays]
            : []
        });
      }

      return updated;
    });

    return clone;
  }