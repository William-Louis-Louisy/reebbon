import {
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Literata_400Regular,
  Literata_500Medium,
  Literata_600SemiBold,
  Literata_700Bold,
} from '@expo-google-fonts/literata';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import { useFonts } from 'expo-font';

import { runtimeFontFamilies } from './design-system';

export const offlineFontFamilies = runtimeFontFamilies;

const offlineFontMap = {
  [offlineFontFamilies.displayMedium]: Fraunces_500Medium,
  [offlineFontFamilies.displaySemiBold]: Fraunces_600SemiBold,
  [offlineFontFamilies.displayItalic]: Fraunces_400Regular_Italic,
  [offlineFontFamilies.uiRegular]: PublicSans_400Regular,
  [offlineFontFamilies.uiMedium]: PublicSans_500Medium,
  [offlineFontFamilies.uiSemiBold]: PublicSans_600SemiBold,
  [offlineFontFamilies.uiBold]: PublicSans_700Bold,
  [offlineFontFamilies.readingRegular]: Literata_400Regular,
  [offlineFontFamilies.readingMedium]: Literata_500Medium,
  [offlineFontFamilies.readingSemiBold]: Literata_600SemiBold,
  [offlineFontFamilies.readingBold]: Literata_700Bold,
  [offlineFontFamilies.monoRegular]: IBMPlexMono_400Regular,
  [offlineFontFamilies.monoMedium]: IBMPlexMono_500Medium,
} as const;

export function useOfflineFonts() {
  return useFonts(offlineFontMap);
}
