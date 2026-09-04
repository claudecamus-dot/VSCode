<!-- TODO-AGENTS:START — section générée par .claude/supervision/scan_transcripts.py, ne pas éditer à la main -->
## TODO agents 🤖

Constats automatiques du superviseur d'agents (usage mesuré dans les transcripts de session) :

⚠️ **Mesure incomplète** — 2 transcript(s) sur 6 absent(s) du disque. Un `n=0` ne veut plus dire « jamais invoquée » mais « on ne le voit plus » : les listes ci-dessous sous-estiment l'usage réel. Ne rien désinstaller sur cette base.

- **Désinstaller les shims BMAD dépréciés** (4) : `bmad-create-architecture` → `bmad-architecture`, `bmad-create-prd` → `bmad-prd`, `bmad-edit-prd` → `bmad-prd`, `bmad-validate-prd` → `bmad-prd` — dépréciés par BMAD dans leur propre `description`, chacun avec son remplaçant ; le seul élagage qui ne repose pas sur notre mesure d'usage.
- **`revue-increment` jamais invoquée** malgré le rappel SessionStart à chaque session — revoir son déclencheur (l'ancrer au flux de commit ?) ou la simplifier.
- **Skills projet sans usage** : `deck-design-review`, `restitution-deck-design` — vérifier pertinence et déclencheurs.

Tableau de bord complet : [technical/agents-supervision.md](technical/agents-supervision.md) — régénéré à chaque session.
<!-- TODO-AGENTS:END -->
