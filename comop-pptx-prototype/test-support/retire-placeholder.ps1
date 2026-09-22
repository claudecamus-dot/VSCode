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

. (Join-Path $PSScriptRoot '..\src\pptx-xml-helpers.ps1')

Invoke-PptxZipRoundTrip -SourcePath (Resolve-Path -LiteralPath $Source).Path -OutputPath $Destination -Prefix "retire-placeholder-" -SkipZipBombCheck -Modify {
  param($workDir)

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
}
