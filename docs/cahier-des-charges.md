# Cahier des charges — Application mobile de lecture d'ebooks

## 1. Vision produit

Une liseuse mobile (smartphone/tablette) au design moderne et épuré, capable d'importer des ebooks dans des formats variés — y compris des dossiers d'images (JPEG/PNG) traités comme des ouvrages illustrés/BD — et offrant une expérience de lecture premium, fluide et personnalisable. L'application fonctionne intégralement en local (offline-first), sans dépendance à un backend pour son usage principal.

**Positionnement :** une liseuse universelle, élégante et rapide, qui unifie des formats habituellement dispersés entre plusieurs applications (EPUB, PDF, BD en images) dans une seule interface cohérente.

## 2. Objectifs

- Offrir une expérience de lecture sans friction : import → lecture en quelques secondes
- Unifier plusieurs types de contenus (texte reflowable, PDF, images) sous une UX commune
- Garantir la confidentialité et la disponibilité offline des contenus de l'utilisateur
- Proposer un rendu visuel soigné, sobre, qui ne détourne pas l'attention du contenu
- Permettre une publication rapide sur App Store et Google Play

## 3. Personas cibles

| Persona | Besoin principal |
|---|---|
| Lecteur régulier (romans, essais) | Confort de lecture EPUB, réglages typographiques fins |
| Lecteur de BD/manga/scans | Navigation image fluide, zoom, sens de lecture adaptable |
| Lecteur de documents (PDF) | Fidélité de mise en page, annotation, navigation rapide |

## 4. Périmètre fonctionnel

### 4.1 MVP

**Bibliothèque**
- Vue grille/liste des ouvrages importés, tri (titre, auteur, date d'ajout, dernière lecture)
- Couverture générée automatiquement si absente
- Recherche locale par titre/auteur

**Import**
- Sélection de fichier(s) unitaire(s) : EPUB, PDF
- Sélection d'un dossier d'images (JPEG/PNG) → converti en "ouvrage" virtuel (BD/scan)
- Sélection d'une archive **CBZ** (ZIP d'images) → décompressée puis traitée comme un ouvrage BD/scan, via le même pipeline que le dossier d'images
- Sélection d'une archive **CBR** (RAR d'images) → même traitement que le CBZ ; support conditionné à la validation technique d'une librairie de décompression RAR compatible mobile (cf. risques §13)
- Détection automatique du format et extraction des métadonnées (titre, auteur, couverture) quand disponibles

**Lecture**
- EPUB : pagination ou scroll continu, reflow du texte, table des matières navigable
- PDF : navigation page à page ou scroll, zoom, ajustement à l'écran
- Images (mode BD) : navigation séquentielle, zoom, sens de lecture gauche→droite ou droite→gauche, mode double-page (tablette)
- Reprise automatique à la dernière position lue
- Marque-pages manuels

**Personnalisation**
- Thèmes clair / sombre / sépia
- Réglage taille de police, interligne, marges (EPUB)
- Luminosité intégrée à l'app (indépendante du système)

### 4.2 Phase 2 (post-MVP)

- Annotations et surlignage (EPUB, PDF)
- Statistiques de lecture (temps, pages, séries en cours)
- Organisation avancée : collections, tags, séries (tomes liés automatiquement)
- Support MOBI/AZW (lecture texte, conversion assistée)
- Synchronisation multi-appareils (compte utilisateur + backend léger)
- Import par partage depuis d'autres apps (share extension)
- Dictionnaire intégré / traduction au clic (EPUB)

### 4.3 Hors périmètre (explicitement exclu)

- Boutique/achat d'ebooks intégrée
- DRM propriétaire (Kindle AZW protégé, Adobe DRM) — non supportés
- Fonctions sociales (partage, avis, communauté)

## 5. Exigences non fonctionnelles

- **Offline-first** : toute la lecture doit fonctionner sans connexion réseau
- **Performance** : ouverture d'un ouvrage < 1s pour un EPUB/PDF de taille standard ; scroll/zoom sans saccade sur le mode images
- **Confidentialité** : aucun contenu importé ne transite par un serveur tiers au MVP
- **Compatibilité** : iOS et Android, smartphone et tablette (mise en page adaptative, notamment mode double-page tablette)
- **Accessibilité** : contraste conforme, taille de police extensible, navigation compatible lecteurs d'écran (niveau de base au MVP)
- **Robustesse à l'import** : fichiers corrompus ou formats non reconnus → message clair, pas de crash

## 6. Stack technique

| Composant | Choix | Justification |
|---|---|---|
| Framework | React Native + Expo | Un seul code TypeScript pour iOS/Android, build cloud (EAS), OTA updates |
| Langage | TypeScript | Contrainte imposée ; typage fort utile pour un modèle multi-format |
| Rendu EPUB | WebView + epub.js | Reflow, CSS, TOC, gestion de la pagination — le plus complet du marché JS |
| Rendu PDF | react-native-pdf | Rendu natif performant, zoom/scroll fluides |
| Rendu images (BD) | Composant custom (FlatList/gesture-handler + reanimated) | Contrôle total du geste, du zoom et du sens de lecture |
| Stockage fichiers | expo-file-system | Copie locale des imports dans le sandbox de l'app |
| Base de données locale | expo-sqlite (ou WatermelonDB si besoin de requêtes plus riches) | Bibliothèque, progression, marque-pages |
| Build & publication | EAS Build + EAS Submit | Publication App Store / Play Store sans environnement natif local |

## 7. Architecture applicative (haut niveau)

```
UI (écrans)
  ├─ Bibliothèque
  ├─ Import
  ├─ Reader (interface commune)
  │    ├─ EpubRenderer   (WebView + epub.js)
  │    ├─ PdfRenderer    (react-native-pdf)
  │    └─ ImageSetRenderer (custom)
  └─ Réglages

Couche domaine
  ├─ Import Pipeline (détection format, extraction métadonnées, copie fichiers)
  ├─ Library Service (CRUD ouvrages, tri, recherche)
  └─ Progress Service (position de lecture, marque-pages)

Couche données
  ├─ SQLite (métadonnées, progression)
  └─ FileSystem (fichiers sources : epub/pdf/images)
```

Le `Reader` expose une interface commune (`open`, `goTo`, `getProgress`, `setTheme`) implémentée différemment par renderer, ce qui permet d'ajouter un futur format (MOBI, etc.) sans toucher au reste de l'app.

## 8. Modèle de données (aperçu)

**Book**
`id, title, author, format (epub|pdf|imageset), coverUri, sourcePath, dateAdded, lastOpenedAt`

**ReadingProgress**
`bookId, position (locator EPUB / page PDF / index image), percentage, updatedAt`

**Bookmark**
`id, bookId, position, label?, createdAt`

## 9. Parcours utilisateur clé

1. Ouverture app → Bibliothèque (grille des ouvrages)
2. Bouton "Importer" → choix fichier ou dossier → traitement (extraction métadonnées, copie locale, génération couverture si besoin) → apparition dans la bibliothèque
3. Tap sur un ouvrage → ouverture du Reader adapté au format → reprise à la dernière position
4. Réglages accessibles en un geste depuis le Reader (thème, police, marges)
5. Retour bibliothèque en un geste (swipe/back)

## 10. Pipeline d'import détaillé

| Format | Détection | Métadonnées | Traitement |
|---|---|---|---|
| EPUB | Extension + signature ZIP | Titre/auteur/couverture via OPF | Copie dans le sandbox, indexation |
| PDF | Extension + en-tête `%PDF` | Titre si présent dans les métadonnées PDF, sinon nom de fichier | Copie dans le sandbox, génération couverture (1ère page) |
| Dossier images | Sélection dossier, filtrage .jpg/.png | Titre = nom du dossier (éditable), couverture = 1ère image | Copie/organisation des images, tri naturel des noms de fichiers |
| CBZ | Extension + signature ZIP | Titre = nom de l'archive (éditable), couverture = 1ère image extraite | Décompression puis traitement identique au dossier d'images |
| CBR | Extension + signature RAR | Idem CBZ | Décompression via lib RAR dédiée — support conditionné à la validation technique (licence, taille binaire, perf) |

## 11. Publication

- Build via **EAS Build** (profils development / preview / production)
- Soumission via **EAS Submit** vers App Store Connect et Google Play Console
- Mise à jour des correctifs non natifs via **EAS Update** (OTA), sans repasser par la validation des stores quand c'est éligible

## 12. Roadmap indicative

- **V1 (MVP)** : bibliothèque, import EPUB/PDF/dossier images/CBZ (CBR si validé), lecture + reprise de position, thèmes, réglages typographiques de base
- **V2** : annotations/surlignage, statistiques, collections/tags, support MOBI en lecture
- **V3** : synchronisation multi-appareils, partage depuis d'autres apps, dictionnaire intégré

## 13. Risques et points d'attention

- **epub.js dans une WebView** : bien tester les performances sur EPUB volumineux (>5000 pages) et les EPUB mal formés
- **MOBI/AZW** : pas de solution fiable de conversion 100% on-device — à cadrer précisément avant de l'engager en V2
- **Mode images/BD** : soigner particulièrement le geste de zoom/pan et le préchargement des images adjacentes pour éviter les temps de latence
- **CBR (RAR)** : format propriétaire, librairies de décompression mobiles limitées et parfois sous licence GPL (incompatible avec la distribution App Store/Play Store) — spike technique obligatoire avant d'engager le développement ; à défaut, dégrader en "CBZ uniquement" pour le MVP et documenter clairement l'absence de support CBR
- **Tablette** : prévoir tôt la mise en page adaptative (double-page) plutôt que l'ajouter après coup
