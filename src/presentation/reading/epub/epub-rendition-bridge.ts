import type {
  EpubRendition,
  EpubRenditionError,
  EpubRenditionLocation,
  ReaderTableOfContentsEntry,
} from '@/application';
import {
  err,
  ok,
  type ReaderFontSize,
  type ReaderHorizontalMargin,
  type ReaderLineSpacing,
  type ReadingTheme,
  type Result,
} from '@/domain';

const DEFAULT_OPEN_TIMEOUT_MS = 20_000;

export interface EpubRenditionControls {
  readonly goToLocation: (cfi: string) => void;
  readonly goPrevious: () => void;
  readonly goNext: () => void;
  readonly changeTheme: (theme: ReadingTheme) => void;
  readonly changeFontSize: (fontSize: ReaderFontSize) => void;
  readonly changeHorizontalMargin: (margin: ReaderHorizontalMargin) => void;
  readonly changeLineSpacing: (lineSpacing: ReaderLineSpacing) => void;
}

export interface EpubDisplayLocation extends EpubRenditionLocation {
  readonly locationIndex: number;
  readonly totalLocations: number;
}

export interface EpubRenditionSnapshot {
  readonly status: 'idle' | 'opening' | 'ready' | 'failure';
  readonly sessionId: number;
  readonly sourceUri?: string;
  readonly initialCfi?: string;
  readonly location?: EpubDisplayLocation;
  readonly error?: EpubRenditionError;
}

interface PendingOpen {
  readonly resolve: (result: Result<void, EpubRenditionError>) => void;
}

export class EpubRenditionBridge implements EpubRendition {
  private snapshot: EpubRenditionSnapshot = { status: 'idle', sessionId: 0 };
  private readonly listeners = new Set<() => void>();
  private controls: EpubRenditionControls | undefined;
  private pendingOpen: PendingOpen | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private tableOfContentsEntries: readonly ReaderTableOfContentsEntry[] = [];
  private tableOfContentsTargets = new Map<string, string>();

  public constructor(
    private readonly openTimeoutMs: number = DEFAULT_OPEN_TIMEOUT_MS,
  ) {}

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public readonly getSnapshot = (): EpubRenditionSnapshot => this.snapshot;

  public attachControls(controls: EpubRenditionControls): () => void {
    this.controls = controls;
    return () => {
      if (this.controls === controls) {
        this.controls = undefined;
      }
    };
  }

  public open(
    fileUri: string,
    initialCfi?: string,
  ): Promise<Result<void, EpubRenditionError>> {
    this.settlePending(err({ kind: 'rendering-failure' }));
    this.clearTimeout();
    this.clearTableOfContents();
    this.publish({
      status: 'opening',
      sessionId: this.snapshot.sessionId + 1,
      sourceUri: fileUri,
      ...(initialCfi === undefined ? {} : { initialCfi }),
    });

    this.timeout = setTimeout(() => {
      this.reportFailure({ kind: 'rendering-failure' });
    }, this.openTimeoutMs);

    return new Promise((resolve) => {
      this.pendingOpen = { resolve };
    });
  }

  public goTo(cfi: string): Promise<Result<void, EpubRenditionError>> {
    return Promise.resolve(this.runControl((controls) => controls.goToLocation(cfi)));
  }

  public getTableOfContents(): Promise<
    Result<readonly ReaderTableOfContentsEntry[], EpubRenditionError>
  > {
    return Promise.resolve(
      this.snapshot.status === 'ready'
        ? ok(this.tableOfContentsEntries)
        : err({ kind: 'rendering-failure' }),
    );
  }

  public goToTableOfContentsEntry(
    entryId: string,
  ): Promise<Result<void, EpubRenditionError>> {
    const target = this.tableOfContentsTargets.get(entryId);
    return Promise.resolve(
      target === undefined
        ? err({ kind: 'rendering-failure' })
        : this.runControl((controls) => controls.goToLocation(target)),
    );
  }

  public getLocation(): Promise<
    Result<EpubRenditionLocation, EpubRenditionError>
  > {
    const location = this.snapshot.location;
    return Promise.resolve(
      this.snapshot.status === 'ready' && location !== undefined
        ? ok({
            cfi: location.cfi,
            completionRatio: location.completionRatio,
          })
        : err({ kind: 'rendering-failure' }),
    );
  }

  public setTheme(theme: ReadingTheme): Promise<Result<void, EpubRenditionError>> {
    return Promise.resolve(this.runControl((controls) => controls.changeTheme(theme)));
  }

  public setFontSize(
    fontSize: ReaderFontSize,
  ): Promise<Result<void, EpubRenditionError>> {
    return Promise.resolve(
      this.runControl((controls) => controls.changeFontSize(fontSize)),
    );
  }

  public setHorizontalMargin(
    margin: ReaderHorizontalMargin,
  ): Promise<Result<void, EpubRenditionError>> {
    return Promise.resolve(
      this.runControl((controls) => controls.changeHorizontalMargin(margin)),
    );
  }

  public setLineSpacing(
    lineSpacing: ReaderLineSpacing,
  ): Promise<Result<void, EpubRenditionError>> {
    return Promise.resolve(
      this.runControl((controls) => controls.changeLineSpacing(lineSpacing)),
    );
  }

  public close(): Promise<Result<void, EpubRenditionError>> {
    this.clearTimeout();
    this.settlePending(err({ kind: 'rendering-failure' }));
    this.clearTableOfContents();
    this.publish({ status: 'idle', sessionId: this.snapshot.sessionId });
    return Promise.resolve(ok(undefined));
  }

  public previousPage(): Result<void, EpubRenditionError> {
    return this.runControl((controls) => controls.goPrevious());
  }

  public nextPage(): Result<void, EpubRenditionError> {
    return this.runControl((controls) => controls.goNext());
  }

  public reportReady(location: EpubDisplayLocation): void {
    if (this.snapshot.status !== 'opening') {
      return;
    }
    this.clearTimeout();
    this.publish({
      ...this.snapshot,
      status: 'ready',
      location: normalizeDisplayLocation(location),
    });
    this.settlePending(ok(undefined));
  }

  public reportLocation(location: EpubDisplayLocation): void {
    if (this.snapshot.status !== 'ready') {
      return;
    }
    this.publish({
      ...this.snapshot,
      location: normalizeDisplayLocation(location),
    });
  }

  public reportTableOfContents(
    entries: readonly ReaderTableOfContentsEntry[],
    targets: Readonly<Record<string, string>>,
  ): void {
    if (this.snapshot.status === 'idle') {
      return;
    }
    this.tableOfContentsEntries = [...entries];
    this.tableOfContentsTargets = new Map(Object.entries(targets));
  }

  public reportFailure(error: EpubRenditionError): void {
    if (this.snapshot.status === 'idle') {
      return;
    }
    this.clearTimeout();
    this.publish({
      status: 'failure',
      sessionId: this.snapshot.sessionId,
      error,
    });
    this.settlePending(err(error));
  }

  private runControl(
    operation: (controls: EpubRenditionControls) => void,
  ): Result<void, EpubRenditionError> {
    if (this.snapshot.status !== 'ready' || this.controls === undefined) {
      return err({ kind: 'rendering-failure' });
    }
    try {
      operation(this.controls);
      return ok(undefined);
    } catch {
      return err({ kind: 'rendering-failure' });
    }
  }

  private publish(snapshot: EpubRenditionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private settlePending(result: Result<void, EpubRenditionError>): void {
    const pending = this.pendingOpen;
    this.pendingOpen = undefined;
    pending?.resolve(result);
  }

  private clearTimeout(): void {
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  private clearTableOfContents(): void {
    this.tableOfContentsEntries = [];
    this.tableOfContentsTargets.clear();
  }
}

function normalizeDisplayLocation(
  location: EpubDisplayLocation,
): EpubDisplayLocation {
  return {
    cfi: location.cfi,
    completionRatio: clamp(location.completionRatio, 0, 1),
    locationIndex: Math.max(0, Math.trunc(location.locationIndex)),
    totalLocations: Math.max(0, Math.trunc(location.totalLocations)),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : minimum;
}
