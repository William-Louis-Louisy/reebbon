import { appUiThemes } from '@/shared/theme';

import { useAppColorScheme } from './use-app-color-scheme';

export function useAppTheme() {
  return appUiThemes[useAppColorScheme()];
}
