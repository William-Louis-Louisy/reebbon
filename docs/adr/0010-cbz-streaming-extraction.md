# ADR 0010 - Extraction streaming des archives CBZ

- Statut : accepte
- Date : 2026-09-10
- Issue : #23
- Backlog : IMP-07

## Contexte

IMP-07 doit importer une archive CBZ, qui est un conteneur ZIP d'images, sans creer une seconde logique de livre Images. L'ADR 0003 impose deja le tri naturel, la validation JPEG/PNG, les noms persistants canoniques, la premiere page comme couverture et la transaction compensee du pipeline dossier Images.

Lire puis decompresser toute l'archive en une operation synchrone conserverait simultanement le CBZ et toutes les planches dans le heap JavaScript. Cette approche est incompatible avec les ouvrages de nombreuses images haute resolution vises par le produit. Une extraction doit aussi empecher la traversee de repertoire et borner les archives compressant une quantite disproportionnee de donnees.

## Decision

- `CbzArchiveExtractor` est un port applicatif. Il extrait une source CBZ vers un repertoire temporaire identifie, puis expose une operation de nettoyage idempotente.
- `ExpoCbzArchiveExtractor` utilise `FileHandle` d'Expo et le decodeur streaming `Unzip` de `fflate`, deja present dans le projet. L'archive est lue par blocs de 64 Kio et chaque sortie est ecrite directement dans le cache; l'ensemble des planches n'est jamais accumule en memoire.
- Les chemins absolus, les separateurs Windows, les segments vides, `.` et `..`, les doublons et les chemins de plus de 1 024 caracteres sont refuses avant ecriture. L'arborescence valide est preservee.
- Une archive est limitee a 10 000 entrees, 512 Mio par entree et 4 Gio de donnees decomprimees. Les archives ZIP64, multi-disques, tronquees ou dont le repertoire central est incoherent sont classees comme corrompues.
- `createCbzImporter` reutilise `ImageDirectoryImportPipeline`. Il ne trie, ne valide et ne cree aucun livre Images lui-meme.
- Le titre propose retire l'extension `.cbz` et reste editable avant l'import. Le titre retenu est transmis au pipeline Images avec le repertoire extrait.
- Le nettoyage de l'extraction est execute apres la copie de toutes les pages dans le staging commun, mais avant son commit. Un echec de nettoyage fait echouer la phase de staging et declenche sa compensation.
- Toute extraction ayant echoue est egalement nettoyee. Une impossibilite de nettoyage est retournee comme erreur `filesystem-failure/cleanup`, jamais comme exception non geree.
- Aucun acces reseau n'est introduit et aucune donnee importee ne quitte l'appareil.

## Consequences

Le CBZ produit exactement le meme `Book<'images'>`, le meme ordre, les memes noms de pages et la meme couverture qu'un dossier contenant les fichiers extraits a sa racine. Les fichiers places uniquement dans des sous-repertoires restent ignores, conformement au comportement direct du pipeline dossier Images defini par IMP-03.

La solution ne requiert aucune dependance native ni modification de configuration iOS/Android. Elle evite le cout memoire des APIs `readAll()` et `unzipSync()`, au prix d'une extraction temporaire dans le cache et d'ecritures sequentielles.

Les formats ZIP64 et multi-disques restent explicitement non pris en charge. CBR/RAR est hors perimetre et demeure interdit tant que le spike IMP-08 n'a pas valide sa licence et sa compatibilite mobile.

Les tests Node couvrent le streaming par petits blocs, les chemins hostiles, les limites, les archives tronquees et l'integration avec le stockage et SQLite. Ils ne remplacent pas une validation de temps, de stockage et de memoire sur appareils iOS et Android avec des CBZ volumineux.
