param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [string]$PlaceholdersPath = ""
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

function Read-ZipTextEntries {
  # Audit performance 2026-09-22 : prend desormais l'archive DEJA OUVERTE par
  # l'appelant (garde anti-zip-bomb) au lieu de rouvrir le fichier -- 1 seul
  # ZipFile.OpenRead pour tout le script, contre 2 avant ce correctif.
  # Non type [System.IO.Compression.ZipArchive] pour la meme raison que dans
  # pptx-xml-helpers.ps1 : ce type peut ne pas etre charge au moment ou ce
  # script est parse, avant le Add-Type explicite ci-dessous.
  param([Parameter(Mandatory = $true)]$Archive)

  $builder = New-Object System.Text.StringBuilder
  foreach ($entry in $Archive.Entries) {
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
#
# Audit performance 2026-09-22 : l'archive est ouverte UNE SEULE FOIS ici et
# partagee entre la garde anti-zip-bomb et la lecture du texte des slides
# (residu du finding "triple lancement powershell", 2 ZipFile.OpenRead ->1).
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($TemplatePath)
try {
  Assert-ZipDecompressedSizeWithinLimit -Archive $zip

  if (-not $PlaceholdersPath) {
    $PlaceholdersPath = Join-Path $PSScriptRoot "placeholders.json"
  }

  $required = Get-Content -LiteralPath $PlaceholdersPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $content = Read-ZipTextEntries -Archive $zip
} finally {
  $zip.Dispose()
}
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
