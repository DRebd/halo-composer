<#
.SYNOPSIS
  Runs every host test (no keyboard needed) in a Linux container, the same way CI does.

  1. lighting engine compiles warning-free
  2. C engine and JavaScript engine produce byte-identical frames
  3. the firmware's protocol code, built for this PC, passes the protocol checks
  4. Halo Studio builds
  5. Halo Studio, driven by a headless browser, talks to that fake keyboard end to end
#>
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
docker build -q -t halo-composer-test (Join-Path $repo 'tests') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'could not build the test image' }
docker run --rm --mount "type=bind,source=$repo,target=/src,readonly" halo-composer-test bash /src/scripts/test_in_container.sh
if ($LASTEXITCODE -ne 0) { throw "tests failed (exit $LASTEXITCODE)" }
