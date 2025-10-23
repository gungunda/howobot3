// tests/test-suite.js
// Автоподключение всех тестов.
// Порядок поиска источника списка модулей:
// 1) tests/manifest.json — JSON-массив путей к модулям-тестам (от корня сайта)
// 2) <script type="application/json" id="tests-list">...</script> — массив путей
// 3) Fallback: пытаемся подтянуть базовый тест tests/entities.test.js

import { run, render } from './test-runner.js';

async function loadManifestJson() {
  try {
    const resp = await fetch('./manifest.json', { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.every(x => typeof x === 'string')) {
      return data;
    }
  } catch (_) {}
  return null;
}

function loadInlineJson() {
  const el = document.getElementById('tests-list');
  if (!el) return null;
  try {
    const data = JSON.parse(el.textContent.trim());
    if (Array.isArray(data) && data.every(x => typeof x === 'string')) {
      return data;
    }
  } catch (_) {}
  return null;
}

async function importTests(paths) {
  const imported = [];
  for (const p of paths) {
    try {
      await import(p);
      imported.push(p);
    } catch (e) {
      console.error('[tests] Не удалось импортировать', p, e);
    }
  }
  return imported;
}

export async function runAllTests() {
  const container = document.getElementById('results');
  container.innerHTML = '<em>Загрузка списка тестов…</em>';

  let tests = await loadManifestJson();
  if (!tests) tests = loadInlineJson();
  if (!tests) tests = ['../tests/entities.test.js']; // безопасный дефолт

  // Нормализуем пути: если кто-то дал относительные внутри tests/, делаем их абсолютными от /tests/
  tests = tests.map(p => {
    if (p.startsWith('/')) return p;
    // если начинается с './' или '../', оставим как есть — это валидно относительно текущего файла
    if (p.startsWith('./') || p.startsWith('../')) return p;
    // иначе считаем, что это путь относительно /tests/
    return '/tests/' + p.replace(/^\/?tests\//, '');
  });

  const imported = await importTests(tests);

  // Запускаем tests
  const results = await run();
  const view = render(results);
  container.innerHTML = '';
  container.appendChild(view);

  // Сводка
  const summary = document.createElement('div');
  summary.style.marginTop = '12px';
  summary.style.fontSize = '13px';
  summary.textContent = `Импортировано тестовых модулей: ${imported.length} / ${tests.length}`;
  container.appendChild(summary);
}
