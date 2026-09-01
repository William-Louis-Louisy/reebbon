import { openReebbonDatabase } from './database/expo-sqlite-connection';
import { ExpoBookContentStore } from './filesystem/expo-book-content-store';
import {
  initializeLocalStorageWithDependencies,
  type LocalStorage,
  type LocalStorageInitializationError,
} from './local-storage-core';
import type { Result } from '../domain';

export type {
  LocalStorage,
  LocalStorageDependencies,
  LocalStorageInitializationError,
} from './local-storage-core';

export function initializeLocalStorage(): Promise<
  Result<LocalStorage, LocalStorageInitializationError>
> {
  return initializeLocalStorageWithDependencies({
    openDatabase: openReebbonDatabase,
    contentStore: new ExpoBookContentStore(),
  });
}
