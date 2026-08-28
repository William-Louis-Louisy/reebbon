# Backlog — Liseuse ebook

Découpé par epics, aligné sur le périmètre fonctionnel du cahier des charges et sur les composants du design system (bibliothèque à ruban, chrome du lecteur, thèmes Paper/Sépia/Nuit).

**Priorité** — P0 : bloquant pour le MVP · P1 : MVP mais non bloquant · P2 : V2 · P3 : V3
**Taille** (repère solo dev) — S : quelques heures à 1 jour · M : 2–4 jours · L : 5 jours et plus

---

## Epic — Bibliothèque (BIB)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| BIB-01 | En tant que lecteur, je veux voir tous mes ouvrages en grille de couvertures, afin de retrouver rapidement un livre | Grille responsive, carte = couverture + ruban de progression ; état vide = invitation claire à importer | P0 | M |
| BIB-02 | En tant que lecteur, je veux trier ma bibliothèque (titre, auteur, date d'ajout, dernière lecture) | Tri persistant entre les sessions | P1 | S |
| BIB-03 | En tant que lecteur, je veux rechercher un ouvrage par titre/auteur | Recherche locale instantanée (sans réseau) | P1 | S |
| BIB-04 | En tant que lecteur, je veux qu'une couverture soit générée automatiquement si l'ouvrage n'en a pas | Dégradé ink/oxblood + titre, cohérent avec le design system | P1 | M |
| BIB-05 | En tant que lecteur, je veux supprimer un ouvrage de ma bibliothèque | Confirmation avant suppression, fichier local retiré | P1 | S |

## Epic — Import (IMP)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| IMP-01 | Importer un fichier EPUB | Copie locale, apparition immédiate dans la bibliothèque | P0 | M |
| IMP-02 | Importer un fichier PDF | Copie locale, couverture générée depuis la 1ère page si absente | P0 | M |
| IMP-03 | Importer un dossier d'images (JPEG/PNG) comme ouvrage BD | Tri naturel des fichiers, titre = nom du dossier (éditable) | P0 | L |
| IMP-04 | Détecter automatiquement le format et extraire les métadonnées | Titre/auteur/couverture lus depuis EPUB (OPF) ou PDF quand disponibles | P0 | M |
| IMP-05 | Être informé clairement en cas de fichier corrompu ou non supporté | Message explicite, jamais de crash | P0 | S |
| IMP-06 | Voir le ruban se dérouler à l'ajout d'un ouvrage | Micro-animation cohérente avec le design system, non bloquante | P1 | S |
| IMP-07 | Importer une archive CBZ comme ouvrage BD | Décompression puis réutilisation exacte du pipeline "dossier d'images" | P0 | M |
| IMP-08 | Importer une archive CBR comme ouvrage BD | Décompression via lib RAR validée en spike ; à défaut, dégradé en "non supporté" avec message clair | P1 | M |

## Epic — Lecteur EPUB (RDR-EPUB)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| RDR-EPUB-01 | Lire un EPUB en mode paginé | Rendu fidèle via WebView + epub.js, pagination fluide | P0 | L |
| RDR-EPUB-02 | Naviguer via la table des matières | Accessible en un geste depuis le lecteur | P0 | M |
| RDR-EPUB-03 | Reprendre automatiquement à la dernière position lue | Position sauvegardée à chaque changement de page | P0 | M |
| RDR-EPUB-04 | Basculer en mode scroll continu | Bascule accessible dans les réglages | P1 | M |

## Epic — Lecteur PDF (RDR-PDF)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| RDR-PDF-01 | Lire un PDF page à page ou en scroll | Rendu natif via react-native-pdf | P0 | M |
| RDR-PDF-02 | Zoomer et ajuster la page à l'écran | Pinch-to-zoom, double-tap pour ajuster | P0 | M |
| RDR-PDF-03 | Naviguer via un sommaire/vignettes | Vue grille des pages pour saut rapide | P1 | M |

## Epic — Lecteur Images / BD (RDR-IMG)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| RDR-IMG-01 | Naviguer séquentiellement dans un ouvrage image avec zoom/pan | Geste fluide, sans latence perceptible | P0 | L |
| RDR-IMG-02 | Choisir le sens de lecture (gauche→droite / droite→gauche) | Réglage par ouvrage, mémorisé | P0 | S |
| RDR-IMG-03 | Activer le mode double-page sur tablette | Mise en page adaptative selon la taille d'écran | P1 | M |
| RDR-IMG-04 | Bénéficier du préchargement des images adjacentes | Pas de temps de latence à la page suivante | P0 | S |

## Epic — Personnalisation & Réglages (PERS)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| PERS-01 | Basculer entre les thèmes de lecture Paper / Sépia / Nuit | Fondu 480ms cohérent avec le design system | P0 | M |
| PERS-02 | Ajuster la taille de police | Effet immédiat, mémorisé par l'app (EPUB) | P0 | S |
| PERS-03 | Ajuster l'interligne et les marges (EPUB) | Effet immédiat | P1 | S |
| PERS-04 | Choisir un thème d'interface clair/sombre indépendant du thème de lecture | Réglage global, séparé du thème de lecture | P1 | S |
| PERS-05 | Ouvrir les réglages depuis une feuille accessible en un geste | Bottom sheet conforme au design system | P0 | S |

## Epic — Marque-pages & Progression : "Le Ruban" (PROG)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| PROG-01 | Voir la progression de lecture encodée par le ruban sur chaque couverture | Longueur du ruban proportionnelle au % lu, mise à jour en temps réel | P0 | M |
| PROG-02 | Ajouter un marque-page manuel en cours de lecture | Accessible en un tap depuis le lecteur | P1 | S |
| PROG-03 | Consulter la liste des marque-pages d'un ouvrage | Navigation directe vers chaque marque-page | P2 | S |

## Epic — Infrastructure & Publication (INFRA)

| ID | User story | Critère d'acceptation principal | Prio | Taille |
|---|---|---|---|---|
| INFRA-01 | Initialiser le projet Expo/TypeScript avec les tokens du design system | `theme.ts` dérivé du style guide (couleurs, typo, espacements) | P0 | M |
| INFRA-02 | Mettre en place le stockage local (SQLite + FileSystem) | Modèles Book / ReadingProgress / Bookmark opérationnels | P0 | L |
| INFRA-03 | Configurer les profils EAS Build (development/preview/production) | Build cloud fonctionnel sur les 2 plateformes | P0 | S |
| INFRA-04 | Soumettre l'app via EAS Submit | Publication App Store + Play Store | P0 | M |
| INFRA-05 | Mettre en place EAS Update pour les correctifs OTA | Mise à jour sans repasser par la validation des stores | P1 | S |

---

## V2 — epics de haut niveau (P2)

- **Annotations & statistiques** : surlignage/notes sur EPUB et PDF, statistiques de lecture (temps, pages, séries en cours)
- **Organisation avancée** : collections, tags, regroupement automatique des tomes d'une même série
- **Support MOBI/AZW** : lecture en extraction de texte, sans conversion complète on-device

## V3 — epics de haut niveau (P3)

- **Synchronisation multi-appareils** : compte utilisateur + backend léger
- **Import par partage** : share extension depuis d'autres apps
- **Dictionnaire intégré** : consultation/traduction au clic sur un mot (EPUB)

---

## Stories à risque — détail

Ces stories correspondent aux points d'attention identifiés dans le cahier des charges ; elles méritent un spike technique avant estimation ferme.

**RDR-EPUB-01 — Lire un EPUB en mode paginé**
- Tester sur un EPUB volumineux (>5000 pages) et sur des EPUB mal formés avant de valider l'approche WebView + epub.js
- Le temps d'ouverture doit rester < 1s pour un fichier de taille standard

**IMP-03 — Importer un dossier d'images comme ouvrage BD**
- Le tri naturel des noms de fichiers doit gérer les conventions courantes (`001.jpg`, `page_1.jpg`, `1.png`…)
- Valider le comportement sur un dossier de 200+ images sans dégradation de performance à l'import

**RDR-IMG-01 — Navigation séquentielle avec zoom/pan**
- Le préchargement des images adjacentes (RDR-IMG-04) est un prérequis, pas un bonus : sans lui, cette story n'est pas "terminée"
- Cibler 60fps sur le geste de zoom/pan y compris sur des images haute résolution (scans)

**IMP-08 — Importer une archive CBR**
- RAR est un format propriétaire ; vérifier en priorité la licence des librairies de décompression disponibles (certaines sont GPL, incompatibles avec la distribution en store)
- Si aucune librairie satisfaisante n'est trouvée, dégrader proprement le scope : CBZ supporté, CBR explicitement non supporté au MVP plutôt qu'une implémentation bricolée

**PROG-01 — Le ruban comme indicateur de progression**
- Le composant doit rester performant même recalculé fréquemment (à chaque page tournée) sans re-render coûteux de la grille bibliothèque
- Un seul composant `Ribbon` partagé entre bibliothèque, lecteur et animation d'import (cf. design system)
