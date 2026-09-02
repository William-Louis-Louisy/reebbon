import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LibraryBookItem } from '@/application';
import type { BookFormat } from '@/domain';
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
  readonly onPress: () => void;
  readonly width: number;
}

export const BookCard = memo(function BookCard({ item, onPress, width }: BookCardProps) {
  const { book } = item;
  const progress = normalizeProgress(item.progress);
  const percentage = Math.round(progress * 100);
  const author = book.author ?? 'Auteur inconnu';
  const accessibilityLabel = `${book.title}, ${author}, ${percentage} pour cent lu`;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
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
              contentFit="cover"
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
    backgroundImage: designSystemTokens.gradients.coverFallback,
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
