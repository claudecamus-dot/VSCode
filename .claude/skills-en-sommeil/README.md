# Skills BMAD en sommeil

Ces skills ne sont **pas supprimées** : elles sont sorties de `.claude/skills/`, donc
plus chargées par Claude Code, mais leur contenu est là et leur historique git intact.
Les réveiller, c'est un `git mv` dans l'autre sens :

    git mv .claude/skills-en-sommeil/<nom> .claude/skills/<nom>

## Pourquoi, et depuis quand

Mise en sommeil le **2026-10-02**, sur arbitrage utilisateur (lot 5 du hub VScode5,
finding « VSCode porte 71 skills bmad-* ») : ne garder chargées que les skills utilisées
ou reprises par le hub.

Mesure faite ce jour-là : **0 invocation** pour chacune des 29 skills ci-dessous dans
`.claude/supervision/usage.jsonl` (34 lignes ; `grep -c '"<nom>"'` = 0 pour chaque nom).
Aucune n'est appelée par le code, les tests, les sous-agents ou les réglages du dépôt
(`git grep -w`, hors `_bmad/` et hors la skill elle-même) : les mentions restantes sont
descriptives (table « jamais routées » d'`agent-orchestrator`, docstrings, wiki généré).

- **15 shims dépréciés par BMAD** (retirés en v7) : checkpoint-preview, dev-auto,
  document-project, domain-research, editorial-review, editorial-review-prose,
  editorial-review-structure, generate-project-context, market-research, quick-dev,
  review-adversarial-general, review-edge-case-hunter, review-verification-gap,
  sprint-status, technical-research.
- **10 skills du module CIS** (`bmad-cis-*`).
- **4 skills du module BMB** (builders) : agent-builder, workflow-builder,
  module-builder, bmb-setup.

Restées en place volontairement : `bmad-create-story` et `bmad-dev-story`, citées comme
workflow produit→dev dans le `CLAUDE.md` du dépôt.

## Attention à la réinstallation

`_bmad/_config/manifest.yaml` liste toujours les modules `cis` et `bmb`. Un
`bmad-method install` futur **les réinstallera** dans `.claude/skills/` tant que ces
modules restent listés : la mise en sommeil serait alors à refaire, ou les modules à
retirer du manifeste à l'installation.
