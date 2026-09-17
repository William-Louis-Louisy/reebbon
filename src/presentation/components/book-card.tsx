import { Image, type ImageLoadEventData } from 'expo-image';
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LibraryBookItem } from '@/application';
import type { Book, BookFormat } from '@/domain';
import { designSystemTokens } from '@/shared/theme';

import { AppText } from './app-text';
import { Ribbon } from './ribbon';
import { normalizeProgress } from './ribbon-metrics';

const formatLabels: Record<BookFormat, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  images: 'IMAGES',
};

export interface BookCardProps {
  readonly item: LibraryBookItem;
  readonly onBookPress: (book: Book) => void;
  readonly onCoverEvent?: (event: LibraryCoverEvent) => void;
  readonly width: number;
}

export type LibraryCoverEvent =
  | { readonly kind: 'mounted'; readonly bookId: string }
  | { readonly kind: 'load-start'; readonly bookId: string }
  | {
      readonly kind: 'load-complete';
      readonly bookId: string;
      readonly cacheType: ImageLoadEventData['cacheType'];
      readonly width: number;
      readonly height: number;
    }
  | { readonly kind: 'load-failed'; readonly bookId: string }
  | { readonly kind: 'unmounted'; readonly bookId: string };

export const BookCard = memo(function BookCard({
  item,
  onBookPress,
  onCoverEvent,
  width,
}: BookCardProps) {
  const { book } = item;
  const progress = normalizeProgress(item.progress);
  const percentage = Math.round(progress * 100);
  const author = book.author ?? 'Auteur inconnu';
  const accessibilityLabel = `${book.title}, ${author}, ${percentage} pour cent lu`;

  useEffect(() => {
    if (book.coverUri === undefined) {
      return;
    }
    onCoverEvent?.({ kind: 'mounted', bookId: book.id });
    return () => onCoverEvent?.({ kind: 'unmounted', bookId: book.id });
  }, [book.coverUri, book.id, onCoverEvent]);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => onBookPress(book)}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View style={styles.coverShadow}>
        <View style={styles.cover}>
          {book.coverUri === undefined ? (
            <View style={styles.fallbackCover}>
              <AppText numberOfLines={4} style={styles.coverTitle} variant="label">
                {book.title}
              </AppText>
            </View>
          ) : (
            <Image
              accessibilityIgnoresInvertColors
              allowDownscaling
              cachePolicy="disk"
              contentFit="cover"
              decodeFormat="rgb"
              onError={() =>
                onCoverEvent?.({ kind: 'load-failed', bookId: book.id })
              }
              onLoad={(event) =>
                onCoverEvent?.({
                  kind: 'load-complete',
                  bookId: book.id,
                  cacheType: event.cacheType,
                  width: event.source.width,
                  height: event.source.height,
                })
              }
              onLoadStart={() =>
                onCoverEvent?.({ kind: 'load-start', bookId: book.id })
              }
              recyclingKey={book.id}
              source={book.coverUri}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Ribbon progress={progress} style={styles.ribbon} />
        </View>
      </View>

      <View style={styles.metadata}>
        <AppText numberOfLines={2} style={styles.title} variant="label">
          {book.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {author}
        </AppText>
        <AppText numberOfLines={1} tone="accent" variant="eyebrow">
          {formatLabels[book.format]} · {percentage}%
        </AppText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  coverShadow: {
    ...designSystemTokens.shadows.bookCover,
    aspectRatio: designSystemTokens.layout.libraryGrid.coverAspectRatio,
    borderRadius: designSystemTokens.radii.md,
    backgroundColor: designSystemTokens.colors.ink,
  },
  cover: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: designSystemTokens.radii.md,
    backgroundColor: designSystemTokens.colors.ink,
  },
  fallbackCover: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: designSystemTokens.spacing[3],
  },
  coverTitle: {
    color: designSystemTokens.colors.paper,
    fontFamily: designSystemTokens.typography.runtimeFamilies.displaySemiBold,
  },
  ribbon: {
    position: 'absolute',
    right: designSystemTokens.components.ribbon.coverInset,
    top: 0,
  },
  metadata: {
    marginTop: designSystemTokens.spacing[3],
    gap: designSystemTokens.spacing[1],
  },
  title: {
    minHeight: designSystemTokens.typography.roles.label.lineHeight * 2,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
});
