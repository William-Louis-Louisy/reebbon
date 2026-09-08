# ADR 0009 - Rendu PDF natif

- Statut : accepte
- Date : 2026-09-07 (mise a jour le 2026-09-08)
- Issues : #19, #20
- Backlog : RDR-PDF-01, RDR-PDF-02

## Contexte

Le deuxieme moteur de lecture doit afficher les PDF importes localement sur iOS et Android, respecter le contrat `Reader<'pdf'>` fixe par l'ADR 0001 et preserver la mise en page du document. Le lecteur doit aussi fournir le zoom et l'ajustement interactif de RDR-PDF-02; le sommaire et les vignettes appartiennent a RDR-PDF-03.

## Decision

- `react-native-pdf` 7 rend le fichier local avec les implementations natives de chaque plateforme. `react-native-blob-util` et les config plugins Expo associes sont installes pour les development builds; Expo Go n'est pas supporte.
- L'application depend uniquement du port `PdfRendition`. `createPdfReader` expose le cycle de vie commun `Reader<'pdf'>`, tandis que `PdfRenditionBridge` adapte les commandes et evenements du composant natif.
- Les pages du contrat sont indexees a partir de 1. Chaque valeur recue de `onLoadComplete` et `onPageChanged` est validee avant d'entrer dans l'application. Une ouverture sans evenement natif expire apres 20 secondes avec une `rendering-failure` typee.
- Le rendu utilise une pagination verticale, une page par ecran (`enablePaging`), sans espacement inter-page. Les boutons du chrome appellent `Reader.goTo`; le glissement natif met a jour le meme etat par `onPageChanged`.
- Le zoom reste entierement natif afin de ne pas renvoyer chaque frame du geste vers JavaScript. Le pinch utilise une echelle bornee de 1 a 3. L'echelle minimale 1 et `fitPolicy=2` ajustent toute la page dans l'ecran; le double-tap natif parcourt ses niveaux de zoom puis revient a cet ajustement. La capacite `zoom` est vraie, tandis que `continuousScroll`, le sommaire et les personnalisations EPUB restent faux.
- La page PDF n'est jamais recoloree. Le chrome commun utilise la surface Paper par defaut, mais le contenu reste rendu fidelement par le moteur natif. Les liens integres ne declenchent pas de navigation externe.
- Le chrome partage `ReaderScreenChrome`, `ReaderLoading`, `ReaderFailure` et `ReaderChromeButton` entre EPUB et PDF. Le Ruban, le titre, les actions, le folio et les etats accessibles gardent une seule implementation.
- La progression utilise `{ kind: 'pdf', page }` et le service generique `ReadingProgressService`. La route restaure la derniere page valide et sauvegarde chaque changement de page sans acces direct a SQLite depuis la presentation.

## Consequences

`react-native-pdf`, `react-native-blob-util`, `@config-plugins/react-native-pdf` et `@config-plugins/react-native-blob-util` deviennent des dependances du development build. Toute installation existante doit etre reconstruite avant d'ouvrir un PDF.

Les tests Node couvrent le contrat Reader, le bridge natif simule, la validation des pages, les erreurs, la progression et la configuration du zoom. Ils ne remplacent pas les validations du rendu, du glissement, du pinch, du double-tap et du temps d'ouverture sur appareils iOS et Android.

Le mode scroll continu, le sommaire et les vignettes restent explicitement hors de cette decision. Ils devront etendre les capacites et l'adaptateur existants sans contourner `Reader`.
