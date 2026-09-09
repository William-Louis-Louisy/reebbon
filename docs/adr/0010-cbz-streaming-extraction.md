# ADR 0010 - Extraction streaming des archives CBZ

- Statut : accepte
- Date : 2026-09-10
- Issue : #23
- Backlog : IMP-07
- Revision : 2026-09-09, Issue #69, robustesse et performance Android

## Contexte

IMP-07 doit importer une archive CBZ, qui est un conteneur ZIP d'images, sans creer une seconde logique de livre Images. L'ADR 0003 impose deja le tri naturel, la validation JPEG/PNG, les noms persistants canoniques, la premiere page comme couverture et la transaction compensee du pipeline dossier Images.

Lire puis decompresser toute l'archive en une operation synchrone conserverait simultanement le CBZ et toutes les planches dans le heap JavaScript. Cette approche est incompatible avec les ouvrages de nombreuses images haute resolution vises par le produit. Une extraction doit aussi empecher la traversee de repertoire et borner les archives compressant une quantite disproportionnee de donnees.

La QA Android de l'Issue #69 observe des fermetures du processus sur smartphone et des imports de plus d'une minute sur tablette. Aucun appareil ni journal systeme n'est disponible dans l'environnement de correction : ces fermetures ne peuvent donc pas etre classees comme OOM, exception native ou autre signal. L'analyse du chemin reel identifie neanmoins trois causes deterministes : la boucle synchrone monopolise le thread JavaScript pendant toute l'extraction, les blocs de 64 Kio multiplient les appels synchrones `readBytes`/`writeBytes` a travers la frontiere native, et la fenetre de fin ZIP est reallocouee puis recopiee a chaque bloc. En outre, un arret anticipe ne ferme pas l'iterateur du generateur, et laisse donc son `FileHandle` source ouvert.

## Decision

- `CbzArchiveExtractor` est un port applicatif. Il extrait une source CBZ vers un repertoire temporaire identifie, puis expose une operation de nettoyage idempotente.
- `ExpoCbzArchiveExtractor` utilise `FileHandle` d'Expo et le decodeur streaming `Unzip` de `fflate`, deja present dans le projet. L'archive est lue par blocs bornes de 1 Mio et chaque sortie est ecrite directement dans le cache; l'ensemble des planches n'est jamais accumule en memoire.
- L'extraction asynchrone rend la main a la boucle evenementielle entre les blocs traites. La decompression d'un bloc et son ecriture restent sequentielles afin de ne pas conserver plusieurs images decompressees simultanement.
- La fenetre necessaire a la validation du repertoire central ZIP utilise un tampon circulaire unique de 65 557 octets. Sa taille ne depend ni de l'archive ni du nombre d'images, et aucun nouveau tampon de fin ZIP n'est alloue par bloc.
- L'iterateur de source est explicitement ferme sur tous les chemins anticipes. Le `finally` du lecteur Expo ferme ainsi le `FileHandle` avant que l'erreur typee et le nettoyage du workspace ne remontent au pipeline.
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

Les tests Node couvrent le streaming par petits blocs, les chemins hostiles, les limites, les archives tronquees, la fermeture anticipee de la source, un corpus synthetique de 205 images et l'integration avec le stockage et SQLite. Le test volumineux verifie qu'un seul writer d'image est resident a la fois et que la boucle evenementielle recoit des points de reprise.

Sur un corpus synthetique non compresse de 128 images de 512 Kio (archive de 67 121 942 octets), le chemin Node passe de 1 025 blocs lus, 1 152 ecritures et 49-58 ms avant correction a 65 blocs lus, 192 ecritures et 3-6 ms apres correction. Cette mesure isole le cout algorithmique et le nombre d'appels; elle ne mesure pas le cout du bridge ni du stockage Android.

Les fichiers temporaires sont toujours recopies sequentiellement par `ImageDirectoryImportPipeline`, puis supprimes avant le commit du staging commun. Ce double passage disque est le prix de la reutilisation exacte d'IMP-03; aucune validation, aucun tri, aucune creation de livre et aucune persistance Images ne sont dupliques dans l'importeur CBZ. Le rafraichissement post-import ne relit aucun binaire.

Les tests automatises ne remplacent pas la QA requise sur smartphone et tablette Android avec le corpus reel. Il reste a chronometrer les memes fichiers avant/apres, observer la memoire du processus et capturer `adb logcat -b all -v threadtime` si le processus se ferme afin de classifier la cause sans inference.
