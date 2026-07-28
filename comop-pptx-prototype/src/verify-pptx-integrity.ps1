# Controle d'integrite OOXML d'un .pptx produit par le prototype.
#
# Raison d'etre : la regression du 2026-06-08 (increment 6) est restee invisible
# 45 jours parce qu'AUCUNE verification n'ouvrait le fichier produit. Les scripts
# de mutation (apply-octo-branding.ps1, remove-template-shape.ps1) reecrivent du
# XML a la main ; une seule substitution ratee suffit a produire un paquet que
# PowerPoint refuse d'ouvrir alors que la taille, les entrees du zip et meme
# python-pptx restent parfaitement normaux.
#
# Deux defauts reels sont verrouilles ici :
#   1. partie XML non parsable  (cause : "<<a:majorFont>>" ecrit dans theme1.xml)
#   2. p:cNvPr id duplique dans une slide (cause : branding non idempotent)
#
# -RealOpen ouvre reellement le fichier dans PowerPoint (COM) : c'est l'oracle,
# mais il exige Office et ne tourne donc pas en CI — les deux controles
# structurels ci-dessus, eux, sont deterministes et rejouables partout.

param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [switch]$RealOpen
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "PPTX introuvable: $TemplatePath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$invalidXml = @()
$duplicateIds = @()
$partCount = 0
$hasContentTypes = $false

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $TemplatePath).Path)
try {
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName -replace "\\", "/"
    $partCount++
    if ($name -eq "[Content_Types].xml") { $hasContentTypes = $true }
    if ($name -notlike "*.xml" -and $name -notlike "*.rels") { continue }

    $stream = $entry.Open()
    try {
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true)
      $text = $reader.ReadToEnd()
    } finally {
      if ($reader) { $reader.Dispose() }
      $stream.Dispose()
    }

    try {
      $doc = New-Object System.Xml.XmlDocument
      $doc.LoadXml($text)
    } catch {
      $invalidXml += [pscustomobject]@{ part = $name; erreur = $_.Exception.Message }
    }

    if ($name -like "ppt/slides/slide*.xml") {
      $ids = [regex]::Matches($text, '<p:cNvPr id="(\d+)"') | ForEach-Object { $_.Groups[1].Value }
      $dups = @($ids | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
      if ($dups.Count -gt 0) {
        $duplicateIds += [pscustomobject]@{ part = $name; ids = $dups }
      }
    }
  }
} finally {
  $zip.Dispose()
}

$ouverture = "non-teste"
if ($RealOpen) {
  $powerpoint = $null
  try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $deck = $powerpoint.Presentations.Open((Resolve-Path -LiteralPath $TemplatePath).Path, $true, $false, $false)
    $ouverture = "ouvert ($($deck.Slides.Count) slides)"
    $deck.Close()
  } catch {
    $ouverture = "REFUS PowerPoint : $($_.Exception.Message)"
  } finally {
    if ($powerpoint) {
      $powerpoint.Quit()
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerpoint)
    }
  }
}

$corrompu = ($invalidXml.Count -gt 0) -or ($duplicateIds.Count -gt 0) -or (-not $hasContentTypes) -or ($ouverture -like "REFUS*")

[pscustomobject]@{
  fichier         = (Resolve-Path -LiteralPath $TemplatePath).Path
  status          = $(if ($corrompu) { "corrompu" } else { "valide" })
  parts           = $partCount
  contentTypes    = $hasContentTypes
  xmlInvalides    = $invalidXml
  idsDupliques    = $duplicateIds
  ouvertureReelle = $ouverture
} | ConvertTo-Json -Depth 5

if ($corrompu) { exit 1 }
