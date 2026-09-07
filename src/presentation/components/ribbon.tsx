import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { designSystemTokens } from '@/shared/theme';

import { getRibbonHeight } from './ribbon-metrics';

export interface RibbonProps {
  readonly animateUnfurl?: boolean;
  readonly progress: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function Ribbon({ animateUnfurl = false, progress, style }: RibbonProps) {
  return animateUnfurl ? (
    <AnimatedRibbon progress={progress} style={style} />
  ) : (
    <RibbonShape progress={progress} style={style} />
  );
}

interface RibbonShapeProps {
  readonly progress: number;
  readonly style?: StyleProp<ViewStyle>;
}

function RibbonShape({ progress, style }: RibbonShapeProps) {
  const { colors, components } = designSystemTokens;
  const { markerBottomOffset, markerHeight, markerOpacity, notchDepth, width } =
    components.ribbon;
  const height = getRibbonHeight(progress);
  const notchTop = height - notchDepth;
  const points = `0,0 ${width},0 ${width},${height} ${width / 2},${notchTop} 0,${height}`;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width, height }, style]}>
      <Svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
        <Polygon fill={colors.oxblood} points={points} />
        <Rect
          fill={colors.paper}
          height={markerHeight}
          opacity={markerOpacity}
          width={width}
          x={0}
          y={height - markerBottomOffset}
        />
      </Svg>
    </View>
  );
}

function AnimatedRibbon({ progress, style }: RibbonShapeProps) {
  const [unfurlProgress] = useState(
    () => new Animated.Value(0),
  );
  const { components, motion } = designSystemTokens;
  const { width } = components.ribbon;
  const height = getRibbonHeight(progress);

  useEffect(() => {
    unfurlProgress.stopAnimation();
    unfurlProgress.setValue(0);

    const animation = Animated.timing(unfurlProgress, {
      duration: motion.ribbonUnfurl,
      easing: Easing.bezier(...motion.pageEasingBezier),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [
    motion.pageEasingBezier,
    motion.ribbonUnfurl,
    unfurlProgress,
  ]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        {
          width,
          height,
          transform: [{ scaleY: unfurlProgress }],
          transformOrigin: 'top center',
        },
        style,
      ]}>
      <RibbonShape progress={progress} />
    </Animated.View>
  );
}
