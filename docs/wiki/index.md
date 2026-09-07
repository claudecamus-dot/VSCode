<!-- TODO-AGENTS:START — section générée par .claude/supervision/scan_transcripts.py, ne pas éditer à la main -->
## TODO agents 🤖

Constats automatiques du superviseur d'agents (usage mesuré dans les transcripts de session) :

⚠️ **Mesure incomplète** — 2 transcript(s) sur 7 absent(s) du disque. Un `n=0` ne veut plus dire « jamais invoquée » mais « on ne le voit plus » : les listes ci-dessous sous-estiment l'usage réel. Ne rien désinstaller sur cette base.

- **Désinstaller les shims BMAD dépréciés** (21) : `bmad-checkpoint-preview`, `bmad-create-architecture`, `bmad-create-prd`, `bmad-create-story`, `bmad-dev-auto`, `bmad-dev-story`, `bmad-document-project`, `bmad-domain-research`, `bmad-edit-prd`, `bmad-editorial-review`, `bmad-editorial-review-prose`, `bmad-editorial-review-structure`, `bmad-generate-project-context`, `bmad-market-research`, `bmad-quick-dev`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-review-verification-gap`, `bmad-sprint-status`, `bmad-technical-research`, `bmad-validate-prd` — dépréciés par BMAD dans leur propre `description`, chacun avec son remplaçant ; le seul élagage qui ne repose pas sur notre mesure d'usage.
- **`revue-increment` jamais invoquée** malgré le rappel SessionStart à chaque session — revoir son déclencheur (l'ancrer au flux de commit ?) ou la simplifier.
- **Skills projet sans usage** : `deck-design-review`, `restitution-deck-design` — vérifier pertinence et déclencheurs.

Tableau de bord complet : [technical/agents-supervision.md](technical/agents-supervision.md) — régénéré à chaque session.
<!-- TODO-AGENTS:END -->
