import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';

import {
  createImageSetReader,
  type ImageSetPage,
  type ImageSetPageProvider,
  type Reader,
  type ReaderProgress,
} from '@/application';
import type { Book, ImageReaderPosition } from '@/domain';
import { readingThemes } from '@/shared/theme';

import {
  ReaderFailure,
  ReaderLoading,
  ReaderScreenChrome,
} from '../reader-screen-chrome';
import { ImageSetRenditionBridge } from './image-set-rendition-bridge';
import {
  getImageFolio,
  getImageIndexFromOffset,
  imagePagerVirtualization,
  isImagePageResident,
} from './image-set-reader-model';
import { ZoomableImagePage } from './zoomable-image-page';

const IMAGE_READING_THEME = 'paper' as const;

export interface ImageSetReaderScreenProps {
  readonly book: Book<'images'>;
  readonly initialPosition?: ImageReaderPosition;
  readonly onClose: () => void;
  readonly onProgressChange: (progress: ReaderProgress<'images'>) => void;
  readonly pageProvider: ImageSetPageProvider;
}

interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export default function ImageSetReaderScreen({
  book,
  initialPosition,
  onClose,
  onProgressChange,
  pageProvider,
}: ImageSetReaderScreenProps) {
  const [bridge] = useState(() => new ImageSetRenditionBridge(pageProvider));
  const [reader] = useState<Reader<'images'>>(() =>
    createImageSetReader(bridge),
  );
  const listRef = useRef<FlatList<ImageSetPage>>(null);
  const snapshot = useSyncExternalStore(
    bridge.subscribe,
    bridge.getSnapshot,
    bridge.getSnapshot,
  );
  const [completionRatio, setCompletionRatio] = useState(0);
  const [zoomedPageIndex, setZoomedPageIndex] = useState<number | undefined>();
  const [viewport, setViewport] = useState<ViewportSize>({
    width: 0,
    height: 0,
  });
  const currentIndex = snapshot.location?.index;
  const totalPages = snapshot.location?.totalPages;
  const folio = getImageFolio(snapshot.location);

  useEffect(
    () =>
      bridge.attachControls({
        setIndex(index) {
          if (listRef.current === null || viewport.width <= 0) {
            throw new Error('Image pager is not mounted.');
          }
          listRef.current.scrollToIndex({ animated: true, index });
        },
      }),
    [bridge, viewport.width],
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

  const updateProgress = useEffectEvent(() => {
    void reader.getProgress().then((progress) => {
      if (progress.ok) {
        setCompletionRatio(progress.value.completionRatio);
        onProgressChange(progress.value);
      }
    });
  });

  useEffect(() => {
    if (snapshot.status === 'ready') {
      void Promise.resolve().then(updateProgress);
    }
  }, [currentIndex, snapshot.status]);

  const navigate = (offset: -1 | 1) => {
    if (currentIndex === undefined) {
      return;
    }
    void reader.goTo({ kind: 'images', index: currentIndex + offset });
  };

  const close = () => {
    void reader.close().finally(onClose);
  };

  const retry = () => {
    setCompletionRatio(0);
    void reader.close().then(() => reader.open(book, initialPosition));
  };

  const updateViewport = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport({ width, height });
    }
  };

  const reportScrollLocation = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (totalPages === undefined) {
      return;
    }
    const index = getImageIndexFromOffset(
      event.nativeEvent.contentOffset.x,
      viewport.width,
      totalPages,
    );
    if (index !== undefined) {
      bridge.reportLocation(index);
    }
  };

  const isReady =
    snapshot.status === 'ready' &&
    snapshot.pages !== undefined &&
    currentIndex !== undefined &&
    totalPages !== undefined;

  return (
    <ReaderScreenChrome
      bookTitle={book.title}
      completionRatio={completionRatio}
      folio={folio}
      isNextDisabled={!isReady || currentIndex >= totalPages - 1}
      isPreviousDisabled={!isReady || currentIndex <= 0}
      onClose={close}
      onNext={() => navigate(1)}
      onPrevious={() => navigate(-1)}
      themeName={IMAGE_READING_THEME}>
      <View onLayout={updateViewport} style={styles.readerSurface}>
        {isReady && viewport.width > 0 && viewport.height > 0 ? (
          <FlatList
            key={snapshot.sessionId}
            ref={listRef}
            data={snapshot.pages}
            decelerationRate="fast"
            disableIntervalMomentum
            extraData={currentIndex}
            getItemLayout={(_data, index) => ({
              index,
              length: viewport.width,
              offset: viewport.width * index,
            })}
            horizontal
            initialNumToRender={imagePagerVirtualization.initialNumToRender}
            initialScrollIndex={currentIndex}
            keyExtractor={(page) => page.uri}
            maxToRenderPerBatch={
              imagePagerVirtualization.maxToRenderPerBatch
            }
            onMomentumScrollEnd={reportScrollLocation}
            onScrollToIndexFailed={({ index }) => {
              listRef.current?.scrollToOffset({
                animated: false,
                offset: index * viewport.width,
              });
            }}
            pagingEnabled
            removeClippedSubviews={false}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.page,
                  { width: viewport.width, height: viewport.height },
                ]}>
                {isImagePageResident(item, currentIndex, totalPages) ? (
                  <ZoomableImagePage
                    onRenderFailure={() =>
                      bridge.reportFailure({ kind: 'rendering-failure' })
                    }
                    onZoomStateChange={(zoomed) => {
                      setZoomedPageIndex(zoomed ? item.index : undefined);
                    }}
                    page={item}
                    totalPages={totalPages}
                  />
                ) : null}
              </View>
            )}
            scrollEnabled={zoomedPageIndex !== currentIndex}
            showsHorizontalScrollIndicator={false}
            windowSize={imagePagerVirtualization.windowSize}
          />
        ) : null}
      </View>
      {snapshot.status === 'failure' ? (
        <ReaderFailure
          message="Les pages locales sont peut-être manquantes, endommagées ou illisibles."
          onClose={close}
          onRetry={retry}
          themeName={IMAGE_READING_THEME}
          title="Cet ouvrage image ne peut pas être affiché."
        />
      ) : null}
      {snapshot.status === 'opening' ? (
        <ReaderLoading
          label="Ouverture de l’ouvrage image…"
          themeName={IMAGE_READING_THEME}
        />
      ) : null}
    </ReaderScreenChrome>
  );
}

const styles = StyleSheet.create({
  readerSurface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: readingThemes.paper.background,
  },
  page: {
    overflow: 'hidden',
    backgroundColor: readingThemes.paper.background,
  },
});
