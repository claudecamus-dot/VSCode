param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

function Get-XmlBlock {
  param([string]$Xml, [string]$Tag)
  $pattern = "<a:$Tag[^>]*>.*?</a:$Tag>"
  $m = [regex]::Match($Xml, $pattern, 'Singleline')
  if ($m.Success) { return $m.Value }
  return $null
}

function Get-ThemeColor {
  param([string]$ClrSchemeXml, [string]$Slot)
  if (-not $ClrSchemeXml) { return $null }

  $rgbPattern = "<a:$Slot>\s*<a:srgbClr val=`"([0-9A-Fa-f]{6})`""
  $m = [regex]::Match($ClrSchemeXml, $rgbPattern, 'Singleline')
  if ($m.Success) { return $m.Groups[1].Value.ToUpper() }

  $sysPattern = "<a:$Slot>\s*<a:sysClr"
  if ([regex]::IsMatch($ClrSchemeXml, $sysPattern, 'Singleline')) { return "non resolu" }

  return $null
}

function Get-MajorFontTypeface {
  param([string]$FontSchemeXml)
  if (-not $FontSchemeXml) { return $null }
  $m = [regex]::Match($FontSchemeXml, '<a:majorFont>.*?<a:latin typeface="([^"]*)"', 'Singleline')
  if ($m.Success -and $m.Groups[1].Value) { return $m.Groups[1].Value }
  return $null
}

function Find-LogoCandidate {
  param([string]$WorkDir)

  $relsFiles = @()
  $relsFiles += Get-ChildItem -Path (Join-Path $WorkDir "ppt\slideLayouts\_rels") -Filter "*.rels" -ErrorAction SilentlyContinue
  $relsFiles += Get-ChildItem -Path (Join-Path $WorkDir "ppt\slideMasters\_rels") -Filter "*.rels" -ErrorAction SilentlyContinue

  $imageNames = New-Object System.Collections.Generic.HashSet[string]
  foreach ($rel in $relsFiles) {
    $relXml = Get-Content -LiteralPath $rel.FullName -Raw -Encoding UTF8
    foreach ($m in [regex]::Matches($relXml, 'Target="\.\./media/(image[^"]+)"')) {
      [void]$imageNames.Add($m.Groups[1].Value)
    }
  }
  if ($imageNames.Count -eq 0) {
    return [ordered]@{
      candidate  = $null
      confidence = "none"
      note       = "aucune image structurelle referencee depuis slideLayouts/slideMasters"
    }
  }

  $mediaDir = Join-Path $WorkDir "ppt\media"
  $candidates = foreach ($name in $imageNames) {
    $mediaPath = Join-Path $mediaDir $name
    if (Test-Path -LiteralPath $mediaPath) {
      [pscustomobject]@{ Name = $name; Size = (Get-Item -LiteralPath $mediaPath).Length }
    }
  }
  $smallest = $candidates | Sort-Object Size, Name | Select-Object -First 1
  if (-not $smallest) {
    return [ordered]@{
      candidate  = $null
      confidence = "none"
      note       = "images referencees depuis slideLayouts/slideMasters mais introuvables dans ppt/media"
    }
  }

  return [ordered]@{
    candidate  = $smallest.Name
    confidence = "low"
    note       = "heuristique taille de fichier (plus petite image structurelle des slideLayouts/slideMasters, egalite departagee par nom) - a confirmer dans l'onglet de revue"
  }
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

if (-not $OutputPath) {
  $directory  = Split-Path -Parent $TemplatePath
  $baseName   = [System.IO.Path]::GetFileNameWithoutExtension($TemplatePath)
  $OutputPath = Join-Path $directory "$baseName.branding.json"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$workDir = New-TempDirectory -Prefix "branding-extract-"

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $workDir)

  $themePath = Join-Path $workDir "ppt\theme\theme1.xml"
  if (-not (Test-Path -LiteralPath $themePath)) {
    throw "Theme introuvable dans le template (ppt/theme/theme1.xml absent): $TemplatePath"
  }
  $themeXml = Get-Content -LiteralPath $themePath -Raw -Encoding UTF8

  $clrSchemeXml  = Get-XmlBlock $themeXml "clrScheme"
  $fontSchemeXml = Get-XmlBlock $themeXml "fontScheme"

  $themeName = $null
  if ($clrSchemeXml -and $clrSchemeXml -match 'name="([^"]*)"') { $themeName = $matches[1] }

  $primaryColor = Get-ThemeColor $clrSchemeXml "dk1"
  if (-not $primaryColor) { $primaryColor = Get-ThemeColor $clrSchemeXml "dk2" }

  $accentColor = Get-ThemeColor $clrSchemeXml "accent2"
  if (-not $accentColor) { $accentColor = Get-ThemeColor $clrSchemeXml "accent1" }

  $font = Get-MajorFontTypeface $fontSchemeXml
  $logo = Find-LogoCandidate $workDir

  $branding = [ordered]@{
    schema_version  = 1
    source_template = (Split-Path -Leaf $TemplatePath)
    name            = $themeName
    primary_color   = $primaryColor
    accent_color    = $accentColor
    font            = $font
    logo            = $logo
    extracted_at    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $json = $branding | ConvertTo-Json -Depth 5
  Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8

  [pscustomobject]@{
    status   = "charte_extraite"
    output   = (Resolve-Path -LiteralPath $OutputPath).Path
    theme    = $themeName
    couleurs = @($primaryColor, $accentColor) | Where-Object { $_ }
    police   = $font
    logo     = if ($logo) { $logo.candidate } else { $null }
  } | ConvertTo-Json

} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
