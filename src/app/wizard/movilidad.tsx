/**
 * Wizard — Paso 5 de 5: MOVILIDAD (stub funcional).
 * Último paso: al continuar, el wizard queda completo (request listo para
 * el motor de planes, que es la siguiente fase).
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';

const OPCIONES = [
  { id: 'caminando', label: 'Caminando', sub: 'Rutas cortas, a pie' },
  { id: 'publico', label: 'Transporte público', sub: 'Metropolitano, buses' },
  { id: 'aplicativo', label: 'Taxi / aplicativo', sub: 'Más rápido, más caro' },
] as const;

export default function WizardMovilidad() {
  const theme = useTheme();
  const { request, setMovilidad } = useWizard();
  const sel = request.movilidad;

  /** Recomendación según el tiempo disponible definido en el Paso 2:
   *  ≤2h caminando, 2-5h transporte público, >5h aplicativo. */
  const recomendado = useMemo<string | null>(() => {
    const min = request.minutosTotales;
    if (!min) return null;
    if (min <= 120) return 'caminando';
    if (min <= 300) return 'publico';
    return 'aplicativo';
  }, [request.minutosTotales]);

  const seguir = () => {
    // El wizard queda completo: el motor genera los 3 planes (Buscando → Resultados).
    router.push('/plan/buscando');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <WizardTopBar onBack={() => router.back()} onCancel={() => { router.dismissAll(); router.back(); }} />
        <TocapuStrip />
        <View style={styles.block}>
          <WizardHeading
            title="¿Cómo te mueves?"
            subtitle="Elige tu movilidad preferida"
          />
        </View>
        <View style={styles.opsWrap}>
          {OPCIONES.map((op) => {
            const active = sel === op.id;
            const esRecomendado = recomendado === op.id;
            return (
              <TouchableOpacity
                key={op.id}
                activeOpacity={0.85}
                onPress={() => setMovilidad(op.id)}>
                <View
                  style={[
                    styles.op,
                    {
                      backgroundColor: theme.surface,
                      borderColor: active ? theme.carmine : theme.brand,
                      borderWidth: active ? 2 : 1.5,
                    },
                  ]}>
                  {esRecomendado ? (
                    <View style={[styles.recomendadoBadge, { backgroundColor: theme.accent }]}>
                      <Text style={[styles.recomendadoTexto, { color: theme.brand }]}>
                        RECOMENDADO
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.opTitle, { color: theme.brand }]}>{op.label}</Text>
                  <Text style={[styles.opSub, { color: theme.textSecondary }]}>{op.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.btnWrap}>
          <WizardButton
            label="ENCONTRAR PLANES"
            onPress={seguir}
            disabled={!sel}
          />
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <StepIndicator step={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 16 },
  opsWrap: { paddingHorizontal: 20, gap: 12, marginTop: 20 },
  op: {
    padding: 16,
    borderRadius: 4,
  },
  recomendadoBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    marginBottom: 6,
  },
  recomendadoTexto: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 8,
    letterSpacing: 1,
  },
  opTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
  },
  opSub: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    marginTop: 4,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
