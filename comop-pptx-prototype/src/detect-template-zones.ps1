param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [string]$OutputPath,

  # Fourni par server.js : le repertoire de travail est alors CREE par Node
  # AVANT le lancement de ce script, pour qu'il puisse le nettoyer lui-meme
  # si le script est tue au timeout (cf. runPowerShell, server.js) -- un
  # child.kill() est une terminaison abrupte qui n'execute jamais le bloc
  # finally ci-dessous. En usage CLI direct, non fourni : le script gere son
  # propre repertoire temporaire comme avant.
  [string]$WorkDir
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

function Get-ShapePosition {
  param([string]$ShapeXml)
  $off = [regex]::Match($ShapeXml, '<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"')
  $ext = [regex]::Match($ShapeXml, '<a:ext\s+cx="(\d+)"\s+cy="(\d+)"')
  if (-not ($off.Success -and $ext.Success)) { return $null }
  return [ordered]@{
    x       = [int]$off.Groups[1].Value
    y       = [int]$off.Groups[2].Value
    largeur = [int]$ext.Groups[1].Value
    hauteur = [int]$ext.Groups[2].Value
  }
}

function Get-TextApercu {
  param([string]$ShapeXml, [int]$MaxChars = 70)
  $fragments = [regex]::Matches($ShapeXml, '<a:t>(.*?)</a:t>') | ForEach-Object { $_.Groups[1].Value }
  $text = (($fragments -join " ") -replace '\s+', ' ').Trim()
  if ($text -eq "") { return $null }
  if ($text.Length -gt $MaxChars) { $text = $text.Substring(0, $MaxChars) + [char]0x2026 }
  return $text
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

if (-not $OutputPath) {
  $directory  = Split-Path -Parent $TemplatePath
  $baseName   = [System.IO.Path]::GetFileNameWithoutExtension($TemplatePath)
  $OutputPath = Join-Path $directory "$baseName.zones.json"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$workDir = if ($WorkDir) { $WorkDir } else { New-TempDirectory -Prefix "zones-detect-" }

try {
  Assert-ZipDecompressedSizeWithinLimit -ZipPath $TemplatePath
  [System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $workDir)

  $presentationPath = Join-Path $workDir "ppt\presentation.xml"
  $dimensions = $null
  if (Test-Path -LiteralPath $presentationPath) {
    $presentationXml = Get-Content -LiteralPath $presentationPath -Raw -Encoding UTF8
    $sz = [regex]::Match($presentationXml, '<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"')
    if ($sz.Success) {
      $dimensions = [ordered]@{ largeur = [int]$sz.Groups[1].Value; hauteur = [int]$sz.Groups[2].Value }
    }
  }

  $slideFiles = Get-ChildItem -LiteralPath (Join-Path $workDir "ppt\slides") -Filter "slide*.xml" |
    Sort-Object { [int]([regex]::Match($_.BaseName, '\d+').Value) }

  # Performance (finding audit) : `$tableau += $x` REALLOUE le tableau entier a
  # chaque ajout (les tableaux .NET sont de taille fixe) -- soit une copie par
  # zone ET par slide. Mesure sur le gabarit versionne : 36 zones + 4 slides =
  # 40 reallocations pour une seule detection, et le cout croit en O(n^2) sur un
  # deck client de 60 slides. List[object].Add() est amorti O(1) ; le rendu
  # ConvertTo-Json est identique (verrouille par test/test-detect-template-zones.js).
  $slides = [System.Collections.Generic.List[object]]::new()
  foreach ($slideFile in $slideFiles) {
    $slideIndex = [int]([regex]::Match($slideFile.BaseName, '\d+').Value)
    $xml = Get-Content -LiteralPath $slideFile.FullName -Raw -Encoding UTF8

    $zones = [System.Collections.Generic.List[object]]::new()

    foreach ($m in [regex]::Matches($xml, '<p:sp>.*?</p:sp>', 'Singleline')) {
      $shapeXml = $m.Value
      $apercu = Get-TextApercu $shapeXml
      if (-not $apercu) { continue }
      $zones.Add([ordered]@{
        type     = "texte"
        nom      = Get-ShapeName $shapeXml
        apercu   = $apercu
        position = Get-ShapePosition $shapeXml
      })
    }

    foreach ($m in [regex]::Matches($xml, '<p:graphicFrame>.*?</p:graphicFrame>', 'Singleline')) {
      $frameXml = $m.Value
      $zones.Add([ordered]@{
        type     = Get-GraphicType $frameXml
        nom      = Get-ShapeName $frameXml
        apercu   = $null
        position = Get-ShapePosition $frameXml
      })
    }

    foreach ($m in [regex]::Matches($xml, '<p:pic>.*?</p:pic>', 'Singleline')) {
      $picXml = $m.Value
      $zones.Add([ordered]@{
        type     = "image"
        nom      = Get-ShapeName $picXml
        apercu   = $null
        position = Get-ShapePosition $picXml
      })
    }

    $slides.Add([ordered]@{
      index = $slideIndex
      zones = $zones
    })
  }

  $result = [ordered]@{
    schema_version  = 1
    source_template = (Split-Path -Leaf $TemplatePath)
    dimensions      = $dimensions
    slides          = $slides
    detected_at     = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $json = $result | ConvertTo-Json -Depth 6
  Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8

  $totalZones = ($slides | ForEach-Object { $_.zones.Count } | Measure-Object -Sum).Sum
  [pscustomobject]@{
    status      = "zones_detectees"
    output      = (Resolve-Path -LiteralPath $OutputPath).Path
    slides      = $slides.Count
    zones_total = $totalZones
  } | ConvertTo-Json

} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
