# ADR 0004 - Rendu EPUB natif dans une WebView

- Statut : accepte
- Date : 2026-09-02
- Issue : #9
- Backlog : RDR-EPUB-01

## Contexte

Le premier moteur de lecture doit afficher les EPUB en mode pagine sur iOS et Android, respecter le contrat `Reader<'epub'>` fixe par l'ADR 0001 et fonctionner hors ligne. Le contenu importe appartient au stockage applicatif persistant; une WebView qui interprete du HTML non fiable ne doit pas obtenir un acces general a ce stockage ni naviguer vers le reseau.

## Decision

- `@epubjs-react-native/core` integre epub.js dans `react-native-webview`. La rendition utilise le manager `default`, le flow `paginated`, le snap de page et une seule page par spread.
- L'application depend uniquement du port `EpubRendition`. L'adaptateur de presentation traduit les evenements epub.js en CFI et progression types, puis `createEpubReader` expose le cycle de vie commun `Reader<'epub'>`.
- Toutes les valeurs issues de la WebView sont validees avant d'entrer dans le contrat applicatif. Une ouverture sans evenement `onReady` expire apres 20 secondes et produit une `rendering-failure` typee.
- Avant ouverture, l'infrastructure copie l'EPUB persistant dans `cache/reebbon/epub-renderer/active-book.epub`. Le HTML du moteur, epub.js, JSZip et cette copie sont les seules ressources placees sous la racine accordee a la WebView. Le cache est supprime a la fermeture, au nouvel essai et apres un echec de preparation.
- Le moteur refuse les sources non `file://`. Les navigations `http`, `https`, `mailto` et `tel` sont bloquees, les fenetres JavaScript sont desactivees, et le contenu EPUB ne peut ni ouvrir de popup ni activer ses propres scripts.
- Literata est chargee depuis l'asset Expo bundle et injectee comme data URI dans chaque document de la rendition. Aucun CDN ni telechargement de police n'est utilise.
- Un patch `patch-package` corrige dans la version 1.4.7 du wrapper la valeur invalide de `allowingReadAccessToURL`, une variable non definie dans le signalement d'erreur et la navigation externe permissive. Le patch porte sur les builds CommonJS et ESM distribues.

## Consequences

`react-native-webview`, `expo-asset` et `@epubjs-react-native/core` deviennent des dependances natives ou embarquees du development build. Le demarrage comprend une copie locale de l'archive et la generation asynchrone des locations epub.js; ces couts doivent etre mesures sur les appareils cibles.

Les tests automatises couvrent le contrat Reader, les messages WebView invalides, le timeout d'un EPUB malforme et une archive de 5 001 pages de spine. Ils ne remplacent pas la mesure du seuil d'ouverture inferieur a une seconde ni la validation gestuelle sur appareils iOS et Android.

La table des matieres, la persistance de position, la personnalisation, le scroll continu et les autres themes restent hors de RDR-EPUB-01. Le modele de capacites annonce les fonctions supportees par epub.js sans les exposer prematurement dans cet ecran.
