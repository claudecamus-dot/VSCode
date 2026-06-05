# Prototype generateur COMOP PowerPoint

Ce prototype genere un support PowerPoint COMOP de 3 slides a partir d'un template `.pptx` interchangeable.

## Demarrer

1. Preparer le template de demonstration :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\prepare-ag2r-template.ps1
```

2. Lancer l'interface locale :

```powershell
node .\server.js
```

3. Ouvrir :

```text
http://localhost:5177
```

## Generer sans interface

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\generate-comop.ps1 -TemplatePath .\templates\comop-template.pptx -DataPath .\data\sample-comop.json -OutputPath .\output\comop-demo.pptx
```

## Valider un template

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\validate-template.ps1 -TemplatePath .\templates\comop-template.pptx
```

Un template compatible doit contenir les placeholders listes dans `src/placeholders.json`.

## Charte graphique (branding)

La charte OCTO est definie dans `config/branding.json` : couleurs, police, texte du footer.

Pour appliquer ou re-appliquer le branding sur le template :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\apply-octo-branding.ps1
```

> **Note** : `"copyright_year": null` dans `branding.json` signifie que l'annee est calculee
> automatiquement depuis la date systeme. Pour figer l'annee, remplacer `null` par ex. `2026`.

## Tests

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\smoke-test.ps1
```

14 assertions end-to-end : existence des fichiers, generation complete, aucun placeholder residuel.
