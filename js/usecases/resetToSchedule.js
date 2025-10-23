// js/usecases/resetToSchedule.js
// Сбросить изменения дня к шаблону: просто удаляем override для dateKey.

export default async function resetToSchedule({ dateKey }) {
  const mod = await import("../adapters/local/override.repo.local.js").catch(() => ({}));
  const deleteOverride = mod.deleteOverride || mod.remove || mod.del || null;
  if (typeof deleteOverride === "function") {
    await deleteOverride(dateKey);
  }
  return true;
}
