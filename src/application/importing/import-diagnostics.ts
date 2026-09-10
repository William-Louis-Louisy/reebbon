export type ImportDiagnosticStage =
  | 'library-stable'
  | 'before-document-picker'
  | 'document-picker-returned'
  | 'document-picker-copy-present'
  | 'document-picker-copy-skipped'
  | 'library-image-cache-released'
  | 'cbz-extraction-start'
  | 'cbz-entry-start'
  | 'cbz-entry-complete'
  | 'cbz-extraction-complete'
  | 'images-pipeline-start'
  | 'images-pipeline-listed'
  | 'images-pipeline-validated'
  | 'images-pipeline-staged'
  | 'images-pipeline-complete'
  | 'library-returned';

export type ImportDiagnosticDetails = Readonly<
  Record<string, boolean | number | string | null>
>;

export interface ImportDiagnostics {
  checkpoint(
    stage: ImportDiagnosticStage,
    details?: ImportDiagnosticDetails,
  ): Promise<void>;
}
