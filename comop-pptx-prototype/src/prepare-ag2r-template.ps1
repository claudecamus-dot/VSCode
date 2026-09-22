param(
  [string]$SourcePath = "$PSScriptRoot\..\..\Pilotage Agile - exemple.pptx",
  [string]$OutputPath = "$PSScriptRoot\..\templates\comop-template.pptx"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "PowerPoint source introuvable: $SourcePath"
}

Invoke-PptxZipRoundTrip -SourcePath $SourcePath -OutputPath $OutputPath -Prefix "comop-template-" -Modify {
  param($workDir)

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

  # Index nommes d'apres le texte MAQUETTE origine de chaque noeud <a:t> dans
  # Pilotage Agile - exemple.pptx (finding risque_technique de l'audit VSCode,
  # re-verifie le 2026-09-22 en dumpant ppt/slides/slideN.xml et en comparant
  # chaque index au texte qu'il remplace -- cf. commentaire de
  # Assert-TextNodeCount ci-dessus sur la fragilite de ces positions). Les
  # index absents des blocs ci-dessous (en-tetes de section : "FAITS
  # MARQUANTS...", "Roadmap", "Exemple :", etc.) restent volontairement
  # inchanges -- ce ne sont pas des index "oublies".

  $slide2 = Join-Path $workDir "ppt\slides\slide2.xml"
  $xml = Get-Content -LiteralPath $slide2 -Raw -Encoding UTF8
  Assert-TextNodeCount -Text $xml -Expected 13 -Label "slide2.xml"
  # 0="MAQUETTE support COPIL - slide 1" / 2="XXX" / 3="EQUIPE XX" /
  # 5="XXXXX" / 6="Periode du XX/XX/2024..." / 7="Velocite moyenne : 30 Pts" /
  # 8="Taux predictibilite : 100 %" / 11="30 % (de l'objectif final)" /
  # 12="% d'avancement realisation projet : 60 %"
  $INDEX_S2_TITRE_SLIDE = 0
  $INDEX_S2_FAITS_MARQUANTS = 2
  $INDEX_S2_EQUIPE = 3
  $INDEX_S2_COMMENTAIRE_INDICATEURS_AGILES = 5
  $INDEX_S2_PERIODE = 6
  $INDEX_S2_VELOCITE_MOYENNE = 7
  $INDEX_S2_TAUX_PREDICTIBILITE = 8
  $INDEX_S2_PROGRESSION_RESULTATS = 11
  $INDEX_S2_AVANCEMENT_PROJET = 12
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_TITRE_SLIDE "COMOP - Evenements passes"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_FAITS_MARQUANTS "{{evenements_passes}} - {{faits_marquants}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_EQUIPE "{{equipe}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_COMMENTAIRE_INDICATEURS_AGILES "{{commentaire_indicateurs_agiles}} - {{points_attention}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_PERIODE "Periode du {{periode_debut}} au {{periode_fin}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_VELOCITE_MOYENNE "Velocite moyenne : {{velocite_moyenne}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_TAUX_PREDICTIBILITE "Taux predictibilite : {{taux_predictibilite}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_PROGRESSION_RESULTATS "{{progression_resultats}} (de l'objectif final)"
  $xml = Set-TextNodeByIndex $xml $INDEX_S2_AVANCEMENT_PROJET "% d'avancement realisation projet : {{avancement_projet}}"
  Set-Content -LiteralPath $slide2 -Value $xml -Encoding UTF8

  $slide3 = Join-Path $workDir "ppt\slides\slide3.xml"
  $xml = Get-Content -LiteralPath $slide3 -Raw -Encoding UTF8
  Assert-TextNodeCount -Text $xml -Expected 14 -Label "slide3.xml"
  # 0="MAQUETTE support COPIL - slide 2" / 3="xxx" (points de discussion) /
  # 9="XXX" (sujets pour decision) / 10="XXXX" (decision(s) prises) /
  # 11="xxx" (roadmap 3 mois) / 12="Roadmap : Niveau de confiance " /
  # 13="Pourcentage d'erreur de 20 %"
  $INDEX_S3_TITRE_SLIDE = 0
  $INDEX_S3_POINTS_DISCUSSION = 3
  $INDEX_S3_SUJETS_DECISION = 9
  $INDEX_S3_DECISIONS = 10
  $INDEX_S3_CONTENU_ROADMAP = 11
  $INDEX_S3_NIVEAU_CONFIANCE = 12
  $INDEX_S3_INCERTITUDE_ROADMAP = 13
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_TITRE_SLIDE "COMOP - Roadmap 3 mois"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_POINTS_DISCUSSION "{{points_discussion}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_SUJETS_DECISION "{{sujets_decision}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_DECISIONS "{{decisions}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_CONTENU_ROADMAP "{{chantiers_3_mois}} - {{jalons_livrables}} - {{avancement_chantiers}} - {{difficultes_roadmap}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_NIVEAU_CONFIANCE "Roadmap : Niveau de confiance {{niveau_confiance}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S3_INCERTITUDE_ROADMAP "Pourcentage d'erreur de {{incertitude_roadmap}}"
  Set-Content -LiteralPath $slide3 -Value $xml -Encoding UTF8

  $slide4 = Join-Path $workDir "ppt\slides\slide4.xml"
  $xml = Get-Content -LiteralPath $slide4 -Raw -Encoding UTF8
  Assert-TextNodeCount -Text $xml -Expected 11 -Label "slide4.xml"
  # 0="MAQUETTE support COPIL - slide 3" / 2="XXX" (faits marquants R7) /
  # 4="XXXXX" (commentaire indicateurs) / 5="Periode du XX/XX/2024..." /
  # 7="Evolution du volume de tickets retour R7 (...)" (legende remplacee par
  # les chiffres eux-memes) / 8="..." (impacts/actions) /
  # 9="Metiers concernes : XX "
  $INDEX_S4_TITRE_SLIDE = 0
  $INDEX_S4_FAITS_MARQUANTS = 2
  $INDEX_S4_COMMENTAIRE_INDICATEURS = 4
  $INDEX_S4_PERIODE = 5
  $INDEX_S4_TICKETS_STATS = 7
  $INDEX_S4_IMPACTS_ACTIONS = 8
  $INDEX_S4_METIERS_CONCERNES = 9
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_TITRE_SLIDE "COMOP - Focus incidentologie / recette"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_FAITS_MARQUANTS "{{type_focus}} - {{faits_marquants_incidentologie_recette}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_COMMENTAIRE_INDICATEURS "{{commentaire_indicateurs_incidentologie_recette}} - {{commentaire_evolution}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_PERIODE "Periode du {{periode_debut}} au {{periode_fin}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_TICKETS_STATS "Tickets crees : {{tickets_crees}} | traites : {{tickets_traites}} | non traites : {{tickets_non_traites}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_IMPACTS_ACTIONS "{{impacts_metiers}} - {{actions_resolution}}"
  $xml = Set-TextNodeByIndex $xml $INDEX_S4_METIERS_CONCERNES "Metiers concernes : {{metiers_concernes}}"
  Set-Content -LiteralPath $slide4 -Value $xml -Encoding UTF8

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }
  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
}

[pscustomobject]@{
  status = "template_prepare"
  output = (Resolve-Path -LiteralPath $OutputPath).Path
} | ConvertTo-Json
