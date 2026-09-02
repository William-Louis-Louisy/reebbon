import type { ReaderProps as CoreReaderProps } from '@epubjs-react-native/core';
import { Literata_400Regular } from '@expo-google-fonts/literata';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import type { EpubRenditionError } from '../../application';
import { err, ok, type Result } from '../../domain';

type CoreFileSystem = ReturnType<CoreReaderProps['fileSystem']>;

const rendererCacheUri = `${Paths.cache.uri.replace(/\/+$/, '')}/reebbon/epub-renderer`;
const renderedBookUri = `${rendererCacheUri}/active-book.epub`;

const rendererFileSystem: CoreFileSystem = {
  file: null,
  progress: 0,
  downloading: false,
  size: 0,
  error: null,
  success: false,
  documentDirectory: rendererCacheUri,
  cacheDirectory: rendererCacheUri,
  bundleDirectory: undefined,
  async readAsStringAsync(fileUri, options) {
    const file = new File(fileUri);
    return options?.encoding === 'base64' ? file.base64() : file.text();
  },
  async writeAsStringAsync(fileUri, contents) {
    ensureRendererCache();
    const file = new File(fileUri);
    file.create({ intermediates: true, overwrite: true });
    file.write(contents);
  },
  async deleteAsync(fileUri) {
    const file = new File(fileUri);
    if (file.exists) {
      file.delete();
    }
  },
  downloadFile() {
    return Promise.resolve({ uri: null, mimeType: null });
  },
  async getFileInfo(fileUri) {
    const file = new File(fileUri);
    return {
      uri: file.uri,
      exists: file.exists,
      isDirectory: false,
      size: file.exists ? file.size : undefined,
    };
  },
};

export function getExpoEpubRendererFileSystem(): CoreFileSystem {
  return rendererFileSystem;
}

export async function prepareEpubForRendering(
  sourceUri: string,
): Promise<Result<string, EpubRenditionError>> {
  try {
    if (!sourceUri.startsWith('file:///')) {
      return err({ kind: 'content-access-failure' });
    }

    clearRendererCacheDirectory();
    ensureRendererCache();
    const source = new File(sourceUri);
    if (!source.exists) {
      clearRendererCacheDirectory();
      return err({ kind: 'content-access-failure' });
    }

    await source.copy(new File(renderedBookUri));
    return ok(renderedBookUri);
  } catch {
    clearRendererCacheDirectoryQuietly();
    return err({ kind: 'content-access-failure' });
  }
}

export async function clearEpubRendererCache(): Promise<
  Result<void, EpubRenditionError>
> {
  try {
    clearRendererCacheDirectory();
    return ok(undefined);
  } catch {
    return err({ kind: 'content-access-failure' });
  }
}

export async function loadBundledLiterataDataUri(): Promise<
  Result<string, EpubRenditionError>
> {
  try {
    const asset = await Asset.fromModule(Literata_400Regular).downloadAsync();
    const uri = asset.localUri;
    if (uri === null || !uri.startsWith('file:///')) {
      return err({ kind: 'content-access-failure' });
    }

    const font = new File(uri);
    if (!font.exists) {
      return err({ kind: 'content-access-failure' });
    }
    return ok(`data:font/ttf;base64,${await font.base64()}`);
  } catch {
    return err({ kind: 'content-access-failure' });
  }
}

function ensureRendererCache(): void {
  const directory = new Directory(rendererCacheUri);
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
}

function clearRendererCacheDirectory(): void {
  const directory = new Directory(rendererCacheUri);
  if (directory.exists) {
    directory.delete();
  }
}

function clearRendererCacheDirectoryQuietly(): void {
  try {
    clearRendererCacheDirectory();
  } catch {
    // The original content-access error remains the actionable failure.
  }
}
