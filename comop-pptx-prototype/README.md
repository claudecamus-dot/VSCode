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
