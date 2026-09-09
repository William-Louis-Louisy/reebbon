import type { Result } from '../../domain';

import type { DirectoryImportSource } from './importer';

export interface DirectoryImportSourcePickerError {
  readonly kind: 'permission-or-access-failure';
}

export interface DirectoryImportSourcePicker {
  pickDirectory(): Promise<
    Result<DirectoryImportSource | null, DirectoryImportSourcePickerError>
  >;
}
