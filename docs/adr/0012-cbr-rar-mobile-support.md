# ADR 0012 - GO architectural pour CBR/RAR natif

- Statut : accepte
- Date : 2026-09-17
- Issue : #25
- Backlog : spike CBR/RAR du Sprint 5
- Implementation produit : #34 / IMP-08

## Decision

Le support CBR recoit un **GO architectural** pour une implementation ulterieure
dans #34, avec un module Expo natif Reebbon construit autour de la source
officielle UnRAR.

Ce GO ne rend pas CBR disponible dans le produit. Le POC de #25 n'ajoute pas
`cbr` a `ImportFormat`, ne modifie pas la detection de format et n'enregistre
aucun importer CBR. Il demontre une architecture raisonnable et maitrisee :

```text
ImportSource CBR
-> fichier local accessible au natif
-> module Expo Reebbon CBR (Kotlin / Swift)
-> coeur C++ commun UnRAR 7.23
-> extraction bornee dans un nouveau repertoire temporaire
-> ImageDirectoryImportPipeline existant
-> livre Images
```

L'Issue #34 reste ouverte. Elle devra transformer le POC en implementation
produit, ajouter le corpus d'archives et effectuer la QA mobile decrite dans cet
ADR avant livraison.

## Pourquoi la decision change

Le premier passage du spike cherchait surtout un wrapper React Native existant.
Aucun wrapper examine ne satisfaisait les contraintes de licence, version,
memoire, taille et parite Android/iOS. Cela ne constituait pas un obstacle a CBR
lui-meme.

Le POC versionne sous `modules/reebbon-cbr-poc/` verifie l'alternative demandee :

- source officielle UnRAR 7.23 vendoree, sans wrapper React Native tiers ;
- meme liste explicite de sources C++ pour Android et iOS ;
- compilation NDK 27.1 sur les quatre ABI Android ;
- bridge Expo qui ne transporte que des chemins et un resultat numerique ;
- extraction UnRAR directement de fichier vers disque ;
- limites et controles Reebbon appliques nativement avant l'extraction d'une
  entree, puis pendant sa decompression ;
- sortie volontairement compatible avec la delegation au pipeline Images
  commun, sans dupliquer IMP-03.

Aucun obstacle de licence, de portabilite source, de securite structurelle ou de
taille binaire manifestement disproportionne n'a ete trouve. L'absence de poste
macOS et d'appareil Android dans cet environnement limite la preuve d'execution,
mais ne justifie plus un NO-GO.

## Moteur retenu

### Source et version

Le moteur retenu est la source C++ officielle RARLAB UnRAR 7.23 :

- archive amont : `unrarsrc-7.2.3.tar.gz` ;
- SHA-256 :
  `3995AF0AA32B1505A566DA053725551A1F0698DC42B2FDF7BA7D65DB0D004E33` ;
- API d'integration : `RAROpenArchiveEx`, `RARReadHeaderEx`,
  `RARProcessFileW`, callback DLL et `RARCloseArchive` ;
- formats lus par ce moteur : RAR4, RAR5 et evolutions RAR7 ;
- archives solides : traitees sequentiellement par le meme handle UnRAR.

Le code amont complet et sa licence sont conserves dans
`modules/reebbon-cbr-poc/native/unrar/`. La logique Reebbon reste separee dans
`reebbon_cbr_poc.cpp`.

### Licence et distribution commerciale

La licence officielle UnRAR autorise gratuitement l'utilisation de la source
dans tout logiciel manipulant des archives RAR ainsi que sa redistribution dans
un autre logiciel. Elle interdit d'utiliser la source pour recreer un archiveur
compatible RAR ou l'algorithme de compression proprietaire.

Elle exige egalement que le paragraphe commencant par `UnRAR source code` soit
reproduit dans la licence ou la documentation, et dans les commentaires du
package derive. Le POC satisfait cette obligation dans :

- `native/unrar/license.txt`, copie amont complete ;
- `modules/reebbon-cbr-poc/NOTICE.md` ;
- le commentaire de l'en-tete public du wrapper Reebbon.

Reebbon utilise uniquement la decompression. Aucune clause de la licence
inspectee n'interdit une application commerciale distribuee sur l'App Store ou
le Play Store. Une notice obligatoire n'est pas une incompatibilite de licence.
Une revue juridique de publication reste recommandee, comme pour toute licence
non standard, mais elle n'est pas un bloqueur technique du spike.

## Architecture du POC

### Frontiere JavaScript

Le module local est decouvert par Expo Autolinking sur Android et Apple. Son API
accepte seulement un chemin source. Le bridge cree un sous-repertoire unique
dans son cache temporaire prive et renvoie :

- chemin de ce repertoire temporaire ;
- nombre d'entrees ;
- nombre de fichiers ;
- octets effectivement produits ;
- indicateur d'archive solide.

Ni l'archive ni une image decompressee ne traversent le heap JavaScript. Android
execute le bridge avec `Dispatchers.IO`; iOS declare une file GCD dediee.

### Extraction et memoire

L'archive est ouverte depuis son fichier local. Chaque en-tete est lu, valide,
puis traite avec `RARProcessFileW` vers le disque. A aucun moment le wrapper ne
lit l'archive complete ou une image complete dans un buffer JS.

Les limites POC sont natives et explicites :

- dictionnaire maximum : 64 Mio ;
- taille decompressee maximum par entree : 512 Mio ;
- taille decompressee totale maximum : 4 Gio ;
- nombre total d'entrees : 10 000 ;
- longueur maximum d'un chemin : 1 024 caracteres.

`RARHeaderDataEx.DictSize` est controle avant l'appel a `RARProcessFileW`, donc
avant l'allocation de la fenetre de decompression de l'entree. Le nombre, la
taille declaree de l'entree et le cumul des tailles declarees sont controles au
meme endroit. Le callback `UCM_PROCESSDATA` compte en plus les octets reellement
produits et interrompt UnRAR si les limites effectives sont depassees. Le
callback `UCM_LARGEDICT` refuse toute demande tardive du moteur.

Le POC desactive `RAR_SMP`. UnRAR travaille donc avec un seul worker natif hors
thread JS/UI, ce qui rend les allocations auxiliaires plus previsibles. Le debit
mono-thread sur de grands CBR devra etre mesure dans #34 avant de reconsiderer ce
compromis memoire/performance.

Ce double controle repond a l'avertissement officiel RARLAB : UnRAR 7 peut
representer des dictionnaires allant jusqu'a 1 Tio, tandis que sa limite interne
generale de 4 Gio reste trop elevee pour un telephone.

### Securite et erreurs

Avant extraction, le POC :

- normalise les separateurs Unix et Windows ;
- refuse chemins absolus, lettres de lecteur, composants vides, `.` et `..` ;
- refuse caracteres de controle et chemins trop longs ;
- refuse les collisions de chemins sans tenir compte de la casse ;
- refuse tous les liens, jonctions, hard links et redirections UnRAR ;
- refuse les entrees chiffrees et les en-tetes chiffres sans demander de mot de
  passe ;
- refuse les archives multi-volumes et entrees scindees dans ce POC ;
- classe les erreurs UnRAR corrompues, acces, ecriture, memoire et chiffrement
  avec des codes stables.

Le repertoire de destination doit ne pas exister. Le coeur le cree et le supprime
recursivement sur toute erreur. Sur succes, il reste disponible pour
`ImageDirectoryImportPipeline`; `cleanup` refuse tout chemin hors de la racine
temporaire native. Le futur appelant #34 devra toujours l'appeler dans un
`finally` apres delegation au pipeline Images.

### Archives solides

UnRAR conserve l'etat du dictionnaire solide dans le handle d'archive. Le POC
lit et extrait donc les entrees dans leur ordre d'origine avec un seul handle.
Les memes limites par entree, cumulees et de dictionnaire s'appliquent. Ce chemin
compile, mais l'execution d'un corpus solide sur appareils fait partie de la QA
obligatoire de #34.

## Portabilite Android

### `lutimes` et Bionic

La source stable active `USE_LUTIMES` sur Linux, alors que Bionic n'expose pas
`lutimes`. L'amont contient deja la voie portable correcte : si
`_POSIX_C_SOURCE >= 200809L`, `ulinks.cpp` utilise
`utimensat(AT_FDCWD, ..., AT_SYMLINK_NOFOLLOW)`.

Le CMake du POC definit donc `_POSIX_C_SOURCE=200809L`. La compilation Android
utilise le code `utimensat` amont, conserve la semantique no-follow et ne modifie
ni UnRAR ni `node_modules`. Le shim experimental `-Dlutimes=utimes`, qui suivait
potentiellement un lien, est abandonne.

### Resultats de compilation

Commande reproductible :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-cbr-poc-android.ps1
```

Environnement : Expo SDK 57.0.18, React Native 0.86.3, NDK 27.1.12297006,
CMake 3.22.1, Ninja, API Android 24, Clang 18.0.2 et C++17. Le build de mesure
utilise `-Oz`, des sections eliminables et un strip des symboles.

Resultats du 17 septembre 2026 :

| ABI | `.so` non strippe | `.so` strippe |
| --- | ---: | ---: |
| armeabi-v7a | 3 607 372 octets | 642 568 octets |
| arm64-v8a | 4 362 272 octets | 1 016 056 octets |
| x86 | 3 832 828 octets | 1 026 852 octets |
| x86_64 | 4 166 264 octets | 997 664 octets |

Ces chiffres incluent le moteur, le wrapper C++ et JNI, mais ne sont pas un
delta AAB compresse. Un AAB distribue ne livre normalement que l'ABI du device.
Le cout observe n'est pas manifestement disproportionne pour le perimetre CBR.
Le delta AAB release exact reste a mesurer dans #34.

Un executable arm64 des tests natifs de chemins et limites est egalement
compile par le script. Aucun appareil ou emulateur n'etait connecte pour
l'executer.

### Integration Expo / Gradle / EAS

`expo-modules-autolinking` resout le module et sa classe Kotlin. Un projet Android
est genere correctement par `npx expo prebuild --platform android --clean
--no-install`.

Le build Gradle complet du projet s'arrete avant la configuration du POC dans
`@react-native/gradle-plugin/settings.gradle.kts:16` avec `plugins` et `id` non
resolus. La meme panne du projet SDK 57 / Gradle 9.3.1 est deja documentee sur
`main` dans l'ADR CBZ et ne provient pas du CMake ou du module CBR. Le build
CMake/NDK direct prouve les quatre ABI sans modifier le dossier Android genere
ni `node_modules`.

#34 devra reexecuter un development build et un build EAS une fois ce probleme
global de toolchain resolu. Le POC est structure comme un module Expo local
standard et ne requiert pas de config plugin ou de modification native manuelle.

## Architecture iOS

Le POC fournit un podspec avec la meme liste explicite de sources UnRAR et le
meme wrapper C++ qu'Android, un bridge Objective-C++ mince, un module Expo Swift
sur file GCD dediee, et les memes limites et codes d'erreur portes par le coeur
commun. Aucun fork de moteur ni moteur iOS divergent n'est requis.

Windows ne fournit pas Xcode/CocoaPods. La compilation iOS et la taille IPA ne
peuvent donc pas etre affirmees comme validees. Elles restent obligatoires dans
#34 avec les commandes documentees dans le README du module. Cette absence
d'environnement n'est pas un obstacle raisonnable a l'architecture commune.

## RAR4, RAR5, corruption et chiffrement

Le moteur officiel retenu implemente RAR4 et RAR5. Le POC appelle son API DLL
commune, sans parser ou reimplementer les algorithmes de compression. Les chemins
de resultat suivants sont implementes nativement :

- RAR4/RAR5 valides : extraction entree par entree vers disque ;
- archives solides : extraction sequentielle avec un handle unique ;
- archive corrompue ou format inconnu : `ERR_CBR_CORRUPTED_ARCHIVE` ;
- entree ou en-tete chiffre : `ERR_CBR_ENCRYPTED_ARCHIVE` avant tout prompt ;
- dictionnaire excessif : `ERR_CBR_DICTIONARY_LIMIT` avant traitement ;
- sortie excessive : interruption native et nettoyage du repertoire temporaire.

La compilation couvre ces chemins et les tests de depot verifient les invariants
du wrapper. Leur execution avec de vraies fixtures RAR4, RAR5, solides,
corrompues et chiffrees sur Android/iOS est explicitement reportee a #34, car
aucun appareil Android ni environnement iOS n'est disponible ici. Le GO porte
sur la faisabilite et l'architecture, pas sur une pretendue QA produit achevee.

## Reutilisation du pipeline Images

Le POC s'arrete volontairement au repertoire temporaire. #34 devra fournir un
adaptateur application `CbrArchiveExtractor` analogue au chemin CBZ, puis appeler
exclusivement `ImageDirectoryImportPipeline.importDirectory`.

Il est interdit dans #34 de recopier la selection JPEG/PNG, le tri naturel, la
validation d'images, le choix de la premiere page comme couverture, le staging,
la persistence ou les compensations. Ces responsabilites restent celles de
IMP-03.

## Travail obligatoire dans #34

Avant de considerer CBR livrable, #34 doit :

1. connecter la copie/permission `ImportSource` au chemin natif sans lire le CBR
   en JavaScript ;
2. enregistrer l'extracteur et la detection CBR dans le pipeline d'import commun ;
3. deleguer le repertoire extrait a `ImageDirectoryImportPipeline` et garantir
   le nettoyage dans tous les chemins ;
4. executer sur Android et iOS un corpus RAR4/RAR5, solide, corrompu, chiffre,
   traversal, lien, dictionnaire excessif, entree excessive, cumul excessif et
   plus de 10 000 entrees ;
5. mesurer RSS/PSS native, pic de heap, duree et fichiers temporaires sur appareil
   avec de grands CBR ;
6. verifier annulation/background/low-memory et fermeture deterministe du handle ;
7. construire development et release via EAS sur Android et iOS ;
8. mesurer les deltas AAB et IPA reels ;
9. faire relire les notices UnRAR avant publication ;
10. conserver #34 ouverte jusqu'a satisfaction de ses criteres produit.

## Alternatives non retenues

Les conclusions du premier passage restent valides pour les alternatives :

- `react-native-unarchive` combine 7-Zip-JBinding 16.02 sur Android et UnrarKit
  5.8.1 sur iOS, avec moteurs divergents, cout Android important et limites non
  exposees ;
- `uncompress-react-native` epingle Junrar 7.4 sans RAR5 et une chaine React
  Native/Gradle obsolete ;
- Junrar 8 est credible sur Android mais n'offre pas le meme moteur sur iOS ;
- libarchive a une licence permissive et une API streaming, mais conserve des
  limites RAR5 amont ;
- 7-Zip-JBinding embarque un moteur generaliste ancien et ajoute des obligations
  LGPL ;
- JavaScript/WASM recreerait les copies archive/JS que le pipeline natif doit
  eviter.

Le GO concerne exclusivement l'integration directe de la source officielle
UnRAR avec les garde-fous Reebbon.

## Verification du spike

- autolinking Expo Android : module et classe Kotlin resolus ;
- autolinking Expo Apple : module local detecte ;
- prebuild Android : termine ;
- CMake/NDK Android : quatre ABI compilees ;
- executable de tests natifs arm64 : compile ;
- tests TypeScript/architecture : 226 passes ;
- appareil Android : non disponible ;
- Gradle application complet : bloque avant le POC par le plugin RN de `main` ;
- iOS/Xcode/CocoaPods : non disponible sous Windows ;
- EAS Android/iOS et delta AAB/IPA : a executer dans #34.

## Sources officielles et upstream

- [RARLAB - source officielle UnRAR et avertissement sur les ports contribues](https://www.rarlab.com/rar_add.htm)
- [RARLAB - notes UnRAR 7 et risque de dictionnaire](https://www.rarlab.com/unrar7notes.htm)
- [RARLAB - specification RAR5](https://www.rarlab.com/technote.htm)
- [RARLAB - distributions officielles 7.23](https://www.rarlab.com/download.htm)
- [Expo - modules locaux et plateformes Android/Apple](https://docs.expo.dev/more/create-expo-module/)
- [Expo - ajout de code natif](https://docs.expo.dev/workflow/customizing/)
- [Expo - integration d'une bibliotheque existante et autolinking](https://docs.expo.dev/modules/existing-library/)
- [7-Zip - licence LGPL/BSD/UnRAR](https://www.7-zip.org/license.txt)
- [Junrar 8.0.0 - support RAR5/RAR7](https://github.com/junrar/junrar/releases/tag/v8.0.0)
- [libarchive - formats et limites RAR](https://github.com/libarchive/libarchive)
