import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppTheme } from '../hooks/use-app-theme';

export default function AppTabs() {
  const theme = useAppTheme();

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      indicatorColor={theme.accent}
      labelStyle={{ selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bibliothèque</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Tokens</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
