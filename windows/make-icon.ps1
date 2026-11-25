# Draws the Staff & Strings icon (the app's: five cream staff lines and an amber note on dark ink,
# as public/icons/icon-512.png and linux/guitar-reading-trainer.svg) at every size Windows uses,
# and writes them into one .ico (PNG-compressed entries), plus a 256 px PNG for the setup window.
# Each size is drawn, not scaled down, so the lines stay crisp at 16 and 32 px.
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Draw-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $u = $size / 512.0
  $ink = [System.Drawing.Color]::FromArgb(255, 0x1c, 0x1a, 0x17)
  $paper = [System.Drawing.Color]::FromArgb(255, 0xf1, 0xec, 0xe4)
  $amber = [System.Drawing.Color]::FromArgb(255, 0xe0, 0xa8, 0x4a)

  # Rounded square, as on the Linux icon (rx 96 of 512).
  $r = 96 * $u
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush $ink), $path)

  # Five staff lines; at small sizes snapped to whole pixels and at least 1 px thick.
  $lineW = [Math]::Max(1.0, 10 * $u)
  $brush = New-Object System.Drawing.SolidBrush $paper
  foreach ($y in 176, 220, 264, 308, 352) {
    $top = $y * $u - $lineW / 2
    if ($size -le 48) { $top = [Math]::Round($top) }
    $g.FillRectangle($brush, [single](72 * $u), [single]$top, [single](368 * $u), [single]$lineW)
  }

  # The note: a tilted head on the fourth line and a stem up.
  $amberBrush = New-Object System.Drawing.SolidBrush $amber
  $state = $g.Save()
  $g.TranslateTransform([single](300 * $u), [single](308 * $u))
  $g.RotateTransform(-20)
  $g.FillEllipse($amberBrush, [single](-58 * $u), [single](-40 * $u), [single](116 * $u), [single](80 * $u))
  $g.Restore($state)
  $stemW = [Math]::Max(1.0, 14 * $u)
  $g.FillRectangle($amberBrush, [single](340 * $u), [single](118 * $u), [single]$stemW, [single](190 * $u))
  $g.Dispose()
  return $bmp
}

$sizes = 16, 20, 24, 32, 40, 48, 64, 128, 256
$pngs = @()
foreach ($s in $sizes) {
  $bmp = Draw-Icon $s
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($s -eq 256) { $bmp.Save([IO.Path]::ChangeExtension($Out, '.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
  $bmp.Dispose()
  $pngs += , $ms.ToArray()
}

# ICO: header, one directory entry per size, then the PNG data.
$fs = [IO.File]::Create($Out)
$w = New-Object IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $dim = if ($s -ge 256) { 0 } else { $s }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$pngs[$i].Length); $w.Write([UInt32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Close()
Write-Host "Icon: $Out ($($sizes -join ', ') px)"
