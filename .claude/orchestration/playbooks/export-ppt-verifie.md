# Playbook `export-ppt-verifie` — génération de deck PPT vérifiée au rendu réel

Chaîne de génération PPT : produire ou faire évoluer un deck, enrichir si pertinent
(cadres photo via `pptx-framed-image`, qualité rédactionnelle via `slide-text-polish`),
puis **toujours** vérifier au rendu réel avec `pptx-verify` — un .pptx qui se génère sans
erreur peut ne pas s'ouvrir/rendre correctement dans PowerPoint.
`restitution-deck-design` fournit la review checklist design (hiérarchie, rythme
d'espacement, couleur=sens, alignement, cohérence de composant).

**Canal de génération propre à CE projet** : le générateur COMOP Node.js/PowerShell
(`comop-pptx-prototype/` — `node server.js` ou
`src/generate-comop.ps1 -TemplatePath … -DataPath … -OutputPath …`, smoke test
`src/smoke-test.ps1`). Pour un deck hors COMOP, la skill globale `pptx-deck`
(python-pptx) reste disponible. Le choix de canal ne dispense JAMAIS de l'étape
verification-rendu.

Importé depuis les projets VSCode2/VScode5, où cette colonne vertébrale génération →
vérification rendu était la pratique effective. Ici, **statut `importe` — à confirmer sur
les premiers runs de ce projet**. `pptx-deck`, `pptx-verify`, `restitution-deck-design`
sont des skills globales ; `pptx-framed-image`, `slide-text-polish` et
`deck-design-library` sont installées dans ce projet.

**Étape `generation` instanciée via le sous-agent `ppt-designer`** (`.claude/agents/ppt-designer.md`,
porté depuis VSCode3 le 2026-07-23, adapté au canal COMOP réel de ce projet) plutôt qu'en
inline — il choisit le canal (COMOP vs hors-COMOP), consulte `deck-design-library` avant
toute nouvelle forme, et porte l'historique de la régression du 2026-06-08 : **corrigée le
2026-07-28** (commit `badedf1`), cause réelle `apply-octo-branding.ps1` et non
`remove-template-shape.ps1`, désormais gardée par `verify-pptx-integrity.ps1` dans
`npm test` (voir mémoire projet `project_comop_multitemplate_plan`).

**Itération de design ≠ reprise** : la boucle **rendu de contrôle → liste de défauts →
correction → re-rendu** est l'étape NOMINALE de ce playbook, bornée à **2 itérations**
au-delà du rendu initial ; à la 3ᵉ, escalade utilisateur avec l'état réel — même livrable
rejeté ≥ 3 tours = ne pas re-deviner le défaut, demander à l'utilisateur de pointer le
défaut précis sur SON artefact. Dans le journal (`log_run.py`), le champ `reprises` ne
compte QUE ce qui sort de ce budget ou relève d'un imprévu — jamais les itérations de la
boucle nominale.

```json
{
  "nom": "export-ppt-verifie",
  "description": "Production ou évolution d'un deck PPT : génération, enrichissements conditionnels (cadres photo, polish rédactionnel, passe design), vérification au rendu réel obligatoire, revue finale avant commit.",
  "statut": "importe",
  "source": "manuel",
  "declencheurs": [
    "génère/améliore/corrige un deck PPT de restitution",
    "remplir les cadres photo (« ici mettre une Photo ») d'un template",
    "qualité rédactionnelle / design des slides d'un deck"
  ],
  "etapes": [
    {
      "id": "cadrage",
      "agent": "session principale",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "contenu de la présentation identifié (données, structure, message), template client ou deck vierge choisi. SI la demande référence un deck/charte externe : RENDRE 2-3 slides de la référence (pptx-verify) et en extraire les motifs concrets AVANT d'implémenter — interdit d'affirmer une conformité de charte de mémoire."
      },
      "checkpoint": false
    },
    {
      "id": "generation",
      "agent": "ppt-designer",
      "mode": "cascade",
      "modele": "(session, hérité — jugement visuel, pas de bascule)",
      "contrat": {
        "type": "deterministe",
        "critere": "instancié via le sous-agent ppt-designer (Agent), pas inline ; export .pptx produit sans exception via le canal choisi (COMOP : `npm test` vert — 16 cas, dont la gate d'intégrité et le pont vers les 34 assertions du smoke-test ; deck python-pptx : self-check géométrique + débordements de pptx-deck passés). Pour une NOUVELLE slide ou une slide retravaillée en profondeur : forme choisie via deck-design-library AVANT de dessiner. Garde d'intégrité OOXML : la gate verify-pptx-integrity.ps1 doit être verte (status « valide », xmlInvalides et idsDupliques vides) sur tout paquet produit — elle tourne dans npm test. La régression du 2026-06-08 est CORRIGÉE (2026-07-28, commit badedf1) et sa cause n'était PAS remove-template-shape.ps1, vérifié innocent, mais apply-octo-branding.ps1 (chevrons doublés dans theme1.xml + branding non idempotent) : ne plus escalader sur remove-template-shape.ps1. Aucun passage à « done » sans que l'UTILISATEUR ait ouvert le fichier lui-même — l'auto-évaluation d'un deck est exactement la faute du 2026-06-08"
      },
      "checkpoint": false
    },
    {
      "id": "cadres-photo",
      "agent": "pptx-framed-image",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "SI le template porte des cadres photo (prstGeom round2DiagRect, « ici mettre une Photo ») : image insérée épousant la forme exacte du cadre"
      },
      "checkpoint": false
    },
    {
      "id": "polish-texte",
      "agent": "slide-text-polish",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "deterministe",
        "critere": "SI le contenu textuel des slides a été produit ou retouché : slide_lint passé sur {title, bullets}, findings bloquants corrigés"
      },
      "checkpoint": false
    },
    {
      "id": "verification-rendu",
      "agent": "pptx-verify",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "critere": "export réel rendu en images et inspecté visuellement (valeurs alignées, panneaux ni vides ni étirés, pas de collision avec le chrome du template) — jamais retirée à l'instanciation. BOUCLE NOMINALE : rendu → liste de défauts → correction → re-rendu, ≤ 2 itérations au-delà du rendu initial puis escalade utilisateur — ces itérations ne se journalisent PAS en reprises."
      },
      "checkpoint": false
    },
    {
      "id": "design-review",
      "agent": "restitution-deck-design",
      "mode": "cascade",
      "modele": "(session)",
      "contrat": {
        "type": "reel",
        "critere": "OBLIGATOIRE dès que le diff touche un layout / composant / couleur de slide (seuil objectif, pas un auto-jugement). Lancer restitution-deck-design et appliquer sa review checklist au rendu réel, corriger, puis retour à verification-rendu."
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
        "critere": "SI du code produit a été modifié : boucle revue-increment (skill du projet) exécutée en entier — revue + correctifs + re-vérification"
      },
      "checkpoint": "avant tout commit — action difficilement réversible, proposer, ne pas exécuter unilatéralement"
    }
  ],
  "regle_reprise": "une relance ciblée par étape en échec de contrat, puis escalade utilisateur avec l'état réel. Les itérations de la boucle nominale rendre→corriger→re-rendre (≤ 2 au-delà du rendu initial, cf. verification-rendu) sont le déroulé attendu, PAS des reprises."
}
```
