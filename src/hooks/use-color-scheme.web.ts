import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * Web: return 'light' on server/static render, the real scheme once hydrated
 * on the client. useSyncExternalStore avoids setState-in-effect (React 19 lint).
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,   // client snapshot
    () => false,  // server snapshot
  );

  if (!hydrated) return 'light';
  return colorScheme === 'unspecified' ? 'light' : colorScheme;
}
