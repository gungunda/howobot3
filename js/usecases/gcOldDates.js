/**
 * gcOldDates
 *
 * Заглушка на будущее.
 * Идея: чистить очень старые override-даты,
 * чтобы не раздувать хранилище.
 *
 * Пока что не вызывается из UI.
 */
export default async function gcOldDates() {
  // TODO: пройтись по Storage.getKeys(),
  // найти planner.override.YYYY-MM-DD.v1,
  // удалить очень старые.
  return;
}