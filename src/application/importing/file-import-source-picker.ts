import type { Result } from '../../domain';

import type { FileImportSource } from './importer';

export interface PickFileImportSourceOptions {
  readonly mimeTypes: readonly string[];
}

export interface FileImportSourcePickerError {
  readonly kind: 'permission-or-access-failure';
}

export interface FileImportSourcePicker {
  pickFile(
    options: PickFileImportSourceOptions,
  ): Promise<Result<FileImportSource | null, FileImportSourcePickerError>>;
}
