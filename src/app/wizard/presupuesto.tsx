/**
 * Wizard — Paso 3 de 5: PRESUPUESTO (Serie AX).
 *
 * Estructura del frame "Presupuesto":
 * monto grande en Cinzel (S/XX) + slider (S/0 - S/200, paso S/5)
 * + chips de monto rápido + CTA CONTINUAR.
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

const MAX = 200;
const PASO = 5;
const CHIPS = [20, 50, 100, 200];

export default function WizardPresupuesto() {
  const insets = useSafeAreaInsets();
  const { request, setPresupuesto } = useWizard();

  const [monto, setMonto] = useState<number>(request.presupuesto ?? 50);

  const seguir = () => {
    setPresupuesto(monto);
    router.push('/wizard/intereses');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/tiempo')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <WizardHeading
            title="¿Cuánto quieres gastar?"
            subtitle="Tu tope de gasto estimado para la ruta"
          />
        </View>

        {/* Monto grande */}
        <View style={[styles.montoWrap, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.montoKicker, { color: palette.primary }]}>PRESUPUESTO TOTAL</Text>
          <Text style={[styles.monto, { color: palette.brand }]}>S/ {monto}</Text>
          <Text style={[styles.montoNota, { color: palette.textSecondary }]}>
            {monto === 0
              ? 'Solo experiencias gratuitas'
              : `Hasta ${Math.floor(monto / 10)} paradas con entrada aproximada`}
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
            minimumTrackTintColor={palette.burgundy}
            maximumTrackTintColor={palette.border}
            thumbTintColor={palette.primary}
          />
          <View style={styles.escalaRow}>
            <Text style={[styles.escala, { color: palette.textSecondary }]}>S/0</Text>
            <Text style={[styles.escala, { color: palette.textSecondary }]}>S/{MAX}</Text>
          </View>
        </View>

        {/* Chips de monto rápido */}
        <View style={styles.chipsRow}>
          <Text style={[styles.chipsLabel, { color: palette.primary }]}>ACCESO RÁPIDO:</Text>
          <View style={styles.chipsGroup}>
            {CHIPS.map((v) => {
              const activo = monto === v;
              return (
                <TouchableOpacity
                  key={v}
                  activeOpacity={0.8}
                  onPress={() => setMonto(v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Presupuesto S/${v}`}
                >
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo ? palette.brand : palette.surface,
                        borderColor: activo ? palette.brand : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: activo ? palette.surface : palette.brand },
                      ]}
                    >
                      S/{v}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.btnWrap}>
          <WizardButton label="CONTINUAR" onPress={seguir} />
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
        <StepIndicator step={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 14 },
  montoWrap: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  montoKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  monto: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    fontWeight: '700',
  },
  montoNota: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 2,
  },
  sliderWrap: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  escalaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  escala: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  chipsRow: {
    paddingHorizontal: 20,
    marginTop: 18,
    gap: 8,
  },
  chipsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chipsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 6 },
});
