# Conventions de code — VSCode (atelier COMOP)

Rédigé le 2026-07-30 en complément de `CLAUDE.md` (qui porte le canal et les
vérifications) — ce fichier porte le « comment coder », pas la gouvernance.

## Linting

ESLint (flat config) ajouté le 2026-07-30 : `comop-pptx-prototype/eslint.config.js`
(config réelle) + `eslint.config.js` à la racine (pointeur, pour que
`npx eslint .` fonctionne depuis les deux emplacements et que le scan de
supervision détecte le linter). Deux blocs de globals distincts : Node/CommonJS
pour `server.js`/`test/`/`test-support/`, navigateur pour `web/*.js` (`document`,
`window`, `fetch` — ce dossier n'est jamais du code Node). Lancer :
`npm run lint` depuis `comop-pptx-prototype/`. Première mesure 2026-07-30 :
3 points, tous sur un `catch (_) {}` volontairement silencieux (purge de
fichiers best-effort) — aucun seuil imposé, jamais de `--fix` aveugle.

## Nommage

- **JS (`server.js`, `web/app.js`)** : `camelCase`, modules CommonJS
  (`require`/`module.exports`), pas de classes — style fonctionnel.
- **PowerShell (`src/*.ps1`)** : un script = une action verbale
  (`generate-comop.ps1`, `validate-template.ps1`, `apply-octo-branding.ps1`,
  `remove-template-shape.ps1`) ; paramètres nommés `PascalCase`
  (`-TemplatePath`, `-DataPath`, `-OutputPath`), typés explicitement
  (`[string]`, `[switch]`).
- **Langue** : noms de variables/fonctions en anglais (JS et PowerShell),
  commentaires et messages utilisateur en français.

## Git

Ce dépôt est une **cible** du hub de supervision `VScode5` — voir la section
« Commit scopé » de `CLAUDE.md` (exclure systématiquement le churn de données
générées avant tout commit).

## Config & secrets

`.claude/settings.json` porte les deny rules et le hook `guard_destructive_git`
(bloque `git push --force` sans lease, `git reset --hard`, lecture de secrets).
Le prototype lui-même ne manipule aucun secret (branding OCTO en clair dans
`config/branding.json`, pas de credentials).
