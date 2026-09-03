# ADR 0007 - Personnalisation de la mise en page EPUB

- Statut : accepté
- Date : 2026-09-03
- Issue : #14
- Backlog : PERS-03

## Contexte

L'interligne et les marges d'un EPUB doivent changer immédiatement tout en restant indépendants des futurs readers PDF et images. Le contrat commun expose déjà une capacité de personnalisation de police, mais les réglages de mise en page ne sont ni des propriétés de police ni des fonctions communes à tous les formats.

Le design system fixe les interlignes `1.5`, `1.7` et `1.9`. Pour les marges, il nomme le réglage par défaut « Confort » sans publier une gamme dédiée, mais son échelle d'espacement fournit les valeurs adjacentes `16`, `24` et `32 px`.

## Décision

- Le domaine expose uniquement les trois interlignes `1.5 / 1.7 / 1.9` et les trois marges horizontales `16 / 24 / 32 px`. Les valeurs par défaut sont `1.7` et `24 px` (« Confort »).
- `Reader` expose une capacité optionnelle `layoutCustomization` avec deux opérations validées : `setLineSpacing` et `setHorizontalMargin`.
- L'adaptateur EPUB déclare cette capacité. Un reader qui la déclare absente ne peut pas exposer ces opérations dans son contrat TypeScript.
- Le bridge applique des overrides epub.js sur des variables CSS internes au thème. Les règles du corps EPUB consomment ces variables, ce qui conserve le réglage lors des changements Paper, Sépia et Nuit et provoque le reflow sans reconstruire la WebView.
- La présentation affiche des groupes radio accessibles seulement lorsque le reader actif fournit `layoutCustomization`.

## Conséquences

Les EPUB utilisent un interligne relatif, qui reste cohérent quand la taille de police change. Les marges reposent exclusivement sur l'échelle d'espacement existante du design system.

PERS-03 ne demande pas de mémorisation : les deux réglages reviennent donc aux valeurs « Confort » à chaque nouvelle session. La persistance éventuelle et le déplacement des contrôles dans une feuille de réglages relèvent d'une Issue dédiée ; PERS-05 reste hors de cette décision. PDF et images ne sont pas modifiés.
