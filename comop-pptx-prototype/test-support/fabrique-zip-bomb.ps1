# Fabrique une archive .pptx piegee pour les tests de securite : une entree dont
# la taille DECOMPRESSEE annoncee depasse la limite de
# Assert-ZipDecompressedSizeWithinLimit (300 Mo, pptx-xml-helpers.ps1), alors que
# le fichier produit reste minuscule sur disque (~1,4 Mo) parce que la charge
# n'est que des zeros -- c'est la definition meme d'une zip bomb, et c'est aussi
# pourquoi le plafond d'upload du serveur (25 Mo compresses) ne protege de rien.
#
# L'entree est volontairement placee HORS ppt/slides/ : sans la garde,
# validate-template.ps1 se contente de la sauter et rend un verdict "incomplet"
# en sortant 0. Le test qui s'appuie sur ce fichier discrimine donc exactement
# l'absence de la garde, sans faire reellement exploser la RAM du poste de test.
param(
  [Parameter(Mandatory = $true)]
  [string]$Destination,

  [int]$Megaoctets = 320
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $Destination) {
  Remove-Item -LiteralPath $Destination -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($Destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $entry = $zip.CreateEntry("ppt/media/image1.png", [System.IO.Compression.CompressionLevel]::Fastest)
  $stream = $entry.Open()
  try {
    $chunk = New-Object byte[] (1048576)
    for ($i = 0; $i -lt $Megaoctets; $i++) {
      $stream.Write($chunk, 0, $chunk.Length)
    }
  } finally {
    $stream.Dispose()
  }
} finally {
  $zip.Dispose()
}
