# CLAUDE.md

<!-- Squelette créé le 2026-07-16 lors du réalignement skills/agents post-BMAD.
     Le paragraphe de contexte projet reste à compléter par l'équipe : ce que
     fait exactement ce dépôt, le vocabulaire métier à préserver, un pointeur
     vers un roadmap/docs. Ne pas laisser deviner — remplir avec des faits. -->

## Projet

Dépôt `VSCode` (remote GitHub `claudecamus-dot/VSCode`). Bac à sable de
prototypage PowerPoint / pilotage agile (fichiers `*.pptx`,
`comop-pptx-prototype/`, `_pptx_extract/`, `docs/`). **Contexte détaillé à
compléter** — cette section n'est pas encore rédigée par l'équipe.

## Skills & agents — comment ça se lance (post-BMAD, 2026-07-16)

**BMAD-METHOD v6.10.0** est installé (`_bmad/`). Les skills vivent dans deux
emplacements car deux outils ont été configurés à l'install :
`.claude/skills/` (Claude Code) **et** `.agents/skills/` (Codex). Si seul
Claude Code est utilisé ici, `.agents/skills/` est du poids mort — à retirer
(réinstaller avec `--tools claude-code` seul, ou `npx bmad-method uninstall`
puis réinstall) si Codex n'est pas utilisé.

- **Routeur BMAD** : en cas de doute sur quel skill lancer, invoquer
  **`bmad-help`**.
- **Agents BMAD (personas)** : par nom — « Amelia » (dev), « John » (PM),
  « Winston » (architecte), « Sally » (UX), « Mary » (analyste), « Paige »
  (tech writer) = skills `bmad-agent-*`.
- **Workflows BMAD** : `bmad-product-brief` / `bmad-prd` / `bmad-architecture`
  / `bmad-create-story` / `bmad-dev-story` (produit→dev) ; `bmad-code-review`,
  `bmad-retrospective`, `bmad-correct-course` (qualité/pilotage). Sorties dans
  `_bmad-output/` — candidat `.gitignore`.
- Pas de skill projet custom ni de `.claude/agents/` ici pour l'instant : tout
  le catalogue skills vient de BMAD. (Pas de hiérarchie de modèles par
  sous-agent applicable pour l'instant, faute d'agents custom à configurer.)

## Discipline de gestion des tokens (2026-07-16, cf. `docs/vscode1-export/optimisation-tokens.md` sur VSCode1/2/3)

Le contexte est un cache actif facturé à chaque tour, pas une mémoire gratuite (source : OCTO Playbook Agentique, partie « Optimiser la consommation Tokens »). Règles concrètes, pas de changement de ton/style de réponse :

- **Ne pas parcourir** `_bmad/`, `_bmad-output/`, `node_modules/`, `__pycache__/` sauf demande explicite.
- **Lire avant d'écrire, grep les appelants avant de modifier** une section partagée.
- **Préférer un grep/read ciblé à un dump récursif** — surtout sur `.claude/skills/bmad-*`/`.agents/skills/bmad-*` (dupliqués, Claude Code + Codex).
- **Sous-agent pour toute sortie volumineuse** plutôt que de la laisser polluer le contexte principal.
- **`/compact` dès ~40 %** de fenêtre de contexte utilisée si la session doit continuer longtemps sur le même sujet.
