import type {
  PdfRendition,
  PdfRenditionError,
  PdfRenditionLocation,
} from '@/application';
import { err, ok, type Result } from '@/domain';

const DEFAULT_OPEN_TIMEOUT_MS = 20_000;

export interface PdfRenditionControls {
  readonly setPage: (page: number) => void;
}

export interface PdfRenditionSnapshot {
  readonly status: 'idle' | 'opening' | 'ready' | 'failure';
  readonly sessionId: number;
  readonly sourceUri?: string;
  readonly initialPage?: number;
  readonly location?: PdfRenditionLocation;
  readonly error?: PdfRenditionError;
}

interface PendingOpen {
  readonly resolve: (result: Result<void, PdfRenditionError>) => void;
}

export class PdfRenditionBridge implements PdfRendition {
  private snapshot: PdfRenditionSnapshot = { status: 'idle', sessionId: 0 };
  private readonly listeners = new Set<() => void>();
  private controls: PdfRenditionControls | undefined;
  private pendingOpen: PendingOpen | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  public constructor(
    private readonly openTimeoutMs: number = DEFAULT_OPEN_TIMEOUT_MS,
  ) {}

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public readonly getSnapshot = (): PdfRenditionSnapshot => this.snapshot;

  public attachControls(controls: PdfRenditionControls): () => void {
    this.controls = controls;
    return () => {
      if (this.controls === controls) {
        this.controls = undefined;
      }
    };
  }

  public open(
    fileUri: string,
    initialPage?: number,
  ): Promise<Result<void, PdfRenditionError>> {
    this.settlePending(err({ kind: 'rendering-failure' }));
    this.clearTimeout();
    this.publish({
      status: 'opening',
      sessionId: this.snapshot.sessionId + 1,
      sourceUri: fileUri,
      ...(initialPage === undefined ? {} : { initialPage }),
    });
    this.timeout = setTimeout(() => {
      this.reportFailure({ kind: 'rendering-failure' });
    }, this.openTimeoutMs);
    return new Promise((resolve) => {
      this.pendingOpen = { resolve };
    });
  }

  public goTo(page: number): Promise<Result<void, PdfRenditionError>> {
    const location = this.snapshot.location;
    if (
      this.snapshot.status !== 'ready' ||
      location === undefined ||
      page < 1 ||
      page > location.totalPages
    ) {
      return Promise.resolve(err({ kind: 'rendering-failure' }));
    }
    return Promise.resolve(this.runControl((controls) => controls.setPage(page)));
  }

  public getLocation(): Promise<Result<PdfRenditionLocation, PdfRenditionError>> {
    const location = this.snapshot.location;
    return Promise.resolve(
      this.snapshot.status === 'ready' && location !== undefined
        ? ok(location)
        : err({ kind: 'rendering-failure' }),
    );
  }

  public close(): Promise<Result<void, PdfRenditionError>> {
    this.clearTimeout();
    this.settlePending(err({ kind: 'rendering-failure' }));
    this.publish({ status: 'idle', sessionId: this.snapshot.sessionId });
    return Promise.resolve(ok(undefined));
  }

  public reportReady(location: PdfRenditionLocation): void {
    if (this.snapshot.status !== 'opening') {
      return;
    }
    this.clearTimeout();
    this.publish({
      ...this.snapshot,
      status: 'ready',
      location,
    });
    this.settlePending(ok(undefined));
  }

  public reportLocation(location: PdfRenditionLocation): void {
    if (this.snapshot.status !== 'ready') {
      return;
    }
    this.publish({ ...this.snapshot, location });
  }

  public reportFailure(error: PdfRenditionError): void {
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
    operation: (controls: PdfRenditionControls) => void,
  ): Result<void, PdfRenditionError> {
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

  private publish(snapshot: PdfRenditionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private settlePending(result: Result<void, PdfRenditionError>): void {
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
}
