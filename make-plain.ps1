# make-plain.ps1
# Bundle generator for the project.
# Output format:
#   1) FILE_INDEX_START ... FILE_INDEX_END
#   2) then all file contents, each preceded by // /relative/path

# ---------------------------
# Config
# ---------------------------

$whitelistPath = "FILES_WHITELIST.txt"

# rootDir = folder where this script is located
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

# output filename: bundle_YYYYMMDD_HHmmss.txt
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile   = "./chatgpt/bundle_${timestamp}.txt"

# ---------------------------
# Helper: normalize path like C:\proj\js\app.js
# into /js/app.js
# ---------------------------
function Normalize-RelPath {
    param($absPath, $rootDir)

    $full = Resolve-Path $absPath | Select-Object -ExpandProperty Path
    $rel  = $full.Substring($rootDir.Length).TrimStart("\","/")

    # convert backslashes to forward slashes
    $rel  = $rel -replace "\\","/"

    return "/" + $rel
}

# ---------------------------
# Step 1. Read whitelist and collect all files
# ---------------------------

if (!(Test-Path $whitelistPath)) {
    Write-Error "FILES_WHITELIST.txt not found"
    exit 1
}

$collectedFiles = @()

Get-Content $whitelistPath | ForEach-Object {
    $line = $_.Trim()

    # skip comments and empty lines
    if ($line -eq "" -or $line.StartsWith("#")) {
        return
    }

    # allow entries like:
    #   js
    #   js/*
    #   index.html
    #   assets
    #   assets/*
    #
    # If it's a folder -> include all files inside recursively.
    # If it's a file   -> include just that file.

    $cleanLine = $line
    if ($cleanLine.EndsWith("/*")) {
        $cleanLine = $cleanLine.Substring(0, $cleanLine.Length - 2)
    }

    $fullPath = Join-Path $rootDir $cleanLine

    if (Test-Path $fullPath) {

        if (Test-Path $fullPath -PathType Container) {
            # directory -> all files recursively
            $filesInDir = Get-ChildItem -Path $fullPath -Recurse -File |
                          Select-Object -ExpandProperty FullName
            $collectedFiles += $filesInDir
        }
        else {
            # single file
            $collectedFiles += (
                Resolve-Path $fullPath | Select-Object -ExpandProperty Path
            )
        }

    } else {
        Write-Warning "Path from whitelist not found: $line"
    }
}

# dedupe + sort (by relative path for stable order)
$collectedFiles = $collectedFiles |
    Sort-Object -Unique

# we will also prepare normalized relative paths once
$relPaths = $collectedFiles | ForEach-Object {
    Normalize-RelPath $_ $rootDir
}

# ---------------------------
# Step 2. Build FILE_INDEX header
# ---------------------------

$indexHeaderLines = @()
$indexHeaderLines += "FILE_INDEX_START"
$indexHeaderLines += $relPaths
$indexHeaderLines += "FILE_INDEX_END"

$indexHeaderText = ($indexHeaderLines -join "`r`n")

# ---------------------------
# Step 3. Build bodies
# ---------------------------

$bodyBuilder = New-Object System.Collections.Generic.List[string]

foreach ($absPath in $collectedFiles) {
    $rel = Normalize-RelPath $absPath $rootDir

    $bodyBuilder.Add("")
    $bodyBuilder.Add("// " + $rel)

    $fileContent = Get-Content -Raw -Encoding UTF8 $absPath
    $bodyBuilder.Add($fileContent)
}

$bodyText = ($bodyBuilder -join "`r`n")

# ---------------------------
# Step 4. Combine and write out
# ---------------------------

$finalText = $indexHeaderText + "`r`n`r`n" + $bodyText + "`r`n"

# write as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $finalText, $utf8NoBom)

Write-Host ("Done. File created: " + $outFile)
