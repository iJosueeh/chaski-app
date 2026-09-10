/**
 * "Buscando planes..." — pantalla de carga con mensajes animados.
 * Al terminar: corre el motor y navega a Resultados con los 3 planes.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import { generarPlanes } from '@/features/plan-engine/plan-engine';
import { getActivePlaces } from '@/features/places/services/places.service';
import { TocapuStrip, WizardTopBar } from '@/features/wizard/components/wizard-ui';

const MENSAJES = [
  'Buscando planes para ti…',
  'Buscando lugares compatibles…',
  'Calculando rutas y tiempos…',
  'Ajustando a tu presupuesto…',
  'Dando los toques finales…',
];

export default function BuscandoPlanes() {
  const theme = useTheme();
  const { request } = useWizard();
  const [msgIdx, setMsgIdx] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const rot = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, MENSAJES.length - 1));
    }, 900);

    (async () => {
      const t0 = Date.now();
      const { data: lugares } = await getActivePlaces();
      const planes = lugares ? generarPlanes(request, lugares) : [];
      // dar al menos 2.5s de animación para que se sienta el "buscando"
      const wait = Math.max(0, 2500 - (Date.now() - t0));
      setTimeout(() => {
        if (done.current) return;
        done.current = true;
        clearInterval(rot);
        router.replace({
          pathname: '/plan/resultados',
          params: { planes: JSON.stringify(planes) },
        });
      }, wait);
    })();

    return () => {
      clearInterval(rot);
      done.current = true;
    };
  }, [request]);

  return (
    <ThemedView style={styles.canvas}>
      <WizardTopBar
        onBack={() => router.back()}
        onCancel={() => {
          router.dismissAll();
          router.back();
        }}
      />
      <TocapuStrip />
      <View style={styles.center}>
        {/* Sello girando (Simple: 2 aros dorados) */}
        <View style={[styles.sello, { borderColor: theme.accent }]} />
        <View style={[styles.selloInner, { borderColor: theme.primary }]} />
        <Text style={[styles.msg, { color: theme.brand }]}>{MENSAJES[msgIdx]}</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          SERIE AX · EL MOTOR DE EXPERIENCIAS
        </Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  sello: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  selloInner: {
    position: 'absolute', width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, opacity: 0.6,
  },
  msg: {
    fontFamily: 'Cinzel_700Bold', fontSize: 18, textAlign: 'center',
    paddingHorizontal: 32,
  },
  sub: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 9, letterSpacing: 2,
  },
});
