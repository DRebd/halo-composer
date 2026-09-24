<#
.SYNOPSIS
  Builds the keyboard firmware with Docker. Results go to .\dist\

.EXAMPLE
  .\scripts\build-firmware.ps1                # both: via (fallback) + composer
  .\scripts\build-firmware.ps1 composer       # only Halo Composer

.NOTES
  Needs Docker Desktop running. The first run downloads ryodeushii's firmware
  source (~300 MB) into a Docker volume named "halo-composer-qmk"; later runs
  reuse it and take about a minute.
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Targets = @('via', 'composer'))
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo 'dist'
New-Item -ItemType Directory -Force $out | Out-Null

$image = (Get-Content (Join-Path $repo 'firmware\base.env') | Where-Object { $_ -match '^QMK_IMAGE=' }) -replace '^QMK_IMAGE=', ''
docker volume create halo-composer-qmk | Out-Null
docker run --rm `
    -v halo-composer-qmk:/qmk `
    --mount "type=bind,source=$repo,target=/src,readonly" `
    --mount "type=bind,source=$out,target=/out" `
    $image bash /src/scripts/build_in_container.sh @Targets
if ($LASTEXITCODE -ne 0) { throw "firmware build failed (exit $LASTEXITCODE)" }
Write-Host "`nFirmware files are in $out"
