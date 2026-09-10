import type {
  ImportDiagnosticDetails,
  ImportDiagnostics,
  ImportDiagnosticStage,
} from '../../application';

export class ExpoImportDiagnostics implements ImportDiagnostics {
  public async checkpoint(
    stage: ImportDiagnosticStage,
    details: ImportDiagnosticDetails = {},
  ): Promise<void> {
    try {
      const { getReebbonImportNativeModule } = await import(
        '../../../modules/reebbon-import'
      );
      const nativeModule = getReebbonImportNativeModule();
      if (nativeModule !== null) {
        await nativeModule.recordMemoryCheckpoint(stage, details);
        return;
      }
    } catch {
      // The native diagnostics module is Android-only.
    }

    console.info(
      `[ReebbonImportMemory] ${JSON.stringify({ stage, details })}`,
    );
  }
}
