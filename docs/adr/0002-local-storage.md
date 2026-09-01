# ADR 0002 - Stockage local SQLite et FileSystem

- Statut : accepte
- Date : 2026-09-01
- Issue : #3
- Backlog : INFRA-02

## Contexte

Reebbon doit conserver localement les metadonnees de bibliotheque, la progression, les marque-pages et les preferences, tout en gardant les contenus ebook hors de la base de donnees. L'import doit aussi disposer d'une zone temporaire nettoyable afin qu'un echec ne laisse pas de livre partiel.

Les contrats du domaine et des repositories ont ete fixes par l'ADR 0001. Cette decision definit leur implementation locale sans ajouter de flux produit ou de renderer.

## Decision

- `expo-sqlite` stocke les donnees structurees dans `reebbon.db`.
- Le schema est versionne avec `PRAGMA user_version`. Les migrations sont ordonnees, transactionnelles et additives ; aucune recreation destructive n'est autorisee.
- La migration v1 cree `books`, `reading_progress`, `bookmarks` et `application_preferences`, active les cles etrangeres, le journal WAL et un delai d'attente en cas de verrou.
- Les positions sont stockees sous forme de `position_kind` et `position_value`, puis validees par le parseur du domaine avant de sortir de l'infrastructure.
- Les timestamps sont serialises en ISO 8601 UTC. Les ratios de progression restent normalises entre 0 et 1.
- Les suppressions de livres suppriment en cascade progression et marque-pages. Les contraintes refusent une position dont le format ne correspond pas au livre.
- `expo-file-system` place les contenus persistants sous `Paths.document/reebbon/books/{bookId}` et les imports temporaires sous `Paths.cache/reebbon/import-staging/{importId}`.
- Un staging est deplace vers le repertoire persistant seulement lors du commit. Le port permet de nettoyer explicitement staging et contenu possede.
- SQLite ne contient que les URI des ressources. Aucun EPUB, PDF, image ou autre binaire ebook n'est stocke dans une colonne SQLite.

## Consequences

Les repositories SQLite et le stockage de contenu implementent les ports applicatifs et peuvent etre injectes dans les futurs cas d'usage. Les erreurs natives sont converties en erreurs typees avant de remonter vers l'application.

`expo-sqlite` et `expo-file-system` deviennent des dependances natives et doivent etre inclus dans les development builds iOS et Android. Les tests Node utilisent une connexion SQLite de test et un gateway FileSystem en memoire ; ils ne remplacent pas une validation sur appareil des APIs natives.

La coordination atomique entre commit FileSystem et persistance SQLite appartiendra au pipeline d'import. La suppression produit complete, incluant confirmation UI et coordination fichiers/base, reste dans BIB-05.
