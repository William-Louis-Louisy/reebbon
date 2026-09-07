import type { ImportError, ImportFormat } from '@/application';

export interface ImportErrorAlert {
  readonly title: string;
  readonly message: string;
}

export function getImportErrorAlert(error: ImportError): ImportErrorAlert {
  switch (error.kind) {
    case 'unsupported-format':
      return {
        title: 'Format non pris en charge',
        message: 'Ce format n’est pas pris en charge. Sélectionnez un fichier EPUB ou PDF.',
      };
    case 'corrupted-source':
      return {
        title: 'Fichier endommagé',
        message: `Ce fichier ${formatLabel(error.format)} est endommagé ou incomplet et ne peut pas être importé.`,
      };
    case 'permission-or-access-failure':
      return {
        title: 'Fichier inaccessible',
        message: 'Reebbon n’a pas pu lire le fichier sélectionné. Vérifiez son accès puis réessayez.',
      };
    case 'filesystem-failure':
      return error.operation === 'cleanup'
        ? {
            title: 'Nettoyage incomplet',
            message: 'L’import a échoué et le nettoyage local n’a pas pu se terminer. Redémarrez Reebbon avant de réessayer.',
          }
        : {
            title: 'Copie impossible',
            message: 'Le fichier n’a pas pu être copié dans le stockage local.',
          };
    case 'metadata-extraction-failure':
      return {
        title: `Fichier ${formatLabel(error.format)} illisible`,
        message: `Les informations de ce fichier ${formatLabel(error.format)} sont absentes ou illisibles.`,
      };
    case 'persistence-failure':
      return error.operation === 'rollback'
        ? {
            title: 'Nettoyage incomplet',
            message: 'L’import a échoué et son annulation n’a pas pu se terminer. Redémarrez Reebbon avant de réessayer.',
          }
        : {
            title: 'Enregistrement impossible',
            message: 'L’ouvrage n’a pas pu être ajouté à la bibliothèque.',
          };
  }
}

function formatLabel(format: ImportFormat | undefined): string {
  switch (format) {
    case 'epub':
      return 'EPUB';
    case 'pdf':
      return 'PDF';
    case 'image-directory':
      return 'd’images';
    case 'cbz':
      return 'CBZ';
    case undefined:
      return 'sélectionné';
  }
}
