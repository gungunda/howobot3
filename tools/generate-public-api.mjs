// tools/generate-public-api.mjs
// Генерирует docs/public-api.json на основе фактических экспортов из js/*.js
// Запуск: npm run gen:api
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

const ROOT = path.resolve(process.cwd(), 'js');
const OUT  = path.resolve(process.cwd(), 'docs/public-api.json');

function readAllJsFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...readAllJsFiles(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Получить видимые имена и параметры из AST
function extractExports(filePath, code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const info = { functions: [], variables: [], classes: [] };
  const id = (n) => (n && n.name) || null;

  // Ищем именованные экспорты
  walk.simple(ast, {
    ExportNamedDeclaration(node) {
      // export function foo(a,b) {}
      if (node.declaration?.type === 'FunctionDeclaration') {
        info.functions.push({
          name: id(node.declaration.id),
          params: node.declaration.params.map(p => p.name || 'param')
        });
      }
      // export const X = ...
      if (node.declaration?.type === 'VariableDeclaration') {
        for (const d of node.declaration.declarations) {
          info.variables.push({ name: id(d.id) });
        }
      }
      // export class Foo {}
      if (node.declaration?.type === 'ClassDeclaration') {
        info.classes.push({ name: id(node.declaration.id) });
      }
      // export { foo, bar as baz }
      if (node.specifiers?.length) {
        for (const s of node.specifiers) {
          info.functions.push({ name: s.exported.name, params: [] });
        }
      }
    }
  });

  // Для случаев: export { func } из ранее объявленной функции — попытаемся добрать параметры
  if (info.functions.some(f => f.params.length === 0)) {
    const map = new Map();
    walk.simple(ast, {
      FunctionDeclaration(node) {
        if (node.id?.name) {
          map.set(node.id.name, node.params.map(p => p.name || 'param'));
        }
      }
    });
    info.functions = info.functions.map(f => {
      if (f.params.length === 0 && map.has(f.name)) {
        return { ...f, params: map.get(f.name) };
      }
      return f;
    });
  }

  return info;
}

function toRepoPath(abs) {
  // превращаем абсолютный путь в путь от корня репо
  const idx = abs.lastIndexOf(path.sep + 'js' + path.sep);
  return idx >= 0 ? abs.slice(idx + 1).replaceAll(path.sep, '/') : abs;
}

function main() {
  const files = readAllJsFiles(ROOT);
  const result = {};
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const info = extractExports(file, code);
    result[toRepoPath(file)] = info;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`✔ public-api.json generated: ${OUT}`);
}

main();
