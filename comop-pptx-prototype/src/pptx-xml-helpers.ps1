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

function Protect-XmlAttribute {
  # Echappement complet pour une valeur inseree dans un attribut XML (ex:
  # typeface="$value"). Audit securite 2026-09-02 (branding) : $font/$to
  # viennent de config/branding.json (texte libre, non valide par un pattern
  # comme le sont primary_color/accent_color) et etaient inseres tels quels
  # dans des here-strings OOXML -- un guillemet dans la valeur casse hors de
  # l'attribut et injecte de l'XML arbitraire (verifie : "/></a:rPr><a:rPr
  # b="1 corrompt le paquet, cf. test-pptx-integrity.js). Aucun usage legitime
  # de balise/guillemet brut dans un nom de police ou une couleur : echappement
  # total, sans exception.
  param([string]$Text)
  if ($null -eq $Text) { return $Text }
  return $Text -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;'
}

function Protect-XmlText {
  # Echappement pour du texte insere en CONTENU d'element XML (ex:
  # <a:t>$value</a:t>) qui tolere les references d'entites XML DEJA valides --
  # config/branding.json ships footer_text avec "&#xA9;" (c) pre-echappe a la
  # main : un echappement naif de tous les "&" transformerait cette entite
  # fonctionnelle en "&amp;#xA9;" (le symbole disparait, remplace par du texte
  # litteral). Seul un "&" qui n'entame PAS une reference existante est
  # echappe ; "<" et ">" bruts n'ont eux aucun usage legitime en texte OOXML
  # (ils ouvriraient une vraie balise) et sont toujours echappes.
  param([string]$Text)
  if ($null -eq $Text) { return $Text }
  $escaped = [regex]::Replace($Text, '&(?!(#[0-9]+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;))', '&amp;')
  $escaped = $escaped -replace '<', '&lt;' -replace '>', '&gt;'
  return $escaped
}
