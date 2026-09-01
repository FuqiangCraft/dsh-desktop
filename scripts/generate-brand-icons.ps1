param(
  [string]$SourceUrl = 'https://avatars.githubusercontent.com/u/148330874?s=512&v=4'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-deepseek-whale-source.png'
$brandingDir = Join-Path $repoRoot 'assets/branding'
$pluginLogoPath = Join-Path $repoRoot 'packages/dsh-desktop-plugin/assets/logo.png'

function New-TransparentBrandBitmap {
  param([System.Drawing.Bitmap]$Source)

  $brandColor = [System.Drawing.Color]::FromArgb(255, 77, 107, 254)
  $result = New-Object System.Drawing.Bitmap $Source.Width, $Source.Height,
    ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  for ($y = 0; $y -lt $Source.Height; $y++) {
    for ($x = 0; $x -lt $Source.Width; $x++) {
      $pixel = $Source.GetPixel($x, $y)
      # The official avatar is a flat blue mark on white. Recover the mark's
      # anti-aliased coverage from its red channel and make the white field
      # transparent so the icon works on light and dark system surfaces.
      $coverage = [Math]::Max(0.0, [Math]::Min(1.0, (255.0 - $pixel.R) / 178.0))
      $alpha = [int][Math]::Round(255.0 * $coverage)
      $result.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(
        $alpha,
        $brandColor.R,
        $brandColor.G,
        $brandColor.B
      ))
    }
  }

  return $result
}

function New-ResizedPngBytes {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size
  )

  $target = New-Object System.Drawing.Bitmap $Size, $Size,
    ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($Source, 0, 0, $Size, $Size)
  }
  finally {
    $graphics.Dispose()
  }

  $stream = New-Object System.IO.MemoryStream
  try {
    $target.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  }
  finally {
    $stream.Dispose()
    $target.Dispose()
  }
}

function Write-Png {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size,
    [string]$Path
  )

  [System.IO.File]::WriteAllBytes($Path, (New-ResizedPngBytes -Source $Source -Size $Size))
}

function Write-PngIcon {
  param(
    [System.Drawing.Bitmap]$Source,
    [string]$Path
  )

  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $images = New-Object 'System.Collections.Generic.List[byte[]]'
  foreach ($size in $sizes) {
    $images.Add((New-ResizedPngBytes -Source $Source -Size $size))
  }
  $headerLength = 6 + (16 * $sizes.Count)
  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter $stream

  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)

    $offset = $headerLength
    for ($i = 0; $i -lt $sizes.Count; $i++) {
      $sizeByte = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
      $writer.Write([byte]$sizeByte)
      $writer.Write([byte]$sizeByte)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$images[$i].Length)
      $writer.Write([uint32]$offset)
      $offset += $images[$i].Length
    }

    foreach ($image in $images) {
      $writer.Write($image)
    }

    [System.IO.File]::WriteAllBytes($Path, $stream.ToArray())
  }
  finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

try {
  Invoke-WebRequest -Uri $SourceUrl -OutFile $sourcePath
  $source = New-Object System.Drawing.Bitmap $sourcePath
  try {
    $transparentMark = New-TransparentBrandBitmap -Source $source
    try {
      Write-Png -Source $transparentMark -Size 512 -Path (Join-Path $brandingDir 'icon.png')
      Write-Png -Source $transparentMark -Size 256 -Path $pluginLogoPath
      Write-PngIcon -Source $transparentMark -Path (Join-Path $brandingDir 'icon.ico')
    }
    finally {
      $transparentMark.Dispose()
    }
  }
  finally {
    $source.Dispose()
  }
}
finally {
  Remove-Item -LiteralPath $sourcePath -Force -ErrorAction SilentlyContinue
}
