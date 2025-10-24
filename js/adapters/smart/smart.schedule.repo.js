// js/adapters/smart/smart.schedule.repo.js
// "Умный" репозиторий расписания.
// Пока что он просто проксирует всё в local-хранилище,
// но позже здесь появится синхронизация с Telegram/облаком.
//
// Мы оставляем одинаковый интерфейс: loadSchedule() и saveSchedule().

import {
  loadSchedule as loadLocalSchedule,
  saveSchedule as saveLocalSchedule
} from "../local/schedule.repo.local.js";

export async function loadSchedule() {
  return loadLocalSchedule();
}

export async function saveSchedule(schedule) {
  return saveLocalSchedule(schedule);
}

export default {
  loadSchedule,
  saveSchedule
};
