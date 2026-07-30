# Helpers OOXML partages par les scripts de manipulation de template COMOP.
# Dot-source depuis chaque script : . (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')
#
# Extraits ici pour supprimer la duplication de Get-ShapeName / Get-GraphicType /
# New-TempDirectory, qui vivaient en double copie octet-pour-octet dans
# detect-template-zones.ps1 et remove-template-shape.ps1 (finding risque_technique
# de l'audit VSCode, 2026-07-23). Une seule source de verite : une correction de
# regex OOXML se fait ici et vaut pour les deux scripts.

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

function New-TempDirectory {
  # Prefixe conserve par appelant (zones-detect- / remove-shape-) : sert de repere
  # au debogage si un repertoire de travail n'est pas nettoye.
  param([string]$Prefix = "comop-ppt-")
  $path = Join-Path ([System.IO.Path]::GetTempPath()) ($Prefix + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $path | Out-Null
  return $path
}
