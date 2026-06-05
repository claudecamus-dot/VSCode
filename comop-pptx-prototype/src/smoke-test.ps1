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

Write-Host ""
Write-Host "Resultat : $passed OK, $failed echoues"
if ($failed -gt 0) { exit 1 } else { exit 0 }
