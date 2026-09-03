# ADR 0006 - Taille de police EPUB persistante

- Statut : accepte
- Date : 2026-09-03
- Issue : #13
- Backlog : PERS-02

## Contexte

La taille du texte EPUB doit changer immediatement, rester comprise dans la plage 12 a 24 px du design system et etre restauree entre les sessions. Les futurs readers ne doivent pas recevoir un controle typographique s'ils ne prennent pas en charge le reflow du texte.

La table SQLite `application_preferences` existe depuis la migration v1, mais aucun port ne l'expose encore. Le contrat `Reader` annonce la personnalisation de police par un booleen sans fournir l'operation correspondante.

## Decision

- `ReaderFontSize` valide uniquement les entiers de 12 a 24, avec 17 par defaut et un pas de 1.
- `Reader` expose `fontCustomization` comme une capacite optionnelle liee statiquement a `capabilities.fontCustomization`. L'adaptateur EPUB l'implemente; un reader qui declare la capacite absente ne peut pas exposer l'operation.
- Le bridge EPUB convertit la taille validee en pixels puis appelle `rendition.themes.fontSize`. La WebView n'est pas reconstruite et la modification est visible immediatement.
- `ApplicationPreferenceRepository` est un port applicatif implemente par SQLite sur la table existante. La cle globale `reader.epub.font-size` memorise la valeur pour les prochaines sessions sans nouvelle migration.
- Le service de preference valide les donnees relues et serialise les ecritures rapides. La fermeture de session attend sa file d'ecriture avant de fermer SQLite.
- La presentation applique d'abord la taille au Reader, puis demande sa persistance. Une erreur de stockage reste non bloquante et affiche un avertissement type.

## Consequences

Le reglage est global a l'application et commun a tous les EPUB. Une preference absente utilise 17 px; une preference invalide ou inaccessible revient a cette valeur pour la session sans transmettre de donnee non validee au renderer.

Le controle compact moins / valeur / plus est affiche directement dans le chrome existant. La feuille de reglages, l'interligne, les marges et la persistance des themes restent hors de PERS-02. Les readers PDF et images ne declarent pas la personnalisation typographique et ne sont pas recolores ou modifies.
