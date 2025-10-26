// js/usecases/getSchedule.js
// Вернуть текущее недельное расписание из хранилища (CloudStorage / localStorage).

import { loadSchedule } from "../data/repo.js";

export async function getSchedule() {
  return loadSchedule();
}

export default getSchedule;
