# make-plain.ps1
# Генератор "простыни" для ChatGPT.
# Делает один большой текстовый snapshot проекта на основе FILES_WHITELIST.txt.

# 1. Определяем корень проекта = папка, где лежит этот скрипт
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 2. Входные и выходные пути
$WhitelistPath = Join-Path $ScriptDir "FILES_WHITELIST.txt"

# Папка, куда мы будем сохранять результат
$OutDir = Join-Path $ScriptDir "ChatGPT"
if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# Имя выходного файла
# Вариант А: всегда один и тот же
#$OutFile = Join-Path $OutDir "bundle.txt"

# Вариант Б: с таймстампом, чтобы не затирать старые версии
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$OutFile = Join-Path $OutDir ("bundle_" + $timestamp + ".txt")

# 3. Читаем вайтлист
if (!(Test-Path $WhitelistPath)) {
    Write-Host "FILES_WHITELIST.txt not found!"
    exit 1
}

$RawList = Get-Content $WhitelistPath

# Фильтруем:
# - обрезаем пробелы
# - убираем пустые строки
# - убираем строки, начинающиеся с '#'
$Targets = $RawList |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" } |
    Where-Object { -not ($_.StartsWith("#")) }

# 4. Функция: получить список файлов по записи ("js", "index.html", "assets/*", и т.д.)
function Expand-Target($t) {
    $FullPath = Join-Path $ScriptDir $t

    if (Test-Path $FullPath) {
        # Если это директория → рекурсивно собрать все файлы внутри
        if ((Get-Item $FullPath).PSIsContainer) {
            return Get-ChildItem $FullPath -Recurse -File
        }
        else {
            # это файл
            return Get-Item $FullPath
        }
    }
    else {
        # Поддержка шаблонов вроде "js/*" (глоб)
        $DirPart  = Split-Path $t
        $FileMask = Split-Path $t -Leaf

        $BaseDirFull = Join-Path $ScriptDir $DirPart
        if (Test-Path $BaseDirFull -PathType Container) {
            return Get-ChildItem $BaseDirFull -Recurse -File -Filter $FileMask
        }
    }

    return @() # если не нашли ничего
}

# 5. Собираем полный список файлов (объекты FileInfo)
$FileList = @()
foreach ($t in $Targets) {
    $FileList += Expand-Target $t
}

# Убираем дубликаты по полному пути
$FileList = $FileList | Sort-Object FullName -Unique

# 6. Пишем результат
# Формат:
# ---FILE-START---
# PATH: relative/path/file.js
# <содержимое>
# ---FILE-END---

# Для понятного относительного пути уберём $ScriptDir из начала
function To-RelativePath($full) {
    return ($full.FullName).Substring($ScriptDir.Length).TrimStart('\','/')
}

# Создаём/очищаем файл вывода
"" | Out-File -FilePath $OutFile -Encoding UTF8

foreach ($f in $FileList) {
    $rel = To-RelativePath $f

    # читаем содержимое
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue

    # Записываем блок
    Add-Content -Path $OutFile -Value "---FILE-START---"
    Add-Content -Path $OutFile -Value ("PATH: " + $rel)
    Add-Content -Path $OutFile -Value $content
    Add-Content -Path $OutFile -Value "---FILE-END---"
    Add-Content -Path $OutFile -Value ""  # пустая строка-разделитель
}

Write-Host "Done."
Write-Host "Saved to $OutFile"
