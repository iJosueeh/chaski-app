import { useFonts } from 'expo-font';
import { Cinzel_400Regular, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { useFonts as usePlatypi, Platypi_600SemiBold } from '@expo-google-fonts/platypi';

const FONTS = {
  Cinzel_400Regular,
  Cinzel_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

export function useAppFonts(): boolean {
  const [mainLoaded] = useFonts(FONTS);
  const [platypiLoaded] = usePlatypi({ Platypi_600SemiBold });
  return mainLoaded && platypiLoaded;
}
