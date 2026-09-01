import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { designSystemTokens } from '@/shared/theme';

import { getRibbonHeight } from './ribbon-metrics';

export interface RibbonProps {
  readonly progress: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function Ribbon({ progress, style }: RibbonProps) {
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
