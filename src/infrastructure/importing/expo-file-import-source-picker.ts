import * as DocumentPicker from 'expo-document-picker';

import type {
  FileImportSourcePicker,
  PickFileImportSourceOptions,
} from '../../application';

import {
  nativeDocumentPickerOptions,
  parsePickedDocument,
} from './file-import-source-picker-core';

type PickDocument = (
  options: DocumentPicker.DocumentPickerOptions,
) => Promise<unknown>;

export class ExpoFileImportSourcePicker implements FileImportSourcePicker {
  public constructor(
    private readonly pickDocument: PickDocument = DocumentPicker.getDocumentAsync,
  ) {}

  public async pickFile(options: PickFileImportSourceOptions) {
    try {
      const result = await this.pickDocument(nativeDocumentPickerOptions(options));
      return parsePickedDocument(result);
    } catch {
      return parsePickedDocument(undefined);
    }
  }
}
