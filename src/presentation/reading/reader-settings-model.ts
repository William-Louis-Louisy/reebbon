import type { ReaderCapabilities } from '@/domain';

export type ReaderSettingsSection =
  | 'reading-theme'
  | 'font-customization'
  | 'layout-customization'
  | 'reading-direction';

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
  if (capabilities.configurableReadingDirection) {
    sections.push('reading-direction');
  }

  return sections;
}
