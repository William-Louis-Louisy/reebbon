import type {
  ImageSetPage,
  ImageSetPageProvider,
  ImageSetRendition,
  ImageSetRenditionError,
  ImageSetRenditionLocation,
} from '@/application';
import { err, ok, type Result } from '@/domain';

export interface ImageSetRenditionControls {
  readonly setIndex: (index: number) => void;
}

export interface ImageSetRenditionSnapshot {
  readonly status: 'idle' | 'opening' | 'ready' | 'failure';
  readonly sessionId: number;
  readonly pages?: readonly ImageSetPage[];
  readonly location?: ImageSetRenditionLocation;
  readonly error?: ImageSetRenditionError;
}

export class ImageSetRenditionBridge implements ImageSetRendition {
  private snapshot: ImageSetRenditionSnapshot = {
    status: 'idle',
    sessionId: 0,
  };
  private readonly listeners = new Set<() => void>();
  private controls: ImageSetRenditionControls | undefined;

  public constructor(private readonly pages: ImageSetPageProvider) {}

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public readonly getSnapshot = (): ImageSetRenditionSnapshot => this.snapshot;

  public attachControls(controls: ImageSetRenditionControls): () => void {
    this.controls = controls;
    return () => {
      if (this.controls === controls) {
        this.controls = undefined;
      }
    };
  }

  public async open(
    contentUri: string,
    totalPages: number,
    initialIndex?: number,
  ): Promise<Result<void, ImageSetRenditionError>> {
    const sessionId = this.snapshot.sessionId + 1;
    this.publish({ status: 'opening', sessionId });

    let loaded: Awaited<ReturnType<ImageSetPageProvider['getPages']>>;
    try {
      loaded = await this.pages.getPages(contentUri, totalPages);
    } catch {
      loaded = err({ kind: 'content-access-failure' });
    }
    if (
      this.snapshot.status !== 'opening' ||
      this.snapshot.sessionId !== sessionId
    ) {
      return err({ kind: 'rendering-failure' });
    }
    if (!loaded.ok) {
      const failure = err({ kind: 'content-access-failure' } as const);
      this.reportFailure(failure.error);
      return failure;
    }
    if (!isValidPageSequence(loaded.value, totalPages)) {
      const failure = err({ kind: 'rendering-failure' } as const);
      this.reportFailure(failure.error);
      return failure;
    }

    const location = { index: initialIndex ?? 0, totalPages };
    if (!isValidLocation(location)) {
      const failure = err({ kind: 'rendering-failure' } as const);
      this.reportFailure(failure.error);
      return failure;
    }
    this.publish({
      status: 'ready',
      sessionId,
      pages: loaded.value,
      location,
    });
    return ok(undefined);
  }

  public goTo(index: number): Promise<Result<void, ImageSetRenditionError>> {
    const location = this.snapshot.location;
    if (
      this.snapshot.status !== 'ready' ||
      location === undefined ||
      !isValidLocation({ index, totalPages: location.totalPages })
    ) {
      return Promise.resolve(err({ kind: 'rendering-failure' }));
    }
    const controlled = this.runControl((controls) => controls.setIndex(index));
    if (controlled.ok) {
      this.publish({ ...this.snapshot, location: { ...location, index } });
    }
    return Promise.resolve(controlled);
  }

  public getLocation(): Promise<
    Result<ImageSetRenditionLocation, ImageSetRenditionError>
  > {
    const location = this.snapshot.location;
    return Promise.resolve(
      this.snapshot.status === 'ready' && location !== undefined
        ? ok(location)
        : err({ kind: 'rendering-failure' }),
    );
  }

  public close(): Promise<Result<void, ImageSetRenditionError>> {
    this.controls = undefined;
    this.publish({ status: 'idle', sessionId: this.snapshot.sessionId });
    return Promise.resolve(ok(undefined));
  }

  public reportLocation(index: number): void {
    const location = this.snapshot.location;
    if (
      this.snapshot.status !== 'ready' ||
      location === undefined ||
      !isValidLocation({ index, totalPages: location.totalPages })
    ) {
      return;
    }
    if (index !== location.index) {
      this.publish({ ...this.snapshot, location: { ...location, index } });
    }
  }

  public reportFailure(error: ImageSetRenditionError): void {
    if (this.snapshot.status === 'idle') {
      return;
    }
    this.publish({
      status: 'failure',
      sessionId: this.snapshot.sessionId,
      error,
    });
  }

  private runControl(
    operation: (controls: ImageSetRenditionControls) => void,
  ): Result<void, ImageSetRenditionError> {
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

  private publish(snapshot: ImageSetRenditionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function isValidPageSequence(
  pages: readonly ImageSetPage[],
  totalPages: number,
): boolean {
  return (
    pages.length === totalPages &&
    pages.every(
      (page, index) =>
        page.index === index &&
        page.uri.startsWith('file:///') &&
        page.uri.trim().length > 'file:///'.length,
    )
  );
}

function isValidLocation(location: ImageSetRenditionLocation): boolean {
  return (
    Number.isSafeInteger(location.index) &&
    Number.isSafeInteger(location.totalPages) &&
    location.index >= 0 &&
    location.totalPages >= 1 &&
    location.index < location.totalPages
  );
}
