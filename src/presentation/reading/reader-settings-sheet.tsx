import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReaderCapabilities } from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import { AppText } from '../components/app-text';
import {
  getReaderSettingsSections,
  type ReaderSettingsSection,
} from './reader-settings-model';

interface ReaderSettingsSheetProps {
  readonly capabilities: ReaderCapabilities;
  readonly fontCustomizationControl?: ReactNode;
  readonly layoutCustomizationControl?: ReactNode;
  readonly onClose: () => void;
  readonly readingThemeControl?: ReactNode;
  readonly themeName: ReadingThemeName;
  readonly visible: boolean;
}

const sheetTokens = designSystemTokens.components.readerSettingsSheet;
const uiEasing = Easing.bezier(
  ...designSystemTokens.motion.uiEasingBezier,
);

export function ReaderSettingsSheet({
  capabilities,
  fontCustomizationControl,
  layoutCustomizationControl,
  onClose,
  readingThemeControl,
  themeName,
  visible,
}: ReaderSettingsSheetProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const theme = readingThemes[themeName];
  const sections = getReaderSettingsSections(capabilities);

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    const animation = Animated.timing(progress, {
      duration: designSystemTokens.motion.uiTransition,
      easing: uiEasing,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [progress, visible]);

  const close = () => {
    progress.stopAnimation();
    Animated.timing(progress, {
      duration: designSystemTokens.motion.uiTransition,
      easing: uiEasing,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, sheetTokens.backdropOpacity],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetTokens.entranceOffset, 0],
  });

  return (
    <Modal
      animationType="none"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modal}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              backgroundColor: designSystemTokens.colors.ink,
              opacity: backdropOpacity,
            },
          ]}
        />
        <Pressable
          accessibilityLabel="Fermer les réglages de lecture"
          accessibilityRole="button"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: progress,
              transform: [{ translateY }],
            },
          ]}>
          <SafeAreaView edges={['bottom']}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.handle, { backgroundColor: theme.border }]}
            />
            <View style={styles.header}>
              <View style={styles.heading}>
                <AppText
                  style={[styles.mutedText, { color: theme.text }]}
                  variant="eyebrow">
                  Lecture
                </AppText>
                <AppText style={{ color: theme.text }} variant="screenTitle">
                  Réglages
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Fermer les réglages de lecture"
                accessibilityRole="button"
                hitSlop={designSystemTokens.spacing[2]}
                onPress={close}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}>
                <AppText style={{ color: theme.text }} variant="button">
                  Fermer
                </AppText>
              </Pressable>
            </View>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}>
              {sections.map((section) => (
                <SettingsSection
                  key={section}
                  section={section}
                  themeName={themeName}>
                  {controlForSection(section, {
                    fontCustomizationControl,
                    layoutCustomizationControl,
                    readingThemeControl,
                  })}
                </SettingsSection>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface SettingsSectionProps {
  readonly children: ReactNode;
  readonly section: ReaderSettingsSection;
  readonly themeName: ReadingThemeName;
}

function SettingsSection({
  children,
  section,
  themeName,
}: SettingsSectionProps) {
  if (children === undefined) {
    return null;
  }

  const theme = readingThemes[themeName];
  const isLayout = section === 'layout-customization';
  return (
    <View
      style={[
        styles.row,
        isLayout && styles.layoutRow,
        { borderBottomColor: theme.border },
      ]}>
      <AppText style={{ color: theme.text }} variant="label">
        {labelForSection(section)}
      </AppText>
      {children}
    </View>
  );
}

interface SettingsControls {
  readonly fontCustomizationControl?: ReactNode;
  readonly layoutCustomizationControl?: ReactNode;
  readonly readingThemeControl?: ReactNode;
}

function controlForSection(
  section: ReaderSettingsSection,
  controls: SettingsControls,
): ReactNode {
  switch (section) {
    case 'reading-theme':
      return controls.readingThemeControl;
    case 'font-customization':
      return controls.fontCustomizationControl;
    case 'layout-customization':
      return controls.layoutCustomizationControl;
  }
}

function labelForSection(section: ReaderSettingsSection): string {
  switch (section) {
    case 'reading-theme':
      return 'Thème de lecture';
    case 'font-customization':
      return 'Taille de police';
    case 'layout-customization':
      return 'Mise en page';
  }
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: sheetTokens.maxWidth,
    maxHeight: sheetTokens.maxHeight,
    alignSelf: 'center',
    paddingHorizontal: designSystemTokens.spacing[5],
    paddingTop: designSystemTokens.spacing[3],
    borderTopLeftRadius: designSystemTokens.radii.lg,
    borderTopRightRadius: designSystemTokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    ...designSystemTokens.shadows.bookCover,
  },
  handle: {
    width: sheetTokens.handleWidth,
    height: sheetTokens.handleHeight,
    alignSelf: 'center',
    marginBottom: designSystemTokens.spacing[4],
    borderRadius: designSystemTokens.radii.pill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designSystemTokens.spacing[4],
    marginBottom: designSystemTokens.spacing[2],
  },
  heading: {
    flex: 1,
    gap: designSystemTokens.spacing[1],
  },
  closeButton: {
    minHeight: sheetTokens.touchTargetSize,
    paddingHorizontal: designSystemTokens.spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  content: {
    paddingBottom: designSystemTokens.spacing[4],
  },
  row: {
    minHeight: sheetTokens.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designSystemTokens.spacing[3],
    paddingVertical: designSystemTokens.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  layoutRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  mutedText: {
    opacity: designSystemTokens.components.readerChrome.mutedOpacity,
  },
});
