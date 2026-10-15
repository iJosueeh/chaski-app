/**
 * Wizard — Paso 1 de 5: UBICACIÓN.
 * Frame del Figma: "Ubicación (Paso 1) - Con Cancelación".
 */
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TicketCard,
  TocapuStrip,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

const SEARCH_LOCATION_ENABLED = false;

export default function WizardUbicacion() {
  const insets = useSafeAreaInsets();
  const { setUbicacion } = useWizard();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cancelar = () => safeCancelWizard();
  const volver = () => safeBackWizard('/(tabs)');

  /** GPS: pide permiso y toma la primera fix (watchPosition, patrón robusto en emuladores). */
  const usarGps = async () => {
    setBusy(true);
    setErrorMsg('');
    let sub: Location.LocationSubscription | null = null;
    const timeout = setTimeout(() => {
      if (sub) sub.remove();
      setBusy(false);
      setErrorMsg('El GPS tardó demasiado. Intenta de nuevo.');
    }, 10000);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(timeout);
        setBusy(false);
        setErrorMsg(
          'Permiso de ubicación denegado. Actívalo en Ajustes e inténtalo de nuevo.',
        );
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Low, timeInterval: 1000, distanceInterval: 1 },
        (pos) => {
          if (sub) sub.remove();
          sub = null;
          clearTimeout(timeout);
          setBusy(false);
          setUbicacion({
            modo: 'gps',
            nombre: 'Mi ubicación actual',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          router.push('/wizard/tiempo');
        },
      );
    } catch {
      clearTimeout(timeout);
      setBusy(false);
      setErrorMsg('No pudimos obtener tu ubicación. Intenta de nuevo o busca manualmente.');
    }
  };

  /** Búsqueda manual: abre el mapa estilo Uber/InDrive para elegir el punto. */
  const buscar = () => {
    router.push('/wizard/mapa');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar onBack={volver} onCancel={cancelar} />
      <TocapuStrip />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingBlock}>
          <WizardHeading
            title="¿Desde dónde empiezas?"
            subtitle="Selecciona tu punto de partida"
          />
        </View>

        <View style={styles.cardsWrap}>
          <TicketCard
            title="Usar mi ubicación"
            subtitle="Precisión alta basada en GPS"
            folio="GPS-001"
            stamp="ORIGEN"
            selected={!busy}
            onPress={usarGps}
          />
          {SEARCH_LOCATION_ENABLED && (
            <TicketCard
              title="Buscar mi ubicación"
              subtitle="Ingresa una dirección o lugar"
              folio="BUSQ-002"
              stamp="ORIGEN"
              onPress={buscar}
            />
          )}
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={palette.primary} />
            <Text style={[styles.busyText, { color: palette.textSecondary }]}>
              Obteniendo tu ubicación…
            </Text>
          </View>
        ) : null}
        {errorMsg ? (
          <Text style={[styles.errorText, { color: palette.burgundy }]}>{errorMsg}</Text>
        ) : null}

        {SEARCH_LOCATION_ENABLED && (
          <View
            style={[styles.mapHint, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.mapHintText, { color: palette.textSecondary }]}>
              🗺️ Toca «Buscar mi ubicación» para elegir tu punto en un mapa interactivo
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          },
        ]}
      >
        <StepIndicator step={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: {
    paddingBottom: 24,
  },
  headingBlock: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  cardsWrap: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 16,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  busyText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  errorText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  mapHint: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  mapHintText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
