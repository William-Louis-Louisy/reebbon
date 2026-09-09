import { Directory } from 'expo-file-system';

import type { DirectoryImportSourcePicker } from '../../application';
import { err, ok } from '../../domain';

import {
  isDirectoryPickerCancellation,
  parsePickedDirectory,
} from './directory-import-source-picker-core';

type PickDirectory = () => Promise<unknown>;

export class ExpoDirectoryImportSourcePicker
  implements DirectoryImportSourcePicker
{
  public constructor(
    private readonly nativePicker: PickDirectory = Directory.pickDirectoryAsync,
  ) {}

  public async pickDirectory(): ReturnType<DirectoryImportSourcePicker['pickDirectory']> {
    try {
      return parsePickedDirectory(await this.nativePicker());
    } catch (error: unknown) {
      return isDirectoryPickerCancellation(error)
        ? ok(null)
        : err({ kind: 'permission-or-access-failure' });
    }
  }
}
