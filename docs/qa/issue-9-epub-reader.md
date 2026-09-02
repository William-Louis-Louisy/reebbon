# Validation RDR-EPUB-01

## Fixtures reproductibles

Executer `npm run reader:fixtures` pour produire dans `.expo/reader-fixtures/` :

- `large-5001.epub`, EPUB 3 valide avec 5 001 elements ordonnes dans le spine;
- `malformed.epub`, archive ZIP volontairement tronquee.

Le repertoire `.expo` reste local et n'est pas versionne. Les tests Node reconstruisent les memes donnees en memoire, verifient les 5 001 pages et classent l'archive tronquee en `corrupted-source`.

## Protocole appareil

1. Generer les fixtures, importer `large-5001.epub`, puis ouvrir le livre.
2. Mesurer du toucher sur la couverture a l'affichage de la premiere page. Repeter cinq fois apres fermeture complete et consigner mediane, appareil et build.
3. Verifier dix changements de page vers l'avant puis vers l'arriere, sans page blanche durable ni blocage du geste.
4. Aller vers la fin du livre et verifier que le folio reste borne au nombre de locations calcule.
5. Importer `malformed.epub` ou remplacer une copie de test deja importee, puis verifier un message explicite sans crash et le fonctionnement de Fermer/Reessayer.
6. Refaire sur iOS et Android avec le reseau desactive.

La cible produit est une premiere ouverture inferieure a une seconde pour un EPUB standard. Une mesure absente n'est pas consideree comme une validation de cette cible.
