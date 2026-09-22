# Helpers OOXML partages par les scripts de manipulation de template COMOP.
# Dot-source depuis chaque script : . (Join-Path $PSScriptRoot 'pptx-xml-helpers.ps1')
#
# Extraits ici pour supprimer la duplication de Get-ShapeName / Get-GraphicType /
# New-TempDirectory, qui vivaient en double copie octet-pour-octet dans
# detect-template-zones.ps1 et remove-template-shape.ps1 (finding risque_technique
# de l'audit VSCode, 2026-07-23). Une seule source de verite : une correction de
# regex OOXML se fait ici et vaut pour les deux scripts.

function Get-ShapeName {
  param([string]$ShapeXml)
  $m = [regex]::Match($ShapeXml, '<p:cNvPr[^>]*\sname="([^"]*)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Get-GraphicType {
  param([string]$FrameXml)
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\bchart"') { return "graphique" }
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\btable"') { return "tableau" }
  if ($FrameXml -match 'graphicData\s+uri="[^"]*\bdiagram"') { return "diagramme" }
  return "objet"
}

function Assert-ZipDecompressedSizeWithinLimit {
  # Audit 2026-09-07 (securite) : ExtractToDirectory() decompresse l'archive
  # ENTIERE sur disque avant tout controle -- seul le poids COMPRESSE d'un
  # upload est borne, en amont, par le serveur (25 Mo, server.js). Une
  # archive ZIP peut annoncer un ratio de compression extreme (zip bomb) et
  # gonfler tres au-dela de ce que le disque/la RAM du poste peuvent
  # absorber avant qu'aucun de ces scripts n'ait rien verifie. On somme la
  # taille DECOMPRESSEE annoncee par chaque entree (ZipArchiveEntry.Length,
  # lue depuis l'en-tete local -- ca ne decompresse rien) et on rejette avant
  # d'extraire quoi que ce soit si le total depasse la limite. 300 Mo : le
  # gabarit connu pese 1,4 Mo compresse/decompresse (marge tres large pour un
  # template legitime avec plusieurs images), tres en-dessous des ratios
  # d'une archive pathologique.
  param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [long]$MaxBytes = 300MB
  )
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $total = 0L
    foreach ($entry in $archive.Entries) {
      $total += $entry.Length
      if ($total -gt $MaxBytes) {
        throw "Archive rejetee : volume decompresse annonce superieur a $([math]::Round($MaxBytes / 1MB)) Mo (zip bomb potentiel)"
      }
    }
  } finally {
    $archive.Dispose()
  }
}

function New-TempDirectory {
  # Prefixe conserve par appelant (zones-detect- / remove-shape-) : sert de repere
  # au debogage si un repertoire de travail n'est pas nettoye.
  param([string]$Prefix = "comop-ppt-")
  $path = Join-Path ([System.IO.Path]::GetTempPath()) ($Prefix + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $path | Out-Null
  return $path
}

function Assert-TextNodeCount {
  # Fragilite mesuree (audit risque_technique) : prepare-ag2r-template.ps1 pilote
  # la preparation par 23 index positionnels bruts dans un .pptx SOURCE externe.
  # Le throw de Set-TextNodeByIndex n'attrape qu'un index HORS BORNES : un deck
  # source qui gagne ou perd un noeud <a:t> AVANT les index vises garde un compte
  # suffisant, tous les index restent valides, et la preparation ecrit chaque
  # placeholder dans la MAUVAISE zone -- succes silencieux, template faux.
  # Un controle du compte exact, avant toute mutation, transforme ce cas en echec
  # dur et nomme la slide qui a bouge. Comptes releves sur le deck source
  # versionne (Pilotage Agile - exemple.pptx) le 2026-09-20 : 13 / 14 / 11.
  param(
    [string]$Text,
    [int]$Expected,
    [string]$Label
  )
  $actual = [regex]::Matches($Text, '<a:t>(.*?)</a:t>').Count
  if ($actual -ne $Expected) {
    throw "$Label : $actual noeuds <a:t> au lieu des $Expected attendus -- le deck source a bouge, les index de preparation ne sont plus fiables"
  }
}

function Set-TextNodeByIndex {
  # Deplacee ici depuis prepare-ag2r-template.ps1 (2026-09-16) : fonction sans
  # effet de bord, testable isolement via test-support/invoke-set-text-node.ps1,
  # comme les autres helpers de ce fichier.
  param(
    [string]$Text,
    [int]$Index,
    [string]$Value
  )

  # Risque technique (audit) : nommer cette variable "$matches" ecrase la
  # variable AUTOMATIQUE de PowerShell (celle que remplit l'operateur
  # -match), meme si l'ecriture reste locale a cette fonction ici. Tout appel
  # a -match ajoute plus tard dans cette fonction lirait/ecraserait silencieusement
  # cette collection au lieu du resultat du -match, un bug tres difficile a
  # diagnostiquer. Nom distinct pour eliminer la collision par construction.
  $textNodeMatches = [regex]::Matches($Text, '<a:t>(.*?)</a:t>')
  if ($Index -lt 0 -or $Index -ge $textNodeMatches.Count) {
    # Correctif du 2026-09-16 (atelier-dev) : un retour silencieux du texte
    # INCHANGE laissait le script continuer et ecrire un statut
    # "template_prepare" de succes alors qu'une mutation attendue n'avait pas
    # eu lieu. Echec dur : remonte via le try/finally de prepare-ag2r-template.ps1,
    # empeche l'ecriture du pptx et du JSON de succes.
    throw "Index $Index hors bornes ($($textNodeMatches.Count) noeuds <a:t> trouves)"
  }

  $match = $textNodeMatches[$Index]
  return $Text.Substring(0, $match.Index) + "<a:t>$Value</a:t>" + $Text.Substring($match.Index + $match.Length)
}

function Protect-XmlAttribute {
  # Echappement complet pour une valeur inseree dans un attribut XML (ex:
  # typeface="$value"). Audit securite 2026-09-02 (branding) : $font/$to
  # viennent de config/branding.json (texte libre, non valide par un pattern
  # comme le sont primary_color/accent_color) et etaient inseres tels quels
  # dans des here-strings OOXML -- un guillemet dans la valeur casse hors de
  # l'attribut et injecte de l'XML arbitraire (verifie : "/></a:rPr><a:rPr
  # b="1 corrompt le paquet, cf. test-pptx-integrity.js). Aucun usage legitime
  # de balise/guillemet brut dans un nom de police ou une couleur : echappement
  # total, sans exception.
  param([string]$Text)
  if ($null -eq $Text) { return $Text }
  return $Text -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;'
}

function Invoke-PptxZipRoundTrip {
  # Squelette extraction -> modification -> recompression, duplique a l'identique
  # (Add-Type / temp dir / Assert-ZipDecompressedSizeWithinLimit / finally de
  # nettoyage) dans 6 scripts (apply-octo-branding, generate-comop,
  # prepare-ag2r-template, remove-template-shape, corrompt-theme,
  # retire-placeholder -- finding risque_technique de l'audit VSCode, releve le
  # 2026-09-22). Chaque appelant garde EXACTEMENT son comportement d'origine via
  # les parametres : -SkipZipBombCheck pour les scripts de test-support qui n'ont
  # jamais fait ce controle, -AtomicWrite pour apply-octo-branding.ps1 (ecriture
  # dans un fichier temporaire voisin puis Move-Item, pour ne jamais laisser la
  # cible detruite si la recompression echoue -- audit 2026-09-13). $Modify recoit
  # le chemin du dossier de travail extrait et fait les mutations XML ; le
  # dossier est toujours nettoye, meme en cas d'exception.
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$Prefix = "comop-ppt-",
    [string]$WorkDir,
    [switch]$SkipZipBombCheck,
    [switch]$AtomicWrite,
    [Parameter(Mandatory = $true)][scriptblock]$Modify
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $resolvedWorkDir = if ($WorkDir) { $WorkDir } else { New-TempDirectory -Prefix $Prefix }
  if ($WorkDir -and -not (Test-Path -LiteralPath $resolvedWorkDir)) {
    New-Item -ItemType Directory -Path $resolvedWorkDir | Out-Null
  }

  try {
    if (-not $SkipZipBombCheck) {
      Assert-ZipDecompressedSizeWithinLimit -ZipPath $SourcePath
    }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath, $resolvedWorkDir)

    & $Modify $resolvedWorkDir

    if ($AtomicWrite) {
      $outputDirectory = Split-Path -Parent $OutputPath
      if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory | Out-Null
      }
      $tempOutput = "$OutputPath.tmp-$([System.Guid]::NewGuid().ToString('N'))"
      try {
        [System.IO.Compression.ZipFile]::CreateFromDirectory($resolvedWorkDir, $tempOutput)
        Move-Item -LiteralPath $tempOutput -Destination $OutputPath -Force
      } finally {
        if (Test-Path -LiteralPath $tempOutput) {
          Remove-Item -LiteralPath $tempOutput -Force
        }
      }
    } else {
      [System.IO.Compression.ZipFile]::CreateFromDirectory($resolvedWorkDir, $OutputPath)
    }
  } finally {
    if (Test-Path -LiteralPath $resolvedWorkDir) {
      Remove-Item -LiteralPath $resolvedWorkDir -Recurse -Force
    }
  }
}

function Protect-XmlText {
  # Echappement pour du texte insere en CONTENU d'element XML (ex:
  # <a:t>$value</a:t>) qui tolere les references d'entites XML DEJA valides --
  # config/branding.json ships footer_text avec "&#xA9;" (c) pre-echappe a la
  # main : un echappement naif de tous les "&" transformerait cette entite
  # fonctionnelle en "&amp;#xA9;" (le symbole disparait, remplace par du texte
  # litteral). Seul un "&" qui n'entame PAS une reference existante est
  # echappe ; "<" et ">" bruts n'ont eux aucun usage legitime en texte OOXML
  # (ils ouvriraient une vraie balise) et sont toujours echappes.
  param([string]$Text)
  if ($null -eq $Text) { return $Text }
  $escaped = [regex]::Replace($Text, '&(?!(#[0-9]+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;))', '&amp;')
  $escaped = $escaped -replace '<', '&lt;' -replace '>', '&gt;'
  return $escaped
}
