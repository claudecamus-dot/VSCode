param(
  [string]$TemplatePath = "$PSScriptRoot\..\templates\comop-template.pptx",
  [string]$DataPath     = "$PSScriptRoot\..\data\sample-comop.json",
  [string]$OutputPath   = "$PSScriptRoot\..\output\smoke-test-output.pptx"
)

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Assert-Step {
  param([string]$label, [scriptblock]$test)
  try {
    $result = & $test
    if ($result -eq $false) { throw "assertion returned false" }
    Write-Host "  [OK] $label"
    $script:passed++
  } catch {
    Write-Host "  [FAIL] $label -- $($_.Exception.Message)"
    $script:failed++
  }
}

Write-Host ""
Write-Host "Smoke test COMOP Generator"
Write-Host "=========================="

Assert-Step "Template existe" { Test-Path -LiteralPath $TemplatePath }
Assert-Step "Data sample existe" { Test-Path -LiteralPath $DataPath }

$dataJson = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Step "Sample JSON valide" { $dataJson -ne $null }

$generateScript = Join-Path $PSScriptRoot "generate-comop.ps1"
Assert-Step "generate-comop.ps1 existe" { Test-Path -LiteralPath $generateScript }

if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }

$result = powershell.exe -NoProfile -ExecutionPolicy Bypass -File $generateScript `
  -TemplatePath $TemplatePath `
  -DataPath $DataPath `
  -OutputPath $OutputPath | ConvertFrom-Json

Assert-Step "Generation sans erreur (status=genere)" { $result.status -eq "genere" }
Assert-Step "Fichier PPTX cree" { Test-Path -LiteralPath $OutputPath }
Assert-Step "Fichier PPTX non vide (> 10 Ko)" { (Get-Item -LiteralPath $OutputPath).Length -gt 10240 }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$verifyDir = Join-Path ([System.IO.Path]::GetTempPath()) ("smoke-verify-" + [System.Guid]::NewGuid().ToString("N"))
try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($OutputPath, $verifyDir)

  Assert-Step "PPTX contient ppt/presentation.xml" {
    Test-Path (Join-Path $verifyDir "ppt\presentation.xml")
  }

  foreach ($sf in @("slide2.xml","slide3.xml","slide4.xml")) {
    $sfPath = Join-Path $verifyDir "ppt\slides\$sf"
    Assert-Step "$sf present dans le PPTX" { Test-Path -LiteralPath $sfPath }
    if (Test-Path -LiteralPath $sfPath) {
      $content = Get-Content -LiteralPath $sfPath -Raw -Encoding UTF8
      Assert-Step "$sf : aucun placeholder non remplace" {
        -not ($content -match '\{\{[a-z_]+\}\}')
      }
    }
  }
} finally {
  if (Test-Path $verifyDir) { Remove-Item $verifyDir -Recurse -Force }
}

if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }

# Test ADR-003 : contenu utilisateur contenant {{...}} ne doit pas etre double-remplace
Write-Host ""
Write-Host "--- Test injection placeholder ---"
$injectionData = @{
  evenements_passes = 'Voir ticket {{velocite_moyenne}} en prod'
  faits_marquants = 'test'
  equipe = 'test'
  commentaire_indicateurs_agiles = 'test'
  points_attention = 'test'
  periode_debut = '2026-01-01'
  periode_fin = '2026-01-31'
  velocite_moyenne = '42'
  taux_predictibilite = '90'
  progression_resultats = '75'
  avancement_projet = '50'
  points_discussion = 'test'
  sujets_decision = 'test'
  decisions = 'test'
  chantiers_3_mois = 'test'
  jalons_livrables = 'test'
  avancement_chantiers = 'test'
  difficultes_roadmap = 'test'
  niveau_confiance = 'eleve'
  incertitude_roadmap = '10'
  type_focus = 'test'
  faits_marquants_incidentologie_recette = 'test'
  commentaire_indicateurs_incidentologie_recette = 'test'
  commentaire_evolution = 'test'
  tickets_crees = '5'
  tickets_traites = '4'
  tickets_non_traites = '1'
  impacts_metiers = 'test'
  actions_resolution = 'test'
  metiers_concernes = 'test'
} | ConvertTo-Json

$injectionDataPath = Join-Path ([System.IO.Path]::GetTempPath()) ("smoke-injection-" + [System.Guid]::NewGuid().ToString("N") + ".json")
$injectionOutputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("smoke-injection-" + [System.Guid]::NewGuid().ToString("N") + ".pptx")
Set-Content -LiteralPath $injectionDataPath -Value $injectionData -Encoding UTF8

try {
  $injResult = powershell.exe -NoProfile -ExecutionPolicy Bypass -File $generateScript `
    -TemplatePath $TemplatePath `
    -DataPath $injectionDataPath `
    -OutputPath $injectionOutputPath | ConvertFrom-Json

  Assert-Step "Injection : generation sans erreur" { $injResult.status -eq "genere" }

  if (Test-Path -LiteralPath $injectionOutputPath) {
    $injVerifyDir = Join-Path ([System.IO.Path]::GetTempPath()) ("smoke-inj-verify-" + [System.Guid]::NewGuid().ToString("N"))
    try {
      [System.IO.Compression.ZipFile]::ExtractToDirectory($injectionOutputPath, $injVerifyDir)
      $s2 = Get-Content (Join-Path $injVerifyDir "ppt\slides\slide2.xml") -Raw -Encoding UTF8
      Assert-Step "Injection : '{{velocite_moyenne}}' dans le texte n'est pas remplace par sa valeur (42)" {
        -not ($s2 -match '>42<')
      }
      Assert-Step "Injection : velocite_moyenne = 42 correctement remplace ailleurs" {
        $s2 -match '42'
      }
    } finally {
      if (Test-Path $injVerifyDir) { Remove-Item $injVerifyDir -Recurse -Force }
    }
  }
} finally {
  if (Test-Path -LiteralPath $injectionDataPath) { Remove-Item -LiteralPath $injectionDataPath -Force }
  if (Test-Path -LiteralPath $injectionOutputPath) { Remove-Item -LiteralPath $injectionOutputPath -Force }
}

# Test extraction de charte (golden-file sur le template OCTO connu)
Write-Host ""
Write-Host "--- Test extraction de charte graphique ---"
$extractScript = Join-Path $PSScriptRoot "extract-template-branding.ps1"
Assert-Step "extract-template-branding.ps1 existe" { Test-Path -LiteralPath $extractScript }

$brandingOutputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("smoke-branding-" + [System.Guid]::NewGuid().ToString("N") + ".json")
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $extractScript `
    -TemplatePath $TemplatePath `
    -OutputPath $brandingOutputPath | Out-Null

  Assert-Step "Sidecar de charte cree" { Test-Path -LiteralPath $brandingOutputPath }

  $branding = Get-Content -LiteralPath $brandingOutputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Assert-Step "Theme detecte = OCTO" { $branding.name -eq "OCTO" }
  Assert-Step "Couleur primaire detectee = 0E2356" { $branding.primary_color -eq "0E2356" }
  Assert-Step "Couleur d'accent detectee = 00D2DD" { $branding.accent_color -eq "00D2DD" }
  Assert-Step "Police detectee = Outfit" { $branding.font -eq "Outfit" }
  Assert-Step "Candidat logo detecte avec confiance faible et note explicite" {
    $branding.logo -ne $null -and $branding.logo.candidate -eq "image4.png" -and $branding.logo.confidence -eq "low" `
      -and -not [string]::IsNullOrWhiteSpace($branding.logo.note)
  }
} finally {
  if (Test-Path -LiteralPath $brandingOutputPath) { Remove-Item -LiteralPath $brandingOutputPath -Force }
}

Write-Host ""
Write-Host "Resultat : $passed OK, $failed echoues"
if ($failed -gt 0) { exit 1 } else { exit 0 }
