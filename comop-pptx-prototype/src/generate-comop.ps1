param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [Parameter(Mandatory = $true)]
  [string]$DataPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$EmptyPlaceholderValue = "-"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

function ConvertTo-XmlText {
  param($Value)
  if ($null -eq $Value) { return $EmptyPlaceholderValue }
  if ($Value -is [array]) {
    $text = ($Value | ForEach-Object { [string]$_ }) -join "`n"
  } else {
    $text = [string]$Value
  }
  if ($text -eq "") { return $EmptyPlaceholderValue }
  return [System.Security.SecurityElement]::Escape($text)
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}
if (-not (Test-Path -LiteralPath $DataPath)) {
  throw "Donnees introuvables: $DataPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$data = Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$workDir = New-TempDirectory -Prefix "comop-pptx-"

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $workDir)

  # Construire le dictionnaire de substitutions avant toute modification des slides
  $subs = @{}
  foreach ($property in $data.PSObject.Properties) {
    $subs[$property.Name] = ConvertTo-XmlText $property.Value
  }

  $slideFiles = Get-ChildItem -LiteralPath (Join-Path $workDir "ppt\slides") -Filter "slide*.xml"
  foreach ($slide in $slideFiles) {
    $xml = Get-Content -LiteralPath $slide.FullName -Raw -Encoding UTF8

    # Remplacement en passe unique via regex pour eviter les double-remplacements
    # (protege contre du contenu utilisateur contenant {{...}})
    $xml = [regex]::Replace($xml, '\{\{([a-zA-Z0-9_]+)\}\}', {
      param($match)
      $name = $match.Groups[1].Value
      if ($subs.ContainsKey($name)) { return $subs[$name] }
      return $EmptyPlaceholderValue
    })

    Set-Content -LiteralPath $slide.FullName -Value $xml -Encoding UTF8
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  [System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $OutputPath)

  [pscustomobject]@{
    status = "genere"
    output = (Resolve-Path -LiteralPath $OutputPath).Path
  } | ConvertTo-Json
} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
