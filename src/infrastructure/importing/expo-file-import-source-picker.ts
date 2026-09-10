import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

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
      const result = await this.pickDocument(
        nativeDocumentPickerOptions(options, documentPickerPlatform()),
      );
      return parsePickedDocument(result);
    } catch {
      return parsePickedDocument(undefined);
    }
  }
}

function documentPickerPlatform(): 'android' | 'ios' | 'web' {
  return Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'android';
}
