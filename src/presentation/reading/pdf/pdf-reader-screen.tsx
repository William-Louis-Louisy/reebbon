import Pdf, { type PdfRef } from 'react-native-pdf';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { createPdfReader, type Reader, type ReaderProgress } from '@/application';
import type { Book, PdfReaderPosition } from '@/domain';
import { readingThemes } from '@/shared/theme';

import {
  ReaderFailure,
  ReaderLoading,
  ReaderScreenChrome,
} from '../reader-screen-chrome';
import {
  getPdfFolio,
  parsePdfLocation,
  pdfZoomConfiguration,
} from './pdf-reader-model';
import { PdfRenditionBridge } from './pdf-rendition-bridge';

const PDF_READING_THEME = 'paper' as const;

export interface PdfReaderScreenProps {
  readonly book: Book<'pdf'>;
  readonly initialPosition?: PdfReaderPosition;
  readonly onClose: () => void;
  readonly onProgressChange: (progress: ReaderProgress<'pdf'>) => void;
}

export default function PdfReaderScreen({
  book,
  initialPosition,
  onClose,
  onProgressChange,
}: PdfReaderScreenProps) {
  const [bridge] = useState(() => new PdfRenditionBridge());
  const [reader] = useState<Reader<'pdf'>>(() => createPdfReader(bridge));
  const pdfRef = useRef<PdfRef>(null);
  const snapshot = useSyncExternalStore(
    bridge.subscribe,
    bridge.getSnapshot,
    bridge.getSnapshot,
  );
  const [completionRatio, setCompletionRatio] = useState(0);
  const folio = getPdfFolio(snapshot.location);

  useEffect(
    () =>
      bridge.attachControls({
        setPage(page) {
          const rendition = pdfRef.current;
          if (rendition === null) {
            throw new Error('PDF rendition is not mounted.');
          }
          rendition.setPage(page);
        },
      }),
    [bridge],
  );

  useEffect(() => {
    void reader.open(book, initialPosition).then((opened) => {
      if (!opened.ok && bridge.getSnapshot().status !== 'failure') {
        bridge.reportFailure(
          opened.error.kind === 'content-access-failure'
            ? opened.error
            : { kind: 'rendering-failure' },
        );
      }
    });
    return () => {
      void reader.close();
    };
  }, [book, bridge, initialPosition, reader]);

  const updateProgress = () => {
    void reader.getProgress().then((progress) => {
      if (progress.ok) {
        setCompletionRatio(progress.value.completionRatio);
        onProgressChange(progress.value);
      }
    });
  };

  const reportLocation = (
    page: unknown,
    totalPages: unknown,
    ready: boolean,
  ) => {
    const parsed = parsePdfLocation(page, totalPages);
    if (!parsed.ok) {
      bridge.reportFailure({ kind: 'rendering-failure' });
      return;
    }
    if (ready) {
      bridge.reportReady(parsed.value);
    } else {
      bridge.reportLocation(parsed.value);
    }
    void Promise.resolve().then(updateProgress);
  };

  const navigate = (offset: -1 | 1) => {
    const location = bridge.getSnapshot().location;
    if (location === undefined) {
      return;
    }
    void reader.goTo({ kind: 'pdf', page: location.page + offset });
  };

  const close = () => {
    void reader.close().finally(onClose);
  };

  const retry = () => {
    setCompletionRatio(0);
    void reader.close().then(() => reader.open(book, initialPosition));
  };

  const isReady = snapshot.status === 'ready';
  return (
    <ReaderScreenChrome
      bookTitle={book.title}
      completionRatio={completionRatio}
      folio={folio}
      isNextDisabled={
        !isReady ||
        snapshot.location === undefined ||
        snapshot.location.page >= snapshot.location.totalPages
      }
      isPreviousDisabled={
        !isReady ||
        snapshot.location === undefined ||
        snapshot.location.page <= 1
      }
      onClose={close}
      onNext={() => navigate(1)}
      onPrevious={() => navigate(-1)}
      themeName={PDF_READING_THEME}>
      {snapshot.sourceUri === undefined ? null : (
        <Pdf
          key={snapshot.sessionId}
          ref={pdfRef}
          enableAnnotationRendering
          enableAntialiasing
          enableDoubleTapZoom={pdfZoomConfiguration.doubleTapEnabled}
          enablePaging
          enableTextSelection={false}
          fitPolicy={pdfZoomConfiguration.fitPolicy}
          horizontal={false}
          maxScale={pdfZoomConfiguration.maximumScale}
          minScale={pdfZoomConfiguration.minimumScale}
          onError={() =>
            bridge.reportFailure({ kind: 'rendering-failure' })
          }
          onLoadComplete={(totalPages) =>
            reportLocation(snapshot.initialPage ?? 1, totalPages, true)
          }
          onPageChanged={(page, totalPages) =>
            reportLocation(page, totalPages, false)
          }
          onPressLink={() => undefined}
          page={snapshot.initialPage ?? 1}
          renderActivityIndicator={() => <View />}
          scale={pdfZoomConfiguration.initialScale}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          source={{ uri: snapshot.sourceUri, cache: false }}
          spacing={0}
          style={styles.pdf}
          trustAllCerts={false}
        />
      )}
      {snapshot.status === 'failure' ? (
        <ReaderFailure
          message="Le fichier est peut-être endommagé ou incompatible avec le moteur de lecture."
          onClose={close}
          onRetry={retry}
          themeName={PDF_READING_THEME}
          title="Ce PDF ne peut pas être affiché."
        />
      ) : null}
      {snapshot.status === 'opening' ? (
        <ReaderLoading
          label="Ouverture du PDF…"
          themeName={PDF_READING_THEME}
        />
      ) : null}
    </ReaderScreenChrome>
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: readingThemes.paper.background,
  },
});
