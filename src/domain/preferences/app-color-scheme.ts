export type AppColorScheme = 'light' | 'dark';

export const defaultAppColorScheme: AppColorScheme = 'light';

export function isAppColorScheme(value: unknown): value is AppColorScheme {
  return value === 'light' || value === 'dark';
}
