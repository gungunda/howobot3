// js/usecases/getSchedule.js
// Исправлено: никаких импортов из ../app.js. Берём репозиторий напрямую из smart-адаптера.
// Поддерживаем и default, и именованные экспорты.

export default async function getSchedule(){
  const repo = await import("../adapters/smart/smart.schedule.repo.js");
  const load = repo.loadSchedule || repo.load || (repo.default && repo.default.loadSchedule);
  if (typeof load !== "function") {
    throw new Error("[getSchedule] schedule repo doesn't expose loadSchedule/load");
  }
  return load();
}
