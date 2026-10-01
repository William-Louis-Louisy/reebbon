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
  useWindowDimensions,
  View,
} from 'react-native';

import {
  createImageSetReader,
  type ImageSetPageProvider,
  type Reader,
  type ReaderProgress,
} from '@/application';
import {
  defaultReadingDirection,
  type Book,
  type ImageReaderPosition,
  type ReadingDirection,
} from '@/domain';
import { readingThemes } from '@/shared/theme';

import {
  ReaderChromeButton,
  ReaderFailure,
  ReaderLoading,
  ReaderScreenChrome,
} from '../reader-screen-chrome';
import { ReaderSettingsSheet } from '../reader-settings-sheet';
import { ImageReadingDirectionControl } from './image-reading-direction-control';
import { ImageSetRenditionBridge } from './image-set-rendition-bridge';
import {
  getAdjacentImageLocationIndex,
  getImageFolio,
  getImageIndexFromOffset,
  getImagePageSpreads,
  getImagePagesPerSpread,
  getImagePagerIndex,
  imagePagerVirtualization,
  type ImagePageSpread,
  isImagePageResident,
} from './image-set-reader-model';
import { ZoomableImagePage } from './zoomable-image-page';

const IMAGE_READING_THEME = 'paper' as const;

export interface ImageSetReaderScreenProps {
  readonly book: Book<'images'>;
  readonly initialPosition?: ImageReaderPosition;
  readonly initialReadingDirection?: ReadingDirection;
  readonly onClose: () => void;
  readonly onProgressChange: (progress: ReaderProgress<'images'>) => void;
  readonly onReadingDirectionChange?: (direction: ReadingDirection) => void;
  readonly pageProvider: ImageSetPageProvider;
}

interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

interface ImagePreloadCenter {
  readonly index: number;
  readonly sessionId: number;
}

export default function ImageSetReaderScreen({
  book,
  initialPosition,
  initialReadingDirection = defaultReadingDirection,
  onClose,
  onProgressChange,
  onReadingDirectionChange,
  pageProvider,
}: ImageSetReaderScreenProps) {
  const [bridge] = useState(() => new ImageSetRenditionBridge(pageProvider));
  const [reader] = useState<Reader<'images'>>(() =>
    createImageSetReader(bridge, initialReadingDirection),
  );
  const listRef = useRef<FlatList<ImagePageSpread>>(null);
  const window = useWindowDimensions();
  const snapshot = useSyncExternalStore(
    bridge.subscribe,
    bridge.getSnapshot,
    bridge.getSnapshot,
  );
  const [completionRatio, setCompletionRatio] = useState(0);
  const [zoomedPageIndex, setZoomedPageIndex] = useState<number | undefined>();
  const preloadCenterRef = useRef<ImagePreloadCenter | undefined>(undefined);
  const [preloadCenter, setPreloadCenter] =
    useState<ImagePreloadCenter>();
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: 0,
    height: 0,
  });
  const currentIndex = snapshot.location?.index;
  const totalPages = snapshot.location?.totalPages;
  const residentCenterIndex =
    preloadCenter?.sessionId === snapshot.sessionId
      ? preloadCenter.index
      : currentIndex;
  const readingDirection =
    snapshot.readingDirection ?? initialReadingDirection;
  const pagesPerSpread = getImagePagesPerSpread(
    window.width,
    window.height,
    reader.capabilities.doublePage,
  );
  const folio = getImageFolio(snapshot.location);

  useEffect(
    () =>
      bridge.attachControls({
        setIndex(index) {
          if (listRef.current === null || viewport.width <= 0) {
            throw new Error('Image pager is not mounted.');
          }
          listRef.current.scrollToIndex({
            animated: true,
            index: getImagePagerIndex(
              index,
              snapshot.location?.totalPages ?? 0,
              readingDirection,
              pagesPerSpread,
            ),
          });
        },
      }),
    [
      bridge,
      pagesPerSpread,
      readingDirection,
      snapshot.location?.totalPages,
      viewport.width,
    ],
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
    if (currentIndex === undefined || totalPages === undefined) {
      return;
    }
    const targetIndex = getAdjacentImageLocationIndex(
      currentIndex,
      totalPages,
      pagesPerSpread,
      offset,
    );
    if (targetIndex !== undefined) {
      void reader.goTo({ kind: 'images', index: targetIndex });
    }
  };

  const selectReadingDirection = (direction: ReadingDirection) => {
    const customization = reader.readingDirectionCustomization;
    if (customization === undefined || direction === readingDirection) {
      return;
    }
    void customization.setReadingDirection(direction).then((updated) => {
      if (updated.ok) {
        setZoomedPageIndex(undefined);
        onReadingDirectionChange?.(direction);
      }
    });
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
    const index = getIndexFromScrollEvent(event);
    if (index !== undefined) {
      updatePreloadCenter(index);
      bridge.reportLocation(index);
    }
  };

  const updatePreloadWindow = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = getIndexFromScrollEvent(event);
    if (index !== undefined) {
      updatePreloadCenter(index);
    }
  };

  const getIndexFromScrollEvent = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ): number | undefined =>
    totalPages === undefined
      ? undefined
      : getImageIndexFromOffset(
          event.nativeEvent.contentOffset.x,
          viewport.width,
          totalPages,
          readingDirection,
          pagesPerSpread,
        );

  const updatePreloadCenter = (index: number) => {
    const current = preloadCenterRef.current;
    if (current?.sessionId === snapshot.sessionId && current.index === index) {
      return;
    }
    const next = { index, sessionId: snapshot.sessionId };
    preloadCenterRef.current = next;
    setPreloadCenter(next);
  };

  const isReady =
    snapshot.status === 'ready' &&
    snapshot.pages !== undefined &&
    currentIndex !== undefined &&
    residentCenterIndex !== undefined &&
    totalPages !== undefined;
  const previousIndex =
    isReady
      ? getAdjacentImageLocationIndex(
          currentIndex,
          totalPages,
          pagesPerSpread,
          -1,
        )
      : undefined;
  const nextIndex =
    isReady
      ? getAdjacentImageLocationIndex(
          currentIndex,
          totalPages,
          pagesPerSpread,
          1,
        )
      : undefined;
  const spreads =
    isReady
      ? getImagePageSpreads(
          snapshot.pages,
          pagesPerSpread,
          readingDirection,
        )
      : [];

  return (
    <>
      <ReaderScreenChrome
        bookTitle={book.title}
        completionRatio={completionRatio}
        folio={folio}
        headerActions={
          reader.readingDirectionCustomization === undefined ? undefined : (
            <ReaderChromeButton
              color={readingThemes[IMAGE_READING_THEME].text}
              label="Réglages de lecture"
              onPress={() => setIsSettingsVisible(true)}
              shortLabel="Sens"
            />
          )
        }
        isNextDisabled={nextIndex === undefined}
        isPreviousDisabled={previousIndex === undefined}
        navigationDirection={readingDirection}
        onClose={close}
        onNext={() => navigate(1)}
        onPrevious={() => navigate(-1)}
        themeName={IMAGE_READING_THEME}>
        <View onLayout={updateViewport} style={styles.readerSurface}>
        {isReady && viewport.width > 0 && viewport.height > 0 ? (
          <FlatList
            key={`${snapshot.sessionId}:${readingDirection}:${pagesPerSpread}:${viewport.width}`}
            ref={listRef}
            data={spreads}
            decelerationRate="fast"
            disableIntervalMomentum
            extraData={residentCenterIndex}
            getItemLayout={(_data, index) => ({
              index,
              length: viewport.width,
              offset: viewport.width * index,
            })}
            horizontal
            initialNumToRender={imagePagerVirtualization.initialNumToRender}
            initialScrollIndex={getImagePagerIndex(
              currentIndex,
              totalPages,
              readingDirection,
              pagesPerSpread,
            )}
            keyExtractor={(spread) => String(spread.canonicalStartIndex)}
            maxToRenderPerBatch={
              imagePagerVirtualization.maxToRenderPerBatch
            }
            onMomentumScrollEnd={reportScrollLocation}
            onScroll={updatePreloadWindow}
            onScrollToIndexFailed={({ index }) => {
              listRef.current?.scrollToOffset({
                animated: false,
                offset: index * viewport.width,
              });
            }}
            pagingEnabled
            removeClippedSubviews={false}
            renderItem={({ item: spread }) => (
              <View
                style={[
                  styles.spread,
                  { width: viewport.width, height: viewport.height },
                  readingDirection === 'right-to-left'
                    ? styles.rightAlignedSpread
                    : styles.leftAlignedSpread,
                ]}>
                {spread.pages.map((page) => (
                  <View
                    key={page.uri}
                    style={[
                      styles.page,
                      {
                        width: viewport.width / pagesPerSpread,
                        height: viewport.height,
                      },
                    ]}>
                    {isImagePageResident(
                      page,
                      residentCenterIndex,
                      totalPages,
                      pagesPerSpread,
                    ) ? (
                      <ZoomableImagePage
                        onRenderFailure={() =>
                          bridge.reportFailure({ kind: 'rendering-failure' })
                        }
                        onZoomStateChange={(zoomed) => {
                          setZoomedPageIndex((activeIndex) =>
                            zoomed
                              ? page.index
                              : activeIndex === page.index
                                ? undefined
                                : activeIndex,
                          );
                        }}
                        page={page}
                        totalPages={totalPages}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            scrollEnabled={zoomedPageIndex === undefined}
            scrollEventThrottle={
              imagePagerVirtualization.scrollEventThrottle
            }
            showsHorizontalScrollIndicator={false}
            updateCellsBatchingPeriod={
              imagePagerVirtualization.updateCellsBatchingPeriod
            }
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
      <ReaderSettingsSheet
        capabilities={reader.capabilities}
        onClose={() => setIsSettingsVisible(false)}
        readingDirectionControl={
          reader.readingDirectionCustomization === undefined ? undefined : (
            <ImageReadingDirectionControl
              direction={readingDirection}
              disabled={snapshot.status !== 'ready'}
              onSelect={selectReadingDirection}
              themeName={IMAGE_READING_THEME}
            />
          )
        }
        themeName={IMAGE_READING_THEME}
        visible={isSettingsVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  readerSurface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: readingThemes.paper.background,
  },
  spread: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: readingThemes.paper.background,
  },
  leftAlignedSpread: {
    justifyContent: 'flex-start',
  },
  rightAlignedSpread: {
    justifyContent: 'flex-end',
  },
  page: {
    overflow: 'hidden',
    backgroundColor: readingThemes.paper.background,
  },
});
