<#
.SYNOPSIS
  Runs the SmartKorb data pipeline on Windows and optionally publishes the result.

.DESCRIPTION
  Alternative to the GitHub Actions workflow for running the daily refresh on a
  PC. Register it with Task Scheduler (see README → "Tägliche Aktualisierung").

.PARAMETER Push
  Commit and push the new snapshot to the current git branch.

.PARAMETER RefreshStores
  Also refresh the branch list from OpenStreetMap (slow, once a week is plenty).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\refresh-data.ps1 -Push
#>
param(
  [switch]$Push,
  [switch]$RefreshStores
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "SmartKorb: refreshing offer data ..."

if (-not (Test-Path 'node_modules')) {
  Write-Host "installing dependencies ..."
  npm ci
}

$flags = if ($RefreshStores) { '--update-seed' } else { '--skip-stores' }
npm run data:refresh -- $flags
if ($LASTEXITCODE -ne 0) { throw "pipeline failed with exit code $LASTEXITCODE" }

if ($Push) {
  $changed = git status --porcelain -- data/snapshot.json src/data/stores.json
  if ([string]::IsNullOrWhiteSpace($changed)) {
    Write-Host "snapshot unchanged - nothing to push"
  } else {
    git add data/snapshot.json src/data/stores.json
    git commit -m ("chore(data): daily refresh {0}" -f (Get-Date -Format 'yyyy-MM-dd'))
    git push
    Write-Host "snapshot published"
  }
}

Write-Host "done."
