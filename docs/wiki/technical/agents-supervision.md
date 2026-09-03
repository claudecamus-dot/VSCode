---
updated: 2026-09-03
generated-by: .claude/supervision/scan_transcripts.py (superviseur d'agents, étage 1)
---

# Supervision des agents — tableau de bord d'usage

> ⚠️ **Page générée automatiquement** (hook SessionStart → `.claude/supervision/scan_transcripts.py`).
> **Ne pas éditer à la main** — toute modification serait écrasée au prochain scan.

Dernier scan : 2026-09-03T02:52:15+02:00 · **4 sessions** (transcripts) · **3** invocations de skills · **2** lancements de sous-agents.

## Skills — usage réel

| Skill | Famille | Invocations | Première | Dernière |
| --- | --- | --- | --- | --- |
| `agent-supervisor` | projet | 2 | 2026-07-23 | 2026-07-27 |
| `agent-orchestrator` | projet | 1 | 2026-07-27 | 2026-07-27 |

## Sous-agents

| Sous-agent | Lancements | Premier | Dernier |
| --- | --- | --- | --- |
| `Explore` | 2 | 2026-07-23 | 2026-07-27 |

## Jamais utilisés

**projet** — 2/7 jamais invoqués :

`deck-design-review`, `revue-increment`

**BMAD** — 71/71 jamais invoqués :

<details><summary>Voir la liste</summary>

`bmad-advanced-elicitation`, `bmad-agent-analyst`, `bmad-agent-architect`, `bmad-agent-builder`, `bmad-agent-dev`, `bmad-agent-pm`, `bmad-agent-tech-writer`, `bmad-agent-ux-designer`, `bmad-architecture`, `bmad-bmb-setup`, `bmad-brainstorming`, `bmad-check-implementation-readiness`, `bmad-checkpoint-preview`, `bmad-cis-agent-brainstorming-coach`, `bmad-cis-agent-creative-problem-solver`, `bmad-cis-agent-design-thinking-coach`, `bmad-cis-agent-innovation-strategist`, `bmad-cis-agent-presentation-master`, `bmad-cis-agent-storyteller`, `bmad-cis-design-thinking`, `bmad-cis-innovation-strategy`, `bmad-cis-problem-solving`, `bmad-cis-storytelling`, `bmad-code-review`, `bmad-correct-course`, `bmad-create-architecture`, `bmad-create-epics-and-stories`, `bmad-create-prd`, `bmad-create-story`, `bmad-customize`, `bmad-dev-auto`, `bmad-dev-story`, `bmad-document-project`, `bmad-domain-research`, `bmad-edit-prd`, `bmad-editorial-review-prose`, `bmad-editorial-review-structure`, `bmad-eval-runner`, `bmad-forge-idea`, `bmad-generate-project-context`, `bmad-help`, `bmad-index-docs`, `bmad-market-research`, `bmad-module-builder`, `bmad-party-mode`, `bmad-prd`, `bmad-prfaq`, `bmad-product-brief`, `bmad-qa-generate-e2e-tests`, `bmad-quick-dev`, `bmad-retrospective`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-shard-doc`, `bmad-spec`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-tea`, `bmad-teach-me-testing`, `bmad-technical-research`, `bmad-testarch-atdd`, `bmad-testarch-automate`, `bmad-testarch-ci`, `bmad-testarch-framework`, `bmad-testarch-nfr`, `bmad-testarch-test-design`, `bmad-testarch-test-review`, `bmad-testarch-trace`, `bmad-ux`, `bmad-validate-prd`, `bmad-workflow-builder`

</details>

**global** — 2/5 jamais invoqués :

`restitution-deck-design`, `skill-creator`

## Skills bibliothèque / référence

_Consommés en lisant/exécutant leurs `scripts/`, ou via un sous-agent qui les suit (ex. `ppt-designer`, qui n'a pas l'outil Skill) — le compteur d'invocations ne peut structurellement pas les voir. `n=0` n'y vaut donc PAS « mort » : ne pas désinstaller sur ce seul signal (constat superviseur #2)._

`deck-design-library`, `pptx-deck`, `pptx-framed-image`, `pptx-verify`, `roadmap-keeper`, `slide-text-polish`

## TODO agents (constats automatiques)

1. **Trier les skills BMAD** : 71 installés, 0 invocation à ce jour — décider lesquels garder, customiser ou désinstaller.
2. **`revue-increment` jamais invoquée** malgré le rappel SessionStart à chaque session — revoir son déclencheur (l'ancrer au flux de commit ?) ou la simplifier.
3. **Skills projet sans usage** : `deck-design-review` — vérifier pertinence et déclencheurs.
4. **Skills en sommeil (>30 j sans usage)** : `Explore`, `agent-orchestrator`, `agent-supervisor`.

## Arbitrages enregistrés

_Constats clos par décision humaine (`.claude/supervision/arbitrages.json`) — l'usage réel reste mesuré ci-dessus._

- **`ppt-designer`** (2026-07-23) : Sous-agent créé (`.claude/agents/ppt-designer.md`), porté depuis VSCode3 et réécrit pour le pipeline réel de ce projet (générateur COMOP Node.js/PowerShell — mutation d'un template .pptx existant via ZipFile/regex — et non un générateur python-pptx from-scratch comme sur VSCode3). Activé comme voie unique de génération/vérification deck : l'étape 'generation' du playbook export-ppt-verifie l'instancie désormais comme sous-agent plutôt qu'inline. Porte une mise en garde explicite sur la régression active et non résolue de remove-template-shape.ps1 (cf. mémoire projet project_comop_multitemplate_plan) — ne doit jamais patcher ce script silencieusement.
- **`deck-design-library`** (2026-07-23) : Déjà présente et adaptée localement (SKILL.md propre au pipeline COMOP, catalogue-restitution.md identique aux 22 patterns de VSCode3/VSCode2) — NON écrasée par le portage VSCode3 : les deux SKILL.md sont des adaptations divergentes légitimes du même texte-source, écraser la version locale aurait perdu ses références locales (deck-design-review, patterns swot-matrix/priority-matrix). Consultée par ppt-designer comme référence de forme avant toute nouvelle slide.
- **`.agents/skills`** (2026-07-23) : Retiré (miroir Codex, poids mort structurel confirmé par diagnostic agent-supervisor 2026-07-23) — BMAD réinstallé en --tools claude-code uniquement, .agents/skills/ supprimé du disque.
- **`bmad-catalogue-codex`** (2026-07-27) : ACCEPTÉ + APPLIQUÉ (bouton Valider du wiki, session non interactive) : sur le finding « bmad-catalogue-codex — Duplication .agents/skills/ (Codex) : poids mort structurel » du diagnostic local, le cadrage réel (R1) a montré que la remédiation proposée (réinstaller BMAD --tools claude-code uniquement + retirer .agents/skills/) était DÉJÀ appliquée et committée : le commit 5c480d1 « chore(bmad): reinstalle en claude-code-only, retire la copie Codex » a supprimé les dizaines de fichiers .agents/skills/bmad-*, et un arbitrage l'avait déjà consigné sous la cible sœur « .agents/skills » (2026-07-23). Le finding restait pourtant affiché OUVERT dans le wiki car la fermeture du scan matche la cible à l'identique et « bmad-catalogue-codex » ≠ « .agents/skills » : cette entrée aligne la cible sur celle du finding pour le clore. Correction minimale (R1) — aucune suppression refaite, aucun fichier code/config touché. Vérifié PAR LES FAITS : (1) .agents/ ABSENT du disque (Test-Path False, aucun répertoire .agents nulle part sous VSCode) ; (2) git ls-files .agents = 0 fichier suivi ; (3) aucun manifeste/config de _bmad (fichiers config.yaml/config.toml et manifest.yaml) ne référence codex — les seules mentions « Codex » résiduelles sont du contenu de skills claude-code (pact-mcp.md, validation-report BMAD) documentant Codex comme runtime MCP, PAS une install dupliquée ; (4) CLAUDE.md documente déjà « Pas de copie .agents/skills/ (Codex) : l'install est mono-outil ici ». Aucune trace de doublon Codex ne subsiste.
- **`scan_transcripts`** (2026-07-27) : ACCEPTÉ + APPLIQUÉ : la proposition (champ `detector_version` invalidant les offsets) est en place, portée DANS LE CANON du hub VScode5 (`.claude/dispositif/canon/scan_transcripts.py`) puis propagée par `sync_dispositif.py --projet VSCode` — l'éditer localement n'aurait servi à rien, le fichier est généré et la synchro l'écrase. Concrètement : constante `DETECTOR_VERSION = 2` + fonction `reset_si_detecteur_change()` qui, sur changement de version, remet à zéro `files`, `skills` et `subagents` (les agrégats dérivant des seuls transcripts, les rejouer sans les réinitialiser doublerait les compteurs) et rejoue tout l'historique disponible. Vérifié PAR LES FAITS : (1) le rejeu s'est déclenché et a fait remonter 5 événements au lieu de 2, dont l'invocation `agent-supervisor` du 2026-07-23T18:26 jusque-là invisible (n=1 first=2026-07-27 AVANT, n=2 first=2026-07-23 APRÈS) ; (2) idempotence confirmée — le scan suivant affiche « +0 evenement(s) » sans rejouer. Traité au passage : `update_wiki_html` distingue désormais trois issues (à jour / page absente / marqueurs manquants), car un projet cible SANS `docs/wiki.html` — le cas normal, seul le hub publie un wiki HTML — déclenchait à chaque session la fausse alerte « wiki.html sans marqueurs ». Contrepartie assumée et documentée dans le code : un rejeu ne voit que les transcripts encore présents sur le disque.
- **`agent-orchestrator`** (2026-07-27) : ACCEPTÉ + APPLIQUÉ : la journalisation passe de la FIN du run à la COMPOSITION du plan. (1) `.claude/skills/agent-orchestrator/SKILL.md` étape 5 réécrite en deux temps — ouvrir la ligne à l'étape 2 avec `resultat: "en-cours"`, la solder à la remise via `--solde` ; (2) canon `log_run.py` : `RESULTATS_SOLDE` accepte désormais `en-attente-validation`, état que la skill EXIGE pour un livrable utilisateur non validé mais qui n'était atteignable qu'en éditant le journal à la main ; (3) canon `scan_transcripts.py` : `build_runs_stats` compte les `en-cours` dans un compteur séparé `en_cours` et les exclut de `n`/succès/échecs, pour qu'un run ouvert ne dégrade pas les taux — un `en_cours` qui ne se solde jamais devient au contraire le signal d'un run abandonné, ce que l'ancien schéma perdait en silence. Vérifié PAR LES FAITS : cette orchestration elle-même a été journalisée à sa composition (`runs.jsonl` créé, 1 run, ts 2026-07-27T12:22:48) puis soldée à la remise ; le scan affiche « 1 run(s) orchestrateur » et `routing-hints.agents` montre bien `n=0, en_cours=N` pour les agents du plan en cours.
- **`dispositif-supervision`** (2026-07-28) : ACCEPTÉ + APPLIQUÉ : le constat local « le meta-outillage capte tout l'effort pendant que la regression PPTX bloquante reste intouchee » est SOLDÉ par le traitement de la régression elle-même (commit badedf1, 2026-07-28), arbitré depuis le hub de supervision sous la cible VSCode:increment-6-pptx. Cause racine trouvée par reproduction : apply-octo-branding.ps1 écrivait « <<a:majorFont>> » dans ppt/theme/theme1.xml (partie XML non parsable → PowerPoint refuse le fichier) et n'était pas idempotent (p:cNvPr id 9900-9902 dupliqués dès la 2e passe). Les deux causes corrigées, le template committé réparé (theme1.xml seul, −4 octets), et la vérification qui manquait — personne n'ouvrait le fichier produit — ajoutée : src/verify-pptx-integrity.ps1 rejouée dans npm test, plus une CI GitHub Actions (windows-latest) qui rejoue enfin les tests existants. Prouvé avec l'oracle réel : PowerPoint refuse le template d'avant et ouvre celui d'après ; deck COMOP généré et ouvert (3 slides). L'incrément 6 reste 'current' dans la roadmap tant que l'utilisateur n'a pas ouvert le deck lui-même — le passer 'done' sur auto-évaluation serait exactement la faute du 2026-06-08.
- **`smoke-test-hors-ci`** (2026-09-01) : ACCEPTÉ + APPLIQUÉ : `comop-pptx-prototype/test/test-smoke.js` rejoue `src/smoke-test.ps1` depuis `npm test`, sur le patron de `test-pptx-integrity.js` (skip hors win32, spawnSync, assertions sur exit 0 et « 0 echoues »). La suite qui couvre seule les scripts de mutation OOXML (34 assertions) entre donc dans npm test et dans la CI. Vu ROUGE avant (template inexistant → fail 1). npm test : 13 → 16 cas. CLAUDE.md mis à jour en conséquence.
- **`playbooks-comop`** (2026-09-01) : ACCEPTÉ + APPLIQUÉ : `dev-verifie` ne fait plus de `smoke-test.ps1` la gate unique (il est désormais chaîné par npm test) ; `export-ppt-verifie` n'escalade plus sur une régression corrigée depuis badedf1, dont la cause réelle était `apply-octo-branding.ps1`. Chiffre faux « 14 assertions » corrigé en 34 là où il était mesurable (ppt-designer.md, playbook).
- **`server-api-corps-json`** (2026-09-01) : ACCEPTÉ + APPLIQUÉ : `readJsonBody()` rend 400 sur un corps JSON malformé sans propager le message brut du parseur, sur les 2 routes concernées. 2 tests ajoutés, vus ROUGES (500 !== 400) avant correction.
- **`state-transcripts-absents`** (2026-09-02) : DEJA RESOLU - verifie par execution le 2026-09-02, pas de correctif applique ici. .claude/supervision/state.json porte desormais mesure_incomplete = {transcripts_absents: 2, total_fichiers: 3, dernier_evenement: 2026-07-27T10:15:43.048Z}. .claude/orchestration/routing-hints.json (regenere 2026-09-02T11:29:51+02:00) porte mesure_non_fiable = true, qui marque explicitement les listes jamais_utilises (75 entrees) et en_sommeil (Explore, agent-orchestrator, agent-supervisor) comme non concluantes - c'est l'option "marquer explicitement comme non concluantes" de la proposition, deja mise en oeuvre et propagee depuis le canon du hub avant ce traitement. Aucun fichier de ce depot modifie pour ce finding ; .claude/supervision/scan_transcripts.py non touche (copie generee du canon).
- **`increment-6-validation`** (2026-09-02) : REMIS A L'ARBITRAGE - aucun correctif applique. Etat re-verifie par execution le 2026-09-02 (un jour apres la mesure du diagnostic, pas 35) : comop-pptx-prototype/.roadmap/roadmap.json a toujours l'item 6 en status=current et l'item 7 en status=todo ; `git log --oneline -- comop-pptx-prototype/.roadmap/roadmap.json` montre badedf1 (2026-07-28) comme dernier commit sur ce fichier ; `git rev-list --count 9114ec9..HEAD -- comop-pptx-prototype` = 1, et ce commit (873d836) traite les 3 findings deja arbitres le 2026-09-01 (tests/server.js), aucune ligne produit relative a l'increment 6/7. L'arbitrage 'dispositif-supervision' du 2026-07-28 conditionne le passage a done a une ouverture reelle du deck par l'utilisateur : cette ouverture n'est tracee nulle part depuis. Rien n'a bouge : le finding reste valide tel quel. Sa proposition presente un vrai choix (R4, pas mecanique) : (A) poser a l'utilisateur la question fermee d'acceptance sur comop-pptx-prototype/output/<deck>.pptx (OK/KO) - suppose une interaction humaine reelle que cet agent ne peut pas produire lui-meme dans ce traitement ; (B) a defaut de reponse, introduire dans roadmap.json un status 'en-attente-validation' distinct de 'current' - cout technique nul verifie (`grep -ril roadmap` sur *.js/*.py du depot : aucun consommateur programmatique du champ status de roadmap.json, seuls des fichiers de donnees/doc le referencent), mais reste un choix de vocabulaire/schema qui engage la roadmap au-dela d'un correctif mecanique, et un statut invente sans le demander risquerait d'etre lu comme une validation implicite. Aucune option tranchee ici ; dossier remonte a l'utilisateur avec le detail ci-dessus.

## Diagnostic qualitatif (étage 2 — `agent-supervisor`)

_Diagnostic à jour — rien à signaler, tous les constats précédents ont été arbitrés._

_5 constat(s) de ce diagnostic écarté(s) par un arbitrage — pour en rouvrir un, demander au superviseur un `re_challenge` avec des données nouvelles :_

- ~~La seule suite qui couvre les scripts de mutation OOXML (34 assertions, verte) n'est rejouee ni par npm test ni par la CI - exactement le trou qui a laisse vivre la regression 45 jours~~ (`smoke-test-hors-ci`)
- ~~La base de mesure de l'etage 1 a disparu : zero transcript sur disque, state.json pointe deux fichiers absents, et le scan de ce jour a quand meme publie 75 skills « jamais utilisees » comme si c'etait une mesure~~ (`state-transcripts-absents`)
- ~~Les deux playbooks de ce projet decrivent un produit qui a 35 jours de retard : ils exigent smoke-test.ps1 comme unique gate et font escalader sur le script innocente de la regression~~ (`playbooks-comop`)
- ~~L'increment 6 attend depuis 35 jours une validation utilisateur que personne n'a demandee, et gele une roadmap dont le blocage est pourtant leve~~ (`increment-6-validation`)
- ~~Un corps JSON malforme sur /api/generate rend un 500 avec le message brut du parseur au lieu d'un 400 - finding d'audit reste sans arbitrage depuis 33 jours~~ (`server-api-corps-json`)

---

_Étage O-C (croisement modèle × tâche × reprises, exploitation de `runs.jsonl`) : voir `.claude/orchestration/routing-hints.json`, régénéré à chaque session._
