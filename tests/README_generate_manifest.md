# tests/manifest.json — генерация

Варианты на любой вкус (Node / PowerShell / Bash). Все скрипты ищут **все файлы `*.test.js`** под `tests/` рекурсивно
и записывают их в `tests/manifest.json` (массив путей).

## Node.js (ESM)
```bash
node tests/generate-manifest.mjs
# с параметрами:
node tests/generate-manifest.mjs --dir tests --out tests/manifest.json
```

## PowerShell (Windows/macOS/Linux)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/generate-manifest.ps1
# или:
pwsh -File tests/generate-manifest.ps1 -Dir tests -Out tests/manifest.json
```

## Bash (macOS/Linux/Git Bash)
```bash
bash tests/generate-manifest.sh
# или:
bash tests/generate-manifest.sh tests tests/manifest.json
```

После генерации просто открывай `tests/test.html#auto` — раннер возьмёт список из `tests/manifest.json`.
