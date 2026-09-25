# Regenerates the README screenshots and GIFs in docs\media\ from the current Studio.
# Needs Docker (the halo-composer-test image from scripts\test.ps1) and ffmpeg on PATH.
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path "$PSScriptRoot\.."
$tmp = Join-Path $env:TEMP 'halo-media'
$media = Join-Path $repo 'docs\media'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force $tmp, $media | Out-Null

python "$repo\studio\build_studio.py" --out "$repo\dist" | Out-Null
docker build -q -t halo-composer-test -f "$repo\tests\Dockerfile" "$repo\tests" | Out-Null
docker run --rm --mount "type=bind,source=$repo,target=/src,readonly" --mount "type=bind,source=$tmp,target=/out" halo-composer-test `
  bash -c "cp -r /src /work && cd /work && npm ci --silent && node scripts/capture_readme_media.js"
if ($LASTEXITCODE -ne 0) { throw "capture failed (exit $LASTEXITCODE)" }

Copy-Item "$tmp\*.png" $media -Force
Get-ChildItem "$tmp\frames" -Directory | ForEach-Object {
  $in = Join-Path $_.FullName 'f%04d.png'
  $out = Join-Path $media "$($_.Name).gif"
  ffmpeg -loglevel error -y -framerate 15 -i $in -vf "scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 $out
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($_.Name)" }
}
Get-ChildItem $media | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB) } } | Format-Table -AutoSize
