# Скачивает текст Корана и переводы с api.alquran.cloud (данные Tanzil)
# и раскладывает их по файлам data/quran/<издание>/NNN.json + data/quran/meta.json.
# Запуск из корня проекта:  powershell -ExecutionPolicy Bypass -File tools\build-quran.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'data\quran'
$editions = @('quran-uthmani', 'ru.kuliev', 'ru.abuadel', 'ru.osmanov')
$folder = @{ 'quran-uthmani' = 'ar'; 'ru.kuliev' = 'ru.kuliev'; 'ru.abuadel' = 'ru.abuadel'; 'ru.osmanov' = 'ru.osmanov' }
$utf8 = New-Object System.Text.UTF8Encoding $false

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = [int]::MaxValue

function Get-Json($url) {
  for ($i = 0; $i -lt 5; $i++) {
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Encoding = [System.Text.Encoding]::UTF8
      return $serializer.DeserializeObject($wc.DownloadString($url))
    } catch {
      Start-Sleep -Seconds (2 * ($i + 1))
    }
  }
  throw "Не удалось загрузить $url"
}

function Save-Json($path, $obj) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText($path, $serializer.Serialize($obj), $utf8)
}

# Буквы без огласовок — чтобы сравнивать басмалу независимо от вариантов знаков
function Strip-Marks([string]$s) {
  return ($s -replace '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '').Replace([char]0x0671, [char]0x0627)
}

$list = (Get-Json 'https://api.alquran.cloud/v1/surah').data
$basmala = $null
$juz = @(); $sajda = @(); $surahs = @()
$lastJuz = 0

foreach ($s in $list) {
  $n = [int]$s.number
  $id = '{0:D3}' -f $n
  Write-Host "Сура $n / 114"
  $res = (Get-Json ("https://api.alquran.cloud/v1/surah/$n/editions/" + ($editions -join ','))).data

  foreach ($ed in $res) {
    $key = $ed.edition.identifier
    $texts = New-Object System.Collections.ArrayList
    foreach ($a in $ed.ayahs) {
      $t = ([string]$a.text).Replace([string][char]0xFEFF, '')
      if ($key -eq 'quran-uthmani') {
        if ($n -eq 1 -and $a.numberInSurah -eq 1) { $basmala = $t }
        # alquran.cloud приклеивает басмалу к первому аяту — отделяем её
        if ($n -ne 1 -and $a.numberInSurah -eq 1 -and $basmala) {
          $words = $t -split ' '
          if ($words.Count -gt 4 -and (Strip-Marks (($words[0..3]) -join ' ')) -eq (Strip-Marks $basmala)) {
            $t = ($words[4..($words.Count - 1)]) -join ' '
          }
        }
        if ([int]$a.juz -ne $lastJuz) { $juz += , @($n, [int]$a.numberInSurah); $lastJuz = [int]$a.juz }
        if ($a.sajda -ne $false -and $a.sajda -ne $null) { $sajda += , @($n, [int]$a.numberInSurah) }
      }
      [void]$texts.Add($t.Trim())
    }
    Save-Json (Join-Path $out ($folder[$key] + "\$id.json")) $texts
  }

  $surahs += , @{ n = $n; ar = [string]$s.name; ayahs = [int]$s.numberOfAyahs; type = $(if ($s.revelationType -eq 'Meccan') { 'm' } else { 'd' }) }
}

# Начала 604 страниц Мединского мусхафа
$pages = @((Get-Json 'https://api.alquran.cloud/v1/meta').data.pages.references | ForEach-Object { , @([int]$_.surah, [int]$_.ayah) })

Save-Json (Join-Path $out 'meta.json') @{ basmala = $basmala; juz = $juz; sajda = $sajda; surahs = $surahs; pages = $pages }
Write-Host 'Готово.'
