import { appUiThemes, runtimeFontFamilies, type AppColorScheme } from './design-system';

export type NavigationTheme = {
  readonly dark: boolean;
  readonly colors: {
    readonly primary: string;
    readonly background: string;
    readonly card: string;
    readonly text: string;
    readonly border: string;
    readonly notification: string;
  };
  readonly fonts: {
    readonly regular: {
      readonly fontFamily: string;
      readonly fontWeight: '400';
    };
    readonly medium: {
      readonly fontFamily: string;
      readonly fontWeight: '500';
    };
    readonly bold: {
      readonly fontFamily: string;
      readonly fontWeight: '600';
    };
    readonly heavy: {
      readonly fontFamily: string;
      readonly fontWeight: '700';
    };
  };
};

export function getNavigationTheme(colorScheme: AppColorScheme): NavigationTheme {
  const theme = appUiThemes[colorScheme];

  return {
    dark: colorScheme === 'dark',
    colors: {
      primary: theme.accent,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.accentStrong,
    },
    fonts: {
      regular: {
        fontFamily: runtimeFontFamilies.uiRegular,
        fontWeight: '400',
      },
      medium: {
        fontFamily: runtimeFontFamilies.uiMedium,
        fontWeight: '500',
      },
      bold: {
        fontFamily: runtimeFontFamilies.uiSemiBold,
        fontWeight: '600',
      },
      heavy: {
        fontFamily: runtimeFontFamilies.uiBold,
        fontWeight: '700',
      },
    },
  };
}
