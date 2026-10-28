# Epics — VSCode (générateur COMOP PowerPoint)

> Amorçage story-obligatoire, 2026-10-28, à compléter avec le PO. Contenu limité à ce
> que le dépôt montre (README.md, CLAUDE.md, `docs/product-brief.md`, `comop-pptx-prototype/`).
> Toute supposition est marquée « à confirmer par le PO ». Aucune fonctionnalité inventée.

## Epic 1 : Socle existant et travaux en cours

Le dépôt contient un générateur de support PowerPoint COMOP (3 slides) à partir d'un
template `.pptx` interchangeable : serveur Node `server.js` et scripts PowerShell
`src/*.ps1` (périmètre `comop-pptx-prototype/`). Cet epic décrit l'existant à maintenir ;
les travaux à venir sont à définir avec le PO.

### Story 1.1: Garder la suite de tests du prototype verte

En tant que mainteneur du prototype COMOP,
je veux que `npm test` passe sur chaque changement de `server.js` ou de `src/*.ps1`,
afin de ne jamais livrer une génération PPTX cassée.

**Statut : existant, vérification de ce jour non exécutée en entier** (11 fichiers dans `comop-pptx-prototype/test/`, dont `test-smoke.js` qui rejoue `src/smoke-test.ps1` ; un `npm test` a été lancé le 2026-10-28 mais son résultat n'a pas été attendu — non exécuté jusqu'au bout). Le périmètre exact des tests à protéger est à confirmer par le PO.

**Acceptance Criteria [2 critères]:** (sources : `CLAUDE.md` section « Vérifications avant commit », `comop-pptx-prototype/package.json`)

- AC1.1.1 — **Given** le dépôt à jour, **When** on lance `npm test` depuis `comop-pptx-prototype/`, **Then** la commande sort en code 0 et aucun test n'échoue.
- AC1.1.2 — **Given** un seul fichier de test à isoler, **When** on lance `node --test test/test-path-guard.js`, **Then** le test passe (1 test passé, mesuré le 2026-10-21 selon `CLAUDE.md`).

### Story 1.2: Générer un support COMOP sans résidu de placeholder

En tant que créateur de démonstrations OCTO (persona du `docs/product-brief.md`, `[ASSOMPTION]` du brief non tranchée),
je veux générer le support de 3 slides à partir d'un template et de données,
afin d'obtenir un `.pptx` sans placeholder résiduel.

**Statut : existant ; vérification non exécutée ici.** Le canal est COMOP + PowerShell, pas python-pptx (`CLAUDE.md`). La validation visuelle par rendu réel reste manuelle : à confirmer par le PO.

**Acceptance Criteria [2 critères]:** (sources : `CLAUDE.md`, `src/generate-comop.ps1`, `src/validate-template.ps1`, `src/smoke-test.ps1`)

- AC1.2.1 — **Given** un template valide, **When** on lance `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\src\generate-comop.ps1 -TemplatePath … -DataPath … -OutputPath …`, **Then** le fichier de sortie est créé et ne contient aucun placeholder résiduel (assertion du smoke test).
- AC1.2.2 — **Given** un template modifié, **When** on lance `.\src\validate-template.ps1`, **Then** les placeholders attendus de `src/placeholders.json` sont tous présents, sinon la commande signale les manquants.

### Story 1.3: Compléter le backlog avec le PO

En tant que PO du dépôt,
je veux que les vraies évolutions du prototype soient listées en stories,
afin que le garde-fou « story obligatoire » s'appuie sur du travail réel.

**Statut : ouvert.** L'amorçage ne couvre que l'existant ; les besoins futurs ne sont pas établis par le dépôt (le brief produit est en statut `draft` avec des `[ASSOMPTION]`). À confirmer par le PO.

**Acceptance Criteria [1 critère]:**

- AC1.3.1 — **Given** ce fichier, **When** le PO l'a relu, **Then** les stories 1.1 et 1.2 sont confirmées ou corrigées et les stories de travaux à venir sont ajoutées ; vérifiable par `grep -cE '^###[ \t]+Story[ \t]+[0-9]+\.[0-9]+' _bmad-output/planning-artifacts/epics.md` (au moins 1).
