param(
  [string]$TemplatePath  = "$PSScriptRoot\..\templates\comop-template.pptx",
  [string]$OutputPath    = "$PSScriptRoot\..\templates\comop-template.pptx",
  [string]$BrandingConfig = "$PSScriptRoot\..\config\branding.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BrandingConfig)) {
  throw "Fichier de configuration branding introuvable: $BrandingConfig"
}

$branding = Get-Content -LiteralPath $BrandingConfig -Raw -Encoding UTF8 | ConvertFrom-Json

$hexPattern = '^[0-9A-Fa-f]{6}$'
if (-not $branding.primary_color -or $branding.primary_color -notmatch $hexPattern) {
  throw "branding.json: primary_color manquant ou invalide (attendu: 6 chiffres hex, ex: 0E2356)"
}
if (-not $branding.accent_color -or $branding.accent_color -notmatch $hexPattern) {
  throw "branding.json: accent_color manquant ou invalide (attendu: 6 chiffres hex, ex: 00D2DD)"
}
if (-not $branding.font) {
  throw "branding.json: font manquant"
}

$colorMap = @{}
$branding.color_map.PSObject.Properties | ForEach-Object { $colorMap[$_.Name] = $_.Value }

$year = if ($branding.copyright_year) { $branding.copyright_year } else { (Get-Date).Year }
$footerText = $branding.footer_text -replace '\{year\}', $year
$primaryColor = $branding.primary_color
$accentColor  = $branding.accent_color
$font         = $branding.font

function Invoke-Branding {
  param([string]$xml)
  foreach ($from in $colorMap.Keys) {
    $to = $colorMap[$from]
    $xml = $xml.Replace("""$from""", """$to""")
    $xml = $xml.Replace("""$($from.ToLower())""", """$to""")
  }
  foreach ($srcFont in $branding.font_replacements) {
    $xml = $xml.Replace("typeface=""$srcFont""", "typeface=""$font""")
  }
  return $xml
}

function Invoke-ThemeBranding {
  param([string]$xml)
  $xml = Invoke-Branding $xml
  $xml = [regex]::Replace($xml, 'name="[^"]*BPCE[^"]*"', 'name="OCTO"')
  $xml = $xml.Replace('name="Conception personnalis&#233;e"', 'name="OCTO Technology"')
  $xml = $xml.Replace('name="Conception personnalisée"', 'name="OCTO Technology"')
  $xml = $xml.Replace('name="Office"', 'name="OCTO Outfit"')
  # $1 CONTIENT deja les chevrons du groupe capture (<a:majorFont>) : les
  # rajouter produisait "<<a:majorFont>>" — theme1.xml non parsable, donc un
  # PPTX que PowerPoint refuse d'ouvrir (regression de l'increment 6, 2026-06-08).
  $xml = [regex]::Replace($xml, '(<a:majorFont>)<a:latin typeface="[^"]*"', "`$1<a:latin typeface=""$font""")
  $xml = [regex]::Replace($xml, '(<a:minorFont>)<a:latin typeface="[^"]*"', "`$1<a:latin typeface=""$font""")
  return $xml
}

function Get-FooterXml {
  param([int]$slideNumber)
  $pageCircle = ""
  if ($slideNumber -gt 0) {
    $pageCircle = @"
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="9901" name="OctoPageCircle"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="8844000" y="4893500"/><a:ext cx="228600" cy="228600"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln w="19050"><a:solidFill><a:srgbClr val="$primaryColor"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr anchor="ctr" anchorCtr="1"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="ctr"/>
      <a:r><a:rPr lang="fr-FR" sz="700" b="0"><a:solidFill><a:srgbClr val="$primaryColor"/></a:solidFill><a:latin typeface="$font"/></a:rPr><a:t>$slideNumber</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>
"@
  }
  return @"
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="9900" name="OctoFooter"/>
    <p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="182880" y="4953500"/><a:ext cx="7315200" cy="152400"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="fr-FR" sz="600" b="0"><a:solidFill><a:srgbClr val="6B7A99"/></a:solidFill><a:latin typeface="$font"/></a:rPr><a:t>$footerText</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>
$pageCircle
"@
}

function Get-AccentLineXml {
  return @"
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="9902" name="OctoAccentLine"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="0" y="480060"/><a:ext cx="9144000" cy="19050"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="$accentColor"/></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
</p:sp>
"@
}

function Remove-OctoElements {
  param([string]$xml)
  # Idempotence : le script s'applique EN PLACE sur le template (TemplatePath =
  # OutputPath par defaut). Sans ce retrait, une 2e passe re-injectait les memes
  # formes avec les memes ids (9900/9901/9902) -> p:cNvPr id dupliques dans une
  # meme slide, que PowerPoint traite comme un fichier a reparer.
  $octoShapes = @([regex]::Matches($xml, '<p:sp>.*?</p:sp>', 'Singleline') |
    Where-Object { $_.Value -match '<p:cNvPr id="990[0-2]" name="Octo' })
  foreach ($shape in ($octoShapes | Sort-Object -Property Index -Descending)) {
    $xml = $xml.Remove($shape.Index, $shape.Length)
  }
  return $xml
}

function Add-OctoElements {
  param([string]$xml, [int]$slideNumber)
  $xml = Remove-OctoElements $xml
  $footer = Get-FooterXml -slideNumber $slideNumber
  $accentLine = Get-AccentLineXml
  return $xml.Replace('</p:spTree>', "$accentLine$footer</p:spTree>")
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("octo-branding-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $workDir)

  $themePath = Join-Path $workDir "ppt\theme\theme1.xml"
  if (Test-Path -LiteralPath $themePath) {
    $xml = Get-Content -LiteralPath $themePath -Raw -Encoding UTF8
    $xml = Invoke-ThemeBranding $xml
    Set-Content -LiteralPath $themePath -Value $xml -Encoding UTF8
  }

  $masterPath = Join-Path $workDir "ppt\slideMasters\slideMaster1.xml"
  if (Test-Path -LiteralPath $masterPath) {
    $xml = Get-Content -LiteralPath $masterPath -Raw -Encoding UTF8
    $xml = Invoke-Branding $xml
    Set-Content -LiteralPath $masterPath -Value $xml -Encoding UTF8
  }

  Get-ChildItem (Join-Path $workDir "ppt\slideLayouts") -Filter "*.xml" | ForEach-Object {
    $xml = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
    $xml = Invoke-Branding $xml
    Set-Content -LiteralPath $_.FullName -Value $xml -Encoding UTF8
  }

  $slideEntries = @(
    @{ Path = "slide2.xml"; Number = 1 }
    @{ Path = "slide3.xml"; Number = 2 }
    @{ Path = "slide4.xml"; Number = 3 }
  )
  foreach ($entry in $slideEntries) {
    $slidePath = Join-Path $workDir "ppt\slides\$($entry.Path)"
    if (Test-Path -LiteralPath $slidePath) {
      $xml = Get-Content -LiteralPath $slidePath -Raw -Encoding UTF8
      $xml = Invoke-Branding $xml
      $xml = Add-OctoElements -xml $xml -slideNumber $entry.Number
      Set-Content -LiteralPath $slidePath -Value $xml -Encoding UTF8
    }
  }

  $slide1Path = Join-Path $workDir "ppt\slides\slide1.xml"
  if (Test-Path -LiteralPath $slide1Path) {
    $xml = Get-Content -LiteralPath $slide1Path -Raw -Encoding UTF8
    $xml = Invoke-Branding $xml
    Set-Content -LiteralPath $slide1Path -Value $xml -Encoding UTF8
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
    status   = "branding_applique"
    output   = (Resolve-Path -LiteralPath $OutputPath).Path
    branding = $branding.name
    couleurs = $colorMap.Count
    polices  = ($branding.font_replacements | Measure-Object).Count
    footer   = $footerText
  } | ConvertTo-Json

} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
