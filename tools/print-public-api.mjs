// tools/print-public-api.mjs
import fs from "node:fs";
import path from "node:path";

const MANIFEST = path.resolve(process.cwd(), "docs/public-api.json");

function pad(n) { return String(n).padStart(2, " "); }

function run() {
  const text = fs.readFileSync(MANIFEST, "utf8");
  const api = JSON.parse(text);

  const files = Object.keys(api).sort();
  console.log(`\nPublic API manifest: ${files.length} files\n`);

  for (const file of files) {
    const { functions = [], variables = [], classes = [] } = api[file] || {};
    const fnLines = functions
      .map(f => `  • ${f.name}(${(f.params || []).join(", ")})`)
      .join("\n");
    const varLines = variables.map(v => `  • ${v.name}`).join("\n");
    const clsLines = classes.map(c => `  • ${c.name}`).join("\n");

    console.log(`\n📄 ${file}`);
    if (functions.length) console.log(`  functions (${pad(functions.length)}):\n${fnLines}`);
    if (variables.length) console.log(`  variables (${pad(variables.length)}):\n${varLines}`);
    if (classes.length)   console.log(`  classes   (${pad(classes.length)}):\n${clsLines}`);
  }

  console.log("\n✅ Done.\n");
}

run();
