# Product brief — VSCode (atelier de génération COMOP)

Synthèse 1 page. Source de vérité : `_bmad-output/planning-artifacts/briefs/brief-VSCode-2026-06-08/brief.md`
(statut `draft`, plusieurs points marqués `[ASSOMPTION]` — non tranchés, repris tels
quels ici, jamais présentés comme des faits acquis).

## Persona

Son créateur, dans un usage de **démonstration** — illustrer auprès de collègues ou
d'interlocuteurs OCTO la capacité à produire des supports COMOP à partir de templates
et chartes variés, sans reconfiguration manuelle à chaque fois. `[ASSOMPTION]` un
persona secondaire projeté : toute personne produisant régulièrement des supports
COMOP à partir de templates différents selon le contexte (client, équipe, période).

## Pourquoi (les 3 rigidités actuelles)

Le générateur actuel repose sur trois rigidités qui limitent sa crédibilité comme
démonstrateur :

- **Un template unique imposé** — tout support part du même `comop-template.pptx`,
  charte OCTO câblée en dur dans `config/branding.json`.
- **Un mode démo déconnecté du réel** — l'action « charger exemple » injecte des
  données fictives plutôt que de partir d'un template réel apporté par l'utilisateur.
- **Une structure supposée figée à 3 slides** — aucun template qui s'écarterait de
  ce moule n'est pris en charge.

## Besoins & douleurs

Pouvoir charger *un template apporté sur le moment* et obtenir un résultat
visuellement cohérent, en direct, sans préparation lourde en amont : extraction
automatique de charte (couleurs, police, logo), bibliothèque de templates
réutilisables, repérage/nettoyage des zones de texte et de visuels avant usage.

## Proposition de valeur

L'outil devient un **atelier multi-templates auto-configurable** : au lieu
d'imposer un template et une charte, il **s'adapte à ce que l'utilisateur
apporte** — un changement de posture, pas une prouesse technique, qui rend le
périmètre tenable pour un prototype personnel tout en restant représentatif d'un
usage réel. Trois espaces suivent le cycle de vie d'un template : configuration
(charger + extraire la charte), revue (repérer/nettoyer les zones), utilisation
(générer avec ses propres visuels).

## État réel du prototype (2026-07-30)

Vérifié dans le code (`comop-pptx-prototype/server.js` + `web/index.html`) : la
solution du brief est **déjà largement implémentée**, pas seulement à l'état de
projet — les 3 espaces Configuration/Revue/Utilisation existent bien en onglets
dans l'interface ; `POST /api/templates` extrait automatiquement la charte
(`extract-template-branding.ps1`) à l'ajout d'un template à la bibliothèque
(CRUD complet : ajout, liste, suppression) ; `GET /api/templates/:nom/zones` et
`POST /api/templates/:nom/remove-shape` couvrent le repérage et le nettoyage des
zones en phase de revue. Le document source (`brief.md`, statut `draft`) décrit
encore cette solution comme l'itération « suivante » — le document a pris du
retard sur le code, pas l'inverse. Restent réellement ouverts : le « point ouvert »
du brief (sort du template OCTO d'origine dans la bibliothèque) et la gestion des
templates de plus de 3 slides (non vérifiée ici).
