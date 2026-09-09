import { Image, type ImageLoadEventData } from 'expo-image';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ImageSetPage } from '@/application';
import { designSystemTokens } from '@/shared/theme';

import {
  clampImageScale,
  clampImageTranslation,
  getImagePanBounds,
  imageZoomConfiguration,
} from './image-set-reader-model';

const IMAGE_RESET_DURATION_MS = designSystemTokens.motion.quickFeedback;

interface ZoomableImagePageProps {
  readonly onRenderFailure: () => void;
  readonly onZoomStateChange: (zoomed: boolean) => void;
  readonly page: ImageSetPage;
  readonly totalPages: number;
}

export function ZoomableImagePage({
  onRenderFailure,
  onZoomStateChange,
  page,
  totalPages,
}: ZoomableImagePageProps) {
  const scale = useSharedValue<number>(imageZoomConfiguration.minimumScale);
  const startScale = useSharedValue<number>(
    imageZoomConfiguration.minimumScale,
  );
  const translationX = useSharedValue<number>(0);
  const translationY = useSharedValue<number>(0);
  const startTranslationX = useSharedValue<number>(0);
  const startTranslationY = useSharedValue<number>(0);
  const viewportWidth = useSharedValue<number>(0);
  const viewportHeight = useSharedValue<number>(0);
  const imageWidth = useSharedValue<number>(0);
  const imageHeight = useSharedValue<number>(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable UI-thread state. */
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clampImageScale(startScale.value * event.scale);
      const bounds = getImagePanBounds(
        viewportWidth.value,
        viewportHeight.value,
        imageWidth.value,
        imageHeight.value,
        scale.value,
      );
      translationX.value = clampImageTranslation(
        translationX.value,
        bounds.x,
      );
      translationY.value = clampImageTranslation(
        translationY.value,
        bounds.y,
      );
    })
    .onEnd(() => {
      const shouldReset = scale.value <= imageZoomConfiguration.resetThreshold;
      if (shouldReset) {
        const timing = { duration: IMAGE_RESET_DURATION_MS };
        scale.value = withTiming(imageZoomConfiguration.minimumScale, timing);
        translationX.value = withTiming(0, timing);
        translationY.value = withTiming(0, timing);
      }
      scheduleOnRN(onZoomStateChange, !shouldReset);
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, stateManager) => {
      if (scale.value > imageZoomConfiguration.resetThreshold) {
        stateManager.activate();
      } else {
        stateManager.fail();
      }
    })
    .onStart(() => {
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      const bounds = getImagePanBounds(
        viewportWidth.value,
        viewportHeight.value,
        imageWidth.value,
        imageHeight.value,
        scale.value,
      );
      translationX.value = clampImageTranslation(
        startTranslationX.value + event.translationX,
        bounds.x,
      );
      translationY.value = clampImageTranslation(
        startTranslationY.value + event.translationY,
        bounds.y,
      );
    });
  /* eslint-enable react-hooks/immutability */

  const updatePageViewport = (event: LayoutChangeEvent) => {
    viewportWidth.value = event.nativeEvent.layout.width;
    viewportHeight.value = event.nativeEvent.layout.height;
  };

  const captureImageSize = (event: ImageLoadEventData) => {
    imageWidth.value = event.source.width;
    imageHeight.value = event.source.height;
  };

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <View onLayout={updatePageViewport} style={styles.zoomViewport}>
        <Animated.View style={[styles.imageTransform, animatedStyle]}>
          <Image
            accessibilityLabel={`Page ${page.index + 1} sur ${totalPages}`}
            accessible
            allowDownscaling
            cachePolicy="none"
            contentFit="contain"
            onError={onRenderFailure}
            onLoad={captureImageSize}
            recyclingKey={page.uri}
            source={{ uri: page.uri }}
            style={styles.image}
            transition={0}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  zoomViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  imageTransform: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
