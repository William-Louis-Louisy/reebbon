# Sprint Planning — Liseuse ebook (MVP)

Sprints de 2 semaines, solo dev. Estimation en points relatifs : **S = 1, M = 3, L = 5**.
Séquençage pensé pour poser les abstractions communes avant les implémentations spécifiques (évite la duplication de logique entre les 3 renderers) et pour valider un format de bout en bout avant de paralléliser sur les deux autres.

**Definition of Done (tous sprints)**
- Code revu (checklist solo : pas de logique dupliquée entre renderers, respect des interfaces définies au Sprint 0)
- Services partagés (Import/Library/Progress) couverts par des tests unitaires
- Testé sur iOS et Android, en light/dark UI et sur les 3 thèmes de lecture
- Pas de régression sur les stories des sprints précédents

---

## Sprint 0 — Fondations
**Objectif :** poser l'architecture commune (interface `Reader`, services, tokens, stockage) avant tout écran, pour que chaque renderer s'y branche sans rien dupliquer.

| Item | Type | Taille |
|---|---|---|
| Init projet Expo/TypeScript + tokens du design system (`theme.ts`) | INFRA-01 | M |
| Définir l'interface `Reader` commune + contrats Import/Library/Progress Service | Tâche technique | M |
| Stockage local SQLite + FileSystem — modèles Book/ReadingProgress/Bookmark | INFRA-02 | L |
| Config EAS Build (dev/preview/prod) | INFRA-03 | S |

**Total : 12 pts**

---

## Sprint 1 — Bibliothèque & premier import (walking skeleton)
**Objectif :** importer un EPUB et le voir apparaître dans la bibliothèque — premier flux complet, même minimal.

| Item | Type | Taille |
|---|---|---|
| Vue grille bibliothèque | BIB-01 | M |
| Import fichier EPUB | IMP-01 | M |
| Détection de format + extraction métadonnées (conçu générique, réutilisé pour PDF/Images) | IMP-04 | M |
| Gestion des erreurs d'import | IMP-05 | S |

**Total : 10 pts**

---

## Sprint 2 — Lecteur EPUB complet
**Objectif :** premier renderer implémentant l'interface `Reader` définie au Sprint 0 — valide l'architecture avant de la répliquer.

| Item | Type | Taille |
|---|---|---|
| Rendu EPUB paginé (WebView + epub.js) | RDR-EPUB-01 | L |
| Table des matières navigable | RDR-EPUB-02 | M |
| Reprise automatique de la dernière position | RDR-EPUB-03 | M |

**Total : 11 pts**

---

## Sprint 3 — Personnalisation transverse & Ruban
**Objectif :** livrer les éléments partagés par tous les renderers (thèmes, réglages, progression) une seule fois, avant d'ajouter PDF et Images.

| Item | Type | Taille |
|---|---|---|
| Thèmes de lecture Paper/Sépia/Nuit | PERS-01 | M |
| Taille de police | PERS-02 | S |
| Interligne et marges (EPUB) | PERS-03 | S |
| Thème d'interface clair/sombre | PERS-04 | S |
| Feuille de réglages (bottom sheet) | PERS-05 | S |
| Composant `Ribbon` — progression sur les couvertures | PROG-01 | M |

**Total : 10 pts**

---

## Sprint 4 — Import & Lecteur PDF
**Objectif :** deuxième renderer — réutilise l'interface `Reader` et l'Import Pipeline posés aux sprints 0-1 sans les redéfinir.

| Item | Type | Taille |
|---|---|---|
| Import fichier PDF | IMP-02 | M |
| Rendu PDF page à page | RDR-PDF-01 | M |
| Zoom et ajustement à l'écran | RDR-PDF-02 | M |
| Navigation par vignettes/sommaire | RDR-PDF-03 | M |

**Total : 12 pts**

---

## Sprint 5 — Import & Lecteur Images/BD
**Objectif :** troisième renderer, le plus exigeant en performance (zoom/pan, préchargement) — dernière brique du triptyque EPUB/PDF/Images. Le CBZ s'ajoute quasi gratuitement : même pipeline que le dossier d'images, juste précédé d'une décompression.

| Item | Type | Taille |
|---|---|---|
| Import dossier d'images (JPEG/PNG) | IMP-03 | L |
| Import archive CBZ (réutilise le pipeline dossier d'images) | IMP-07 | M |
| Navigation séquentielle avec zoom/pan | RDR-IMG-01 | L |
| Spike (hors points, 1-2j) : lib de décompression RAR — licence, taille binaire, perf → go/no-go pour IMP-08 | — | — |

**Total : 13 pts + spike**

---

## Sprint 6 — Finitions lecteur & bibliothèque
**Objectif :** compléter les 3 renderers et enrichir la bibliothèque avec les fonctions de confort.

| Item | Type | Taille |
|---|---|---|
| Sens de lecture configurable (Images) | RDR-IMG-02 | S |
| Préchargement des images adjacentes | RDR-IMG-04 | S |
| Mode double-page tablette (Images) | RDR-IMG-03 | M |
| Mode scroll continu (EPUB) | RDR-EPUB-04 | M |
| Tri de la bibliothèque | BIB-02 | S |
| Recherche locale | BIB-03 | S |
| Animation du ruban à l'import | IMP-06 | S |
| Marque-page manuel en lecture | PROG-02 | S |
| *Si spike Sprint 5 positif* : import archive CBR | IMP-08 | M |

**Total : 12 pts (15 pts si CBR retenu)**

---

## Sprint 7 — Polish & release
**Objectif :** fermer le MVP et publier. Sprint volontairement plus léger pour laisser du slack à la QA et aux allers-retours de review des stores.

| Item | Type | Taille |
|---|---|---|
| Couverture générée automatiquement | BIB-04 | M |
| Suppression d'un ouvrage | BIB-05 | S |
| Soumission EAS Submit (App Store + Play Store) | INFRA-04 | M |
| EAS Update (correctifs OTA) | INFRA-05 | S |
| Buffer QA / bugfixing / review stores | — | — |

**Total : 8 pts + buffer**

---

## Vue d'ensemble

| Sprint | Thème | Points |
|---|---|---|
| 0 | Fondations | 12 |
| 1 | Bibliothèque & import EPUB | 10 |
| 2 | Lecteur EPUB | 11 |
| 3 | Personnalisation & Ruban | 10 |
| 4 | Import & lecteur PDF | 12 |
| 5 | Import & lecteur Images + CBZ + spike CBR | 13 |
| 6 | Finitions (+ CBR si spike positif) | 12 (15) |
| 7 | Polish & release | 8 |

**~16-17 semaines (4 mois)** pour le MVP complet, en solo, CBR compris si le spike du Sprint 5 est positif — sinon le CBZ seul suffit à couvrir l'usage BD/manga et le CBR passe en V2. `PROG-03` (P2) et les epics V2/V3 restent hors planning — à re-scoper une fois le MVP publié et les premiers retours utilisateurs récoltés.
