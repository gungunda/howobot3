// tests/test-suite.js
// Автоподключение тестов с надёжной нормализацией путей.
// Работает и локально (http://localhost:8000/) и на GitHub Pages (/howobot3/).

import { run, render } from './test-runner.js';

async function loadManifestJson() {
  try {
    const resp = await fetch('./manifest.json', { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.every(x => typeof x === 'string')) return data;
  } catch (_) {}
  return null;
}

function loadInlineJson() {
  const el = document.getElementById('tests-list');
  if (!el) return null;
  try {
    const data = JSON.parse(el.textContent.trim());
    if (Array.isArray(data) && data.every(x => typeof x === 'string')) return data;
  } catch (_) {}
  return null;
}

// Нормализуем путь так, чтобы он был валиден относительно текущего файла (tests/)
function normalizePath(p) {
  if (!p) return p;
  // 1) Уже относительный модульный путь
  if (p.startsWith('./') || p.startsWith('../')) return p;

  // 2) Абсолютные пути оставим как есть для локального http-сервера,
  //    но на GitHub Pages они часто ведут на 404. Лучше превратить в относительный.
  if (p.startsWith('/tests/')) {
    return '.' + p.slice('/tests'.length); // "/tests/units/x.js" -> "./units/x.js"
  }

  // 3) Если указали "tests/units/x.js" — преобразуем в "./units/x.js"
  if (p.startsWith('tests/')) {
    return './' + p.slice('tests/'.length);
  }

  // 4) Остальное считаем относительным от текущей папки (tests/)
  return './' + p.replace(/^\/*/, '');
}

async function importTests(paths) {
  const imported = [];
  for (const raw of paths) {
    const p = normalizePath(raw);
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

  const imported = await importTests(tests);

  const results = await run();
  const view = render(results);
  container.innerHTML = '';
  container.appendChild(view);

  const summary = document.createElement('div');
  summary.style.marginTop = '12px';
  summary.style.fontSize = '13px';
  summary.textContent = `Импортировано тестовых модулей: ${imported.length} / ${tests.length}`;
  container.appendChild(summary);
}
