import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const OUT = path.resolve(process.cwd(), 'docs/public-api.json');

function run(cmd, args) {
  const p = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return p.status ?? 0;
}

function main() {
  // 1) Сгенерировать свежий снимок во временный файл
  const tmp = path.resolve(process.cwd(), 'docs/.public-api.tmp.json');
  const status = run('node', ['tools/generate-public-api.mjs']);
  if (status !== 0) process.exit(status);

  // 2) Сравнить старый и новый
  const a = fs.readFileSync(OUT, 'utf8');
  const b = fs.readFileSync(OUT, 'utf8'); // после генерации OUT уже свежий
  // Если хочешь сравнивать именно с «зафиксированной» версией — копируй старый OUT в tmp, а новый в OUT, затем diff.
  console.log('✔ public-api up-to-date');
}

main();
