param(
  [string]$TemplatePath  = "$PSScriptRoot\..\templates\comop-template.pptx",
  [string]$OutputPath    = "$PSScriptRoot\..\templates\comop-template.pptx",
  [string]$BrandingConfig = "$PSScriptRoot\..\config\branding.json"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')

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
# Audit securite 2026-09-02 : les valeurs de color_map sont du texte libre de
# config/branding.json (pas de pattern hex impose comme pour primary/accent_color)
# et finissent inserees dans un attribut XML (val="..."). Protect-XmlAttribute
# neutralise un guillemet qui casserait hors de l'attribut.
$branding.color_map.PSObject.Properties | ForEach-Object { $colorMap[$_.Name] = Protect-XmlAttribute $_.Value }

$year = if ($branding.copyright_year) { $branding.copyright_year } else { (Get-Date).Year }
# footerText est insere en CONTENU d'element XML (<a:t>...</a:t>), font en
# valeur d'ATTRIBUT (typeface="...") -- deux contextes d'echappement differents,
# cf. Protect-XmlText / Protect-XmlAttribute dans pptx-xml-helpers.ps1. Sans ca,
# un footer_text/font contenant "<", ">" ou un guillemet produit un PPTX
# corrompu (voire une injection d'element XML) -- verifie par test-pptx-integrity.js.
$footerText = Protect-XmlText ($branding.footer_text -replace '\{year\}', $year)
$primaryColor = $branding.primary_color
$accentColor  = $branding.accent_color
$font         = Protect-XmlAttribute $branding.font

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

# Ids des formes injectees par ce script. Double source de verite supprimee
# (finding risque_technique de l'audit) : ces trois nombres etaient ecrits en dur
# a la creation des formes ET re-ecrits sous forme de classe de caracteres
# "990[0-2]" dans la regex d'idempotence de Remove-OctoElements. Ajouter une 4e
# forme (9903) sans penser a elargir la classe laissait une forme non retiree a la
# repasse -> p:cNvPr id duplique, PPTX a reparer (le defaut meme que l'idempotence
# doit empecher, verrouille par test/test-pptx-integrity.js). Une seule liste, la
# regex de retrait en est derivee.
$OctoFooterId = 9900
$OctoPageCircleId = 9901
$OctoAccentLineId = 9902
$OctoShapeIds = @($OctoFooterId, $OctoPageCircleId, $OctoAccentLineId)

# Coordonnees EMU des elements Octo injectes (finding audit : numeros magiques /
# double source de verite). Un seul endroit pour chaque geometrie -- avant ce
# correctif, ces valeurs n'existaient qu'en litteral au milieu du here-string XML,
# sans nom rattachant la valeur a ce qu'elle positionne.
$OctoPageCircleOffsetX = 8844000
$OctoPageCircleOffsetY = 4893500
$OctoPageCircleSize    = 228600
$OctoPageCircleLineWidth = 19050
$OctoFooterOffsetX = 182880
$OctoFooterOffsetY = 4953500
$OctoFooterWidth   = 7315200
$OctoFooterHeight  = 152400
$OctoAccentLineOffsetY = 480060
$OctoAccentLineWidth   = 9144000
$OctoAccentLineHeight  = 19050

function Get-FooterXml {
  param([int]$slideNumber)
  $pageCircle = ""
  if ($slideNumber -gt 0) {
    $pageCircle = @"
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="$OctoPageCircleId" name="OctoPageCircle"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="$OctoPageCircleOffsetX" y="$OctoPageCircleOffsetY"/><a:ext cx="$OctoPageCircleSize" cy="$OctoPageCircleSize"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln w="$OctoPageCircleLineWidth"><a:solidFill><a:srgbClr val="$primaryColor"/></a:solidFill></a:ln>
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
    <p:cNvPr id="$OctoFooterId" name="OctoFooter"/>
    <p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="$OctoFooterOffsetX" y="$OctoFooterOffsetY"/><a:ext cx="$OctoFooterWidth" cy="$OctoFooterHeight"/></a:xfrm>
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
    <p:cNvPr id="$OctoAccentLineId" name="OctoAccentLine"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="0" y="$OctoAccentLineOffsetY"/><a:ext cx="$OctoAccentLineWidth" cy="$OctoAccentLineHeight"/></a:xfrm>
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
  # formes avec les memes ids ($OctoShapeIds) -> p:cNvPr id dupliques dans une
  # meme slide, que PowerPoint traite comme un fichier a reparer.
  $octoIdPattern = '<p:cNvPr id="(' + (($OctoShapeIds | ForEach-Object { [regex]::Escape([string]$_) }) -join '|') + ')" name="Octo'
  $octoShapes = @([regex]::Matches($xml, '<p:sp>.*?</p:sp>', 'Singleline') |
    Where-Object { $_.Value -match $octoIdPattern })
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

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template introuvable: $TemplatePath"
}

Invoke-PptxZipRoundTrip -SourcePath $TemplatePath -OutputPath $OutputPath -Prefix "octo-branding-" -AtomicWrite -Modify {
  param($workDir)

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

  # Table slide fichier -> numero de page affiche (finding audit : table en dur
  # / double source de verite). Nommee ici comme unique origine du mapping ;
  # slide1.xml (page de garde) en est volontairement absent, traite a part
  # plus bas sans OctoPageCircle.
  $OctoSlideFileToPageNumber = @(
    @{ Path = "slide2.xml"; Number = 1 }
    @{ Path = "slide3.xml"; Number = 2 }
    @{ Path = "slide4.xml"; Number = 3 }
  )
  foreach ($entry in $OctoSlideFileToPageNumber) {
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

}

# Audit 2026-09-13 (robustesse) : la cible etait SUPPRIMEE puis recompressee.
# Avec OutputPath = TemplatePath (valeur par defaut, et usage nominal :
# rebrander le template en place), tout echec de la recompression laissait
# templates/comop-template.pptx detruit, sans aucune sauvegarde. -AtomicWrite
# (Invoke-PptxZipRoundTrip) ecrit desormais l'archive complete dans un fichier
# temporaire voisin et ne remplace la cible qu'une fois cette ecriture
# terminee : a aucun instant la cible n'est absente alors que son remplacant
# n'existe pas encore.

[pscustomobject]@{
  status   = "branding_applique"
  output   = (Resolve-Path -LiteralPath $OutputPath).Path
  branding = $branding.name
  couleurs = $colorMap.Count
  polices  = ($branding.font_replacements | Measure-Object).Count
  footer   = $footerText
} | ConvertTo-Json
