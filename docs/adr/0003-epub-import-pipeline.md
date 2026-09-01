# ADR 0003 - Pipeline d'import EPUB

- Statut : accepte
- Date : 2026-09-01
- Issue : #6
- Backlog : IMP-01

## Contexte

Le premier walking skeleton produit doit permettre de choisir un EPUB, de le copier dans le sandbox local, de persister l'ouvrage dans SQLite et de rafraichir immediatement la bibliotheque. Le FileSystem et SQLite ne partagent pas de transaction atomique. L'import doit donc coordonner les ports fixes par les ADR 0001 et 0002 sans coupler la presentation aux APIs Expo.

La detection generique et l'extraction OPF appartiennent a IMP-04 (#7). La gestion exhaustive des sources corrompues et non supportees appartient a IMP-05 (#8).

## Decision

- Le picker de fichiers est un port applicatif. Son adaptateur `ExpoFileImportSourcePicker` utilise `expo-document-picker`, demande une copie cache lisible immediatement et valide le resultat natif avant de produire un `FileImportSource`.
- `createEpubImporter` implemente le port commun `Importer<'epub'>`. Il ne depend que de `BookRepository`, `BookContentStore`, d'une horloge et d'un generateur d'identifiants.
- Le flux cree un staging, copie la source sous le nom canonique `book.epub`, deplace le staging vers `Documents/reebbon/books/{bookId}`, puis sauvegarde les metadonnees dans SQLite.
- Le titre provisoire est derive du nom de fichier. L'auteur, la couverture, la signature ZIP et les metadonnees OPF restent explicitement deferes a IMP-04.
- `expo-crypto` fournit des UUID v4 injectables pour les identifiants de livre et d'import.
- En cas d'echec, une compensation supprime toute ligne potentiellement ecrite, le contenu persistant potentiellement deplace et le staging. Les erreurs restent discriminees par les contrats applicatifs.
- Apres un succes, la route relit la bibliotheque via le cas d'usage existant avant de fermer le stockage. Aucun contenu ne quitte l'appareil.

## Consequences

Le premier import EPUB est complet sans schema SQLite supplementaire et sans acces FileSystem dans la presentation. Les imports PDF, Images et CBZ pourront reutiliser le meme contrat et le meme stockage, mais leurs implementations restent hors de cette Issue.

`expo-document-picker` et `expo-crypto` deviennent des dependances natives Expo et doivent etre presentes dans les development builds iOS et Android. Les tests Node valident l'orchestration et la compensation, mais ne remplacent pas un test du picker systeme sur appareil.

IMP-04 remplacera les metadonnees provisoires par la detection et l'extraction validees. IMP-05 renforcera les diagnostics des archives corrompues et les garanties de nettoyage face aux erreurs natives. IMP-06 reste responsable de toute animation du Ruban pendant l'import.
