import {
  TabList,
  TabListProps,
  TabSlot,
  Tabs,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { designSystemTokens } from '@/shared/theme';

import { useAppTheme } from '../hooks/use-app-theme';
import { AppText } from '../components/app-text';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <WebTabList>
          <TabTrigger name="index" href="/" asChild>
            <WebTabButton>Fondations</WebTabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <WebTabButton>Tokens</WebTabButton>
          </TabTrigger>
        </WebTabList>
      </TabList>
    </Tabs>
  );
}

function WebTabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useAppTheme();

  return (
    <Pressable {...props} style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressed]}>
      <View
        style={[
          styles.button,
          {
            backgroundColor: isFocused ? theme.background : theme.surface,
            borderColor: theme.border,
          },
        ]}>
        <AppText variant="label" tone={isFocused ? 'default' : 'muted'}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

function WebTabList(props: TabListProps) {
  const theme = useAppTheme();

  return (
    <View {...props} style={styles.listContainer}>
      <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="eyebrow" tone="accent">
          Reebbon
        </AppText>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    position: 'absolute',
    bottom: designSystemTokens.spacing[4],
    width: '100%',
    paddingHorizontal: designSystemTokens.spacing[5],
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
    maxWidth: designSystemTokens.layout.maxContentWidth,
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.lg,
    paddingHorizontal: designSystemTokens.spacing[4],
    paddingVertical: designSystemTokens.spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSystemTokens.spacing[3],
  },
  buttonPressable: {
    marginLeft: 'auto',
  },
  button: {
    borderWidth: 1,
    borderRadius: designSystemTokens.radii.md,
    paddingHorizontal: designSystemTokens.spacing[4],
    paddingVertical: designSystemTokens.spacing[2],
  },
  pressed: {
    opacity: 0.7,
  },
});
