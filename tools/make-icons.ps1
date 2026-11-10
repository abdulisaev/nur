# Рисует PNG-иконки приложения и обложку 640x360 для Mini App в @BotFather.
# Запуск из корня проекта:  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}

function DrawEmblem($g, [float]$cx, [float]$cy, [float]$s) {
  $gold1 = [System.Drawing.Color]::FromArgb(246, 220, 138); $gold2 = [System.Drawing.Color]::FromArgb(201, 162, 39)
  $goldBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.PointF(0, ($cy - $s))), (New-Object System.Drawing.PointF(0, ($cy + $s))), $gold1, $gold2)
  $pen = New-Object System.Drawing.Pen($goldBrush, ($s * 0.135))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $half = $s
  foreach ($angle in 0, 45) {
    $state = $g.Save()
    $g.TranslateTransform($cx, $cy); $g.RotateTransform($angle)
    $path = RoundRect (-$half) (-$half) (2 * $half) (2 * $half) ($s * 0.15)
    $g.DrawPath($pen, $path)
    $g.Restore($state)
  }
  $r = $s * 0.49
  $g.FillEllipse($goldBrush, $cx - $r, $cy - $r, 2 * $r, 2 * $r)
  # Полумесяц: тёмный круг, смещённый вправо и обрезанный по золотому
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(11, 61, 47))
  $r2 = $r * 0.8
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $clip.AddEllipse($cx - $r, $cy - $r, 2 * $r, 2 * $r)
  $g.SetClip($clip)
  $g.FillEllipse($dark, $cx - $r2 + $r * 0.38, $cy - $r2 - $r * 0.04, 2 * $r2, 2 * $r2)
  $g.ResetClip()
}

function NewIcon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.PointF(0, 0)), (New-Object System.Drawing.PointF($size, $size)), [System.Drawing.Color]::FromArgb(15, 92, 69), [System.Drawing.Color]::FromArgb(5, 32, 25))
  if ($maskable) { $g.FillRectangle($bg, 0, 0, $size, $size) }
  else { $g.FillPath($bg, (RoundRect 0 0 $size $size ($size * 0.223))) }
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath
  $glow.AddEllipse(-$size * 0.3, -$size * 0.4, $size * 1.2, $size * 1.1)
  $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(110, 63, 217, 168)
  $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 63, 217, 168))
  $pgb.CenterPoint = New-Object System.Drawing.PointF(($size * 0.3), ($size * 0.2))
  if ($maskable) { $g.FillRectangle($pgb, 0, 0, $size, $size) } else { $g.FillPath($pgb, (RoundRect 0 0 $size $size ($size * 0.223))) }
  $scale = if ($maskable) { 0.19 } else { 0.23 }
  DrawEmblem $g ($size / 2) ($size / 2) ($size * $scale)
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

NewIcon 192 'icon-192.png' $false
NewIcon 512 'icon-512.png' $false
NewIcon 512 'icon-maskable-512.png' $true

# Обложка 640x360 для @BotFather (/newapp)
$w = 640; $h = 360
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.PointF(0, 0)), (New-Object System.Drawing.PointF($w, $h)), [System.Drawing.Color]::FromArgb(15, 92, 69), [System.Drawing.Color]::FromArgb(4, 22, 17))
$g.FillRectangle($bg, 0, 0, $w, $h)
foreach ($b in @(@(-120, -160, 420, [System.Drawing.Color]::FromArgb(90, 63, 217, 168)), @(420, 120, 380, [System.Drawing.Color]::FromArgb(70, 201, 162, 39)))) {
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath; $gp.AddEllipse([float]$b[0], [float]$b[1], [float]$b[2], [float]$b[2])
  $br = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp); $br.CenterColor = $b[3]; $br.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $b[3]))
  $g.FillPath($br, $gp)
}
DrawEmblem $g 150 180 62
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 230, 245, 238))
$g.DrawString('Нур', (New-Object System.Drawing.Font('Segoe UI Semibold', 50)), $white, 262, 110)
$g.DrawString('Азкары · Коран · Тасбих', (New-Object System.Drawing.Font('Segoe UI', 19)), $soft, 268, 196)
$g.DrawString('перевод · транскрипция · 20 чтецов', (New-Object System.Drawing.Font('Segoe UI', 14)), $soft, 270, 232)
$bmp.Save((Join-Path $out 'telegram-cover-640x360.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host 'Иконки готовы.'
