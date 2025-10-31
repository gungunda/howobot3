// tools/check-public-api.mjs
import fs from "node:fs";
import path from "node:path";
import { parse } from "acorn";
import * as walk from "acorn-walk";

const ROOT_JS = path.resolve(process.cwd(), "js");
const MANIFEST = path.resolve(process.cwd(), "docs/public-api.json");

function readAllJs(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...readAllJs(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

function repoPath(abs) {
  // превращаем абсолютный путь в "js/..." — ключ, как в манифесте
  const i = abs.lastIndexOf(path.sep + "js" + path.sep);
  return abs.slice(i + 1).replaceAll(path.sep, "/");
}

function extractExports(code) {
  const ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
  const out = { functions: [], variables: [], classes: [] };

  const addFn = (name, params = []) => out.functions.push({ name, params });
  const addVar = (name) => out.variables.push({ name });
  const addCls = (name) => out.classes.push({ name });

  const id = (n) => (n && n.name) || null;

  // Эксплицитные декларации
  walk.simple(ast, {
    ExportNamedDeclaration(node) {
      const d = node.declaration;
      // export function foo(a,b) {}
      if (d?.type === "FunctionDeclaration") {
        addFn(id(d.id), d.params.map(p => p.name || "param"));
      }
      // export const X = ...
      if (d?.type === "VariableDeclaration") {
        for (const dec of d.declarations) addVar(id(dec.id));
      }
      // export class Foo {}
      if (d?.type === "ClassDeclaration") {
        addCls(id(d.id));
      }
      // export { foo, bar as baz }
      if (node.specifiers?.length) {
        for (const s of node.specifiers) addFn(s.exported.name, []);
      }
    }
  });

  // Попробуем добрать параметры для export { foo } из ранее объявленной функции
  if (out.functions.some(f => f.params.length === 0)) {
    const map = new Map();
    walk.simple(ast, {
      FunctionDeclaration(node) {
        if (node.id?.name) {
          map.set(node.id.name, node.params.map(p => p.name || "param"));
        }
      }
    });
    out.functions = out.functions.map(f => map.has(f.name) && f.params.length === 0
      ? { ...f, params: map.get(f.name) }
      : f
    );
  }

  // Убираем дубликаты
  const uniq = (arr, key) => Array.from(new Map(arr.map(o => [o[key], o])).values());
  out.functions = uniq(out.functions, "name").filter(f => !!f.name);
  out.variables = uniq(out.variables, "name").filter(v => !!v.name);
  out.classes   = uniq(out.classes, "name").filter(c => !!c.name);

  return out;
}

function diff(manifest, actual) {
  const problems = [];

  const mfFiles = new Set(Object.keys(manifest));
  const acFiles = new Set(Object.keys(actual));

  for (const f of acFiles) if (!mfFiles.has(f)) problems.push({ type: "extra-file", file: f });
  for (const f of mfFiles) if (!acFiles.has(f)) problems.push({ type: "missing-file", file: f });

  for (const f of mfFiles) {
    if (!actual[f]) continue;
    const mf = manifest[f];
    const ac = actual[f];

    const byName = (list) => Object.fromEntries((list || []).map(x => [x.name, x]));

    const mfFns = byName(mf.functions || []);
    const acFns = byName(ac.functions || []);

    for (const name of Object.keys(acFns)) if (!mfFns[name]) problems.push({ type: "extra-export", file: f, name });
    for (const name of Object.keys(mfFns)) if (!acFns[name]) problems.push({ type: "missing-export", file: f, name });

    for (const name of Object.keys(mfFns)) {
      if (!acFns[name]) continue;
      const a = (acFns[name].params || []).join(",");
      const b = (mfFns[name].params || []).join(",");
      if (a !== b) problems.push({ type: "params-mismatch", file: f, name, actual: a, manifest: b });
    }
  }

  return problems;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const files = readAllJs(ROOT_JS);
  const actual = {};

  for (const p of files) {
    const code = fs.readFileSync(p, "utf8");
    actual[repoPath(p)] = extractExports(code);
  }

  const problems = diff(manifest, actual);

  if (problems.length === 0) {
    console.log("✔ public-api.json matches code");
    process.exit(0);
  }

  console.log("✖ public-api.json mismatch:\n");
  for (const p of problems) {
    if (p.type === "extra-file")      console.log(`  [EXTRA FILE]    ${p.file} присутствует в коде, но отсутствует в манифесте`);
    if (p.type === "missing-file")    console.log(`  [MISSING FILE]  ${p.file} есть в манифесте, но нет в коде`);
    if (p.type === "extra-export")    console.log(`  [EXTRA EXPORT]  ${p.file} → ${p.name} есть в коде, но нет в манифесте`);
    if (p.type === "missing-export")  console.log(`  [MISSING EXP]   ${p.file} → ${p.name} есть в манифесте, но нет в коде`);
    if (p.type === "params-mismatch") console.log(`  [PARAMS DIFF]   ${p.file} → ${p.name} params: code=[${p.actual}] manifest=[${p.manifest}]`);
  }
  process.exit(1);
}

main();
