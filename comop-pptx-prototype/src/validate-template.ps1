param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [string]$PlaceholdersPath = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

function Read-ZipTextEntries {
  param([string]$Path)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $builder = New-Object System.Text.StringBuilder
    foreach ($entry in $zip.Entries) {
      $entryName = $entry.FullName -replace "\\", "/"
      if ($entryName -like "ppt/slides/*.xml") {
        $stream = $entry.Open()
        try {
          $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
          [void]$builder.AppendLine($reader.ReadToEnd())
        } finally {
          if ($reader) { $reader.Dispose() }
          $stream.Dispose()
        }
      }
    }
    return $builder.ToString()
  } finally {
    $zip.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

# Audit 2026-09-13 (securite) : ce script est le PREMIER lance sur un template
# uploade (server.js, POST /api/templates) et etait le seul a ouvrir l'archive
# SANS la garde anti-zip-bomb cablee le 2026-09-07 dans les six autres --
# Read-ZipTextEntries concatene l'integralite de ppt/slides/*.xml dans un
# StringBuilder non borne, et la garde d'extract-template-branding n'entrait en
# jeu qu'apres. Controle du volume decompresse annonce AVANT toute lecture.
Assert-ZipDecompressedSizeWithinLimit -ZipPath $TemplatePath

if (-not $PlaceholdersPath) {
  $PlaceholdersPath = Join-Path $PSScriptRoot "placeholders.json"
}

$required = Get-Content -LiteralPath $PlaceholdersPath -Raw -Encoding UTF8 | ConvertFrom-Json
$content = Read-ZipTextEntries -Path $TemplatePath
$found = [regex]::Matches($content, "\{\{([a-zA-Z0-9_]+)\}\}") | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$missing = @($required | Where-Object { $found -notcontains $_ })

[pscustomobject]@{
  template = (Resolve-Path -LiteralPath $TemplatePath).Path
  status = $(if ($missing.Count -eq 0) { "valide" } else { "incomplet" })
  requiredCount = $required.Count
  foundCount = $found.Count
  missing = $missing
  found = $found
} | ConvertTo-Json -Depth 5
