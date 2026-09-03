import type { ReaderProps as CoreReaderProps } from '@epubjs-react-native/core';

import type { EpubRenditionError, ReaderProgress } from '@/application';
import type { Book, EpubReaderPosition, Result } from '@/domain';

export interface EpubReaderScreenProps {
  readonly book: Book<'epub'>;
  readonly clearRendererCache: () => Promise<Result<void, EpubRenditionError>>;
  readonly fileSystem: CoreReaderProps['fileSystem'];
  readonly initialPosition?: EpubReaderPosition;
  readonly loadReadingFont: () => Promise<Result<string, EpubRenditionError>>;
  readonly onClose: () => void;
  readonly onProgressChange: (progress: ReaderProgress<'epub'>) => void;
  readonly prepareSource: (
    sourceUri: string,
  ) => Promise<Result<string, EpubRenditionError>>;
}
