export type AppColorScheme = 'light' | 'dark';
export type ReadingThemeName = 'paper' | 'sepia' | 'night';

export const runtimeFontFamilies = {
  displayMedium: 'Fraunces-Medium',
  displaySemiBold: 'Fraunces-SemiBold',
  displayItalic: 'Fraunces-RegularItalic',
  uiRegular: 'PublicSans-Regular',
  uiMedium: 'PublicSans-Medium',
  uiSemiBold: 'PublicSans-SemiBold',
  uiBold: 'PublicSans-Bold',
  readingRegular: 'Literata-Regular',
  readingMedium: 'Literata-Medium',
  readingSemiBold: 'Literata-SemiBold',
  readingBold: 'Literata-Bold',
  monoRegular: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
} as const;

export const designSystemTokens = {
  colors: {
    ink: '#35304C',
    ink2: '#4A4368',
    oxblood: '#7A3030',
    oxblood2: '#93403F',
    oxbloodTint: '#D98C7A',
    paper: '#ECE6D8',
    paper2: '#E3DBC8',
    paperText: '#2B2620',
    paperTextSoft: '#5E5646',
    walnut: '#26211D',
    walnut2: '#332C26',
    walnutText: '#D8CFB8',
    walnutTextSoft: '#948A72',
    sepia: '#F1E2C0',
    sepia2: '#E9D6AC',
    sepiaText: '#4A3826',
    night: '#1E1B22',
    night2: '#2A2530',
    nightText: '#C9C0AE',
    borderLight: '#DAD1BC',
    borderDark: '#3A342E',
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    7: 48,
    8: 64,
  },
  radii: {
    sm: 8,
    md: 14,
    lg: 20,
    pill: 999,
  },
  motion: {
    quickFeedback: 120,
    uiTransition: 260,
    readingThemeTransition: 480,
    readingThemeEasing: 'cubic-bezier(.22,.61,.36,1)',
  },
  interaction: {
    pressedOpacity: 0.78,
    pressedScale: 0.97,
    disabledOpacity: 0.52,
  },
  gradients: {
    coverFallback: 'linear-gradient(155deg, #35304C, #4A4368)',
  },
  shadows: {
    bookCover: {
      shadowColor: '#35304C',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 6,
    },
  },
  typography: {
    families: {
      display: 'Fraunces',
      ui: 'Public Sans',
      reading: 'Literata',
      mono: 'IBM Plex Mono',
    },
    runtimeFamilies: runtimeFontFamilies,
    roles: {
      hero: {
        family: 'display',
        weight: '600',
        size: 42,
        lineHeight: 44,
        tracking: -0.42,
      },
      heading: {
        family: 'display',
        weight: '500',
        size: 28,
        lineHeight: 32,
        tracking: -0.14,
      },
      quote: {
        family: 'display',
        weight: '400',
        size: 18,
        lineHeight: 27,
        tracking: 0,
      },
      screenTitle: {
        family: 'ui',
        weight: '600',
        size: 20,
        lineHeight: 26,
        tracking: -0.1,
      },
      label: {
        family: 'ui',
        weight: '500',
        size: 15,
        lineHeight: 21,
        tracking: 0,
      },
      body: {
        family: 'ui',
        weight: '400',
        size: 15,
        lineHeight: 23,
        tracking: 0,
      },
      button: {
        family: 'ui',
        weight: '600',
        size: 14,
        lineHeight: 14,
        tracking: 0.14,
      },
      caption: {
        family: 'ui',
        weight: '400',
        size: 12,
        lineHeight: 17,
        tracking: 0.12,
      },
      reading: {
        family: 'reading',
        weight: '400',
        size: 17,
        lineHeight: 29,
        tracking: 0,
      },
      eyebrow: {
        family: 'mono',
        weight: '500',
        size: 11,
        lineHeight: 13,
        tracking: 1.54,
      },
      folio: {
        family: 'mono',
        weight: '400',
        size: 12,
        lineHeight: 14,
        tracking: 0.24,
      },
    },
  },
  layout: {
    maxContentWidth: 1000,
    libraryGrid: {
      fallbackViewportWidth: 320,
      tabletBreakpoint: 600,
      wideBreakpoint: 900,
      compactColumns: 2,
      tabletColumns: 3,
      wideColumns: 4,
      compactPadding: 16,
      regularPadding: 24,
      gap: 16,
      coverAspectRatio: 3 / 4.4,
      emptyStateMinHeight: 320,
      emptyBookWidth: 96,
      emptyBookHeight: 132,
      navigationClearance: 96,
    },
  },
  components: {
    readerChrome: {
      mutedOpacity: 0.7,
    },
    readingThemeSelector: {
      controlSize: 32,
      dotSize: 18,
      borderWidth: 1.5,
    },
    ribbon: {
      width: 20,
      minHeight: 32,
      maxHeight: 72,
      notchDepth: 8,
      markerHeight: 3,
      markerOpacity: 0.85,
      markerBottomOffset: 16,
      coverInset: 18,
    },
  },
} as const;

export type DesignSystemTokens = typeof designSystemTokens;

export type AppUiTheme = {
  readonly name: AppColorScheme;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly accentStrong: string;
  readonly border: string;
};

export type ReadingTheme = {
  readonly name: ReadingThemeName;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly accent: string;
  readonly border: string;
};

const { colors } = designSystemTokens;

export const appUiThemes: Record<AppColorScheme, AppUiTheme> = {
  light: {
    name: 'light',
    background: colors.paper,
    surface: colors.paper2,
    text: colors.paperText,
    textMuted: colors.paperTextSoft,
    accent: colors.oxblood,
    accentStrong: colors.oxblood2,
    border: colors.borderLight,
  },
  dark: {
    name: 'dark',
    background: colors.walnut,
    surface: colors.walnut2,
    text: colors.walnutText,
    textMuted: colors.walnutTextSoft,
    accent: colors.oxbloodTint,
    accentStrong: colors.oxblood,
    border: colors.borderDark,
  },
};

export const readingThemes: Record<ReadingThemeName, ReadingTheme> = {
  paper: {
    name: 'paper',
    background: colors.paper,
    surface: colors.paper2,
    text: colors.paperText,
    accent: colors.oxblood,
    border: colors.borderLight,
  },
  sepia: {
    name: 'sepia',
    background: colors.sepia,
    surface: colors.sepia2,
    text: colors.sepiaText,
    accent: colors.oxblood,
    border: colors.borderLight,
  },
  night: {
    name: 'night',
    background: colors.night,
    surface: colors.night2,
    text: colors.nightText,
    accent: colors.oxbloodTint,
    border: colors.borderDark,
  },
};
