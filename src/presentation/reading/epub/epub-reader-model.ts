import type { Theme as CoreTheme } from '@epubjs-react-native/core';

import type { ReaderTableOfContentsEntry } from '@/application';
import {
  defaultReaderHorizontalMargin,
  defaultReaderLineSpacing,
  err,
  ok,
  type ReaderFontSize,
  type ReaderHorizontalMargin,
  type ReaderLineSpacing,
  type Result,
} from '@/domain';
import {
  designSystemTokens,
  readingThemes,
  type ReadingThemeName,
} from '@/shared/theme';

import type { EpubDisplayLocation } from './epub-rendition-bridge';

type ProgressUnit = 'ratio' | 'percentage';
const MAXIMUM_TOC_DEPTH = 32;
const MAXIMUM_TOC_ITEMS = 2_000;
const MAXIMUM_TOC_LABEL_LENGTH = 300;
const MAXIMUM_TOC_TARGET_LENGTH = 2_048;

export interface InvalidEpubLocationError {
  readonly kind: 'invalid-epub-location';
}

export interface InvalidEpubTableOfContentsError {
  readonly kind: 'invalid-epub-table-of-contents';
}

export interface ParsedEpubTableOfContents {
  readonly entries: readonly ReaderTableOfContentsEntry[];
  readonly targets: Readonly<Record<string, string>>;
}

export const epubCoreThemes: Record<ReadingThemeName, CoreTheme> = {
  paper: createCoreTheme('paper'),
  sepia: createCoreTheme('sepia'),
  night: createCoreTheme('night'),
};

export function formatEpubFontSize(fontSize: ReaderFontSize): string {
  return String(fontSize) + 'px';
}

export function createEpubHorizontalMarginInjection(
  margin: ReaderHorizontalMargin,
): string {
  return createEpubLayoutInjection(
    '--reebbon-horizontal-margin',
    String(margin) + 'px',
  );
}

export function createEpubLineSpacingInjection(
  lineSpacing: ReaderLineSpacing,
): string {
  return createEpubLayoutInjection(
    '--reebbon-line-spacing',
    String(lineSpacing),
  );
}

export function parseEpubTableOfContents(
  value: unknown,
): Result<ParsedEpubTableOfContents, InvalidEpubTableOfContentsError> {
  if (!Array.isArray(value)) {
    return err({ kind: 'invalid-epub-table-of-contents' });
  }

  const entries: ReaderTableOfContentsEntry[] = [];
  const targets: Record<string, string> = {};
  const visited = new WeakSet<object>();
  let inspectedItems = 0;

  const visit = (items: readonly unknown[], depth: number): boolean => {
    if (depth > MAXIMUM_TOC_DEPTH) {
      return false;
    }
    for (const candidate of items) {
      inspectedItems += 1;
      if (inspectedItems > MAXIMUM_TOC_ITEMS || !isRecord(candidate)) {
        if (inspectedItems > MAXIMUM_TOC_ITEMS) {
          return false;
        }
        continue;
      }
      if (visited.has(candidate)) {
        return false;
      }
      visited.add(candidate);

      const label = normalizeTocLabel(candidate.label);
      const target = normalizeTocTarget(candidate.href);
      let childDepth = depth;
      if (label !== undefined && target !== undefined) {
        const id = `toc-${entries.length}`;
        entries.push({ id, label, depth });
        targets[id] = target;
        childDepth += 1;
      }

      const subitems = Array.isArray(candidate.subitems)
        ? candidate.subitems
        : [];
      if (!visit(subitems, childDepth)) {
        return false;
      }
    }
    return true;
  };

  return visit(value, 0)
    ? ok({ entries, targets })
    : err({ kind: 'invalid-epub-table-of-contents' });
}

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
  const transition = [
    `background-color ${designSystemTokens.motion.readingThemeTransition}ms ${designSystemTokens.motion.readingThemeEasing}`,
    `color ${designSystemTokens.motion.readingThemeTransition}ms ${designSystemTokens.motion.readingThemeEasing}`,
  ].join(', ');
  return {
    html: {
      '--reebbon-horizontal-margin': `${defaultReaderHorizontalMargin}px`,
      '--reebbon-line-spacing': String(defaultReaderLineSpacing),
    },
    body: {
      color: theme.text,
      background: theme.background,
      'background-color': theme.background,
      transition,
      'font-family': "'Reebbon Literata', serif",
      'font-size': `${reading.size}px`,
      'line-height': 'var(--reebbon-line-spacing)',
      'letter-spacing': `${reading.tracking}px`,
      'padding-left': 'var(--reebbon-horizontal-margin)',
      'padding-right': 'var(--reebbon-horizontal-margin)',
    },
    a: {
      color: theme.accent,
      transition: `color ${designSystemTokens.motion.readingThemeTransition}ms ${designSystemTokens.motion.readingThemeEasing}`,
    },
    img: {
      'max-width': '100%',
      'max-height': '100%',
      'object-fit': 'contain',
    },
  };
}

function createEpubLayoutInjection(property: string, value: string): string {
  return `
    rendition.themes.override(${JSON.stringify(property)}, ${JSON.stringify(value)}, true);
    rendition.views().forEach(function (view) {
      if (view.pane) view.pane.render();
    });
    true;
  `;
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

function normalizeTocLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const label = value.replace(/\s+/g, ' ').trim();
  return label.length > 0 && label.length <= MAXIMUM_TOC_LABEL_LENGTH
    ? label
    : undefined;
}

function normalizeTocTarget(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const target = value.trim();
  if (
    target.length === 0 ||
    target.length > MAXIMUM_TOC_TARGET_LENGTH ||
    target.includes('\u0000') ||
    target.startsWith('//') ||
    target.includes('\\')
  ) {
    return undefined;
  }
  if (/^epubcfi\(.+\)$/.test(target)) {
    return target;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(target) ? undefined : target;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
