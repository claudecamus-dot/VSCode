# VSCode — bac à sable de prototypage PowerPoint / pilotage agile

Deux périmètres cohabitent dans ce dépôt :

- **`comop-pptx-prototype/`** — le vrai code : un générateur de support PowerPoint
  COMOP (3 slides) à partir d'un template `.pptx` interchangeable. Petit serveur
  Node (`server.js`) pour l'interface locale + génération pilotée par des scripts
  PowerShell (`src/*.ps1`).
- **`.claude/`** — l'outillage de supervision de la flotte (canon partagé,
  synchronisé depuis le hub `VScode5`).

## Utilisation

Toutes les commandes se lancent depuis `comop-pptx-prototype/` :

```powershell
# préparer le template de démonstration
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\prepare-ag2r-template.ps1

# lancer l'interface locale (http://localhost:5177, bind 127.0.0.1 uniquement)
node .\server.js
```

Générer sans interface, valider un template, gérer la charte graphique, lancer
les tests (`npm test` + `smoke-test.ps1`) : voir le détail complet dans
[`comop-pptx-prototype/README.md`](comop-pptx-prototype/README.md) — ce fichier
racine n'est qu'un point d'entrée, la source de vérité reste dans le sous-dossier.

## Documentation

- Règles du dépôt : [`CLAUDE.md`](CLAUDE.md).
- Tableau de bord de supervision (synchronisé depuis le hub) :
  [`docs/wiki/index.md`](docs/wiki/index.md) ou `docs/wiki.html`.
- Cadrage produit : [`docs/product-brief.md`](docs/product-brief.md).
