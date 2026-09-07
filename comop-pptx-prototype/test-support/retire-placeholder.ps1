# Support de test UNIQUEMENT : retire un placeholder {{...}} precis d'un
# template copie, pour prouver que validate-template.ps1 (et sa mise en avant
# par POST /api/templates) detecte vraiment un template incomplet. Aucun usage
# en production.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination,
  [Parameter(Mandatory = $true)][string]$Placeholder
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("retire-placeholder-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null
try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $Source).Path, $workDir)

  $token = "{{$Placeholder}}"
  $slideFiles = Get-ChildItem -LiteralPath (Join-Path $workDir "ppt\slides") -Filter "slide*.xml"
  foreach ($slide in $slideFiles) {
    $xml = Get-Content -LiteralPath $slide.FullName -Raw -Encoding UTF8
    if ($xml.Contains($token)) {
      $xml = $xml.Replace($token, "valeur-test-sans-placeholder")
      Set-Content -LiteralPath $slide.FullName -Value $xml -Encoding UTF8
    }
  }

  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $Destination)
} finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}
