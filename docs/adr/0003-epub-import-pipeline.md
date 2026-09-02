# ADR 0003 - Pipeline d'import EPUB

- Statut : accepte
- Date : 2026-09-01
- Issue : #6
- Backlog : IMP-01
- Revision : 2026-09-02, Issue #7, IMP-04

## Contexte

Le premier walking skeleton produit doit permettre de choisir un EPUB, de le copier dans le sandbox local, de persister l'ouvrage dans SQLite et de rafraichir immediatement la bibliotheque. Le FileSystem et SQLite ne partagent pas de transaction atomique. L'import doit donc coordonner les ports fixes par les ADR 0001 et 0002 sans coupler la presentation aux APIs Expo.

La revision IMP-04 ajoute la detection generique et l'extraction OPF sans modifier les contrats de domaine ni coupler le pipeline aux APIs Expo. La gestion exhaustive des messages et cas d'erreur produit reste dans IMP-05 (#8).

## Decision

- Le picker de fichiers est un port applicatif. Son adaptateur `ExpoFileImportSourcePicker` utilise `expo-document-picker`, demande une copie cache lisible immediatement et valide le resultat natif avant de produire un `FileImportSource`.
- `createEpubImporter` implemente le port commun `Importer<'epub'>`. Il ne depend que de `BookRepository`, `BookContentStore`, d'une horloge et d'un generateur d'identifiants.
- Le flux cree un staging, copie la source sous le nom canonique `book.epub`, deplace le staging vers `Documents/reebbon/books/{bookId}`, puis sauvegarde les metadonnees dans SQLite.
- `ImportFormatDetector` combine le type de source, l'extension ou le MIME declare et une signature binaire lue par le port `ImportFileReader`. Les dossiers deviennent `image-directory`; EPUB et CBZ exigent une signature ZIP, PDF exige `%PDF-`. Une declaration dont la signature ne correspond pas est une source corrompue typee.
- `BookMetadataExtractor<F>` est le contrat generique reutilisable par EPUB, PDF et Images. Son implementation EPUB reste dans l'infrastructure et utilise le meme lecteur binaire injecte.
- L'extracteur EPUB valide `mimetype`, resout `META-INF/container.xml`, puis lit l'OPF. `fflate` decompresse uniquement les entrees ciblees et `fast-xml-parser` valide les documents XML localement, sans composant natif ni acces reseau.
- Les chemins d'archive sont normalises et ne peuvent pas sortir de la racine. Les DTD, entites personnalisees, doublons et entrees surdimensionnees sont refuses. Le titre et le premier auteur valides sont bornes et normalises avant de construire `Book`.
- Les couvertures EPUB 2 (`meta name="cover"`) et EPUB 3 (`properties="cover-image"`) sont resolues depuis le manifeste. JPEG, PNG, GIF, WebP et SVG sont verifies par signature ou structure; les SVG actifs ou externes sont ignores.
- La couverture valide est ecrite dans le staging sous un nom canonique, puis deplacee avec l'EPUB. `coverUri` ne reference donc jamais une ressource temporaire ou externe.
- Le nom de fichier reste le fallback de titre lorsque l'OPF ne fournit pas de titre valide.
- `expo-crypto` fournit des UUID v4 injectables pour les identifiants de livre et d'import.
- En cas d'echec, une compensation supprime toute ligne potentiellement ecrite, le contenu persistant potentiellement deplace et le staging. Les erreurs restent discriminees par les contrats applicatifs.
- Apres un succes, la route relit la bibliotheque via le cas d'usage existant avant de fermer le stockage. Aucun contenu ne quitte l'appareil.

## Consequences

Le premier import EPUB est complet sans schema SQLite supplementaire et sans acces FileSystem dans la presentation. Les imports PDF, Images et CBZ pourront reutiliser le meme contrat et le meme stockage, mais leurs implementations restent hors de cette Issue.

`expo-document-picker` et `expo-crypto` deviennent des dependances natives Expo et doivent etre presentes dans les development builds iOS et Android. Les tests Node valident l'orchestration et la compensation, mais ne remplacent pas un test du picker systeme sur appareil.

Les futurs imports PDF et Images doivent implementer les memes ports plutot que creer un second pipeline. La detection PDF et dossier d'images est deja couverte; leur import et leur extraction specifique restent dans IMP-02 et IMP-03.

L'archive EPUB compressee est lue en memoire une fois par import, puis seules les entrees de metadonnees et de couverture sont decompressees avec des limites explicites. Cette approche evite d'extraire tout l'ouvrage et reste compatible Expo, mais les imports EPUB tres volumineux devront etre mesures sur appareils avant d'envisager un lecteur ZIP aleatoire ou streaming.

IMP-05 renforcera les diagnostics utilisateur des archives corrompues et formats non supportes. IMP-06 reste responsable de toute animation du Ruban pendant l'import.
