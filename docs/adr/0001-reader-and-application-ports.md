# ADR 0001 - Reader commun et ports applicatifs

- Statut : accepte
- Date : 2026-08-31
- Issue : #2

## Contexte

Reebbon doit lire des EPUB, PDF et ensembles d'images sans dupliquer les flux de presentation. Les renderers mobiles, la persistance SQLite et le FileSystem Expo ne sont pas encore implementes. Les contrats doivent donc stabiliser les dependances internes avant l'introduction de ces technologies.

CBZ et CBR sont des formats d'import, pas des formats du lecteur. CBZ doit alimenter le pipeline d'images. CBR reste interdit tant que le spike dedie n'a pas valide sa faisabilite mobile et sa licence.

## Decision

- `BookFormat` contient uniquement `epub`, `pdf` et `images`.
- `ReaderPosition` est une union discriminee. Les pages PDF sont indexees a partir de 1 et les images a partir de 0. Une fonction de parsing valide les positions provenant de la persistance.
- `Reader<F>` relie statiquement un format a son type de position. Il expose `open`, `goTo`, `getProgress`, `setTheme` et `close`, conformement au cahier des charges.
- Les divergences fonctionnelles sont exposees par `ReaderCapabilities` plutot que par des tests repetes sur le format dans la presentation.
- Les importers implementent un port commun type par format source. EPUB et PDF conservent leur format ; un dossier d'images et CBZ produisent un livre `images`. CBR n'est pas defini.
- `BookRepository`, `ReadingProgressRepository` et `BookmarkRepository` sont des ports applicatifs. Leurs futures implementations SQLite resteront dans l'infrastructure.
- Les erreurs de lecteur, d'import et de persistance sont des unions ou objets discrimines retournes dans `Result`, sans identification par texte libre.

## Consequences

La presentation pourra selectionner un adapter et afficher ses controles par capacite sans connaitre sa technologie. Les implementations futures devront convertir les erreurs WebView, natives, SQLite et FileSystem vers les erreurs applicatives avant de les retourner.

`setTheme` definit un theme de surface commun. Il ne donne pas l'autorisation de recolorer le contenu PDF ou image ; leur fidelite reste preservee tant qu'une exigence produit contraire n'existe pas.

Cette decision ne fournit aucun renderer, pipeline d'import, transaction, schema SQLite ou ecran. Ces implementations restent dans les Issues des sprints suivants.
