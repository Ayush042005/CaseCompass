Write-Host "Checking repository size (tracked files only)..."

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
    Write-Error "Not a git repository."
    exit 1
}

$files = git ls-files
$totalSize = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        $totalSize += (Get-Item $file).Length
    }
}

$totalMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "Total tracked size: $totalMB MB"
Write-Host ""
Write-Host "Largest tracked files:"
if (git rev-parse --verify HEAD 2>$null) {
    git ls-tree -r -t -l HEAD | Sort-Object -Descending -Property @{Expression={[int]$_.Split("`t ")[3]}} | Select-Object -First 10 | ForEach-Object {
        $parts = $_ -split "\s+"
        $sizeMB = [math]::Round([int]$parts[3] / 1MB, 2)
        $name = $parts[4..($parts.Length-1)] -join " "
        Write-Host "$sizeMB MB`t$name"
    }
} else {
    Write-Host "No commit yet; skipping largest-file listing."
}

Write-Host ""
if ($totalMB -ge 10.0) {
    Write-Error "ERROR: Repository exceeds 10 MB limit!"
    exit 1
} elseif ($totalMB -ge 8.0) {
    Write-Warning "WARNING: Repository is approaching 10 MB limit ($totalMB MB)."
} else {
    Write-Host "SUCCESS: Repository size is well under the limit." -ForegroundColor Green
}
