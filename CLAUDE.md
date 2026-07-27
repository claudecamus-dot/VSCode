# CLAUDE.md

## Projet

Dépôt `VSCode` (remote GitHub `claudecamus-dot/VSCode`) — **bac à sable de
prototypage PowerPoint / pilotage agile**. Deux périmètres cohabitent :

- **`comop-pptx-prototype/`** — le vrai code du dépôt : un générateur de support
  PowerPoint COMOP (3 slides) à partir d'un template `.pptx` interchangeable.
  Petit serveur Node (`server.js`) pour l'interface locale + génération pilotée
  par des **scripts PowerShell** (`src/*.ps1`). Voir son `README.md` pour les
  commandes exactes.
- **`.claude/`** — l'outillage de supervision de la flotte (canon partagé :
  `supervision/scan_transcripts.py`, `orchestration/log_run.py`, hooks). Ce dépôt
  est une **cible** du hub de supervision `VScode5` ; ces fichiers sont
  synchronisés depuis le hub (en-tête « généré — ne pas éditer localement »).

Dossiers annexes : `_pptx_extract/` (extractions de templates), `_debug_template/`,
`docs/wiki/` (tableau de bord de supervision, synchronisé depuis le hub `VScode5`),
`_bmad/` + `_bmad-output/` (installation BMAD).

## Canal du prototype COMOP (R3 — ne pas plaquer un autre pattern)

La génération PPT ici passe par **COMOP + PowerShell**, **pas** par python-pptx
(la leçon qui a fondé la règle « adapter au canal » de la flotte vient de ce dépôt).
Commandes réelles, depuis `comop-pptx-prototype/` :

- **Interface locale** : `node .\server.js` puis `http://localhost:5177`
  (le serveur écoute sur `127.0.0.1` uniquement).
- **Générer sans interface** :
  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\generate-comop.ps1 -TemplatePath … -DataPath … -OutputPath …`
- **Valider un template** : `.\src\validate-template.ps1` (placeholders attendus
  dans `src/placeholders.json`).
- **Branding OCTO** : `config/branding.json` + `.\src\apply-octo-branding.ps1`.

## Vérifications avant commit (canal du prototype)

| Si le changement touche… | Alors… |
| --- | --- |
| `server.js` / le routage HTTP | `npm test` (node:test, ~10 cas réels sur un serveur lancé) |
| La génération PPTX / les scripts `src/*.ps1` | rejouer `.\src\smoke-test.ps1` (assertions end-to-end : fichiers, génération complète, aucun placeholder résiduel) |
| Un template `.pptx` | `.\src\validate-template.ps1` sur le template modifié |

`npm run coverage` (c8) mesure `server.js` (~50 % lignes ; le reste est couvert par
`smoke-test.ps1`). Les tests montent un vrai serveur en process séparé avec
`COMOP_DATA_ROOT` sur un dossier temporaire — ils ne touchent jamais
`templates/`, `output/` ni `data/`. Garde-fou en place : `safeTemplatePath`
(anti-traversée de répertoire) — ne pas contourner.

## Commit scopé

Ce dépôt est une cible d'un hub de supervision qui régénère des données
(`.claude/supervision/state.json`, `.claude/orchestration/routing-hints.json`,
`docs/wiki/`). Avant de committer : `git diff --cached --name-only`, et **ne jamais
embarquer** ce churn de données généré ni du travail non lié au changement en cours.

## Skills & agents (BMAD, post-réalignement 2026-07-16)

**BMAD-METHOD v6.10.0** est installé (`_bmad/`) — l'essentiel du catalogue skills
vient de là. Un seul agent projet custom : **`.claude/agents/ppt-designer.md`**
(génération + qualité visuelle des exports `.pptx` sur le canal COMOP décrit
ci-dessus ; ne déclare jamais un deck « vérifié » sans rendu réel inspecté).

- **Routeur** : en cas de doute sur quel skill lancer, invoquer **`bmad-help`**.
- **Agents (personas)**, par nom : « Amelia » (dev), « John » (PM), « Winston »
  (architecte), « Sally » (UX), « Mary » (analyste), « Paige » (tech writer) =
  skills `bmad-agent-*`.
- **Workflows** : `bmad-product-brief` / `bmad-prd` / `bmad-architecture` /
  `bmad-create-story` / `bmad-dev-story` (produit→dev) ; `bmad-code-review`,
  `bmad-retrospective`, `bmad-correct-course` (qualité/pilotage). Sorties dans
  `_bmad-output/` (gitignoré).
- Les skills installées vivent dans `.claude/skills/` (Claude Code). Pas de copie
  `.agents/skills/` (Codex) : l'install est mono-outil ici.

## Discipline de gestion des tokens

Le contexte est un cache actif facturé à chaque tour, pas une mémoire gratuite
(source : OCTO Playbook Agentique, « Optimiser la consommation Tokens »). Sans
changer le ton des réponses :

- **Ne pas parcourir** `_bmad/`, `_bmad-output/`, `node_modules/`, `__pycache__/`,
  `comop-pptx-prototype/coverage/` sauf demande explicite.
- **Lire avant d'écrire**, grep les appelants avant de modifier une section partagée.
- **Préférer un grep/read ciblé à un dump récursif** — surtout sur
  `.claude/skills/bmad-*` (77 skills BMAD installées).
- **Sous-agent pour toute sortie volumineuse** plutôt que polluer le contexte principal.
- **`/compact` dès ~40 %** de fenêtre utilisée si la session doit continuer longtemps.
