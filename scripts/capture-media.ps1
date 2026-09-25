# Regenerates the README screenshots and GIFs in docs\media\ from the current Studio.
# Needs Docker (the halo-composer-test image from tests\Dockerfile) and ffmpeg on PATH. No keyboard needed.
#
# 1. builds Studio into dist\
# 2. runs scripts\capture_readme_media.js in the container (Playwright's Chromium): screenshots,
#    plus the frames of each seamless GIF loop and a matching still, into %TEMP%\halo-media
# 3. turns each set of frames into a GIF with ffmpeg, copies everything into docs\media\ and
#    prints each loop's seam check (frame N vs frame 0; ~0 means the loop joins invisibly)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path "$PSScriptRoot\.."
$tmp = Join-Path $env:TEMP 'halo-media'
$media = Join-Path $repo 'docs\media'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force $tmp, $media | Out-Null

python "$repo\studio\build_studio.py" --out "$repo\dist" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Studio build failed' }
docker build -q -t halo-composer-test -f "$repo\tests\Dockerfile" "$repo\tests" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'could not build the test image' }
# Only package.json and the lock file are copied: npm installs the pinned Playwright next to them,
# and the script runs straight from the read-only /src mount (NODE_PATH points it at the install).
docker run --rm --mount "type=bind,source=$repo,target=/src,readonly" --mount "type=bind,source=$tmp,target=/out" halo-composer-test `
  bash -c "mkdir -p /work && cp /src/package.json /src/package-lock.json /work/ && cd /work && npm ci --silent --no-audit --no-fund && NODE_PATH=/work/node_modules node /src/scripts/capture_readme_media.js"
if ($LASTEXITCODE -ne 0) { throw "capture failed (exit $LASTEXITCODE)" }

# GIFs. Every frame is shown for 7/100 s (GIF delays are whole hundredths; ~14.3 fps). One
# 256-color palette per GIF, built from all frames (stats_mode=full keeps the static parts, like
# Studio's panel, in their true colors). Ordered (bayer) dithering at scale 2 gave the smoothest
# gradients: error diffusion (sierra2_4a) shimmered from frame to frame and made files up to 2.5x
# bigger; bayer_scale 3-4 is smaller but shows rings of banding on the keys' glow.
$loops = Get-Content (Join-Path $tmp 'loops.json') -Raw | ConvertFrom-Json
foreach ($l in $loops) {
  $in = Join-Path $tmp "frames\$($l.name)\f%04d.png"
  $out = Join-Path $media "$($l.name).gif"
  $vf = "scale=$($l.width):-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle"
  ffmpeg -loglevel error -y -framerate 100/7 -i $in -vf $vf -loop 0 $out
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($l.name)" }
  # The still with the same name (a frame from the loop) is the swap-in alternative to the GIF.
  $still = Join-Path $tmp "$($l.name).png"
  if ($l.stillWidth) {
    ffmpeg -loglevel error -y -i $still -vf "scale=$($l.stillWidth):-1:flags=lanczos" (Join-Path $media "$($l.name).png")
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for the $($l.name) still" }
  } else { Copy-Item $still $media -Force }
}
# Screenshots
Get-ChildItem $tmp -Filter 'studio-*.png' | Where-Object { $loops.name -notcontains $_.BaseName } | Copy-Item -Destination $media -Force

$loops | Select-Object name, @{ n = 'loop ms'; e = { $_.T } }, @{ n = 'frames'; e = { $_.N } }, @{ n = 'fps'; e = { [math]::Round(1000 / 70, 1) } },
  @{ n = 'seam mean'; e = { '{0:N4}' -f $_.seam.mean } }, @{ n = 'seam max'; e = { $_.seam.max } }, @{ n = 'step mean'; e = { '{0:N3}' -f $_.step.mean } },
  @{ n = 'GIF KB'; e = { [math]::Round((Get-Item (Join-Path $media "$($_.name).gif")).Length / 1KB) } } | Format-Table -AutoSize
Get-ChildItem $media | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB) } } | Format-Table -AutoSize
