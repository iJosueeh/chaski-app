/**
 * Wizard — Paso 3 de 5: PRESUPUESTO (completo, según Figma).
 *
 * Estructura del frame "Presupuesto (Con Cancelación)":
 * monto grande en Cinzel (S/XX) + slider (S/0 - S/200, paso S/5)
 * + chips de monto rápido + CTA CONTINUAR.
 *
 * Lógica: S/0 es válido (museos gratis); el motor usará este valor como
 * tope de la suma de entradas de las paradas del plan.
 */
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';

const MAX = 200;
const PASO = 5;

const CHIPS = [20, 50, 100, 200];

export default function WizardPresupuesto() {
  const theme = useTheme();
  const { request, setPresupuesto } = useWizard();

  const [monto, setMonto] = useState<number>(request.presupuesto ?? 50);

  const seguir = () => {
    setPresupuesto(monto);
    router.push('/wizard/intereses');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <WizardTopBar
          onBack={() => router.back()}
          onCancel={() => {
            router.dismissAll();
            router.back();
          }}
        />
        <TocapuStrip />
        <View style={styles.block}>
          <WizardHeading
            title="¿Cuánto quieres gastar?"
            subtitle="Tu tope de gasto para todo el plan"
          />
        </View>

        {/* Monto grande */}
        <View style={styles.montoWrap}>
          <Text style={[styles.montoKicker, { color: theme.primary }]}>PRESUPUESTO TOTAL</Text>
          <Text style={[styles.monto, { color: theme.brand }]}>S/ {monto}</Text>
          <Text style={[styles.montoNota, { color: theme.textSecondary }]}>
            {monto === 0 ? 'Solo experiencias gratuitas' : `Hasta ${Math.floor(monto / 10)} paradas con entrada S/10 aprox.`}
          </Text>
        </View>

        {/* Slider */}
        <View style={styles.sliderWrap}>
          <Slider
            minimumValue={0}
            maximumValue={MAX}
            step={PASO}
            value={monto}
            onValueChange={setMonto}
            minimumTrackTintColor={theme.carmine}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.carmine}
          />
          <View style={styles.escalaRow}>
            <Text style={[styles.escala, { color: theme.textSecondary }]}>S/0</Text>
            <Text style={[styles.escala, { color: theme.textSecondary }]}>S/{MAX}</Text>
          </View>
        </View>

        {/* Chips de monto rápido */}
        <View style={styles.chipsRow}>
          <Text style={[styles.chipsLabel, { color: theme.primary }]}>ACCESO RÁPIDO:</Text>
          {CHIPS.map((v) => {
            const activo = monto === v;
            return (
              <TouchableOpacity key={v} activeOpacity={0.8} onPress={() => setMonto(v)}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activo ? theme.brand : theme.surface,
                      borderColor: theme.brand,
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: activo ? theme.surface : theme.brand }]}>
                    S/{v}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.btnWrap}>
          <WizardButton label="CONTINUAR" onPress={seguir} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <StepIndicator step={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 16 },
  montoWrap: { alignItems: 'center', marginTop: 20 },
  montoKicker: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
  },
  monto: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 52,
    lineHeight: 64,
    marginTop: 4,
  },
  montoNota: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  sliderWrap: { paddingHorizontal: 24, marginTop: 24 },
  escalaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  escala: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  chipsLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    letterSpacing: 1,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
