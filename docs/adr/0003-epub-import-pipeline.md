# ADR 0003 - Pipeline commun d'import de contenus

- Statut : accepte
- Date : 2026-09-01
- Issue : #6
- Backlog : IMP-01
- Revisions : 2026-09-07, Issue #18, IMP-02; 2026-09-08, Issues #60 et #62; 2026-09-09, Issue #22, IMP-03

## Contexte

Le premier walking skeleton produit doit permettre de choisir un EPUB, de le copier dans le sandbox local, de persister l'ouvrage dans SQLite et de rafraichir immediatement la bibliotheque. Le FileSystem et SQLite ne partagent pas de transaction atomique. L'import doit donc coordonner les ports fixes par les ADR 0001 et 0002 sans coupler la presentation aux APIs Expo.

La revision IMP-04 ajoute la detection generique et l'extraction OPF sans modifier les contrats de domaine ni coupler le pipeline aux APIs Expo. La revision IMP-05 formalise la presentation exhaustive des erreurs typees et valide les compensations sur l'etat reel du FileSystem et de SQLite.

La revision IMP-02 ajoute le PDF sans creer un second orchestrateur d'import. Elle doit extraire les metadonnees disponibles, generer une couverture locale depuis la premiere page et conserver les memes garanties de staging et de compensation que l'EPUB.

La revision IMP-03 ajoute les dossiers JPEG/PNG. Leur acces fourni par le picker peut etre temporaire, notamment sur iOS : toutes les pages retenues doivent donc etre copiees dans le stockage possede avant la fin du flux. La quantite attendue de 200 pages ou plus interdit de charger les images completes dans le heap JavaScript pour les valider.

L'Issue #60 documente des fermetures brutales sur Android avec des PDF volumineux ou riches en images. L'audit confirme qu'apres le rendu natif de couverture, `File.bytes()` alloue encore un buffer JavaScript de la taille complete de la source et que `pdf-lib` le conserve pendant son analyse pour deux champs facultatifs. A l'inverse, sur Android, le renderer de couverture ouvre un descripteur de fichier et dimensionne son bitmap a 640 px avant allocation.

L'Issue #62 suit un crash Android observe apres la persistance reussie d'un PDF lourd. Aucun appareil ni log systeme n'est disponible dans l'environnement d'implementation pour classer ce crash. L'analyse statique exclut une nouvelle lecture du binaire pendant le rafraichissement de bibliotheque, mais identifie des chemins natifs ou `PdfRenderer.Page`, `Bitmap`, le descripteur ou le cache du TurboModule ne sont pas liberes de maniere deterministe.

## Decision

- Le picker de fichiers est un port applicatif. Son adaptateur `ExpoFileImportSourcePicker` utilise `expo-document-picker`, demande une copie cache lisible immediatement et valide le resultat natif avant de produire un `FileImportSource`.
- `createFileBookImporter` porte l'orchestration transactionnelle commune aux fichiers EPUB et PDF. Les wrappers `createEpubImporter` et `createPdfImporter` fixent uniquement le format, le nom local et le titre de repli; ils dependent des memes ports applicatifs.
- `executeImportTransaction` porte desormais la creation du staging, son commit, la sauvegarde SQLite et la compensation commune a toutes les sources. Les importers de fichiers et de dossiers ne definissent que la preparation de leur contenu et la construction du livre.
- Le flux cree un staging, copie la source sous le nom canonique `book.epub` ou `book.pdf`, deplace le staging vers `Documents/reebbon/books/{bookId}`, puis sauvegarde les metadonnees dans SQLite.
- Le picker de dossiers et sa lecture sont des ports applicatifs. Leurs adaptateurs `expo-file-system` valident les valeurs natives avant de les exposer au pipeline; une annulation Android ou iOS reste un resultat attendu et silencieux.
- L'import Images ne parcourt que les fichiers directement contenus dans le dossier choisi. Il ignore les sous-dossiers et les extensions autres que `.jpg`, `.jpeg` et `.png`, trie les noms par segments numeriques et texte avec un departage deterministe, puis verifie les signatures JPEG/PNG avec un prefixe de huit octets.
- Les pages Images sont copiees sequentiellement sous les noms `page-000001.jpg` ou `.png`, dans l'ordre de lecture. Le livre persiste utilise le format `images`, le repertoire possede comme `fileUri`, la premiere page comme `coverUri` et le nombre de pages retenues comme `totalPages`.
- Le nom du dossier est propose comme titre avant l'import. La presentation permet de l'editer, puis le pipeline normalise la valeur retenue et conserve le nom du dossier comme repli.
- `ImportFormatDetector` combine le type de source, l'extension ou le MIME declare et une signature binaire lue par le port `ImportFileReader`. Les dossiers deviennent `image-directory`; EPUB et CBZ exigent une signature ZIP, PDF exige `%PDF-`. Une declaration dont la signature ne correspond pas est une source corrompue typee.
- `BookMetadataExtractor<F>` est le contrat generique reutilisable par EPUB, PDF et Images. Son implementation EPUB reste dans l'infrastructure et utilise le meme lecteur binaire injecte.
- L'extracteur EPUB valide `mimetype`, resout `META-INF/container.xml`, puis lit l'OPF. `fflate` decompresse uniquement les entrees ciblees et `fast-xml-parser` valide les documents XML localement, sans composant natif ni acces reseau.
- Les chemins d'archive sont normalises et ne peuvent pas sortir de la racine. Les DTD, entites personnalisees, doublons et entrees surdimensionnees sont refuses. Le titre et le premier auteur valides sont bornes et normalises avant de construire `Book`.
- Les couvertures EPUB 2 (`meta name="cover"`) et EPUB 3 (`properties="cover-image"`) sont resolues depuis le manifeste. JPEG, PNG, GIF, WebP et SVG sont verifies par signature ou structure; les SVG actifs ou externes sont ignores.
- La couverture valide est ecrite dans le staging sous un nom canonique, puis deplacee avec l'EPUB. `coverUri` ne reference donc jamais une ressource temporaire ou externe.
- `PdfMetadataExtractor` ne lit jamais le fichier PDF complet dans le heap JavaScript. L'API native disponible ne fournissant pas titre et auteur de maniere sure et bornee sur les deux plateformes, ces champs facultatifs sont omis et le pipeline commun utilise le nom de fichier comme titre de repli.
- `ExpoPdfFirstPageRenderer` utilise `@dariyd/react-native-pdf-page-image` pour ouvrir le PDF avec PDFKit sur iOS ou `PdfRenderer` sur Android, obtenir le nombre de pages et produire un JPEG borne a 640 px depuis la premiere page. L'image temporaire est lue puis fermee; sa copie persistante rejoint le PDF dans le meme staging.
- La fermeture du gateway PDF est attendue avant que l'extraction ne retourne, meme si l'ouverture native echoue. Le patch Android ferme chaque page et recycle chaque bitmap dans un bloc `finally`, libere le descripteur si la construction du renderer echoue, ferme les documents encore en cache a l'invalidation du TurboModule et expose les echecs de fermeture a la conversion d'erreur typee.
- Le TurboModule PDF est charge au moment de l'import. Un development build qui ne le contient pas retourne une erreur d'extraction typee au lieu d'empecher le demarrage de l'application.
- Le nom de fichier reste le fallback de titre lorsqu'un extracteur ne fournit pas de titre valide, notamment si l'OPF EPUB est incomplet ou si les metadonnees facultatives d'un PDF sont omises.
- `expo-crypto` fournit des UUID v4 injectables pour les identifiants de livre et d'import.
- En cas d'echec, une compensation supprime toute ligne potentiellement ecrite, le contenu persistant potentiellement deplace et le staging. Les erreurs restent discriminees par les contrats applicatifs.
- La presentation transforme exhaustivement chaque `ImportError` en un titre et un message explicites. Le point d'entree React conserve un dernier garde-fou contre une rejection inattendue afin qu'un echec d'import ne devienne pas une rejection non geree.
- Apres un succes, la route relit la bibliotheque via le cas d'usage existant avant de fermer le stockage. Aucun contenu ne quitte l'appareil.

## Consequences

Les imports EPUB, PDF et dossiers Images partagent desormais la meme transaction sans schema SQLite supplementaire et sans acces FileSystem dans la presentation. CBZ pourra reutiliser la preparation d'un livre Images apres decompression, mais reste hors de cette Issue.

L'import d'un dossier de 200 pages effectue une lecture bornee et une copie par page, sans conserver les binaires complets en memoire JavaScript. La validation automatisee couvre 205 pages; le temps et le comportement du picker doivent encore etre mesures sur appareils iOS et Android representatifs.

`expo-document-picker`, `expo-crypto` et `@dariyd/react-native-pdf-page-image` doivent etre presents dans les development builds iOS et Android. Les tests Node valident l'orchestration, la compensation et le contrat du rendu PDF, mais ne remplacent pas un test du picker et du moteur PDF natif sur appareil.

Le lecteur PDF reste hors du perimetre d'IMP-02. Cette decision ne choisit ni le moteur de lecture ni ses interactions; elle ne produit que les ressources locales necessaires a la bibliotheque.

Le lecteur Images, la navigation, le zoom, le sens de lecture et la double page restent hors du perimetre d'IMP-03. Les sous-dossiers ne sont pas interpretes implicitement comme des chapitres.

L'archive EPUB compressee est lue en memoire une fois par import, puis seules les entrees de metadonnees et de couverture sont decompressees avec des limites explicites. Cette approche evite d'extraire tout l'ouvrage et reste compatible Expo, mais les imports EPUB tres volumineux devront etre mesures sur appareils avant d'envisager un lecteur ZIP aleatoire ou streaming.

Le chemin nominal PDF n'alloue plus de buffer JavaScript proportionnel a la taille du document. Sur Android, le rendu de couverture ouvre la source par descripteur de fichier et borne le bitmap avant son allocation; seul le petit JPEG genere est relu pour rejoindre le staging. Les ressources Java et natives connues sont liberees avant la copie, la persistance et le rafraichissement de bibliotheque. Les PDF volumineux et principalement composes d'images restent a valider sur appareil avec `adb logcat`: sans trace du crash initial, ce correctif de cycle de vie ne constitue pas une preuve d'OOM ni n'exclut un defaut PDFium distinct.

Les erreurs de nettoyage sont elles-memes signalees explicitement, car une panne du stockage peut empecher de garantir la compensation malgre les tentatives de suppression. IMP-06 reste responsable de toute animation du Ruban pendant l'import.
