# Support de test UNIQUEMENT : recree le defaut exact de la regression du
# 2026-06-08 (chevrons en double autour de <a:majorFont>/<a:minorFont> dans
# ppt/theme/theme1.xml) sur une copie du template, pour prouver que la gate
# src/verify-pptx-integrity.ps1 le detecte vraiment. Aucun usage en production.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("corrompt-theme-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null
try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $Source).Path, $workDir)

  $themePath = Join-Path $workDir "ppt\theme\theme1.xml"
  $xml = Get-Content -LiteralPath $themePath -Raw -Encoding UTF8
  $xml = $xml.Replace('<a:majorFont>', '<<a:majorFont>>').Replace('<a:minorFont>', '<<a:minorFont>>')
  Set-Content -LiteralPath $themePath -Value $xml -Encoding UTF8

  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $Destination)
} finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}
