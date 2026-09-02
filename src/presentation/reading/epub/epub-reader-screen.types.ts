import type { ReaderProps as CoreReaderProps } from '@epubjs-react-native/core';

import type { EpubRenditionError } from '@/application';
import type { Book, Result } from '@/domain';

export interface EpubReaderScreenProps {
  readonly book: Book<'epub'>;
  readonly clearRendererCache: () => Promise<Result<void, EpubRenditionError>>;
  readonly fileSystem: CoreReaderProps['fileSystem'];
  readonly loadReadingFont: () => Promise<Result<string, EpubRenditionError>>;
  readonly onClose: () => void;
  readonly prepareSource: (
    sourceUri: string,
  ) => Promise<Result<string, EpubRenditionError>>;
}
