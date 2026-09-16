# Support de test UNIQUEMENT : appelle Set-TextNodeByIndex (definie dans
# src/pptx-xml-helpers.ps1) isolement, sans les effets de bord (source .pptx
# obligatoire, ecriture disque) de prepare-ag2r-template.ps1 qui la consomme.
# Aucun usage en production.

param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][int]$Index,
  [Parameter(Mandatory = $true)][string]$Value
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot '..\src\pptx-xml-helpers.ps1')

Set-TextNodeByIndex -Text $Text -Index $Index -Value $Value
