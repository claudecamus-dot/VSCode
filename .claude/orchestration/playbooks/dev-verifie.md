# Playbook `dev-verifie` — implémentation vérifiée de bout en bout

Workflow de dev générique : implémenter, tester, **vérifier en réel** (pas seulement un
statut de test vert — une suite qui passe ne garantit pas qu'un rendu/écran/export soit
correct), puis revue finale avant tout commit.

Importé depuis le projet VSCode2 (Interview-to-Deck) où ce déroulé était éprouvé ; ici,
**statut `importé` — à confirmer sur les premiers runs de ce projet** (routing-hints le
fera évoluer vers `eprouve` une fois rejoué avec succès).

Les étapes de vérification réelle sont **conditionnelles au type de fichiers touchés** :
ne garder à l'instanciation que celles dont la condition s'applique, ne jamais retirer les
tests ni la revue finale avant commit.

Frontière avec `export-ppt-verifie` : un changement de code qui *touche* la génération PPT
au passage reste ici (l'étape `verification-pptx` couvre) ; quand le **livrable est le deck
lui-même** (layout, contenu, visuel), préférer `export-ppt-verifie`.

**Cadrage lourd obligatoire (arbitrage utilisateur 2026-09-16, propage depuis le hub)**
: `bmad-product-brief`, `bmad-architecture`, `bmad-create-epics-and-stories` et
`bmad-sprint-planning` sont des etapes **bloquantes** de la phase de cadrage, avant
`implementation` -- voir leurs contrats ci-dessous (etapes `cadrage-brief`,
`cadrage-architecture`, `cadrage-epics`, `gate-cadrage`). Deux risques reels, a ne pas
laisser produire un blocage silencieux :
- `bmad-create-epics-and-stories` exige `PRD.md` + `Architecture.md`. Ce playbook ne
  produit pas de PRD complet (`cadrage-brief` rend un brief, pas un PRD) -- si `PRD.md`
  manque a l'etape `cadrage-epics`, le contrat de cette etape impose un FAIL immediat vers
  l'utilisateur (proposer `bmad-prd`), jamais une invention silencieuse du document.
- L'architecture << step-file >> de ces skills s'arrete sur des menus interactifs a chaque
  etape (constate le 2026-09-16 au hub : `bmad-code-review` a bloque un sous-agent pour la
  meme raison, et `bmad-method install` s'est revele etre un TUI qui rend `exit 0` sans
  rien ecrire hors d'un vrai terminal). Ces quatre etapes s'executent donc en **session
  principale**, jamais deleguees a un sous-agent sans TTY : un sous-agent qui heurte un
  menu interactif porte `etat: echec`, jamais un silence pris pour un succes.

```json
{
  "nom": "dev-verifie",
  "description": "Implémentation d'une feature/correction avec tests, vérification réelle adaptée aux fichiers touchés, et revue finale avant commit.",
  "statut": "importe",
  "source": "manuel",
  "declencheurs": [
    "implémente/corrige/ajoute une fonctionnalité",
    "changement de template/UI (HTML, CSS, JS)",
    "changement touchant la génération d'un export PPT",
    "fin d'incrément, préparation d'un commit de code produit"
  ],
  "etapes": [
    {
      "id": "cadrage",
      "agent": "session principale",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "fichiers concernés lus, appelants des fonctions/champs partagés grep-és avant modification"
      },
      "checkpoint": false
    },
    {
      "id": "cadrage-brief",
      "agent": "skill bmad-product-brief",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "regime": "propose (la skill ECRIT un fichier reel) : annoncer l'etape et attendre le feu vert avant de la lancer, § 2 quinquies de agent-orchestrator",
        "critere": "brief produit (probleme, utilisateurs, contraintes) et relu par l'utilisateur avant de passer a `cadrage-architecture` ; exécuté en SESSION PRINCIPALE, jamais délégué à un sous-agent sans TTY (menus interactifs — voir note ci-dessus) — un blocage sur un menu est `etat: echec`, jamais un silence pris pour un succès"
      },
      "checkpoint": "annonce + feu vert avant lancement (écrit un fichier réel)"
    },
    {
      "id": "cadrage-architecture",
      "agent": "skill bmad-architecture",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "regime": "propose (ecrit Architecture.md) : annoncer et attendre le feu vert",
        "critere": "Architecture.md produit à partir du brief de `cadrage-brief` ; invariants d'architecture nommés, pas un paragraphe générique ; session principale, mêmes garde-fous menu interactif que `cadrage-brief`"
      },
      "checkpoint": "annonce + feu vert avant lancement (écrit un fichier réel)"
    },
    {
      "id": "cadrage-epics",
      "agent": "skill bmad-create-epics-and-stories",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "regime": "propose (ecrit epics.md/stories) : annoncer et attendre le feu vert",
        "critere": "epics.md produit, decoupe en stories verifiables ; PRÉREQUIS CONNU : cette skill exige `PRD.md` + `Architecture.md` en bloquant — `Architecture.md` vient de `cadrage-architecture`, mais ce playbook ne produit PAS de `PRD.md` complet (`cadrage-brief` rend un brief, pas un PRD). SI `PRD.md` manque au moment de lancer cette étape : FAIL immédiat vers l'utilisateur avec la proposition explicite de lancer `bmad-prd` d'abord — jamais de PRD inventé en silence, jamais d'attente sur un prompt que personne ne surveille"
      },
      "checkpoint": "annonce + feu vert avant lancement (écrit un fichier réel) ; FAIL nommé si PRD.md absent"
    },
    {
      "id": "gate-cadrage",
      "agent": "skill bmad-sprint-planning",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "regime": "propose (peut ecrire sprint-status) : annoncer et attendre le feu vert",
        "critere": "verdict PASS/CONCERNS/FAIL de la readiness gate de bmad-sprint-planning, lu sur `epics.md` produit par `cadrage-epics` — PASS : `implementation` démarre ; CONCERNS : lacunes nommées, présentées à l'utilisateur, confirmation attendue avant `implementation` ; FAIL (epics.md absent, ou une story sans critère d'acceptation vérifiable) : retour à l'étape en amont qui a échoué, jamais d'implementation sur une base FAIL. Le verdict doit pouvoir échouer réellement — un verdict qui ne connaît que PASS est un contrat décoratif, pas une gate"
      },
      "checkpoint": false
    },
    {
      "id": "implementation",
      "agent": "session principale",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "chaque exigence EXPLICITE de la demande (points numérotés, contraintes) cochée une à une contre le diff — pas seulement « ça compile/passe » ; toute exigence réinterprétée ou écartée signalée, jamais silencieuse ; style du fichier environnant respecté"
      },
      "checkpoint": false
    },
    {
      "id": "tests",
      "agent": "session principale",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "verdict lu sur les DEUX lignes de synthèse RÉELLES (« pass N / fail 0 » de node --test, et « Resultat : N OK, 0 echoues » du smoke-test), pas sur une sortie tronquée ou filtrée. `npm test` couvre les 16 cas JS dont la gate d'intégrité OOXML (verify-pptx-integrity.ps1) ET, depuis test/test-smoke.js, la suite smoke elle-même : la lancer séparément ne sert qu'à isoler un échec.",
        "commande": "cd comop-pptx-prototype && npm test (16 cas, dont la gate OOXML et le pont vers le smoke-test) ; pour isoler le cœur PowerShell : powershell -NoProfile -ExecutionPolicy Bypass -File comop-pptx-prototype/src/smoke-test.ps1 (34 assertions)"
      },
      "checkpoint": false
    },
    {
      "id": "verification-ui",
      "agent": "session principale",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "critere": "SI template/CSS/JS/écran touché : rendu réel regardé (screenshot ou app lancée), pas seulement le code source relu"
      },
      "checkpoint": false
    },
    {
      "id": "verification-pptx",
      "agent": "pptx-verify",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "critere": "SI la génération d'un export PPT est touchée : export réel rendu en images et inspecté (python-pptx est un parseur tolérant, un fichier qui parse peut ne pas s'ouvrir correctement dans PowerPoint)"
      },
      "checkpoint": false
    },
    {
      "id": "revue-increment",
      "agent": "revue-increment",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "critere": "boucle revue-increment (skill du projet, rappelée par le hook SessionStart) exécutée en entier : revue du code produit ET de la façon de travailler, correctifs appliqués, re-vérification"
      },
      "checkpoint": "avant tout commit — action difficilement réversible, proposer, ne pas exécuter unilatéralement"
    }
  ],
  "regle_reprise": "une relance ciblée par étape en échec de contrat, puis escalade utilisateur avec l'état réel"
}
```
