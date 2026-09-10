/**
 * Wizard — Paso 1 de 5: UBICACIÓN.
 * Frame del Figma: "Ubicación (Paso 1) - Con Cancelación".
 * Dos tarjetas-ticket: "Usar mi ubicación" (GPS) y "Buscar una ubicación".
 */
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TicketCard,
  TocapuStrip,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';

export default function WizardUbicacion() {
  const theme = useTheme();
  const { setUbicacion } = useWizard();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cancelar = () => {
    router.dismissAll();
    router.back();
  };

  const volver = () => router.back();

  /** GPS: pide permiso y toma la primera fix (watchPosition, patrón robusto en emuladores). */
  const usarGps = async () => {
    setBusy(true);
    setErrorMsg('');
    let sub: Location.LocationSubscription | null = null;
    const timeout = setTimeout(() => {
      if (sub) sub.remove();
      setBusy(false);
      setErrorMsg('El GPS tardó demasiado. Intenta de nuevo o elige "Buscar una ubicación".');
    }, 10000);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(timeout);
        setBusy(false);
        setErrorMsg(
          'Permiso de ubicación denegado. Actívalo en ajustes o elige "Buscar una ubicación".',
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
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <WizardTopBar onBack={volver} onCancel={cancelar} />
        <TocapuStrip />
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
          <TicketCard
            title="Buscar mi ubicación"
            subtitle="Ingresa una dirección o lugar"
            folio="BUSQ-002"
            stamp="ORIGEN"
            onPress={buscar}
          />
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.busyText, { color: theme.textSecondary }]}>
              Obteniendo tu ubicación…
            </Text>
          </View>
        ) : null}
        {errorMsg ? (
          <Text style={[styles.errorText, { color: theme.carmine }]}>{errorMsg}</Text>
        ) : null}

        <View style={styles.mapHint}>
          <Text style={[styles.mapHintText, { color: theme.textSecondary }]}>
            🗺️ Toca «Buscar mi ubicación» para elegir tu punto en un mapa interactivo
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background }]}>
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
    paddingTop: 16,
  },
  cardsWrap: {
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 20,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  busyText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
  },
  errorText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  mapHint: {
    alignItems: 'center',
    marginTop: 24,
  },
  mapHintText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
