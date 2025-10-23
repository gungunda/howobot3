\
/* tests/setup.init.js
   Пресидинг LocalStorage: вызываем loadSchedule(), чтобы дефолт записался в хранилище.
   Подключай в tests/test.html ПЕРЕД test-suite.js:
   <script type="module" src="./setup.init.js"></script>
*/
try {
  const repo = await import("../js/adapters/local/schedule.repo.local.js");
  const loadSchedule = repo.loadSchedule || repo.load;
  if (typeof loadSchedule === "function") {
    await loadSchedule();
    console.log("[setup.init] loadSchedule() called — LocalStorage seeded");
  } else {
    console.warn("[setup.init] loadSchedule() not found");
  }
} catch (e) {
  console.warn("[setup.init] error:", e?.message);
}
