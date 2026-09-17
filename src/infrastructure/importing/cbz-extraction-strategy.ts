export type CbzExtractionStrategy = 'native' | 'javascript' | 'unavailable';

export function selectCbzExtractionStrategy(
  platform: string,
  nativeModuleAvailable: boolean,
): CbzExtractionStrategy {
  if (platform !== 'android') {
    return 'javascript';
  }
  return nativeModuleAvailable ? 'native' : 'unavailable';
}
