# ADR 0011 - Rendu du lecteur Images

- Statut : accepte
- Date : 2026-09-10
- Issues : #24, #27, #28
- Backlog : RDR-IMG-01, RDR-IMG-03, RDR-IMG-04 (prerequis)

## Contexte

Le troisieme moteur de lecture doit afficher les ouvrages Images issus d'un dossier ou d'un CBZ, respecter `Reader<'images'>` et permettre une navigation, un zoom et un pan fluides sur des scans haute resolution. Le backlog rend le prechargement adjacent obligatoire et interdit implicitement une liste qui monterait simultanement toutes les images decodees d'un ouvrage de 200 pages ou plus.

Les imports Images produisent deja des fichiers locaux canoniques `page-000001.jpg|png`, ordonnes naturellement, ainsi qu'un nombre total de pages persiste. La presentation ne doit cependant ni parcourir directement le filesystem ni deduire des pages non validees.

## Decision

- `createImageSetReader` implemente le contrat commun `Reader<'images'>`. Les positions restent indexees a partir de zero et la progression vaut `index / (totalPages - 1)`, avec 100 % pour un ouvrage d'une page.
- `ImageSetPageProvider` est un port applicatif. Son adaptateur Expo parcourt le repertoire local et refuse une sequence canonique manquante, dupliquee, non contigue ou exterieure au repertoire de l'ouvrage.
- `ImageSetRenditionBridge` adapte le cycle `open`, `goTo`, `getProgress` et `close` au pager. La fermeture supprime immediatement les references a la liste des pages.
- Le pager utilise une `FlatList` horizontale paginee avec une fenetre virtuelle de trois spreads. Les metadonnees legeres de toutes les pages peuvent etre listees, mais un composant `Image` haute resolution n'est monte que pour le spread actif et ses voisins immediats.
- Le montage des deux spreads voisins constitue le prechargement adjacent RDR-IMG-04. `expo-image` utilise `cachePolicy="none"` : les vues residentes conservent les decodages necessaires, tandis que le cache memoire global n'accumule pas toutes les pages visitees.
- La fenetre de residence suit la page visuelle la plus proche pendant le geste, dans les deux sens de lecture. La nouvelle voisine commence donc son decodage avant la fin de la pagination, avec une priorite de chargement haute, sans avancer prematurement la progression persistante.
- Le meme pager manipule des spreads adaptatifs : un spread contient une page lorsque le plus petit cote de la fenetre est inferieur a 600 points, et deux pages sur une fenetre tablette. Le seuil est un token partage et le test du plus petit cote maintient le mode page simple sur un telephone en paysage.
- Les spreads sont formes a partir des index canoniques avant toute transformation visuelle. En droite-vers-gauche, l'ordre des spreads et l'ordre des deux pages dans chaque spread sont inverses; la premiere page canonique reste donc a droite. Une reprise sur l'une des pages d'une paire rouvre la paire qui la contient sans reecrire la position tant que l'utilisateur ne navigue pas. Apres navigation, la position devient le dernier index canonique visible afin que le dernier spread atteigne 100 % et que le retour en page simple reprenne sur la page la plus avancee deja affichee.
- En double-page, la fenetre residente reste bornee au spread courant et aux deux spreads adjacents, soit six images au maximum. Le retour a une taille telephone remonte le meme pager en page simple autour de l'index canonique courant.
- Le pinch et le pan sont geres par Gesture Handler et Reanimated sur le thread UI. Le zoom est borne de 1 a 4, le pan est borne par les dimensions reelles de l'image contenue, et le pager est desactive pendant le pan d'une page zoomee.
- Le chrome, le Ruban, les actions precedent/suivant, le folio et les etats chargement/erreur reutilisent `ReaderScreenChrome`. La progression passe par `ReadingProgressService` et SQLite comme pour EPUB/PDF.
- Le contenu image conserve ses couleurs. Les capacites de zoom, de sens de lecture et de double-page adaptatif sont actives; les themes de lecture restent une capacite inactive.

## Consequences

Le cout JavaScript de la liste croit avec le nombre d'URI courtes, mais le nombre de decodages haute resolution montes reste borne a trois sur telephone et six sur tablette. Pendant un changement de spread, l'ancien spread reste dans cette fenetre, le nouveau voisin est rendu avant la fin du geste et les pages qui en sortent sont liberees.

Aucune dependance ni configuration native n'est ajoutee. L'application continue d'exiger un development build a cause de ses dependances natives existantes.

Les tests Node valident le contrat Reader, 205 pages, les tailles telephone/tablette, la formation des spreads dans les deux sens, les extremites, le retour en page simple, la fenetre de residence bornee, les bornes de zoom/pan, le bridge, le fournisseur de pages et la reprise SQLite. Ils ne mesurent pas les FPS, le heap natif ni la pression memoire GPU; ces mesures restent a executer sur appareils iOS et Android avec des scans haute resolution.

Le sens de lecture RDR-IMG-02 est traite par #26; la residence et le mode double-page utilisent ses index canoniques et restent donc independants de l'ordre visuel.
