---
updated: 2026-07-23
generated-by: .claude/supervision/scan_transcripts.py (superviseur d'agents, étage 1)
---

# Supervision des agents — tableau de bord d'usage

> ⚠️ **Page générée automatiquement** (hook SessionStart → `.claude/supervision/scan_transcripts.py`).
> **Ne pas éditer à la main** — toute modification serait écrasée au prochain scan.
> Conception et phasage : [../../reflexions/agent-superviseur.md](../../reflexions/agent-superviseur.md).

Dernier scan : 2026-07-23T20:35:36+02:00 · **1 sessions** (transcripts) · **0** invocations de skills · **0** lancements de sous-agents.

## Skills — usage réel

| Skill | Famille | Invocations | Première | Dernière |
| --- | --- | --- | --- | --- |
| _(aucun)_ | | | |

## Sous-agents

| Sous-agent | Lancements | Premier | Dernier |
| --- | --- | --- | --- |
| _(aucun)_ | | |

## Jamais utilisés

**projet** — 6/6 jamais invoqués :

`agent-orchestrator`, `agent-supervisor`, `deck-design-library`, `pptx-framed-image`, `revue-increment`, `slide-text-polish`

**BMAD** — 71/71 jamais invoqués :

<details><summary>Voir la liste</summary>

`bmad-advanced-elicitation`, `bmad-agent-analyst`, `bmad-agent-architect`, `bmad-agent-builder`, `bmad-agent-dev`, `bmad-agent-pm`, `bmad-agent-tech-writer`, `bmad-agent-ux-designer`, `bmad-architecture`, `bmad-bmb-setup`, `bmad-brainstorming`, `bmad-check-implementation-readiness`, `bmad-checkpoint-preview`, `bmad-cis-agent-brainstorming-coach`, `bmad-cis-agent-creative-problem-solver`, `bmad-cis-agent-design-thinking-coach`, `bmad-cis-agent-innovation-strategist`, `bmad-cis-agent-presentation-master`, `bmad-cis-agent-storyteller`, `bmad-cis-design-thinking`, `bmad-cis-innovation-strategy`, `bmad-cis-problem-solving`, `bmad-cis-storytelling`, `bmad-code-review`, `bmad-correct-course`, `bmad-create-architecture`, `bmad-create-epics-and-stories`, `bmad-create-prd`, `bmad-create-story`, `bmad-customize`, `bmad-dev-auto`, `bmad-dev-story`, `bmad-document-project`, `bmad-domain-research`, `bmad-edit-prd`, `bmad-editorial-review-prose`, `bmad-editorial-review-structure`, `bmad-eval-runner`, `bmad-forge-idea`, `bmad-generate-project-context`, `bmad-help`, `bmad-index-docs`, `bmad-market-research`, `bmad-module-builder`, `bmad-party-mode`, `bmad-prd`, `bmad-prfaq`, `bmad-product-brief`, `bmad-qa-generate-e2e-tests`, `bmad-quick-dev`, `bmad-retrospective`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-shard-doc`, `bmad-spec`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-tea`, `bmad-teach-me-testing`, `bmad-technical-research`, `bmad-testarch-atdd`, `bmad-testarch-automate`, `bmad-testarch-ci`, `bmad-testarch-framework`, `bmad-testarch-nfr`, `bmad-testarch-test-design`, `bmad-testarch-test-review`, `bmad-testarch-trace`, `bmad-ux`, `bmad-validate-prd`, `bmad-workflow-builder`

</details>

**global** — 5/5 jamais invoqués :

`pptx-deck`, `pptx-verify`, `restitution-deck-design`, `roadmap-keeper`, `skill-creator`

## TODO agents (constats automatiques)

1. **Trier les skills BMAD** : 71 installés, 0 invocation à ce jour — décider lesquels garder, customiser ou désinstaller.
2. **`revue-increment` jamais invoquée** malgré le rappel SessionStart à chaque session — revoir son déclencheur (l'ancrer au flux de commit ?) ou la simplifier.
3. **Skills projet sans usage** : `agent-orchestrator`, `agent-supervisor`, `deck-design-library`, `pptx-framed-image`, `slide-text-polish` — vérifier pertinence et déclencheurs.

## Diagnostic qualitatif (étage 2 — `agent-supervisor`)

_Diagnostic à jour._

1. **Increment 6 cloture alors qu'une regression PPTX bloquante est capitalisee, sans passage revue-increment** — Ne pas considerer l'increment 6 'livre': rouvrir via revue-increment (verif RUNTIME reelle du rendu PPTX, pas tests verts) et traiter la regression avant l'increment 7. · **Proposition** : Amender le contrat du playbook dev-verifie (.claude/orchestration/playbooks/dev-verifie.md) pour faire de revue-increment le gate terminal NON-skippable de tout plan de dev, avec sortie bloquante si la verif runtime du chemin de verif projet echoue.
2. **Etage-1 diagnostique a l'aveugle : 0 session couverte, state/runs vides -> jamais_utilises est un artefact de donnees vides** — Ne prendre AUCUNE decision de desinstallation/mise en sommeil sur la base de jamais_utilises tant que le scan couvre 0 session : la liste ne prouve pas des agents morts, elle prouve une instrumentation qui ne capte pas encore (dispositif deploye aujourd'hui, HEAD 3f84fcc). · **Proposition** : Verifier pourquoi scan_transcripts couvre 0 session (mapping du repertoire projet / filtre de dates) et confirmer que log_usage.py ecrit bien un evenement par appel Skill, avant de refaire confiance au prochain diagnostic.
3. **Duplication .agents/skills/ (Codex) : poids mort structurel, independant du scan** — Trancher l'usage de Codex. Si non utilise, desinstaller la copie Codex (reinstaller BMAD --tools claude-code seul, ou npx bmad-method uninstall puis reinstall). Cible NETTE car fondee sur la structure du repo, pas sur le scan vide. · **Proposition** : Reinstaller BMAD avec --tools claude-code uniquement et retirer .agents/skills/ du depot, pour supprimer la double-maintenance et le bruit dans jamais_utilises.

---

_Étage O-C (croisement modèle × tâche × reprises, exploitation de `runs.jsonl`) : voir `.claude/orchestration/routing-hints.json`, régénéré à chaque session._
