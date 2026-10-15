/**
 * Wizard — Paso 5 de 5: MOVILIDAD (Serie AX).
 * Último paso: al continuar, navega a /plan/buscando para generar los planes.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

const OPCIONES = [
  { id: 'caminando', label: 'Caminando', sub: 'Rutas a pie, ritmo pausado' },
  { id: 'publico', label: 'Transporte público', sub: 'Metropolitano y corredores' },
  { id: 'aplicativo', label: 'Taxi / aplicativo', sub: 'Mayor alcance y rapidez' },
] as const;

export default function WizardMovilidad() {
  const insets = useSafeAreaInsets();
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
    router.push('/plan/buscando');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/intereses')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <WizardHeading
            title="¿Cómo te mueves?"
            subtitle="Elige tu medio de desplazamiento preferido"
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
                onPress={() => setMovilidad(op.id)}
                accessibilityRole="button"
                accessibilityLabel={`${op.label}, ${op.sub}${esRecomendado ? ', recomendado' : ''}`}
              >
                <View
                  style={[
                    styles.op,
                    {
                      backgroundColor: palette.surface,
                      borderColor: active ? palette.primary : palette.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  {esRecomendado ? (
                    <View style={[styles.recomendadoBadge, { backgroundColor: palette.accent }]}>
                      <Text style={[styles.recomendadoTexto, { color: palette.brand }]}>
                        RECOMENDADO
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.opTitle, { color: palette.brand }]}>{op.label}</Text>
                  <Text style={[styles.opSub, { color: palette.textSecondary }]}>{op.sub}</Text>
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

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          },
        ]}
      >
        <StepIndicator step={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 14 },
  opsWrap: { paddingHorizontal: 20, gap: 12, marginTop: 18 },
  op: {
    padding: 16,
    borderRadius: 8,
  },
  recomendadoBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginBottom: 6,
  },
  recomendadoTexto: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  opTitle: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  opSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginTop: 3,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 6 },
});
