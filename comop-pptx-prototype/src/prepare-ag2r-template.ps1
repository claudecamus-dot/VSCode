param(
  [string]$SourcePath = "$PSScriptRoot\..\..\Pilotage Agile AG2R - exemple.pptx",
  [string]$OutputPath = "$PSScriptRoot\..\templates\comop-template.pptx"
)

$ErrorActionPreference = "Stop"

function New-TempDirectory {
  $path = Join-Path ([System.IO.Path]::GetTempPath()) ("comop-template-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $path | Out-Null
  return $path
}

function Replace-Text {
  param(
    [string]$Text,
    [string]$From,
    [string]$To
  )
  return $Text.Replace($From, $To)
}

function Replace-Next {
  param(
    [string]$Text,
    [string]$From,
    [string]$To
  )
  $index = $Text.IndexOf($From)
  if ($index -lt 0) {
    return $Text
  }
  return $Text.Substring(0, $index) + $To + $Text.Substring($index + $From.Length)
}

function Set-TextNodeByIndex {
  param(
    [string]$Text,
    [int]$Index,
    [string]$Value
  )

  $matches = [regex]::Matches($Text, '<a:t>(.*?)</a:t>')
  if ($Index -lt 0 -or $Index -ge $matches.Count) {
    return $Text
  }

  $match = $matches[$Index]
  return $Text.Substring(0, $match.Index) + "<a:t>$Value</a:t>" + $Text.Substring($match.Index + $match.Length)
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "PowerPoint source introuvable: $SourcePath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$workDir = New-TempDirectory

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath, $workDir)

  $presentationPath = Join-Path $workDir "ppt\presentation.xml"
  $presentation = Get-Content -LiteralPath $presentationPath -Raw -Encoding UTF8
  $presentation = [regex]::Replace($presentation, '<p:sldId id="256" r:id="rId2"\s*/>', '')
  Set-Content -LiteralPath $presentationPath -Value $presentation -Encoding UTF8

  $relsPath = Join-Path $workDir "ppt\_rels\presentation.xml.rels"
  $rels = Get-Content -LiteralPath $relsPath -Raw -Encoding UTF8
  $rels = [regex]::Replace($rels, '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"\s*/>', '')
  Set-Content -LiteralPath $relsPath -Value $rels -Encoding UTF8

  $appPath = Join-Path $workDir "docProps\app.xml"
  if (Test-Path -LiteralPath $appPath) {
    $app = Get-Content -LiteralPath $appPath -Raw -Encoding UTF8
    $app = $app.Replace("<Slides>4</Slides>", "<Slides>3</Slides>")
    Set-Content -LiteralPath $appPath -Value $app -Encoding UTF8
  }

  $slide2 = Join-Path $workDir "ppt\slides\slide2.xml"
  $xml = Get-Content -LiteralPath $slide2 -Raw -Encoding UTF8
  $xml = Set-TextNodeByIndex $xml 0 "COMOP - Evenements passes"
  $xml = Set-TextNodeByIndex $xml 2 "{{evenements_passes}} - {{faits_marquants}}"
  $xml = Set-TextNodeByIndex $xml 3 "{{equipe}}"
  $xml = Set-TextNodeByIndex $xml 5 "{{commentaire_indicateurs_agiles}} - {{points_attention}}"
  $xml = Set-TextNodeByIndex $xml 6 "Periode du {{periode_debut}} au {{periode_fin}}"
  $xml = Set-TextNodeByIndex $xml 7 "Velocite moyenne : {{velocite_moyenne}}"
  $xml = Set-TextNodeByIndex $xml 8 "Taux predictibilite : {{taux_predictibilite}}"
  $xml = Set-TextNodeByIndex $xml 11 "{{progression_resultats}} (de l'objectif final)"
  $xml = Set-TextNodeByIndex $xml 12 "% d'avancement realisation projet : {{avancement_projet}}"
  Set-Content -LiteralPath $slide2 -Value $xml -Encoding UTF8

  $slide3 = Join-Path $workDir "ppt\slides\slide3.xml"
  $xml = Get-Content -LiteralPath $slide3 -Raw -Encoding UTF8
  $xml = Set-TextNodeByIndex $xml 0 "COMOP - Roadmap 3 mois"
  $xml = Set-TextNodeByIndex $xml 3 "{{points_discussion}}"
  $xml = Set-TextNodeByIndex $xml 9 "{{sujets_decision}}"
  $xml = Set-TextNodeByIndex $xml 10 "{{decisions}}"
  $xml = Set-TextNodeByIndex $xml 11 "{{chantiers_3_mois}} - {{jalons_livrables}} - {{avancement_chantiers}} - {{difficultes_roadmap}}"
  $xml = Set-TextNodeByIndex $xml 12 "Roadmap : Niveau de confiance {{niveau_confiance}}"
  $xml = Set-TextNodeByIndex $xml 13 "Pourcentage d'erreur de {{incertitude_roadmap}}"
  Set-Content -LiteralPath $slide3 -Value $xml -Encoding UTF8

  $slide4 = Join-Path $workDir "ppt\slides\slide4.xml"
  $xml = Get-Content -LiteralPath $slide4 -Raw -Encoding UTF8
  $xml = Set-TextNodeByIndex $xml 0 "COMOP - Focus incidentologie / recette"
  $xml = Set-TextNodeByIndex $xml 2 "{{type_focus}} - {{faits_marquants_incidentologie_recette}}"
  $xml = Set-TextNodeByIndex $xml 4 "{{commentaire_indicateurs_incidentologie_recette}} - {{commentaire_evolution}}"
  $xml = Set-TextNodeByIndex $xml 5 "Periode du {{periode_debut}} au {{periode_fin}}"
  $xml = Set-TextNodeByIndex $xml 7 "Tickets crees : {{tickets_crees}} | traites : {{tickets_traites}} | non traites : {{tickets_non_traites}}"
  $xml = Set-TextNodeByIndex $xml 8 "{{impacts_metiers}} - {{actions_resolution}}"
  $xml = Set-TextNodeByIndex $xml 9 "Metiers concernes : {{metiers_concernes}}"
  Set-Content -LiteralPath $slide4 -Value $xml -Encoding UTF8

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }
  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  [System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $OutputPath)
  [pscustomobject]@{
    status = "template_prepare"
    output = (Resolve-Path -LiteralPath $OutputPath).Path
  } | ConvertTo-Json
} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
