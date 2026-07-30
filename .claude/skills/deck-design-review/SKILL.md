---
name: deck-design-review
description: Revue de design des 3 slides du support COMOP de CE projet (généré par comop-pptx-prototype/, mutation OOXML d'un template existant) — régénérer le vrai .pptx, l'ouvrir réellement dans PowerPoint (COM, comme verify-pptx-integrity.ps1 -RealOpen), et passer chaque slide contre son contrat (indicateurs agiles, roadmap/décisions, focus incidentologie). À lancer avant de déclarer un changement de template ou de branding terminé, ou comme étape de revue du playbook export-ppt-verifie.
---

# deck-design-review — la revue de design du support COMOP

`pptx-verify` (global) dit **comment** regarder ; `restitution-deck-design`
(global) dit **ce qui fait pro** en général. Ce skill ajoute le **contrat par
slide de CE support** (COMOP, 3 slides), pour que chaque slide soit revue
contre SA définition — pas une impression d'ensemble.

Créé le 2026-07-30 (finding `pratique-design` du superviseur de flotte, écart
mesuré : `deck-design-library` + `ppt-designer` présents, `deck-design-review`
manquant). **Canal différent des autres decks de la flotte** (R3) : ce n'est
pas un générateur python-pptx from-scratch (VSCode2/3/4) — c'est une
**mutation régex d'un template `.pptx` existant** (dézippage OOXML,
substitution de placeholders, rezippage), sans rendu LibreOffice établi ici.
L'oracle de ce dépôt est **PowerPoint réel via COM**, pas des images
LibreOffice — voir `verify-pptx-integrity.ps1 -RealOpen`.

## 0. Sur le BON artefact, TOUTES les slides

- Régénérer le vrai support : `.\src\generate-comop.ps1 -TemplatePath ... -DataPath ... -OutputPath ...`
  (ou route `/api/generate`) — jamais un ancien fichier de `output/`.
- `smoke-test.ps1` ET `verify-pptx-integrity.ps1 -RealOpen` DOIVENT être verts
  AVANT toute revue visuelle — un paquet OOXML invalide (thème corrompu, id
  dupliqués) peut passer `python-pptx`/un check géométrique sans broncher
  (c'est exactement ce qui a caché la régression de 45 jours de l'incrément 6).
- Ouvrir réellement le `.pptx` dans PowerPoint (ou `-RealOpen` qui l'automatise
  via COM) et **regarder les 3 slides** — pas un extrait, pas une supposition
  sur la seule sortie texte des scripts.

## 1. Contrat par slide

| Slide | Contenu (placeholders) | Contrat au rendu |
| --- | --- | --- |
| 1 — Suivi agile | équipe, période, événements passés, faits marquants, indicateurs (vélocité, prédictibilité, progression résultats), avancement projet, points d'attention | KPI numériques alignés et lisibles (pas de troncature type "92 %" coupé) ; texte long (`commentaire_indicateurs_agiles`) tient dans sa zone sans déborder sur le KPI voisin. |
| 2 — Roadmap & décisions | chantiers 3 mois, jalons/livrables, avancement chantiers, difficultés, points de discussion, sujets de décision, décisions, niveau de confiance, incertitude roadmap | Statuts par chantier (`vert`/`orange`/`en cadrage`) lisibles comme un état, pas noyés dans un paragraphe ; la zone décision reste visuellement distincte du suivi (ce sont 2 usages différents de la même slide). |
| 3 — Focus (`type_focus`, ex. incidentologie/recette) | faits marquants, tickets créés/traités/non traités, impacts métiers, actions de résolution, métiers concernés | Le titre de la slide reflète `type_focus` réel (pas un libellé figé "Incidentologie" si le focus a changé) ; les 3 compteurs de tickets forment un ensemble visuellement cohérent (même style, pas un chiffre qui déborde). |

## 2. Règles transverses (au rendu réel PowerPoint)

- **Charte OCTO appliquée** : footer, cercle de page, ligne d'accent
  (`OctoFooter`/`OctoPageCircle`/`OctoAccentLine`, posés par
  `apply-octo-branding.ps1`) présents et identiques sur les 3 slides — une
  variation d'une slide à l'autre est un défaut (régression d'idempotence
  déjà rencontrée sur ce script, cf. incrément 6).
- **Aucun placeholder résidueL** : `{{...}}` visible sur une slide = substitution
  ratée, bloquant (déjà couvert par `smoke-test.ps1`, à re-confirmer à l'œil).
- **Texte dans sa boîte** : le français accentué et les valeurs longues
  sortent des cadres serrés — invisible à un check géométrique seul.
- **Cohérence inter-templates** : si le support est généré depuis un template
  de la bibliothèque (`/api/templates`) autre que `comop-template.pptx`, la
  charte extraite automatiquement (couleurs/police/logo) doit se retrouver
  fidèlement sur les 3 slides — pas un mélange avec la charte OCTO par défaut.

## 3. Boucle

Rendu (ouverture PowerPoint réelle) → liste de défauts par slide (n° + type +
correctif) → correction dans le script `src/*.ps1` concerné → régénération →
re-vérification (`verify-pptx-integrity.ps1 -RealOpen` + re-ouverture) → re-rendu.
Budget 2 itérations au-delà du rendu initial, puis escalade utilisateur avec
l'état réel. Un changement d'intention design (branding, placeholder, structure
de slide) se fait **valider par l'utilisateur sur le rendu réel** avant d'être
déclaré fait.
