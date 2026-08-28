import { useEffect, useState } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

import type { AppColorScheme } from '@/shared/theme';

export function useAppColorScheme(): AppColorScheme {
  const [hasHydrated, setHasHydrated] = useState(false);
  const nativeColorScheme = useNativeColorScheme();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setHasHydrated(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  return nativeColorScheme === 'dark' ? 'dark' : 'light';
}
