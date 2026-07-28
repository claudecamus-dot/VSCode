param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [Parameter(Mandatory = $true)]
  [int]$SlideIndex,

  [Parameter(Mandatory = $true)]
  [string]$ShapeName
)

$ErrorActionPreference = "Stop"

function Get-ShapeName {
  param([string]$ShapeXml)
  $m = [regex]::Match($ShapeXml, '<p:cNvPr[^>]*\sname="([^"]*)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Get-GraphicType {
  param([string]$FrameXml)
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\bchart"') { return "graphique" }
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\btable"') { return "tableau" }
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\bdiagram"') { return "diagramme" }
  return "objet"
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("remove-shape-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $workDir)

  $slidePath = Join-Path $workDir "ppt\slides\slide$SlideIndex.xml"
  if (-not (Test-Path -LiteralPath $slidePath)) {
    throw "Slide $SlideIndex introuvable dans le template"
  }

  $xml = Get-Content -LiteralPath $slidePath -Raw -Encoding UTF8

  # On ne cible que les graphiques/tableaux/diagrammes/images : les zones de
  # texte (<p:sp> avec contenu) sont des emplacements de donnees du COMOP et
  # ne doivent pas pouvoir etre retirees par cette voie.
  $removedType = $null
  $removedAt = -1
  $removedLength = 0
  foreach ($entry in @(
      @{ Pattern = '<p:graphicFrame>.*?</p:graphicFrame>'; Kind = "graphicFrame" }
      @{ Pattern = '<p:pic>.*?</p:pic>'; Kind = "pic" }
    )) {
    $match = [regex]::Matches($xml, $entry.Pattern, 'Singleline') | Where-Object { (Get-ShapeName $_.Value) -eq $ShapeName } | Select-Object -First 1
    if ($match) {
      $removedType = if ($entry.Kind -eq "pic") { "image" } else { Get-GraphicType $match.Value }
      $removedAt = $match.Index
      $removedLength = $match.Length
      break
    }
  }

  if ($removedAt -lt 0) {
    throw "Forme '$ShapeName' introuvable (graphique/tableau/diagramme/image) sur la slide $SlideIndex"
  }

  $xml = $xml.Remove($removedAt, $removedLength)
  Set-Content -LiteralPath $slidePath -Value $xml -Encoding UTF8

  # L'operation ecrase le template EN PLACE : sans sauvegarde, une suppression
  # de trop est irrattrapable. C'est arrive — le commit e18574f (snapshot WIP) a
  # embarque un template ampute de ses 3 formes media, et le golden-file du
  # smoke-test est reste rouge jusqu'au 2026-07-28 sans que personne relie les deux.
  # La copie va dans archive/ : le serveur ne liste que templates/*.pptx a plat,
  # elle n'apparait donc pas dans la bibliotheque.
  $templateDir = Split-Path -Parent (Resolve-Path -LiteralPath $TemplatePath).Path
  $archiveDir = Join-Path $templateDir "archive"
  if (-not (Test-Path -LiteralPath $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir | Out-Null
  }
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($TemplatePath)
  $backupPath = Join-Path $archiveDir ("$baseName-avant-suppression-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".pptx")
  Copy-Item -LiteralPath $TemplatePath -Destination $backupPath -Force

  if (Test-Path -LiteralPath $TemplatePath) {
    Remove-Item -LiteralPath $TemplatePath -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $TemplatePath)

  [pscustomobject]@{
    status     = "forme_supprimee"
    output     = (Resolve-Path -LiteralPath $TemplatePath).Path
    slide      = $SlideIndex
    nom        = $ShapeName
    type       = $removedType
    sauvegarde = $backupPath
  } | ConvertTo-Json

} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
