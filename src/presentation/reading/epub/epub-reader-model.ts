import type { Theme as CoreTheme } from '@epubjs-react-native/core';

import { err, ok, type Result } from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import type { EpubDisplayLocation } from './epub-rendition-bridge';

type ProgressUnit = 'ratio' | 'percentage';

export interface InvalidEpubLocationError {
  readonly kind: 'invalid-epub-location';
}

export const epubCoreThemes: Record<ReadingThemeName, CoreTheme> = {
  paper: createCoreTheme('paper'),
  sepia: createCoreTheme('sepia'),
  night: createCoreTheme('night'),
};

export function parseEpubDisplayLocation(
  value: unknown,
  totalLocations: unknown,
  progress: unknown,
  progressUnit: ProgressUnit,
): Result<EpubDisplayLocation, InvalidEpubLocationError> {
  if (
    !isCoreLocation(value) ||
    typeof totalLocations !== 'number' ||
    !Number.isInteger(totalLocations) ||
    totalLocations < 0
  ) {
    return err({ kind: 'invalid-epub-location' });
  }

  const normalizedProgress = getProgress(value, progress);
  if (normalizedProgress === undefined) {
    return err({ kind: 'invalid-epub-location' });
  }

  return ok({
    cfi: value.start.cfi,
    completionRatio: progressUnit === 'percentage'
      ? normalizedProgress / 100
      : normalizedProgress,
    locationIndex: value.start.location,
    totalLocations,
  });
}

export function createLiterataInjection(fontDataUri: string): string {
  if (!/^data:font\/ttf;base64,[A-Za-z0-9+/=]+$/.test(fontDataUri)) {
    return 'true;';
  }

  return `
    (function () {
      var css = "@font-face{font-family:'Reebbon Literata';src:url('${fontDataUri}') format('truetype');font-weight:400;font-style:normal;}";
      var applyFont = function (contents) {
        var style = contents.document.createElement('style');
        style.textContent = css;
        contents.document.head.appendChild(style);
      };
      rendition.hooks.content.register(applyFont);
      rendition.getContents().forEach(applyFont);
      true;
    })();
  `;
}

export function getEpubFolio(
  location: EpubDisplayLocation | undefined,
): { readonly current: number; readonly total: number } | undefined {
  if (location === undefined || location.totalLocations < 1) {
    return undefined;
  }
  return {
    current: Math.min(location.totalLocations, location.locationIndex + 1),
    total: location.totalLocations,
  };
}

function createCoreTheme(name: ReadingThemeName): CoreTheme {
  const theme = readingThemes[name];
  const reading = designSystemTokens.typography.roles.reading;
  return {
    body: {
      color: theme.text,
      background: theme.background,
      'font-family': "'Reebbon Literata', serif",
      'font-size': `${reading.size}px`,
      'line-height': `${reading.lineHeight}px`,
      'letter-spacing': `${reading.tracking}px`,
      'padding-left': `${designSystemTokens.spacing[5]}px`,
      'padding-right': `${designSystemTokens.spacing[5]}px`,
    },
    a: {
      color: name === 'night'
        ? designSystemTokens.colors.oxbloodTint
        : designSystemTokens.colors.oxblood,
    },
    img: {
      'max-width': '100%',
      'max-height': '100%',
      'object-fit': 'contain',
    },
  };
}

interface ValidatedCoreLocation {
  readonly start: {
    readonly cfi: string;
    readonly location: number;
    readonly percentage?: number;
  };
}

function isCoreLocation(value: unknown): value is ValidatedCoreLocation {
  if (!isRecord(value) || !isRecord(value.start)) {
    return false;
  }
  const { cfi, location } = value.start;
  return (
    typeof cfi === 'string' &&
    cfi.trim().startsWith('epubcfi(') &&
    cfi.trim().endsWith(')') &&
    typeof location === 'number' &&
    Number.isInteger(location) &&
    location >= 0
  );
}

function getProgress(
  location: ValidatedCoreLocation,
  progress: unknown,
): number | undefined {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    return progress;
  }
  const fallback = location.start.percentage;
  return typeof fallback === 'number' && Number.isFinite(fallback)
    ? fallback
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
