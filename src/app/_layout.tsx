import { createLocalAppColorSchemePreferenceService } from '@/infrastructure';
import RootLayout from '@/presentation/layout/root-layout';

const appColorSchemePreferences =
  createLocalAppColorSchemePreferenceService();

export default function AppLayout() {
  return (
    <RootLayout
      appColorSchemePreferences={appColorSchemePreferences}
    />
  );
}
