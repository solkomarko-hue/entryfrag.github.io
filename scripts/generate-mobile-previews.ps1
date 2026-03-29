param(
  [string]$Root = "A:\Entryfrag",
  [string]$OutputDir = "A:\Entryfrag\mobile-previews",
  [int]$MaxDimension = 720,
  [long]$Quality = 64
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Get-PreviewName([string]$fileName) {
  return (($fileName -replace '(?i)(\.(png|jpe?g|webp|gif))+$', '') + '.jpg')
}

function Save-JpegPreview([string]$sourcePath, [string]$destPath, [int]$maxDimension, [long]$quality) {
  $image = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $ratio = [Math]::Min($maxDimension / $image.Width, $maxDimension / $image.Height)
    if ($ratio -gt 1) { $ratio = 1 }
    $width = [Math]::Max([int][Math]::Round($image.Width * $ratio), 1)
    $height = [Math]::Max([int][Math]::Round($image.Height * $ratio), 1)

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $width, $height)

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        $encoder = [System.Drawing.Imaging.Encoder]::Quality
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, $quality)
        $bitmap.Save($destPath, $codec, $encoderParams)
      }
      finally {
        $graphics.Dispose()
      }
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $image.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$sourceFiles = Get-ChildItem -Path $Root -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\artifacts\\' -and
  $_.FullName -notmatch '\\mobile-previews\\' -and
  $_.Extension -match '^(?i)\.(png|jpe?g)$' -and
  $_.Name -notmatch '(?i)rozmir'
}

foreach ($file in $sourceFiles) {
  $previewName = Get-PreviewName $file.Name
  $destPath = Join-Path $OutputDir $previewName
  if ((Test-Path $destPath) -and (Get-Item $destPath).LastWriteTimeUtc -ge $file.LastWriteTimeUtc) {
    continue
  }
  Save-JpegPreview -sourcePath $file.FullName -destPath $destPath -maxDimension $MaxDimension -quality $Quality
}

Get-ChildItem -Path $OutputDir -File | Sort-Object Name | Select-Object Name,Length