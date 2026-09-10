# ADR 0010 - Extraction streaming des archives CBZ

- Statut : accepte
- Date : 2026-09-10
- Issue : #23
- Backlog : IMP-07
- Revisions : 2026-09-09, Issue #69, robustesse et performance Android ; 2026-09-10, Issue #71, isolation du demarrage Android ; 2026-09-10, Issue #73, extraction native Android et instrumentation memoire

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

## Revision Issue #71 - demarrage Android

La route racine importe le point d'entree `infrastructure`, dont les reexports sont evalues au demarrage. Le reexport de `ExpoCbzArchiveExtractor` introduit par IMP-07 faisait donc charger tout le chemin CBZ avant toute selection de fichier. La revision #69 a ajoute a ce chemin du code asynchrone et le protocole `Symbol.asyncIterator`, alors que la source Expo est exclusivement un generateur synchrone. Une incompatibilite ou une exception de chargement de ce sous-systeme optionnel pouvait ainsi rendre toute l'application indisponible, au lieu de rester une erreur d'import CBZ.

Le point d'entree d'infrastructure ne reexporte plus l'adaptateur CBZ. La composition applicative le charge a la demande, apres que l'utilisateur a confirme un import CBZ, et transforme un echec de chargement en erreur typee `filesystem-failure/extract`. Le coeur conserve une API `async`, les reprises de boucle evenementielle, les blocs de 1 Mio, le tampon circulaire et la fermeture de l'iterateur sur erreur. Son entree est restreinte a `Iterable<Uint8Array>`, seul contrat utilise en production, ce qui retire le protocole `AsyncIterable` inutile sans retablir une extraction bloquante.

Metro genere les bundles Android de `main` et de son parent, et le bundle contenant la route racine compile en bytecode Hermes. Un AVD API 30 local a ete demarre, mais la construction du dev client echoue avant compilation applicative dans le plugin Gradle React Native 0.86.3 avec Gradle 9.3.1 (`plugins` et `id` non resolus dans le `settings.gradle.kts` du plugin). Faute d'APK installable, la trace fatale observee sur les appareils QA ne peut pas etre classee plus finement depuis cet environnement. La validation froid/reprise sur les deux appareils reste obligatoire avec `adb logcat`.

## Revision Issue #73 - ANR picker et pression memoire Android

Le logcat reel classe deux incidents independants. Le timeout `Changing to new focus window` suit le retour de `DocumentsUI`; `expo-document-picker` executait alors une copie de l'archive vers son cache directement dans `OnActivityResult`, avant de resoudre la promesse. Le second incident est un kill explicite de LMKD apres `TRIM_MEMORY_RUNNING_CRITICAL`, avec environ 414 Mio de RSS et 223 Mio de swap. Le PSS observe monte de 179 Mio a environ 540-564 Mio autour du flow. Il ne s'agit ni d'une exception JavaScript ni d'un crash natif hypothetique.

Le picker Android conserve desormais l'URI `content://` accordee par le systeme (`copyToCacheDirectory: false`) et desactive aussi le retour base64. iOS garde sa copie sandbox necessaire a l'acces ulterieur. Cette decision retire du callback de retour d'activite toute copie proportionnelle a la taille du CBZ et elimine la cause deterministe de l'ANR.

Le chemin `fflate` etait streaming au niveau algorithmique, mais chaque bloc compresse passait de `FileHandle.readBytes` a un `Uint8Array`, puis chaque bloc decompresse repassait de JavaScript a un `ByteArray` via `writeBytes`. La decompression et les ecritures synchrones restaient sur le thread JavaScript, et la duree de vie effective des copies de bridge dependait du GC Hermes et du runtime natif. Cette empreinte ne peut pas etre garantie suffisamment bornee sur l'appareil Android qui subit deja la pression LMKD.

Android utilise donc un module Expo local charge a la demande. Une coroutine sur `Dispatchers.IO` ouvre directement l'URI du provider, parcourt `ZipInputStream` et ecrit une seule entree a la fois avec un tampon reutilise de 64 Kio. Aucun octet d'archive ou d'image decompressee ne traverse le bridge JavaScript. Une seconde lecture sequentielle de la source valide le repertoire central avec une fenetre circulaire fixe de 65 557 octets; elle ne copie pas l'archive et le premier descripteur est ferme avant sa reouverture. Les limites de nombre d'entrees, taille par entree, taille totale et chemins hostiles restent appliquees. L'absence du module dans un ancien dev client produit une erreur typee au lieu d'un fallback Android vers `fflate`. Le fallback JavaScript reste isole et disponible pour iOS et le web.

Cette extraction native ne duplique aucune logique IMP-03. Le repertoire temporaire est toujours transmis a `ImageDirectoryImportPipeline`, qui reste seul responsable de la selection JPEG/PNG, du tri naturel, de la validation des signatures, de la copie sequentielle dans le staging, de la premiere page comme couverture, du commit et de la persistance. Le nettoyage compense du repertoire extrait reste pilote par `createCbzImporter`.

Le tag logcat `ReebbonImportMemory` emet des snapshots JSON contenant RSS, swap, PSS total et ventilation Java/native/graphics/code aux etapes bibliotheque stable, avant picker, retour picker, copie presente ou evitee, debut/fin d'extraction, debut/fin de chaque entree ZIP, etapes IMP-03 et retour bibliotheque. Ces mesures permettent de separer les bitmaps/graphics deja residents, le runtime de developpement et l'import lui-meme lors de la QA sur le corpus reel.

Le cache memoire partage d'`expo-image` est purge juste avant l'ouverture du picker, entre deux checkpoints. Les fichiers de couverture restent dans le cache disque et les vues visibles peuvent etre rechargees, mais les bitmaps non references d'une session de lecture precedente ne concurrencent plus l'import. La difference entre les deux snapshots attribue explicitement, au lieu de la supposer, la part du palier 540-560 Mio qui provient de ce cache.
