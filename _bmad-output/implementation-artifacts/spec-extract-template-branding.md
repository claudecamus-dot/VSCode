---
title: 'Extraction automatique de la charte graphique d un template PPTX'
type: 'feature'
created: '2026-06-08'
status: 'done'
context: []
baseline_commit: 'ea017d85b0d93b538ba452cba4e407baa3c9f996'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'atelier multi-templates doit reprendre automatiquement la charte (couleurs, police, logo) de chaque template chargé — condition préalable à une bibliothèque où chaque template porte sa propre identité, sans `branding.json` centralisé.

**Approche:** Un script PowerShell autonome, miroir-lecture de `apply-octo-branding.ps1` : désarchive le `.pptx`, lit le thème XML (couleurs + police), applique une heuristique best-effort pour repérer un logo candidat, et écrit le résultat dans un sidecar JSON à côté du template.

## Boundaries & Constraints

**Always:**
- Lecture seule du `.pptx` d'entrée — jamais de modification
- Réutiliser le pattern zip→tempdir→lecture→cleanup (try/finally) déjà établi dans `apply-octo-branding.ps1`/`generate-comop.ps1`
- Couleurs en hex 6 chiffres extraites de `<a:clrScheme>` (dk1/lt1/dk2/lt2/accent1..6), police de `<a:fontScheme><a:majorFont><a:latin typeface=...>`
- Le logo est un candidat **best-effort** signalé avec un indicateur de confiance — jamais présenté comme une certitude

**Ask First:**
- Si l'emplacement/nommage du sidecar (`<template>.branding.json` à côté du `.pptx`) s'avère incompatible avec une convention découverte en explorant le code, demander avant de choisir un autre schéma

**Never:**
- Ne pas écrire/modifier le `.pptx` d'entrée
- Ne pas tenter de résoudre les couleurs système non-RVB (`<a:sysClr>`) — signaler "non résolu" plutôt qu'inventer une valeur hex
- Ne pas construire d'UI dans cet incrément (`web/*` est hors périmètre — c'est l'incrément suivant du plan)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Template OCTO connu | `comop-template.pptx` (thème "OCTO" : 0E2356/00D2DD/DB4B4B, police Outfit) | Sidecar JSON avec ces valeurs + un candidat logo (confiance faible) | N/A |
| Thème sans image structurelle | Aucune image dans `slideLayouts`/`slideMasters` | `logo: null` avec note explicite | N/A |
| `.pptx` introuvable | Chemin invalide | Arrêt propre, message clair | Exception "Template introuvable" (miroir `apply-octo-branding.ps1`) |
| Couleur système non résolue | `<a:sysClr>` au lieu de `<a:srgbClr>` | Champ couleur marqué "non résolu" | N/A |

</frozen-after-approval>

## Code Map

- `comop-pptx-prototype/src/apply-octo-branding.ps1` -- pattern de référence à miroiter en lecture (zip→tempdir→XML→cleanup ; `Invoke-ThemeBranding` montre la structure attendue du thème)
- `comop-pptx-prototype/src/generate-comop.ps1` -- pattern `New-TempDirectory` + try/finally à réutiliser tel quel
- `comop-pptx-prototype/config/branding.json` -- schéma de référence à alléger (sans `color_map`/`font_replacements`, qui n'ont de sens qu'en écriture)
- `comop-pptx-prototype/src/smoke-test.ps1` -- runner `Assert-Step` à étendre d'un test bout-en-bout golden-file
- `comop-pptx-prototype/templates/comop-template.pptx` -- template connu servant de golden-file (thème "OCTO", couleurs 0E2356/00D2DD/DB4B4B, police Outfit ; vérifié par inspection directe du XML)

## Tasks & Acceptance

**Execution:**
- [x] `comop-pptx-prototype/src/extract-template-branding.ps1` -- créer le script (`-TemplatePath`, `-OutputPath` optionnel par défaut `<TemplatePath>.branding.json`) -- nouveau script miroir-lecture, zéro nouvelle dépendance
- [x] sidecar `<template>.branding.json` -- généré par le script -- nouvel artefact, schéma allégé aligné sur `branding.json`
- [x] `comop-pptx-prototype/src/smoke-test.ps1` -- ajouter un test bout-en-bout golden-file sur `comop-template.pptx` -- valide que l'extraction reproduit les valeurs connues du thème OCTO

**Acceptance Criteria:**
- Given `comop-template.pptx`, when le script s'exécute, then le JSON produit contient `primary_color: "0E2356"`, un `accent_color` parmi les accents détectés (ex. `"00D2DD"`), `font: "Outfit"`, et un champ `logo` avec `candidate`/`confidence`/`note`
- Given un `.pptx` dont `ppt/theme/theme1.xml` est absent, when le script s'exécute, then il échoue proprement avec un message explicite (miroir du comportement de `apply-octo-branding.ps1` sur fichier manquant)
- Given le smoke-test étendu, when il est lancé, then le nouveau test passe et confirme que le sidecar correspond aux valeurs de référence connues

## Spec Change Log

## Design Notes

**Heuristique logo (best-effort, signalée comme telle) :** parmi les images référencées depuis `ppt/slideLayouts/*.xml.rels` et `ppt/slideMasters/*.xml.rels` (structurelles/de marque — par opposition aux images de contenu intégrées directement dans `ppt/slides/*.xml.rels`, ex. visuels de roadmap), retenir **la plus petite par taille de fichier** comme candidat, avec `confidence: "low"`. Sur `comop-template.pptx`, cela désigne `image4.png` (8 Ko, référencée depuis `slideLayout13`) — un candidat plausible mais non garanti, à confirmer/corriger plus tard dans l'onglet de revue (incrément 5 du plan), pas dans cet incrément.

**Schéma sidecar (allégé vs `branding.json`) :**
```json
{
  "schema_version": 1,
  "source_template": "comop-template.pptx",
  "name": "OCTO",
  "primary_color": "0E2356",
  "accent_color": "00D2DD",
  "font": "Outfit",
  "logo": { "candidate": "image4.png", "confidence": "low", "note": "heuristique taille de fichier — à confirmer en revue" },
  "extracted_at": "2026-06-08T12:00:00Z"
}
```

## Verification

**Commands:**
- `powershell -File comop-pptx-prototype/src/extract-template-branding.ps1 -TemplatePath comop-pptx-prototype/templates/comop-template.pptx` -- expected: sidecar JSON écrit avec `primary_color: "0E2356"`, `font: "Outfit"`
- `powershell -File comop-pptx-prototype/src/smoke-test.ps1` -- expected: tous les tests passent, y compris le nouveau test d'extraction golden-file

## Suggested Review Order

**Orchestration (mirror-lecture du pattern établi)**

- Point d'entrée : flux principal zip→tempdir→lecture du thème→écriture du sidecar→cleanup, miroir lecture-seule de `apply-octo-branding.ps1`
  [`extract-template-branding.ps1:105-146`](../../comop-pptx-prototype/src/extract-template-branding.ps1#L105)

**Extraction du thème (couleurs, police)**

- `Get-ThemeColor` retient `srgbClr` en priorité et signale `"non resolu"` pour `sysClr` plutôt que d'inventer une valeur hex (patch revue : signalement explicite au lieu d'un `null` ambigu)
  [`extract-template-branding.ps1:18-30`](../../comop-pptx-prototype/src/extract-template-branding.ps1#L18)

- `Get-MajorFontTypeface` lit `<a:majorFont><a:latin typeface=...>`, simple et conforme au schéma OOXML observé
  [`extract-template-branding.ps1:32-38`](../../comop-pptx-prototype/src/extract-template-branding.ps1#L32)

**Détection heuristique du logo (best-effort, signalée comme telle)**

- `Find-LogoCandidate` choisit la plus petite image structurelle référencée depuis `slideLayouts`/`slideMasters`, avec égalité départagée par nom pour un résultat déterministe, et une note explicite sur la nature heuristique du choix (patch revue : déterminisme + note enrichie)
  [`extract-template-branding.ps1:40-83`](../../comop-pptx-prototype/src/extract-template-branding.ps1#L40)

**Tests (golden-file)**

- Nouveau bloc de test bout-en-bout : exécute l'extraction sur `comop-template.pptx` et vérifie les valeurs de référence connues du thème OCTO (couleurs, police, logo avec confiance/note)
  [`smoke-test.ps1:141-166`](../../comop-pptx-prototype/src/smoke-test.ps1#L141)
