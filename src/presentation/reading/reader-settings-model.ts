import type { ReaderCapabilities } from '@/domain';

export type ReaderSettingsSection =
  | 'reading-theme'
  | 'font-customization'
  | 'layout-customization';

export function getReaderSettingsSections(
  capabilities: ReaderCapabilities,
): readonly ReaderSettingsSection[] {
  const sections: ReaderSettingsSection[] = [];

  if (capabilities.readingThemeCustomization) {
    sections.push('reading-theme');
  }
  if (capabilities.fontCustomization) {
    sections.push('font-customization');
  }
  if (capabilities.layoutCustomization) {
    sections.push('layout-customization');
  }

  return sections;
}
