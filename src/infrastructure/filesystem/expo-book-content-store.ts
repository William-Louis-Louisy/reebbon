import { ExpoFileSystemGateway } from './expo-file-system-gateway';
import { LocalBookContentStore } from './local-book-content-store';

export class ExpoBookContentStore extends LocalBookContentStore {
  public constructor() {
    super(new ExpoFileSystemGateway());
  }
}
