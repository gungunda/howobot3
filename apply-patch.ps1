# apply-patch.ps1
# Usage:
#   powershell -ExecutionPolicy Bypass -File apply-patch.ps1 [-PatchFile patch.txt]
#
# This script reads a "pseudo-zip" patch file and writes/overwrites
# the described files into the current project directory.

param(
    [string] $PatchFile = "patch.txt"
)

if (!(Test-Path $PatchFile)) {
    Write-Error "Patch file not found: $PatchFile"
    exit 1
}

# Read the whole patch file as array of lines
$lines = Get-Content -Raw -Encoding UTF8 $PatchFile -ErrorAction Stop -Wait |
         Split-Path -Leaf | Out-Null

# NOTE:
# The above trick with Split-Path is wrong for multi-line, let's just do simple:
$allText = Get-Content -Raw -Encoding UTF8 $PatchFile
$allLines = $allText -split "`r`n|`n|`r"

# Parser state
$inFileBlock   = $false    # between ===FILE_START=== and ===FILE_END===
$inBody        = $false    # between -----8<----- markers
$currentPath   = ""
$currentBody   = @()

function Flush-CurrentFile {
    param($path, $bodyLines)

    if (-not $path) {
        Write-Warning "Flush called with empty path, skipping."
        return
    }

    # Normalize slashes in path to OS style
    $normPath = $path -replace "\\","/"
    $normPathParts = $normPath -split "/"
    $joined = [System.IO.Path]::Combine($normPathParts)

    $targetFullPath = Join-Path (Get-Location) $joined
    $targetDir = Split-Path $targetFullPath -Parent

    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $fileText = ($bodyLines -join "`r`n")
    [System.IO.File]::WriteAllText($targetFullPath, $fileText, $utf8NoBom)

    Write-Host ("[WROTE] " + $path)
}

foreach ($line in $allLines) {

    if (-not $inFileBlock) {
        # we are looking for ===FILE_START===
        if ($line -eq "===FILE_START===") {
            $inFileBlock = $true
            $inBody = $false
            $currentPath = ""
            $currentBody = @()
        }
        continue
    }

    # we're inside FILE block

    if ($line -eq "===FILE_END===") {
        # finalize this file
        Flush-CurrentFile -path $currentPath -bodyLines $currentBody
        $inFileBlock = $false
        $inBody = $false
        $currentPath = ""
        $currentBody = @()
        continue
    }

    if (-not $inBody) {
        # expecting PATH: ... or first body marker
        if ($line -match "^PATH:\s*(.+)$") {
            $currentPath = $Matches[1].Trim()
            continue
        }

        if ($line -eq "-----8<-----") {
            # start of body
            $inBody = $true
            continue
        }

        # any other line before body we just ignore (robustness)
        continue
    }

    # we are IN body
    if ($line -eq "-----8<-----") {
        # end of body section, wait for ===FILE_END===
        $inBody = $false
        continue
    }

    # collect body lines
    $currentBody += $line
}

Write-Host "Done."
