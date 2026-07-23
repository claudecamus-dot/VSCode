# Catalogue des agents/skills — projet VSCode (bac à sable proto PPT / COMOP)

Catalogue de départ, créé le 2026-07-23 lors du déploiement du dispositif
orchestrateur/superviseur depuis VScode5 (supervision multi-projets). Aucune entrée n'a
encore de recul d'usage dans **ce** projet — les statuts viendront de
`routing-hints.json`, généré par `supervision/scan_transcripts.py` à chaque session.

## Skills globales (disponibles dans tous les projets de l'utilisateur)

| Skill | Usage |
| --- | --- |
| `pptx-deck` | Construire un deck PowerPoint avec python-pptx (layout + self-check géométrique) |
| `pptx-verify` | Vérifier visuellement un .pptx généré (rendu réel + inspection) |
| `restitution-deck-design` | Système de design pour decks de restitution façon conseil |
| `roadmap-keeper` | Suivi et rendu visuel de roadmap (déjà utilisé par `comop-pptx-prototype/.roadmap/`) |
| `skill-creator` | Créer/modifier des skills Claude Code |

## Skills projet

| Skill | Usage | Statut |
| --- | --- | --- |
| `revue-increment` | Definition-of-done : fin d'incrément, avant commit (rappelée par le hook SessionStart) | Préexistante au déploiement |
| `deck-design-library` | Choisir la FORME d'une slide depuis son intention (22 patterns OCTO) — à lire AVANT de dessiner | Déployée 2026-07-23 |
| `pptx-framed-image` | Image épousant la forme exacte d'un cadre de template (« ici mettre une Photo ») | Déployée 2026-07-23 |
| `slide-text-polish` | Lint qualité rédactionnelle des slides (slide_lint) | Déployée 2026-07-23 |
| `agent-orchestrator` | Qualifie une demande, compose un plan (cascade/parallèle/async), exécute, journalise | Déployée 2026-07-23 |
| `agent-supervisor` | Diagnostic qualitatif étage 2 (KO répétés, inefficacité, agents morts, vérifs manquantes) | Déployée 2026-07-23 |

## Canal de génération PPT du projet

Le livrable principal est produit par le **générateur COMOP** (`comop-pptx-prototype/`,
Node.js + PowerShell) : `node server.js` (UI web) ou
`src/generate-comop.ps1 -TemplatePath … -DataPath … -OutputPath …` ; test :
`src/smoke-test.ps1`. Les skills PPT ci-dessus s'appliquent au `.pptx` produit quel que
soit le canal (python-pptx ou JS).

## BMAD-METHOD (v6.10.0 — modules core + bmm + tea + bmb + cis)

71 skills `bmad-*` installées — le catalogue le plus large des projets de l'utilisateur
(seul projet avec les modules test-architecture `tea`, builder `bmb` et créatif `cis`).
**À utiliser uniquement sur demande explicite**, via `bmad-help`. NB : dupliquées dans
`.agents/skills/` (miroir Codex) — ce doublon n'est pas géré par ce catalogue.

## Playbooks (`.claude/orchestration/playbooks/`)

| Playbook | Pour | Statut |
| --- | --- | --- |
| `dev-verifie` | Implémentation/correction avec tests + vérification réelle + revue-increment avant commit | Importé, à confirmer |
| `export-ppt-verifie` | Génération/évolution d'un deck PPT (canal COMOP ou pptx-deck) avec `pptx-verify` obligatoire | Importé, à confirmer |
| `revue-design-parallele` | Revue multi-angles d'un livrable en fan-out puis consolidation | Importé, à confirmer |
