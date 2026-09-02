# ADR 0005 - Capacite de table des matieres du Reader

- Statut : accepte
- Date : 2026-09-02
- Issue : #10
- Backlog : RDR-EPUB-02

## Contexte

Le lecteur EPUB doit exposer une table des matieres et naviguer vers une section sans faire dependre l'ecran de lecture des `href` ou des structures propres a epub.js. Les futurs lecteurs pourront proposer leur propre representation d'un sommaire. Les donnees EPUB proviennent par ailleurs d'un contenu non fiable execute dans une WebView et doivent etre validees avant d'entrer dans l'application.

## Decision

- `Reader` expose une capacite optionnelle `tableOfContents`, independante du format. Elle fournit des entrees plates composees d'un identifiant opaque, d'un libelle et d'une profondeur, puis une operation `goToEntry`.
- L'adaptateur EPUB valide et aplatit la navigation recue d'epub.js. Les entrees mal formees, les cibles reseau et les schemas executables sont rejetes. Des limites de profondeur, de taille et de longueur evitent qu'un sommaire hostile monopolise les ressources.
- Les `href` EPUB restent dans `EpubRenditionBridge`. Le bridge associe chaque identifiant genere a sa cible et seul cet adaptateur appelle `goToLocation`.
- `createEpubReader` verifie que l'identifiant demande appartient au dernier sommaire charge avant de deleguer la navigation. Un identifiant inconnu produit une erreur typee `invalid-table-of-contents-entry`.
- L'ecran affiche le controle de sommaire uniquement quand la capacite retourne au moins une entree valide. La selection appelle exclusivement `Reader.tableOfContents.goToEntry`.

## Consequences

La presentation ne contient aucun test de format ni aucune cible de navigation EPUB. Un futur lecteur PDF ou images pourra fournir la meme capacite sans modifier le flux de l'ecran commun qui la consommera.

L'ordre hierarchique est conserve par une liste plate et une profondeur afin de permettre une interface virtualisee. La selection courante, la recherche dans le sommaire et la persistance de la derniere section ne font pas partie de RDR-EPUB-02.

Les tests automatises couvrent la validation des donnees de navigation, la confidentialite des cibles dans le bridge, les erreurs typees et la delegation au moteur. La verification gestuelle et visuelle sur iOS et Android reste une validation manuelle sur development build.
