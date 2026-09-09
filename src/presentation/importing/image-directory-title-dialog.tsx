import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeBookMetadataText } from '@/application';
import { designSystemTokens } from '@/shared/theme';

import { AppText } from '../components/app-text';
import { useAppTheme } from '../hooks/use-app-theme';

const titleMaximumLength = 500;
const sheetTokens = designSystemTokens.components.readerSettingsSheet;

export interface ImageDirectoryTitleDialogProps {
  readonly defaultTitle: string;
  readonly onCancel: () => void;
  readonly onConfirm: (title: string) => void;
}

export function ImageDirectoryTitleDialog({
  defaultTitle,
  onCancel,
  onConfirm,
}: ImageDirectoryTitleDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const theme = useAppTheme();
  const normalizedTitle = normalizeBookMetadataText(title);

  return (
    <Modal
      animationType="none"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modal}>
        <View
          pointerEvents="none"
          style={[
            styles.backdrop,
            { backgroundColor: designSystemTokens.colors.ink },
          ]}
        />
        <Pressable
          accessibilityLabel="Annuler l’import du dossier"
          accessibilityRole="button"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.content}>
              <AppText tone="accent" variant="eyebrow">
                Dossier d’images
              </AppText>
              <AppText variant="screenTitle">Titre de l’ouvrage</AppText>
              <AppText tone="muted">
                Le nom du dossier est proposé par défaut. Vous pouvez le modifier avant
                l’import.
              </AppText>
              <TextInput
                accessibilityLabel="Titre de l’ouvrage image"
                autoFocus
                maxLength={titleMaximumLength}
                onChangeText={setTitle}
                onSubmitEditing={() => {
                  if (normalizedTitle !== undefined) {
                    onConfirm(normalizedTitle);
                  }
                }}
                placeholder="Titre de l’ouvrage"
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                selectTextOnFocus
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={title}
              />
              <View style={styles.actions}>
                <DialogAction label="Annuler" onPress={onCancel} variant="secondary" />
                <DialogAction
                  disabled={normalizedTitle === undefined}
                  label="Importer"
                  onPress={() => {
                    if (normalizedTitle !== undefined) {
                      onConfirm(normalizedTitle);
                    }
                  }}
                  variant="primary"
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface DialogActionProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant: 'primary' | 'secondary';
}

function DialogAction({
  disabled = false,
  label,
  onPress,
  variant,
}: DialogActionProps) {
  const theme = useAppTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? theme.text : 'transparent',
          borderColor: theme.text,
        },
        !primary && styles.secondaryAction,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <AppText style={{ color: primary ? theme.background : theme.text }} variant="button">
        {label}
      </AppText>
    </Pressable>
  );
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
    opacity: sheetTokens.backdropOpacity,
  },
  sheet: {
    width: '100%',
    maxWidth: sheetTokens.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: designSystemTokens.spacing[5],
    paddingTop: designSystemTokens.spacing[5],
    borderTopLeftRadius: designSystemTokens.radii.lg,
    borderTopRightRadius: designSystemTokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    ...designSystemTokens.shadows.bookCover,
  },
  content: {
    gap: designSystemTokens.spacing[3],
    paddingBottom: designSystemTokens.spacing[4],
  },
  input: {
    minHeight: sheetTokens.touchTargetSize,
    paddingHorizontal: designSystemTokens.spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: designSystemTokens.radii.sm,
    fontFamily: designSystemTokens.typography.runtimeFamilies.uiRegular,
    fontSize: designSystemTokens.typography.roles.body.size,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: designSystemTokens.spacing[2],
    marginTop: designSystemTokens.spacing[2],
  },
  action: {
    minHeight: sheetTokens.touchTargetSize,
    paddingHorizontal: designSystemTokens.spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystemTokens.radii.sm,
  },
  secondaryAction: {
    borderWidth: designSystemTokens.components.libraryImportAction.borderWidth,
  },
  pressed: {
    opacity: designSystemTokens.interaction.pressedOpacity,
    transform: [{ scale: designSystemTokens.interaction.pressedScale }],
  },
  disabled: {
    opacity: designSystemTokens.interaction.disabledOpacity,
  },
});
