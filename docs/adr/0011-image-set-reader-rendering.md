# ADR 0011 - Rendu du lecteur Images

- Statut : accepte
- Date : 2026-09-10
- Issues : #24, #27
- Backlog : RDR-IMG-01, RDR-IMG-04 (prerequis)

## Contexte

Le troisieme moteur de lecture doit afficher les ouvrages Images issus d'un dossier ou d'un CBZ, respecter `Reader<'images'>` et permettre une navigation, un zoom et un pan fluides sur des scans haute resolution. Le backlog rend le prechargement adjacent obligatoire et interdit implicitement une liste qui monterait simultanement toutes les images decodees d'un ouvrage de 200 pages ou plus.

Les imports Images produisent deja des fichiers locaux canoniques `page-000001.jpg|png`, ordonnes naturellement, ainsi qu'un nombre total de pages persiste. La presentation ne doit cependant ni parcourir directement le filesystem ni deduire des pages non validees.

## Decision

- `createImageSetReader` implemente le contrat commun `Reader<'images'>`. Les positions restent indexees a partir de zero et la progression vaut `index / (totalPages - 1)`, avec 100 % pour un ouvrage d'une page.
- `ImageSetPageProvider` est un port applicatif. Son adaptateur Expo parcourt le repertoire local et refuse une sequence canonique manquante, dupliquee, non contigue ou exterieure au repertoire de l'ouvrage.
- `ImageSetRenditionBridge` adapte le cycle `open`, `goTo`, `getProgress` et `close` au pager. La fermeture supprime immediatement les references a la liste des pages.
- Le pager utilise une `FlatList` horizontale paginee avec une fenetre virtuelle de trois ecrans. Les metadonnees legeres de toutes les pages peuvent etre listees, mais un composant `Image` haute resolution n'est monte que pour la page active et ses voisines immediates.
- Le montage des deux voisines constitue le prechargement adjacent RDR-IMG-04. `expo-image` utilise `cachePolicy="none"` : les trois vues residentes conservent les decodages necessaires, tandis que le cache memoire global n'accumule pas toutes les pages visitees.
- La fenetre de residence suit la page visuelle la plus proche pendant le geste, dans les deux sens de lecture. La nouvelle voisine commence donc son decodage avant la fin de la pagination, avec une priorite de chargement haute, sans avancer prematurement la progression persistante.
- Le pinch et le pan sont geres par Gesture Handler et Reanimated sur le thread UI. Le zoom est borne de 1 a 4, le pan est borne par les dimensions reelles de l'image contenue, et le pager est desactive pendant le pan d'une page zoomee.
- Le chrome, le Ruban, les actions precedent/suivant, le folio et les etats chargement/erreur reutilisent `ReaderScreenChrome`. La progression passe par `ReadingProgressService` et SQLite comme pour EPUB/PDF.
- Le contenu image conserve ses couleurs. Les capacites de zoom et de sens de lecture sont actives; themes de lecture et double-page restent des capacites inactives.

## Consequences

Le cout JavaScript de la liste croit avec le nombre d'URI courtes, mais le nombre de decodages haute resolution montes reste borne a trois. Pendant un changement de page, l'ancienne page reste dans cette fenetre, la nouvelle voisine est rendue avant la fin du geste et la page qui en sort est liberee.

Aucune dependance ni configuration native n'est ajoutee. L'application continue d'exiger un development build a cause de ses dependances natives existantes.

Les tests Node valident le contrat Reader, 205 pages, la fenetre de residence bornee aux extremites et dans les deux sens de lecture, les bornes de zoom/pan, le bridge, le fournisseur de pages et la reprise SQLite. Ils ne mesurent pas les FPS, le heap natif ni la pression memoire GPU; ces mesures restent a executer sur appareils iOS et Android avec des scans haute resolution.

Le sens de lecture RDR-IMG-02 est traite par #26; la residence utilise ses index canoniques et reste donc independante de l'ordre visuel. RDR-IMG-03 (double-page tablette) reste hors perimetre de cette decision.
