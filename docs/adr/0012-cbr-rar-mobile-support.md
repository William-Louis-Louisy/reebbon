# ADR 0012 - NO-GO CBR/RAR pour le MVP

- Statut : accepte
- Date : 2026-09-17
- Issue : #25
- Backlog : spike CBR/RAR du Sprint 5
- Issue conditionnelle : #34 / IMP-08

## Decision

Le support CBR est **NO-GO pour le MVP**.

Aucune solution evaluee ne satisfait simultanement les garde-fous suivants :

- licence et obligations de distribution identifiees pour l'App Store et le Play Store ;
- extraction fiable des archives RAR4 et RAR5 ;
- compatibilite demontree avec Expo SDK 57, React Native 0.86.3 et EAS Build sur Android et iOS ;
- memoire plafonnee avant toute allocation dictee par une archive hostile ;
- extraction sequentielle vers le disque sans copie complete dans le heap JavaScript ;
- impact binaire mesure et acceptable sur les deux plateformes ;
- maintenance sur un moteur amont actuel.

CBR reste donc explicitement non supporte. CBZ demeure le format archive de BD/manga supporte par le MVP. L'Issue #34 / IMP-08 ne doit pas etre implementee sur la base de ce spike et peut etre classee `not planned` apres integration de cette decision.

Cette decision ne conclut pas que RAR est techniquement impossible. Elle conclut qu'un GO serait injustifie sans un module natif sur mesure et une validation mobile complete qui ne sont ni disponibles ni demontres aujourd'hui.

## Contexte et contraintes Reebbon

Le projet utilise Expo SDK 57, React Native 0.86.3 et EAS Build. Le retour d'experience de l'import CBZ impose de ne faire traverser au bridge JavaScript ni l'archive complete ni les images decompressees. Une extraction d'archive doit s'executer hors du thread JavaScript, ecrire une seule entree a la fois dans un repertoire temporaire et imposer ses limites avant les allocations importantes.

Un futur extracteur CBR ne devrait contenir aucune logique de livre Images. Comme `CbzArchiveExtractor`, il devrait produire un repertoire temporaire et le transmettre a l'unique `ImageDirectoryImportPipeline`. Ce pipeline resterait responsable de la selection JPEG/PNG, du tri naturel, de la validation, de la premiere page comme couverture, du staging, de la persistance et des compensations.

La documentation Expo confirme qu'un module Expo local peut embarquer du code Kotlin/Swift dans un development build. Elle ne garantit cependant pas la portabilite d'un moteur C/C++ tiers : l'autolinking, CocoaPods/CMake, les ABI, le NDK et les builds EAS doivent encore etre valides par le module concerne.

## Evaluation des solutions

### 1. Source officielle UnRAR 7.23

**Moteur reel.** Source C++ officielle RARLAB, archive `unrarsrc-7.2.3.tar.gz`, version interne 7.20 beta 3 correspondant a la release 7.23. Le moteur lit RAR4 et RAR5, ainsi que les evolutions RAR7.

**Licence.** La licence UnRAR autorise gratuitement l'emploi de la source dans un logiciel qui manipule des archives RAR et autorise sa distribution dans un autre logiciel. Elle interdit d'utiliser la source pour recreer l'algorithme de compression RAR et exige de reproduire le paragraphe de restriction dans la licence ou la documentation et dans les commentaires de la distribution modifiee. Pour un extracteur uniquement, aucun obstacle de principe a une distribution commerciale App Store/Play Store n'a ete identifie. Cette conclusion ne remplace pas une revue juridique de publication.

**Memoire.** L'API lit l'archive depuis un fichier et peut ecrire la sortie directement sur disque ; elle ne requiert donc pas de charger toute l'archive. En revanche, la fenetre de decompression reste une allocation majeure. La source stable fixe `WinSizeLimit` a 4 Gio et `UNPACK_MAX_DICT` a 64 Gio. RARLAB avertit qu'une archive peut demander jusqu'a 1 Tio et recommande aux integrateurs de la refuser ou de demander une confirmation. Le callback `UCM_LARGEDICT` de la DLL n'est appele que lorsque la limite interne est depassee : la limite par defaut de 4 Gio est deja incompatible avec un telephone. Une integration Reebbon devrait lire `RARHeaderDataEx.DictSize` et refuser une entree avant `RARProcessFile`, ou exposer dans le wrapper une limite native nettement plus basse, non contournable et testee avant allocation.

**Compatibilite mobile.** RARLAB ne distribue aucun SDK/AAR/XCFramework officiel Android/iOS. Sa page d'extensions classe les ports mobiles comme contributions non supportees et avertit qu'ils peuvent contenir une source obsolete sans correctifs critiques.

Une compilation croisee de la source stable avec Android NDK 27.1, cible `arm64-v8a` API 24, echoue sans modification : `ulinks.cpp` appelle `lutimes`, absent de Bionic. La substitution experimentale `-Dlutimes=utimes` permet seulement d'estimer la taille ; elle modifie la semantique des liens symboliques et n'est pas un correctif publiable.

**Taille mesuree.** Avec `clang++ -Oz`, sections eliminables et symboles retires, cette compilation experimentale produit un `libunrar.so` arm64 de 358 064 octets (0,341 Mio). Ce chiffre n'inclut ni le wrapper Expo, ni les autres ABI Android, ni le code iOS, ni l'impact reel sur un AAB/IPA. Il montre qu'un moteur UnRAR cible pourrait etre compact, mais il ne constitue pas une mesure EAS sur deux plateformes.

**Verdict.** Meilleur moteur fonctionnel et licence la plus directe, mais **pas de GO** : port Android requis, plafond memoire mobile absent de l'API publique, integration iOS non construite, aucun build EAS Android/iOS et aucun delta AAB/IPA valides.

### 2. `react-native-unarchive` 1.1.0

**Moteurs reels.** Le nom et la licence MIT du wrapper ne decrivent pas les moteurs distribues :

- Android depend de `com.sorrowblue.sevenzipjbinding:7-Zip-JBinding-4Android:16.02-2.4`, donc du moteur 7-Zip/p7zip 16.02 via JNI ;
- iOS depend d'UnrarKit `~> 2.10`, qui embarque UnRAR 5.8.1.

Ces moteurs lisent RAR4/RAR5, mais ne sont ni de meme version ni de meme implementation. L'exemple du wrapper est developpe avec React Native 0.81.1, pas 0.86.3, et aucune matrice Expo SDK 57/EAS n'est fournie.

**Licence.** Android herite de la LGPL 2.1+, des licences BSD et de la restriction UnRAR de 7-Zip ; iOS herite de la licence BSD du wrapper UnrarKit et de la licence UnRAR du moteur. La mention MIT du paquet React Native ne supprime aucune de ces obligations. Un chemin de conformite LGPL, en particulier pour la redistribution mobile, n'est pas documente par le wrapper.

**Memoire.** Android utilise des callbacks d'extraction et iOS sait extraire vers un repertoire, donc la sortie peut etre sequentielle. Le wrapper n'expose toutefois aucun plafond de dictionnaire mobile et ne demontre pas la liberation des allocations natives sur le corpus Reebbon.

**Taille mesuree.** L'AAR Android transitif fait 19 394 461 octets compresse. Il embarque quatre moteurs natifs generalistes : 15,81 Mio pour arm64, 12,45 Mio pour armeabi-v7a, 12,35 Mio pour x86 et 14,60 Mio pour x86_64. Ce cout vient du support de nombreux formats et fonctions dont Reebbon n'a pas besoin.

**Verdict.** Rejete : moteurs divergents et anciens, obligations transitives insuffisamment documentees, absence de plafond memoire, impact Android disproportionne et compatibilite Expo 57/EAS non demontree.

### 3. `uncompress-react-native` 1.1.3

**Moteurs reels.** Android depend de Junrar 7.4.0 ; iOS depend d'UnrarKit sans version verrouillee. Junrar 7.4.0 precede le support RAR5 livre seulement dans Junrar 8.0.0. Le wrapper a ete developpe avec React Native 0.64.1, AGP 3.2.1 et `jcenter()`.

**Verdict.** Rejete : Android ne couvre pas RAR5 avec la version epinglee, la chaine Gradle est obsolete, les moteurs divergent et aucune compatibilite Expo 57/RN 0.86.3/EAS n'est etablie.

### 4. Junrar 8.0.0

**Moteur reel.** Implementation Java sous licence UnRAR. La version 8.0.0, publiee en juillet 2026, ajoute RAR5/RAR7, les archives solides et multi-volumes. Elle expose `ArchiveOptions.maxDictionarySize`, avec allocation progressive/segmentee, et des flux entree/sortie. Elle est donc techniquement credible pour une extraction Android bornee a condition d'abaisser explicitement sa limite par defaut de 4 Gio.

**Taille mesuree.** Le JAR Maven Central fait 222 189 octets (0,212 Mio) avant D8/R8, auquel s'ajoute `slf4j-api`. C'est nettement plus petit que 7-Zip-JBinding.

**Verdict.** Non retenu : Java/Android uniquement, aucun equivalent iOS du meme moteur, support RAR5 tres recent sans validation sur le corpus mobile Reebbon. L'utiliser imposerait deux implementations et deux comportements de securite differents.

### 5. libarchive 3.8.8

**Moteur reel.** Implementation C autonome sous licence BSD. Son API est concue pour lire les archives en flux et ecrire les entrees directement sur disque. Une edition statique peut limiter les formats lies, ce qui est favorable a la taille.

**RAR4/RAR5.** L'amont annonce RAR et RAR5 en lecture, mais precise explicitement « avec certaines limitations dues au statut proprietaire de RAR ». Un incident amont ouvert, #3352, montre encore une archive RAR5 valide dont les donnees sont restituees puis suivies d'une erreur fatale de fin de bloc sur la branche courante inspectee. Cette couverture n'est pas suffisante pour promettre l'import CBR general.

**Mobile et taille.** Aucun AAR/XCFramework mobile officiel ni wrapper Expo maintenu n'est fourni. Une integration demanderait deux toolchains natives, un filtrage des formats, des limites de ressources propres et des builds EAS. Aucun delta AAB/IPA exact ne peut etre affirme avant ce travail.

**Verdict.** Rejete : licence permissive et streaming satisfaisants, mais compatibilite RAR5 incomplete et compatibilite/impact mobile non valides.

### 6. 7-Zip / 7-Zip-JBinding

**Moteur reel.** 7-Zip 16.02 via JNI dans le wrapper Android examine. Le moteur RAR est derive d'UnRAR. La licence de `7z.dll` combine LGPL 2.1+, clauses BSD et restriction UnRAR ; les informations de licence doivent accompagner les redistributions binaires.

**Verdict.** Rejete : moteur generaliste ancien, obligations LGPL non traitees par le wrapper, AAR de 19,4 Mo, pas de chemin iOS equivalent valide et aucune garantie de plafond memoire adapte a Reebbon.

### 7. Autres options ecartees

- `(lib)unarr` est LGPL-3.0 et ne supporte pas RAR5 ; il echoue donc sur deux criteres avant toute integration mobile.
- `unrar5j` est une petite implementation Java RAR4/RAR5 sous Apache-2.0, mais ne supporte pas le mode PPMd RAR4 ni plusieurs filtres RAR4 et n'offre aucun moteur iOS.
- `node-unrar-js` et les variantes WebAssembly utilisent en environnement navigateur un `ArrayBuffer` contenant l'archive, puis exposent les fichiers comme `Uint8Array`. Leur API fichier repose sur les API Node absentes de React Native. Le chemin mobile disponible recreerait precisement les copies archive/JS/WASM que l'architecture CBZ a supprimees.
- UnrarKit offre une API iOS pratique et un mode par blocs, mais sa branche courante embarque encore UnRAR 5.8.1. RARLAB classe ce port parmi les contributions non supportees potentiellement privees de correctifs critiques.

## Compatibilite App Store / Play Store

Le spike distingue la licence du wrapper de celle du moteur effectivement lie :

- UnRAR direct et Junrar autorisent un extracteur distribue dans une application, sous reserve de conserver le texte de restriction et de ne jamais fournir de compression RAR ;
- libarchive BSD autorise la redistribution binaire avec conservation des notices ;
- 7-Zip ajoute la LGPL et ses obligations de redistribution/reliaison aux clauses UnRAR ;
- les licences MIT/BSD des wrappers React Native et UnrarKit ne remplacent pas les licences des moteurs embarques.

La licence UnRAR n'est donc pas, a elle seule, le motif du NO-GO. Le NO-GO resulte de l'absence d'une solution unique dont la conformite complete, les builds mobiles, la memoire et la taille ont tous ete valides. Aucun GO ne doit etre deduit de la seule etiquette MIT d'un paquet npm.

## Architecture interdite et architecture de reouverture

Tant que cette decision est active, il ne faut pas :

- ajouter `cbr` a `ImportFormat` ;
- ajouter une detection ou un bouton CBR ;
- introduire un moteur RAR, une dependance native ou un plugin de configuration ;
- dupliquer la creation de livres Images ;
- utiliser un fallback JavaScript/WASM qui charge l'archive complete.

Une nouvelle Issue de spike pourra rouvrir la decision uniquement avec les preuves suivantes :

1. moteur et version identiques, ou comportement explicitement aligne, sur Android et iOS ;
2. licence et notices auditees pour les deux stores ;
3. module Expo local minimal construit par EAS en development et release pour Android et iOS ;
4. extraction RAR4/RAR5 reelle vers un repertoire temporaire, hors thread JS, une entree a la fois ;
5. limite de dictionnaire native configurable et refusee avant allocation, ainsi que limites d'entrees, de taille par entree et de taille totale ;
6. protections contre traversal, chemins absolus, liens, doublons, archives solides hostiles et bombes de decompression ;
7. mesures appareil de PSS/RSS, temps d'import et nettoyage sur archives petites, volumineuses, solides, corrompues et chiffrees ;
8. delta mesure de l'AAB par ABI et de l'IPA ;
9. fermeture deterministe des handles et liberation du contexte natif sur succes, erreur et annulation ;
10. delegation finale et exclusive a `ImageDirectoryImportPipeline`.

Si ces preuves permettent plus tard un GO, l'architecture devra rester :

```text
ImportSource CBR
-> CbrArchiveExtractor natif borne
-> repertoire temporaire
-> ImageDirectoryImportPipeline existant
-> livre images
```

## Mesures reproductibles du spike

### UnRAR stable 7.23

Source officielle : `https://www.rarlab.com/rar/unrarsrc-7.2.3.tar.gz`

- SHA-256 de l'archive : `3995AF0AA32B1505A566DA053725551A1F0698DC42B2FDF7BA7D65DB0D004E33`
- NDK : `27.1.12297006`
- cible : `aarch64-linux-android24`
- echec sans modification : `ulinks.cpp:39: use of undeclared identifier 'lutimes'`
- estimation avec shim non publiable `-Dlutimes=utimes` : 358 064 octets pour `libunrar.so` arm64 optimise taille et strippe

### 7-Zip-JBinding Android 16.02-2.4

Artefact Maven Central : `com.sorrowblue.sevenzipjbinding:7-Zip-JBinding-4Android:16.02-2.4`

- SHA-256 AAR : `D2A2EE4391AF32A47D08B2438A94E06EAA5A1764398A17D089BC234945F3A0DE`
- AAR : 19 394 461 octets
- `arm64-v8a/lib7-Zip-JBinding.so` : 16 573 552 octets
- `armeabi-v7a/lib7-Zip-JBinding.so` : 13 059 004 octets
- `x86/lib7-Zip-JBinding.so` : 12 954 948 octets
- `x86_64/lib7-Zip-JBinding.so` : 15 309 168 octets

### Junrar 8.0.0

Artefact Maven Central : `com.github.junrar:junrar:8.0.0`

- SHA-256 JAR : `A735F8E6C4DB9396B5D08CD13671D383782D24B154684FBB2873F5DB126A1816`
- JAR : 222 189 octets avant D8/R8

Ces mesures ne sont pas des deltas d'application. Aucune dependance candidate n'a ete ajoutee a Reebbon et aucun code IMP-08 n'a ete implemente.

## Sources officielles et upstream

- [RARLAB - source officielle et avertissement sur les ports contribues](https://www.rarlab.com/rar_add.htm)
- [RARLAB - notes d'integration UnRAR 7 et risque de dictionnaire](https://www.rarlab.com/unrar7notes.htm)
- [RARLAB - specification RAR5](https://www.rarlab.com/technote.htm)
- [Expo - ajout de code natif et modules locaux](https://docs.expo.dev/workflow/customizing/)
- [Expo - builds EAS locaux et prerequis natifs](https://docs.expo.dev/build-reference/local-builds/)
- [UnrarKit - moteur UnRAR 5.8.1 et API streaming](https://github.com/abbeycode/UnrarKit/blob/7cd8c32bcfc1e1a7d16bc5b58cbd37a6eaf8b316/README.md)
- [`react-native-unarchive` - moteur Android 7-Zip-JBinding](https://github.com/pushpender-singh-ap/react-native-unarchive/blob/ee8d07218126226ae0aa085ecc3d3c86a6c6cdb3/android/build.gradle)
- [`react-native-unarchive` - moteur iOS UnrarKit](https://github.com/pushpender-singh-ap/react-native-unarchive/blob/ee8d07218126226ae0aa085ecc3d3c86a6c6cdb3/Unarchive.podspec)
- [`uncompress-react-native` - moteur Android Junrar 7.4.0](https://github.com/didisouzacosta/uncompress-react-native/blob/2f3338ce2f01fb97b9e39d6a9a5bbb49fbb8b95b/android/build.gradle)
- [`uncompress-react-native` - moteur iOS UnrarKit](https://github.com/didisouzacosta/uncompress-react-native/blob/2f3338ce2f01fb97b9e39d6a9a5bbb49fbb8b95b/uncompress-react-native.podspec)
- [7-Zip - licence LGPL/BSD/UnRAR](https://www.7-zip.org/license.txt)
- [Junrar 8.0.0 - release RAR5/RAR7](https://github.com/junrar/junrar/releases/tag/v8.0.0)
- [Junrar - licence UnRAR](https://github.com/junrar/junrar/blob/v8.0.0/LICENSE)
- [libarchive - formats, streaming et limites RAR](https://github.com/libarchive/libarchive)
- [libarchive - licence](https://github.com/libarchive/libarchive/blob/v3.8.8/COPYING)
- [libarchive #3352 - erreur sur une archive RAR5 valide](https://github.com/libarchive/libarchive/issues/3352)
- [(lib)unarr - absence de support RAR5](https://github.com/selmf/unarr)
- [node-unrar-js - API en memoire et limites navigateur](https://github.com/YuJianrong/node-unrar.js)
