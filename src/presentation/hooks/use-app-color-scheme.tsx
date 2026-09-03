import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { AppColorSchemePreferenceService } from '@/application';
import {
  defaultAppColorScheme,
  type AppColorScheme,
} from '@/domain';

export type AppColorSchemePersistenceOperation = 'load' | 'save';

interface AppColorSchemeContextValue {
  readonly colorScheme: AppColorScheme;
  readonly isPersisting: boolean;
  readonly selectColorScheme: (colorScheme: AppColorScheme) => void;
}

type AppColorSchemeProviderProps = PropsWithChildren<{
  readonly preferences: Pick<
    AppColorSchemePreferenceService,
    'load' | 'save'
  >;
  readonly onPersistenceError: (
    operation: AppColorSchemePersistenceOperation,
  ) => void;
}>;

const AppColorSchemeContext =
  createContext<AppColorSchemeContextValue | null>(null);

export function AppColorSchemeProvider({
  children,
  onPersistenceError,
  preferences,
}: AppColorSchemeProviderProps) {
  const [colorScheme, setColorScheme] =
    useState<AppColorScheme>(defaultAppColorScheme);
  const [isReady, setIsReady] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let active = true;

    void preferences
      .load()
      .then((loaded) => {
        if (!active) {
          return;
        }
        if (loaded.ok) {
          setColorScheme(loaded.value);
        } else {
          onPersistenceError('load');
        }
      })
      .catch(() => {
        if (active) {
          onPersistenceError('load');
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
      isMounted.current = false;
    };
  }, [onPersistenceError, preferences]);

  const selectColorScheme = (nextColorScheme: AppColorScheme) => {
    if (nextColorScheme === colorScheme) {
      return;
    }

    setColorScheme(nextColorScheme);
    setPendingWrites((current) => current + 1);
    void preferences
      .save(nextColorScheme)
      .then((saved) => {
        if (!saved.ok && isMounted.current) {
          onPersistenceError('save');
        }
      })
      .catch(() => {
        if (isMounted.current) {
          onPersistenceError('save');
        }
      })
      .finally(() => {
        if (isMounted.current) {
          setPendingWrites((current) => Math.max(0, current - 1));
        }
      });
  };

  if (!isReady) {
    return null;
  }

  return (
    <AppColorSchemeContext.Provider
      value={{
        colorScheme,
        isPersisting: pendingWrites > 0,
        selectColorScheme,
      }}>
      {children}
    </AppColorSchemeContext.Provider>
  );
}

export function useAppColorScheme(): AppColorScheme {
  return useAppColorSchemePreference().colorScheme;
}

export function useAppColorSchemePreference(): AppColorSchemeContextValue {
  const value = useContext(AppColorSchemeContext);
  if (value === null) {
    throw new Error(
      'useAppColorSchemePreference must be used within AppColorSchemeProvider',
    );
  }
  return value;
}
