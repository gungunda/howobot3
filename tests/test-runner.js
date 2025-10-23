// Крошечный раннер без зависимостей
export const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${a} to equal ${b}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected value to be truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected value to be falsy, got ${actual}`);
    }
  };
}

export async function run() {
  const results = [];
  for (const t of tests) {
    try {
      const r = t.fn();
      if (r instanceof Promise) await r;
      results.push({ name: t.name, ok: true });
    } catch (e) {
      results.push({ name: t.name, ok: false, err: e });
    }
  }
  return results;
}

export function render(results) {
  const root = document.createElement('div');
  let ok = 0, fail = 0;
  for (const r of results) {
    const pre = document.createElement('pre');
    if (r.ok) {
      ok++;
      pre.className = "ok";
      pre.textContent = `✓ ${r.name}`;
    } else {
      fail++;
      pre.className = "fail";
      pre.textContent = `✗ ${r.name}\n${r.err?.stack || r.err}`;
    }
    root.appendChild(pre);
  }
  const sum = document.createElement('div');
  sum.className = "summary";
  sum.textContent = `Passed: ${ok} • Failed: ${fail} • Total: ${results.length}`;
  root.appendChild(sum);
  return root;
}
